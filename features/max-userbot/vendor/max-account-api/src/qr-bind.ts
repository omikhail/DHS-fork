import { randomUUID } from 'node:crypto';
import { Opcode } from './opcodes.js';
import { Transport } from './transport.js';
import { DEFAULT_USER_AGENT } from './auth.js';
import type { RawTransport } from './raw-transport.js';
import type {
  AuthQrPasswordLoginResponse,
  HelloResponse,
  LoginResponse,
  PasswordChallenge,
  QrLoginResponse,
  QrPollResponse,
  QrStartResponse,
  UserAgent,
} from './types.js';

export interface QrBindOptions {
  /** WS endpoint. Default `wss://ws-api.oneme.ru/websocket`. */
  wsUrl?: string;
  /** UA for the web side. Default = bundled WEB Chrome on macOS UA. */
  webUserAgent?: UserAgent;
  /**
   * Web-side `deviceId` UUID. Generated automatically if absent; pass an
   * existing one to maintain device identity across runs (so the WS token
   * issued here can be reused by a regular `MaxClient`).
   */
  webDeviceId?: string;
  /**
   * Resolver for the 2FA cloud-password challenge. Required when the account
   * has 2FA enabled — otherwise this function throws on the password step.
   */
  resolvePassword?: (challenge: PasswordChallenge) => Promise<string | null>;
  /** How many chats the final LOGIN (op 19) should preload. Default 40. */
  chatsCount?: number;
  /** Per-request timeout for the web WS in ms. Default 20_000. */
  requestTimeoutMs?: number;
}

export interface QrBindResult {
  /**
   * Web-bound LOGIN token. Persist this as `StoredSession.loginToken` and
   * pass to {@link import('./client.js').MaxClient} for subsequent runs.
   */
  webToken: string;
  /**
   * Web-side `deviceId` UUID used for HELLO/LOGIN. Persist this as
   * `StoredSession.deviceId` — the token is bound to it.
   */
  webDeviceId: string;
  /** Final `LoginResponse` (profile + chats + contacts + config). */
  loginResponse: LoginResponse;
}

/**
 * Bind a new **web** session using an already-authenticated **mobile** binary
 * transport. This is the headless equivalent of the in-app camera QR scan.
 *
 * Flow:
 *  1. open WS to `wss://ws-api.oneme.ru/websocket` → op 6 HELLO (`deviceType:'WEB'`)
 *  2. op 288 → server returns `{qrLink, trackId, ttl, pollingInterval}`
 *  3. **mobile** transport: op 290 with `{qrLink}` (the QR-confirm; same op as
 *     what the camera-scan path eventually invokes)
 *  4. web side: poll op 289 until `status.loginAvailable === true`
 *  5. web side: op 291 → either LOGIN token, or `passwordChallenge` if 2FA
 *  6. if 2FA: op 115 with the password → LOGIN token
 *  7. web side: op 19 LOGIN → full `LoginResponse`
 *
 * The returned `webToken` is the LOGIN token MaxClient (WS) expects.
 *
 * @param raw  An authenticated `RawTransport` — must have already passed
 *             `hello()` + `mobileLogin()` (or `sendPhoneAuthCode` →
 *             `verifyPhoneAuthCode` → `mobileLogin`). Op 290 fails without
 *             a logged-in mobile session.
 */
export async function qrBindWebSession(
  raw: RawTransport,
  opts: QrBindOptions = {},
): Promise<QrBindResult> {
  const wsUrl = opts.wsUrl ?? 'wss://ws-api.oneme.ru/websocket';
  const webDeviceId = opts.webDeviceId ?? randomUUID();
  const userAgent = opts.webUserAgent ?? DEFAULT_USER_AGENT;

  const ws = new Transport({
    url: wsUrl,
    headers: {
      'User-Agent': userAgent.headerUserAgent,
      Origin: 'https://web.max.ru',
    },
    ...(opts.requestTimeoutMs !== undefined ? { requestTimeoutMs: opts.requestTimeoutMs } : {}),
  });

  await ws.connect();
  try {
    // 1. HELLO (web side)
    await ws.request<HelloResponse>(Opcode.HELLO, { userAgent, deviceId: webDeviceId });

    // 2. QR_START — ask for a fresh trackId
    const qrStart = await ws.request<QrStartResponse>(Opcode.QR_START);

    // 3. Mobile side confirms the QR (op 290)
    await raw.confirmQrAuth(qrStart.qrLink);

    // 4. Long-poll op 289 until `loginAvailable` flips
    const pollIntervalMs = Math.max(1_000, qrStart.pollingInterval ?? 2_000);
    const deadline = qrStart.expiresAt ?? Date.now() + Math.max(qrStart.ttl ?? 120_000, 30_000);
    let approved = false;
    while (Date.now() < deadline) {
      const poll = await ws.request<QrPollResponse>(Opcode.QR_POLL, {
        trackId: qrStart.trackId,
      });
      if (poll.status?.loginAvailable === true) {
        approved = true;
        break;
      }
      await sleep(pollIntervalMs);
    }
    if (!approved) {
      throw new Error(
        `QR-bind timed out: trackId ${qrStart.trackId} did not flip to loginAvailable`,
      );
    }

    // 5. CLAIM (op 291) — returns either LOGIN token or 2FA challenge
    const claim = await ws.request<QrLoginResponse>(Opcode.QR_LOGIN, {
      trackId: qrStart.trackId,
    });
    let webToken = claim.tokenAttrs?.LOGIN?.token;

    // 6. 2FA: exchange password for LOGIN token (op 115)
    if (!webToken && claim.passwordChallenge) {
      if (!opts.resolvePassword) {
        throw new Error(
          'Account has a 2FA cloud password — pass `resolvePassword` in QrBindOptions',
        );
      }
      const pw = await opts.resolvePassword(claim.passwordChallenge);
      if (pw === null || pw === undefined || pw === '') {
        throw new Error('2FA password not provided — QR-bind aborted');
      }
      const final = await ws.request<AuthQrPasswordLoginResponse>(
        Opcode.AUTH_QR_PASSWORD_LOGIN,
        { trackId: claim.passwordChallenge.trackId, password: pw },
      );
      webToken = final.tokenAttrs?.LOGIN?.token;
    }

    if (!webToken) {
      throw new Error('QR-bind completed without a LOGIN token (server response missing tokenAttrs.LOGIN)');
    }

    // 7. Final LOGIN (op 19) — also gives us profile + chats snapshot
    const loginResponse = await ws.request<LoginResponse>(Opcode.LOGIN, {
      token: webToken,
      chatsCount: opts.chatsCount ?? 40,
      interactive: true,
      chatsSync: 0,
      contactsSync: 0,
      presenceSync: -1,
      draftsSync: 0,
    });

    return { webToken, webDeviceId, loginResponse };
  } finally {
    ws.close();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
