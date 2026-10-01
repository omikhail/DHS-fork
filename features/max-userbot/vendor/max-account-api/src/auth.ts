import qrTerminal from 'qrcode-terminal';
import { Opcode } from './opcodes.js';
import type { Transport } from './transport.js';
import type { RawTransport } from './raw-transport.js';

/** Transport that can speak the mobile binary protocol (phone-auth). */
type PhoneAuthTransport = RawTransport;
import type {
  PhoneAuthStartRequest,
  PhoneAuthStartResponse,
  PhoneAuthVerifyRequest,
  PhoneAuthVerifyResponse,
  AuthEmailSendCodeRequest,
  AuthEmailSendCodeResponse,
  AuthEmailVerifyCodeRequest,
  AuthEmailVerifyCodeResponse,
  AuthPasswordCommitRequest,
  AuthPasswordHintRequest,
  AuthPasswordInfoRequest,
  AuthPasswordInfoResponse,
  AuthPasswordValidateRequest,
  AuthPasswordVerifyRequest,
  AuthPasswordVerifyResponse,
  AuthQrPasswordLoginRequest,
  AuthQrPasswordLoginResponse,
  AuthTrackStartRequest,
  AuthTrackStartResponse,
  HelloRequest,
  HelloResponse,
  LoginResponse,
  PasswordChallenge,
  QrLoginResponse,
  QrPollResponse,
  QrStartResponse,
  UserAgent,
} from './types.js';

export const DEFAULT_USER_AGENT: UserAgent = {
  deviceType: 'WEB',
  locale: 'ru',
  deviceLocale: 'ru',
  osVersion: 'macOS',
  deviceName: 'Chrome',
  headerUserAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
  appVersion: '26.32.1',
  screen: '720x1280 1.0x',
  timezone: 'Europe/Moscow',
};

export interface QrEmitter {
  emitQr(info: { link: string; expiresAt: number }): void;
  printToTerminal: boolean;
  /**
   * Called when the QR scan succeeds but the account has 2FA cloud password
   * enabled — caller must return the password (string) or `null` to abort.
   * If absent, `loginViaQr` throws when 2FA is required.
   */
  resolvePassword?: (challenge: PasswordChallenge) => Promise<string | null>;
}

function formatExpiry(expiresAt: number): { local: string; inSec: number } {
  const ms = expiresAt - Date.now();
  const inSec = Math.max(0, Math.round(ms / 1000));
  const d = new Date(expiresAt);
  const local = d.toLocaleString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });
  return { local, inSec };
}

export async function hello(
  transport: Transport,
  deviceId: string,
  userAgent: UserAgent = DEFAULT_USER_AGENT,
): Promise<HelloResponse> {
  const req: HelloRequest = { userAgent, deviceId };
  return transport.request<HelloResponse>(Opcode.HELLO, req);
}

/**
 * Run QR login flow:
 *  1. opcode 288 → get qrLink + trackId + pollingInterval
 *  2. emit qrLink to user (terminal QR + event)
 *  3. poll opcode 289 with trackId until loginAvailable=true or expiry
 *  4. opcode 291 → returns LOGIN token + profile
 */
export async function loginViaQr(
  transport: Transport,
  emitter: QrEmitter,
): Promise<QrLoginResponse> {
  const start = await transport.request<QrStartResponse>(Opcode.QR_START);
  emitter.emitQr({ link: start.qrLink, expiresAt: start.expiresAt });
  if (emitter.printToTerminal) {
    qrTerminal.generate(start.qrLink, { small: true });
    const { local, inSec } = formatExpiry(start.expiresAt);
    // eslint-disable-next-line no-console
    console.log(
      `\n[max-account-api] Отсканируйте QR или откройте ссылку:\n  ${start.qrLink}\n` +
        `Код истечёт через ${inSec} с (в ${local}).\n`,
    );
  }

  const interval = Math.max(1000, start.pollingInterval ?? 5000);
  const deadline = start.expiresAt;

  while (Date.now() < deadline) {
    const poll = await transport.request<QrPollResponse>(Opcode.QR_POLL, {
      trackId: start.trackId,
    });
    if (poll.status?.loginAvailable) {
      const res = await transport.request<QrLoginResponse>(Opcode.QR_LOGIN, {
        trackId: start.trackId,
      });
      // Account with 2FA cloud password: tokenAttrs is `{}`, passwordChallenge is set.
      if (!res.tokenAttrs?.LOGIN && res.passwordChallenge) {
        if (!emitter.resolvePassword) {
          throw new Error(
            'Аккаунт защищён облачным паролем (2FA). Передайте `resolvePassword` в loginViaQr или используйте `client.completeQrPasswordLogin`.',
          );
        }
        const pw = await emitter.resolvePassword(res.passwordChallenge);
        if (pw === null || pw === undefined) {
          throw new Error('2FA-пароль не предоставлен — вход отменён.');
        }
        const final = await transport.request<AuthQrPasswordLoginResponse>(
          Opcode.AUTH_QR_PASSWORD_LOGIN,
          { trackId: res.passwordChallenge.trackId, password: pw } satisfies AuthQrPasswordLoginRequest,
        );
        return {
          tokenAttrs: final.tokenAttrs,
          ...(final.profile ? { profile: final.profile } : {}),
        };
      }
      return res;
    }
    await sleep(interval);
  }
  if (emitter.printToTerminal) {
    // eslint-disable-next-line no-console
    console.log('\n[max-account-api] QR-код истёк. Перезапустите скрипт.\n');
  }
  throw new Error('QR-код истёк до сканирования. Перезапустите скрипт.');
}

/**
 * Submit login token (received from QR or persisted from previous session)
 * to obtain full app state (profile, chats, contacts, config).
 */
export async function loginWithToken(
  transport: Transport,
  token: string,
  opts: { chatsCount?: number; interactive?: boolean } = {},
): Promise<LoginResponse> {
  return transport.request<LoginResponse>(Opcode.LOGIN, {
    token,
    chatsCount: opts.chatsCount ?? 40,
    interactive: opts.interactive ?? true,
    chatsSync: 0,
    contactsSync: 0,
    presenceSync: -1,
    draftsSync: 0,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// --------------------------------------------------------------------------
// Cloud-password / email auth track (ops 104, 107–113)
// --------------------------------------------------------------------------

/** Op 112: open a fresh auth track. Returns `trackId` used by all `auth*` ops. */
export async function startAuthTrack(
  transport: Transport,
  type = 0,
): Promise<AuthTrackStartResponse> {
  return transport.request<AuthTrackStartResponse>(Opcode.AUTH_TRACK_START, {
    type,
  } satisfies AuthTrackStartRequest);
}

/** Op 104: returns whether 2FA is set on the account and the recovery email (if any). */
export async function getPasswordInfo(
  transport: Transport,
  trackId: string,
): Promise<AuthPasswordInfoResponse> {
  return transport.request<AuthPasswordInfoResponse>(Opcode.AUTH_PASSWORD_INFO, {
    trackId,
  } satisfies AuthPasswordInfoRequest);
}

/** Op 107: pre-flight password strength check. Throws server `password.invalid` for weak. */
export async function validatePassword(
  transport: Transport,
  trackId: string,
  password: string,
): Promise<void> {
  await transport.request(Opcode.AUTH_PASSWORD_VALIDATE, {
    trackId,
    password,
  } satisfies AuthPasswordValidateRequest);
}

/** Op 108: stash the password hint (shown later as a reminder). */
export async function setPasswordHint(
  transport: Transport,
  trackId: string,
  hint: string,
): Promise<void> {
  await transport.request(Opcode.AUTH_PASSWORD_HINT, {
    trackId,
    hint,
  } satisfies AuthPasswordHintRequest);
}

/** Op 109: ask the server to email a verification code to `email`. */
export async function sendEmailCode(
  transport: Transport,
  trackId: string,
  email: string,
): Promise<AuthEmailSendCodeResponse> {
  return transport.request<AuthEmailSendCodeResponse>(Opcode.AUTH_EMAIL_SEND_CODE, {
    trackId,
    email,
  } satisfies AuthEmailSendCodeRequest);
}

/** Op 110: confirm the code mailed by `sendEmailCode`. */
export async function verifyEmailCode(
  transport: Transport,
  trackId: string,
  verifyCode: string,
): Promise<AuthEmailVerifyCodeResponse> {
  return transport.request<AuthEmailVerifyCodeResponse>(Opcode.AUTH_EMAIL_VERIFY_CODE, {
    trackId,
    verifyCode,
  } satisfies AuthEmailVerifyCodeRequest);
}

/**
 * Op 111: commit a 2FA cloud password change.
 *  - to ENABLE: `{password, hint, expectedCapabilities:[0,3,4]}` after a verified
 *    email track (ops 109/110 done).
 *  - to DISABLE: `{remove2fa:true, expectedCapabilities:[5]}` after `verifyPassword`.
 */
export async function commitPasswordChange(
  transport: Transport,
  req: AuthPasswordCommitRequest,
): Promise<void> {
  await transport.request(Opcode.AUTH_PASSWORD_COMMIT, req);
}

/** Op 113: prove ownership of the account with the existing 2FA password. */
export async function verifyPassword(
  transport: Transport,
  trackId: string,
  password: string,
): Promise<AuthPasswordVerifyResponse> {
  return transport.request<AuthPasswordVerifyResponse>(Opcode.AUTH_PASSWORD_VERIFY, {
    trackId,
    password,
  } satisfies AuthPasswordVerifyRequest);
}

/** Op 115: exchange a `passwordChallenge.trackId` + 2FA password for a LOGIN token. */
export async function completeQrPasswordLogin(
  transport: Transport,
  trackId: string,
  password: string,
): Promise<AuthQrPasswordLoginResponse> {
  return transport.request<AuthQrPasswordLoginResponse>(Opcode.AUTH_QR_PASSWORD_LOGIN, {
    trackId,
    password,
  } satisfies AuthQrPasswordLoginRequest);
}

/** Op 20: invalidate the current login token server-side. */
export async function logout(transport: Transport): Promise<void> {
  await transport.request(Opcode.LOGOUT);
}

// --------------------------------------------------------------------------
// Phone auth (ops 17, 18) — Android mobile flow
// --------------------------------------------------------------------------

/**
 * Op 17: request an SMS verification code.
 *
 * IMPORTANT: this op is **mobile-only**. The web WebSocket endpoint refuses
 * `userAgent.deviceType:'ANDROID'` with close code 1008 ("deviceType forbidden"),
 * and a WEB hello returns `phone-auth-enabled:false`. You must use
 * `RawTransport` (TLS to `api.oneme.ru:443`) with an ANDROID/IOS userAgent.
 *
 * `type='START_AUTH'` for a fresh request; `type='RESEND'` to re-send.
 * Returns a short-lived `token` that must be passed to `verifyPhoneAuthCode`.
 */
export async function sendPhoneAuthCode(
  transport: PhoneAuthTransport,
  phone: string,
  type: 'START_AUTH' | 'RESEND' = 'START_AUTH',
): Promise<PhoneAuthStartResponse> {
  // Observed sub-type hints embedded by mobile client: 21 for START_AUTH, 17 for RESEND.
  const hint = type === 'START_AUTH' ? 21 : 17;
  return transport.request<PhoneAuthStartResponse>(
    Opcode.PHONE_AUTH_START,
    { type, phone } satisfies PhoneAuthStartRequest,
    { prependOpHint: hint },
  );
}

/**
 * Op 18: submit the SMS code received after `sendPhoneAuthCode`.
 * On success returns `tokenAttrs.LOGIN.token` (use with `loginWithToken`).
 * If 2FA cloud password is set, returns `passwordChallenge` instead — pass to
 * `completeQrPasswordLogin` (op 115, same shape as QR flow).
 * On wrong code the server throws `{error:'verify.code.wrong'}`.
 *
 * Mobile-only — see `sendPhoneAuthCode` for the transport requirement.
 */
export async function verifyPhoneAuthCode(
  transport: PhoneAuthTransport,
  verifyCode: string,
  token: string,
): Promise<PhoneAuthVerifyResponse> {
  // Mobile op 18 observed:
  //   header flags byte = 0x02
  //   body = msgpack int (-31) followed by map {verifyCode, token, type:'CHECK_CODE'}
  return transport.request<PhoneAuthVerifyResponse>(
    Opcode.PHONE_AUTH_VERIFY,
    { verifyCode, token, authTokenType: 'CHECK_CODE' } as PhoneAuthVerifyRequest,
    { prependOpHint: 0xad, flags: 1 },
  );
}
