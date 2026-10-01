/**
 * Raw TLS transport for the MAX mobile protocol (api.oneme.ru:443).
 *
 * The web client uses WebSocket with JSON frames; the Android/iOS client
 * uses a custom binary frame format over plain TLS — and crucially, the
 * server gates phone-auth (ops 17/18) and other mobile-only flows behind
 * `userAgent.deviceType === 'ANDROID'` / `'IOS'`, which the WS endpoint
 * refuses (close code 1008, "deviceType forbidden").
 *
 * Wire format (observed via Frida hooks on Conscrypt SSLOutputStream):
 *
 *   offset 0   : 0x0a              magic
 *   offset 1   : direction (0 = client→server, 1 = server→client, 3 = error)
 *   offset 2-3 : seq (2B big-endian — wraps at 65536)
 *   offset 4-5 : opcode (2B big-endian — high byte is 0 for op < 256;
 *                non-zero for op > 255, e.g. op 290 = 0x0122)
 *   offset 6   : flags (observed 0 for PING/HELLO, 1 for op-17 phone-auth)
 *   offset 7-9 : payload length (3B big-endian)
 *   offset 10+ : msgpack payload
 *
 * Most payloads are a plain msgpack map (e.g. PING `{interactive:true}`).
 * Some ops (notably op 17 phone-auth) prepend two msgpack ints to the map
 * (observed `(-16, 21, {...})` for START_AUTH, `(-16, 17, {...})` for
 * RESEND). We replicate the mobile behaviour by wrapping such payloads in
 * a `[hint, op, body]` triplet when `prependOpHint` is set.
 *
 * This module ships only what the phone-auth flow needs:
 *  - `RawTransport.hello()`             → op 6 with ANDROID userAgent
 *  - `RawTransport.request(op, body)`   → generic request/response
 *  - automatic seq numbering + (op, seq) correlation
 */
import * as tls from 'node:tls';
import { EventEmitter } from 'node:events';
import { encode as msgpackEncode, decodeMulti as msgpackDecodeMulti, decode as msgpackDecode } from '@msgpack/msgpack';
// @ts-expect-error — no types ship with lz4js (pure-JS LZ4 block codec).
import lz4js from 'lz4js';
import { Opcode } from './opcodes.js';
import type { UserAgent, HelloResponse, QrConfirmRequest } from './types.js';

export interface RawTransportOptions {
  host?: string;
  port?: number;
  servername?: string;
  /** Reject self-signed / mismatched certs (default true). */
  rejectUnauthorized?: boolean;
  connectTimeoutMs?: number;
  requestTimeoutMs?: number;
  /** When true, hex-dump every TX/RX frame to stderr for diagnostics. */
  debug?: boolean;
}

export interface SendOptions {
  /**
   * If set, prepend `(<prefixInt>, <hint>, body)` to the payload — observed on
   * op 17 phone-auth frames (prefixInt=-16). For op 17 hints:
   *   - 21 for START_AUTH
   *   - 17 for RESEND
   */
  prependOpHint?: number;
  /**
   * Custom prefix byte when `prependOpHint` is set. Defaults to 0xf0
   * (observed on op 17 / 18 / 115). Sent as a raw byte.
   */
  prefixInt?: number;
  /**
   * Prepend a single msgpack int before the payload (no hint). Used by op 18
   * verify (observed prefix = -31).
   */
  prependScalar?: number;
  /** Override the flags byte (header offset 6). Op 17 uses 1, op 18 uses 2. */
  flags?: number;
  /**
   * Raw bytes prepended verbatim before the msgpack body. Used by HELLO
   * (`[0xf3, 0x5a]`) — a fixed "session-greeting" tag that gates mobile-only
   * features server-side. Mutually exclusive with `prependOpHint` /
   * `prependScalar`.
   */
  rawPrefix?: Buffer;
}

interface Pending {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  timer: NodeJS.Timeout;
}

const FRAME_MAGIC = 0x0a;
const HEADER_SIZE = 10;

const DIR_CLIENT = 0;
const FLAGS_DEFAULT = 0;
const FLAGS_PHONE_AUTH = 1;

/**
 * Captured byte-template of a real Android client's op 6 HELLO frame.
 * Re-encoding the same map content via standard msgpack is silently dropped
 * by the server (no error reply, just TCP close) — the server's parser
 * appears to depend on this *exact* token stream, including bytes that look
 * like JNI buffer artifacts but are part of the protocol. The only fields
 * we patch are `mt_instanceid` (UUID, offset 29, 36 bytes) and `deviceId`
 * (16-hex, offset 298, 16 bytes). Header seq stays 1 — HELLO is always the
 * first frame on a fresh connection.
 *
 * Captured from MAX Android v26.32.1 against api.oneme.ru:443 (Spyder fork).
 */
const HELLO_TEMPLATE_HEX =
  '0a000001000602000130f35a84ad6d745f696e7374616e63656964d92430393437366632372d663230362d343139362d383662612d656537663434643566363233a9757365724167656e748baa64657669636554797065a7414e44524f4944aa61707056657273696f6ea732362e33322e31a96f731200f322aa416e64726f6964203134a874696d657a6f6e65ad4575726f70652f4d6f73636f77a673637265656eb7343430647069200700f500313038307832313338ae70757368447500f31aa347434da461726368a67838365f3634a66c6f63616c65a27275ab6275696c644e756d626572cd1aafa900f20a4e616d65ba476f6f676c652073646b5f6770686f6e6536345f3f0012accf00144c4500a0af636c69656e74536573cf004249640ba82100f0044964b066646630393164333564346535343162';
const HELLO_TEMPLATE = Buffer.from(HELLO_TEMPLATE_HEX, 'hex');
const HELLO_MT_OFFSET = 29; // 36 chars
const HELLO_DEVICE_OFFSET = 298; // 16 chars

export class RawTransport extends EventEmitter {
  private sock: tls.TLSSocket | null = null;
  private seq = 0;
  private readonly pending = new Map<string, Pending>();
  private rxBuf: Buffer = Buffer.alloc(0);
  private readonly opts: Required<RawTransportOptions>;

  constructor(opts: RawTransportOptions = {}) {
    super();
    this.opts = {
      host: 'api.oneme.ru',
      port: 443,
      servername: opts.servername ?? opts.host ?? 'api.oneme.ru',
      rejectUnauthorized: true,
      connectTimeoutMs: 15_000,
      requestTimeoutMs: 30_000,
      debug: false,
      ...opts,
    } as Required<RawTransportOptions>;
  }

  private hexDump(tag: string, buf: Buffer): void {
    if (!this.opts.debug) return;
    const lines: string[] = [`[${tag}] ${buf.length} bytes`];
    for (let off = 0; off < buf.length; off += 16) {
      const chunk = buf.subarray(off, off + 16);
      const hex = Array.from(chunk).map((b) => b.toString(16).padStart(2, '0')).join(' ');
      const ascii = Array.from(chunk)
        .map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.'))
        .join('');
      lines.push(`  ${off.toString(16).padStart(4, '0')}: ${hex.padEnd(48)} ${ascii}`);
    }
    process.stderr.write(lines.join('\n') + '\n');
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const sock = tls.connect({
        host: this.opts.host,
        port: this.opts.port,
        servername: this.opts.servername,
        rejectUnauthorized: this.opts.rejectUnauthorized,
        // Mobile clients negotiate plain TLS (no ALPN preference observed).
      });
      this.sock = sock;
      const to = setTimeout(() => {
        sock.destroy(new Error('TLS connect timeout'));
      }, this.opts.connectTimeoutMs);

      sock.once('secureConnect', () => {
        clearTimeout(to);
        this.emit('open');
        resolve();
      });
      sock.on('data', (chunk) => this.onData(typeof chunk === 'string' ? Buffer.from(chunk) : chunk));
      sock.on('error', (e) => {
        clearTimeout(to);
        this.emit('error', e);
        reject(e);
      });
      sock.on('close', () => this.onClose());
    });
  }

  close(): void {
    this.sock?.end();
    this.sock = null;
    for (const [k, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new Error('Transport closed'));
      this.pending.delete(k);
    }
  }

  /**
   * Op 290 — confirm a web-side QR login from this authenticated mobile
   * session. This is the headless equivalent of scanning the QR with the
   * MAX mobile app's camera.
   *
   * Pass the `qrLink` string returned by the web client's op 288 response.
   * The server uses this to flip the corresponding `trackId` to
   * `loginAvailable:true`, which the web client picks up via op 289 polling.
   *
   * Returns when the server ACKs (empty body). The actual web-side LOGIN
   * issuance happens on the web WS — see {@link import('./qr-bind.js').qrBindWebSession}
   * for the full flow.
   *
   * Wire prefix: `f0 34` (op-hint 0x34), `flags=1`.
   */
  async confirmQrAuth(qrLink: string): Promise<void> {
    const req: QrConfirmRequest = { qrLink };
    await this.request(Opcode.QR_CONFIRM, req, { prependOpHint: 0x34, flags: 1 });
  }

  /**
   * Send op 19 (LOGIN) over the mobile binary transport.
   *
   * Reversed from MAX Android v26.15.1: the request map carries:
   *   { chatCacheFingerprint: <96-byte binary>,   // local cache hash; zeros OK for fresh session
   *     exp: { chatsCountGroups: <2-byte binary> }, // server-side experiment caps
   *     token: <LOGIN token from op 115>,
   *     presenceSync: 0,
   *     interactive: true }
   * with a 5-byte raw prefix `f0 ff ff ff 3c` and `flags=1` in the header.
   *
   * Returns the full LoginResponse (profile, chats, contacts, refreshed token).
   * Use after HELLO + phone-auth (op 17/18 [+ 115 for 2FA]) on the same socket.
   */
  async mobileLogin(token: string): Promise<unknown> {
    if (!this.sock || this.sock.destroyed) throw new Error('RawTransport not connected');
    const payload = {
      chatCacheFingerprint: Buffer.alloc(96), // 96-byte zero binary for fresh session
      exp: { chatsCountGroups: Buffer.from([0x09, 0x32]) },
      token,
      presenceSync: 0,
      interactive: true,
    };
    return this.request(19, payload, {
      flags: 1,
      rawPrefix: Buffer.from([0xf0, 0xff, 0xff, 0xff, 0x3c]),
    });
  }

  /**
   * Send op 6 (HELLO) using the captured Android byte template.
   *
   * MAX's server rejects any re-encoded HELLO whose msgpack token stream
   * deviates from the captured Android-client form — even semantically
   * identical maps trigger a silent TCP close. We work around this by
   * shipping the exact bytes the v26.15.1 Android client sent and patching
   * only the per-install identifiers (`mt_instanceid` UUID + 16-hex
   * `deviceId`). `userAgent` content is therefore fixed at the template's
   * values; the `userAgent` argument is ignored (kept for API parity but
   * marked optional). Always emits the first frame (seq=1) on a fresh
   * connection — call right after `connect()`.
   */
  async hello(
    mobileDeviceId: string,
    mtInstanceId: string,
    _userAgent?: UserAgent,
  ): Promise<HelloResponse> {
    if (!this.sock || this.sock.destroyed) throw new Error('RawTransport not connected');
    if (!/^[0-9a-f]{16}$/.test(mobileDeviceId)) {
      throw new Error('hello(): mobileDeviceId must be 16 lowercase hex chars');
    }
    if (mtInstanceId.length !== 36) {
      throw new Error('hello(): mtInstanceId must be a 36-char UUID string');
    }
    const frame = Buffer.from(HELLO_TEMPLATE);
    Buffer.from(mtInstanceId, 'utf-8').copy(frame, HELLO_MT_OFFSET);
    Buffer.from(mobileDeviceId, 'utf-8').copy(frame, HELLO_DEVICE_OFFSET);
    // Sync our seq counter with the template (1) so subsequent ops get 2, 3, …
    this.seq = 1;
    const seq = 1;
    this.hexDump('TX op=6 (HELLO template)', frame);
    return new Promise<HelloResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(this.key(6, seq));
        reject(new Error('HELLO timeout'));
      }, this.opts.requestTimeoutMs);
      this.pending.set(this.key(6, seq), {
        resolve: (v) => resolve(v as HelloResponse),
        reject,
        timer,
      });
      this.sock!.write(frame, (err) => {
        if (err) {
          clearTimeout(timer);
          this.pending.delete(this.key(6, seq));
          reject(err);
        }
      });
    });
  }

  request<TRes = unknown>(opcode: number, payload?: unknown, opts: SendOptions = {}): Promise<TRes> {
    if (!this.sock || this.sock.destroyed) {
      return Promise.reject(new Error('RawTransport not connected'));
    }
    const seq = (++this.seq) & 0xffff;
    const body = this.encodeBody(opcode, payload, opts);
    let flags = FLAGS_DEFAULT;
    if (opts.flags !== undefined) flags = opts.flags;
    else if (opts.prependOpHint !== undefined) flags = FLAGS_PHONE_AUTH;
    const frame = this.encodeFrame(seq, opcode, flags, body);
    this.hexDump(`TX op=${opcode} seq=${seq} flags=${flags}`, frame);
    return new Promise<TRes>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(this.key(opcode, seq));
        reject(new Error(`Request timeout: op=${opcode} seq=${seq}`));
      }, this.opts.requestTimeoutMs);
      this.pending.set(this.key(opcode, seq), {
        resolve: (v) => resolve(v as TRes),
        reject,
        timer,
      });
      this.sock!.write(frame, (err) => {
        if (err) {
          clearTimeout(timer);
          this.pending.delete(this.key(opcode, seq));
          reject(err);
        }
      });
    });
  }

  private key(op: number, seq: number): string {
    return `${op}:${seq}`;
  }

  private encodeBody(_op: number, payload: unknown, opts: SendOptions): Buffer {
    if (payload === undefined) return Buffer.alloc(0);
    const body = Buffer.from(msgpackEncode(payload));
    if (opts.rawPrefix !== undefined) {
      return Buffer.concat([opts.rawPrefix, body]);
    }
    if (opts.prependOpHint !== undefined) {
      // Observed wire prefix: 2 raw bytes [0xf0, <hint>]. The first byte
      // is fixed (0xf0); the second is an op-specific subtype byte and is
      // NOT msgpack-encoded — values >0x7f appear verbatim (e.g. 0xad on op 18).
      const prefixByte = (opts.prefixInt ?? 0xf0) & 0xff;
      const hintByte = opts.prependOpHint & 0xff;
      return Buffer.concat([Buffer.from([prefixByte, hintByte]), body]);
    }
    if (opts.prependScalar !== undefined) {
      return Buffer.concat([Buffer.from(msgpackEncode(opts.prependScalar)), body]);
    }
    return body;
  }

  private encodeFrame(seq: number, op: number, flags: number, body: Buffer): Buffer {
    const buf = Buffer.alloc(HEADER_SIZE + body.length);
    buf[0] = FRAME_MAGIC;
    buf[1] = DIR_CLIENT;
    buf[2] = (seq >> 8) & 0xff;
    buf[3] = seq & 0xff;
    buf[4] = (op >> 8) & 0xff;
    buf[5] = op & 0xff;
    buf[6] = flags & 0xff;
    buf[7] = (body.length >> 16) & 0xff;
    buf[8] = (body.length >> 8) & 0xff;
    buf[9] = body.length & 0xff;
    body.copy(buf, HEADER_SIZE);
    return buf;
  }

  private onData(chunk: Buffer): void {
    this.rxBuf = this.rxBuf.length === 0 ? chunk : Buffer.concat([this.rxBuf, chunk]);
    while (this.rxBuf.length >= HEADER_SIZE) {
      const magic = this.rxBuf[0]!;
      if (magic !== FRAME_MAGIC) {
        this.emit('error', new Error(`Bad frame magic: 0x${magic.toString(16)}`));
        this.rxBuf = Buffer.alloc(0);
        return;
      }
      const dir = this.rxBuf[1]!;
      const seq = (this.rxBuf[2]! << 8) | this.rxBuf[3]!;
      const op = (this.rxBuf[4]! << 8) | this.rxBuf[5]!;
      const flags = this.rxBuf[6]!;
      const len = (this.rxBuf[7]! << 16) | (this.rxBuf[8]! << 8) | this.rxBuf[9]!;
      if (this.rxBuf.length < HEADER_SIZE + len) return; // wait for more
      const fullFrame = this.rxBuf.subarray(0, HEADER_SIZE + len);
      const body = this.rxBuf.subarray(HEADER_SIZE, HEADER_SIZE + len);
      this.hexDump(`RX op=${op} seq=${seq} flags=${flags}`, fullFrame);
      this.rxBuf = this.rxBuf.subarray(HEADER_SIZE + len);
      this.handleFrame(dir, seq, op, flags, body);
    }
  }

  private handleFrame(dir: number, seq: number, op: number, flags: number, body: Buffer): void {
    let payload: unknown = undefined;
    if (body.length > 0) {
      // `flags` is the `cof` byte (compress-or-flag): when non-zero the
      // mobile binary protocol stores LZ4-compressed bytes after the header.
      // The Android client encodes the ratio as `(uncompressed/compressed)+1`
      // so we use it to size the decompression target generously, then trim.
      let workingBody = body;
      if (flags !== 0) {
        try {
          workingBody = this.lz4Decompress(body, flags);
        } catch (e) {
          this.emit(
            'error',
            new Error(`LZ4 decompress fail op=${op}: ${(e as Error).message}`),
          );
          // Fall back to raw bytes — extractLongestString may still find a token.
          workingBody = body;
        }
      }
      try {
        payload = this.decodeBody(workingBody);
      } catch (e) {
        this.emit('error', new Error(`msgpack decode fail op=${op}: ${(e as Error).message}`));
        return;
      }
    }
    this.emit('frame', { dir, seq, op, flags, payload });
    if (dir === DIR_CLIENT) {
      // echoed our own frame? unlikely on TLS but skip just in case
      return;
    }
    // dir = server → either response to our request or server-pushed event.
    const p = this.pending.get(this.key(op, seq));
    if (p) {
      clearTimeout(p.timer);
      this.pending.delete(this.key(op, seq));
      if (payload && typeof payload === 'object' && (payload as { error?: string }).error) {
        p.reject(new Error(`Server error: ${(payload as { error: string }).error}`));
      } else {
        p.resolve(payload);
      }
      return;
    }
    this.emit('push', { seq, op, payload });
  }

  /**
   * Decompress an LZ4-block-encoded body. The mobile binary protocol uses
   * `lz4-java` `fastCompressor()` server-side (see `d2d.java`); we use the
   * pure-JS `lz4js` block codec on the client. The `cof` byte from the header
   * encodes the ratio `(uncompressed/compressed)+1`, which we use to size the
   * output buffer with headroom.
   */
  private lz4Decompress(body: Buffer, cof: number): Buffer {
    // Headroom factor: cof=1 means ratio<2 (low compression), cof=N means up
    // to (N-1)x. Use (cof+2)x + 1KB padding for safety; lz4js writes only the
    // actual decompressed bytes and returns the length.
    const headroom = Math.max(cof, 2) + 2;
    const estSize = body.length * headroom + 1024;
    const out = Buffer.alloc(estSize);
    const inU8 = body instanceof Uint8Array ? body : new Uint8Array(body);
    const written = (lz4js as {
      decompressBlock: (src: Uint8Array, dst: Uint8Array, sIdx: number, eIdx: number, tIdx: number) => number;
    }).decompressBlock(inU8, out, 0, body.length, 0);
    return out.subarray(0, written);
  }

  /**
   * Decode the body. Mobile-protocol responses prepend 2+ raw bytes before
   * the actual msgpack map (e.g. op 6 reply: `f0 d2 … 87 <map>`; op 17 reply:
   * `f3 a7 … 85 <map>`; op 18: similar). The map's trailing bytes can also
   * contain "junk" the server still sends — `msgpackDecode` errors on extra
   * bytes after the value. We scan offsets for a container header (fixmap /
   * fixarray / map16) and use `decodeMulti` to take the FIRST value, which
   * tolerates trailing data. Falls back to last stream value otherwise.
   */
  private decodeBody(body: Buffer): unknown {
    // Scan offsets 0..8 for a container header. Prefer MAP candidates over
    // ARRAY candidates — op 18 reply starts with `f2 91 82 …` where `91` is
    // a fixarray-1 wrapping the real fixmap-2 payload at offset 2; without
    // this preference we'd return `[{…}]` instead of `{…}`.
    let arrayFallback: unknown = undefined;
    const tryAt = (off: number): unknown | undefined => {
      try {
        for (const v of msgpackDecodeMulti(body.subarray(off))) {
          return v; // first value only
        }
      } catch {
        // ignore
      }
      return undefined;
    };
    for (let pass = 0; pass < 2; pass++) {
      const wantMap = pass === 0;
      for (let off = 0; off < Math.min(body.length, 9); off++) {
        const h = body[off]!;
        const isFixmap = h >= 0x80 && h <= 0x8f;
        const isFixarr = h >= 0x90 && h <= 0x9f;
        const isMap16 = h === 0xde || h === 0xdf;
        const isArr16 = h === 0xdc || h === 0xdd;
        const matches = wantMap ? (isFixmap || isMap16) : (isFixarr || isArr16);
        if (!matches) continue;
        const v = tryAt(off);
        if (v && typeof v === 'object') {
          if (wantMap) return v;
          // Unwrap a 1-element array containing a map (server wraps some
          // responses like op 18 in a fixarray).
          if (Array.isArray(v) && v.length === 1 && v[0] && typeof v[0] === 'object') {
            return v[0];
          }
          arrayFallback ??= v;
        }
      }
    }
    if (arrayFallback !== undefined) return arrayFallback;
    // Fallback A: stream-decode, return the last value.
    try {
      const values: unknown[] = [];
      for (const v of msgpackDecodeMulti(body)) values.push(v);
      if (values.length > 0) return values[values.length - 1];
    } catch {
      try { return msgpackDecode(body); } catch {}
    }
    // Fallback B: if the body clearly contains a LOGIN token response (op 115
    // / op 18 happy path), the server uses an opaque non-msgpack form for the
    // inner `LOGIN.<key>` field — scan for ASCII markers and pull out the
    // longest str8/str16 value as the token.
    const hasTokenAttrs = body.indexOf(Buffer.from('tokenAttrs')) >= 0;
    const hasLogin = body.indexOf(Buffer.from('LOGIN')) >= 0;
    if (hasTokenAttrs && hasLogin) {
      const tok = this.extractLongestString(body);
      if (tok) return { tokenAttrs: { LOGIN: { token: tok } } };
    }
    return undefined;
  }

  /** Scan `buf` for the longest msgpack str8/str16/str32 ASCII payload. */
  private extractLongestString(buf: Buffer): string | null {
    let best: string | null = null;
    for (let i = 0; i < buf.length - 2; i++) {
      let len = 0;
      let start = -1;
      const h = buf[i]!;
      if (h === 0xd9) {
        len = buf[i + 1]!;
        start = i + 2;
      } else if (h === 0xda) {
        len = (buf[i + 1]! << 8) | buf[i + 2]!;
        start = i + 3;
      } else if (h === 0xdb) {
        len = ((buf[i + 1]! << 24) >>> 0) | (buf[i + 2]! << 16) | (buf[i + 3]! << 8) | buf[i + 4]!;
        start = i + 5;
      } else continue;
      if (len < 50 || start + len > buf.length) continue;
      const slice = buf.subarray(start, start + len);
      // Token-like = printable ASCII (base64url charset).
      let printable = true;
      for (let k = 0; k < slice.length; k++) {
        const c = slice[k]!;
        if (c < 0x20 || c > 0x7e) { printable = false; break; }
      }
      if (!printable) continue;
      const s = slice.toString('utf-8');
      if (!best || s.length > best.length) best = s;
    }
    return best;
  }

  private onClose(): void {
    this.emit('close');
    for (const [k, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new Error('Transport closed by peer'));
      this.pending.delete(k);
    }
  }
}
