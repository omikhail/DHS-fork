import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, randomBytes } from 'node:crypto';

function freshMobileDeviceId(): string {
  return randomBytes(8).toString('hex');
}

export interface StoredSession {
  deviceId: string;
  /**
   * Stable per-install UUID. The mobile MAX client sends this in op 6 HELLO as
   * `mt_instanceid` — gating phone-auth and other ANDROID/IOS-only flows.
   * Auto-generated on first session load if missing.
   */
  mtInstanceId?: string;
  /**
   * 16-char hex device ID used by the mobile binary transport. Different from
   * the WS-side UUID `deviceId` (kept for back-compat) — the server's HELLO
   * template embeds this verbatim. Auto-generated on first load.
   */
  mobileDeviceId?: string;
  /**
   * Web-bound LOGIN token used by the WS transport (`MaxClient`). For
   * phone-auth users this is produced by `qrBindWebSession()` —
   * `MaxClient.loginWithPhone()` does the bind automatically.
   */
  loginToken?: string;
  /**
   * Mobile-bound LOGIN token from phone-auth (op 17/18 [+ op 115] → op 19).
   * Stored separately because it is **not** WS-compatible — only
   * `RawTransport.mobileLogin()` accepts it. Useful for power-users who
   * want to call mobile-only ops.
   */
  mobileLoginToken?: string;
  webToken?: string;
  webTokenExpiresAt?: number;
  ownerId?: number;
}

export interface SessionStore {
  load(): Promise<StoredSession>;
  save(s: StoredSession): Promise<void>;
}

/**
 * JSON file session store. Holds deviceId + auth tokens between runs.
 * Default path: ./.max-session.json (relative to process.cwd()).
 *
 * For production, prefer storing tokens in a secret manager (env, Vault, etc.)
 * and implement SessionStore yourself.
 */
export class FileSessionStore implements SessionStore {
  private cache: StoredSession | null = null;
  constructor(private readonly file = path.resolve(process.cwd(), '.max-session.json')) {}

  async load(): Promise<StoredSession> {
    if (this.cache) return this.cache;
    try {
      const raw = await fs.readFile(this.file, 'utf-8');
      this.cache = JSON.parse(raw) as StoredSession;
    } catch {
      this.cache = {
        deviceId: randomUUID(),
        mtInstanceId: randomUUID(),
        mobileDeviceId: freshMobileDeviceId(),
      };
      await this.save(this.cache);
    }
    let mutated = false;
    if (!this.cache.mtInstanceId) {
      this.cache.mtInstanceId = randomUUID();
      mutated = true;
    }
    if (!this.cache.mobileDeviceId) {
      this.cache.mobileDeviceId = freshMobileDeviceId();
      mutated = true;
    }
    if (mutated) await this.save(this.cache);
    return this.cache;
  }

  async save(s: StoredSession): Promise<void> {
    this.cache = s;
    await fs.writeFile(this.file, JSON.stringify(s, null, 2), 'utf-8');
  }
}

export class MemorySessionStore implements SessionStore {
  private state: StoredSession;
  constructor(initial?: Partial<StoredSession>) {
    this.state = {
      deviceId: initial?.deviceId ?? randomUUID(),
      mtInstanceId: initial?.mtInstanceId ?? randomUUID(),
      mobileDeviceId: initial?.mobileDeviceId ?? freshMobileDeviceId(),
      ...initial,
    };
  }
  async load(): Promise<StoredSession> {
    return this.state;
  }
  async save(s: StoredSession): Promise<void> {
    this.state = s;
  }
}
