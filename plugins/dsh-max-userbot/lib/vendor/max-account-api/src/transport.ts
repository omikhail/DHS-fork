import WebSocket from 'ws';
import { EventEmitter } from 'node:events';
import { Cmd, PROTOCOL_VERSION } from './opcodes.js';
import type { WireFrame } from './types.js';

export interface TransportOptions {
  url: string;
  pingIntervalMs?: number;
  reconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
  requestTimeoutMs?: number;
  headers?: Record<string, string>;
}

interface PendingRequest {
  resolve: (payload: unknown) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
  opcode: number;
}

/**
 * Low-level WebSocket transport.
 *
 * Owns:
 *  - connection lifecycle (auto-reconnect with exponential backoff)
 *  - seq numbering for outgoing requests
 *  - request/response correlation via (opcode, seq)
 *  - server-pushed events (cmd:0 from server) → ack with cmd:1 + emit `push`
 *
 * Higher-level handlers subscribe to `push` and call `request()` to send commands.
 */
export class Transport extends EventEmitter {
  private ws: WebSocket | null = null;
  private outgoingSeq = 0;
  private pending = new Map<string, PendingRequest>();
  private pingTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private closedByUser = false;
  private readonly opts: Required<Omit<TransportOptions, 'headers'>> & { headers?: Record<string, string> };

  constructor(opts: TransportOptions) {
    super();
    this.opts = {
      pingIntervalMs: 30_000,
      reconnectDelayMs: 1_000,
      maxReconnectDelayMs: 30_000,
      requestTimeoutMs: 20_000,
      ...opts,
    };
  }

  connect(): Promise<void> {
    this.closedByUser = false;
    return new Promise((resolve, reject) => {
      const headers = this.opts.headers ?? {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
        Origin: 'https://web.max.ru',
      };

      const ws = new WebSocket(this.opts.url, { headers });
      this.ws = ws;

      const onceOpen = () => {
        ws.off('error', onceErr);
        this.reconnectAttempts = 0;
        this.emit('open');
        this.startPing();
        resolve();
      };
      const onceErr = (err: Error) => {
        ws.off('open', onceOpen);
        reject(err);
      };

      ws.once('open', onceOpen);
      ws.once('error', onceErr);

      ws.on('message', (data) => this.onMessage(data));
      ws.on('close', (code, reason) => this.onClose(code, reason.toString()));
      ws.on('error', (err) => this.emit('error', err));
    });
  }

  close(): void {
    this.closedByUser = true;
    this.stopPing();
    this.ws?.close();
    this.ws = null;
    for (const [key, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new Error('Transport closed'));
      this.pending.delete(key);
    }
  }

  /**
   * Send a request frame and await matched response (cmd:1, same opcode+seq).
   */
  request<TRes = unknown>(opcode: number, payload?: unknown): Promise<TRes> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('WebSocket is not open'));
    }
    const seq = this.outgoingSeq++;
    const frame: WireFrame = {
      ver: PROTOCOL_VERSION,
      cmd: Cmd.REQUEST,
      seq,
      opcode,
      ...(payload !== undefined ? { payload } : {}),
    };

    return new Promise<TRes>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(this.key(opcode, seq));
        reject(new Error(`Request timeout: opcode=${opcode} seq=${seq}`));
      }, this.opts.requestTimeoutMs);

      this.pending.set(this.key(opcode, seq), {
        resolve: (p) => resolve(p as TRes),
        reject,
        timer,
        opcode,
      });

      this.ws!.send(JSON.stringify(frame), (err) => {
        if (err) {
          clearTimeout(timer);
          this.pending.delete(this.key(opcode, seq));
          reject(err);
        }
      });
    });
  }

  /**
   * Send a "fire-and-forget" frame with custom cmd (used for acking server pushes).
   */
  sendRaw(frame: Omit<WireFrame, 'ver'>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ ver: PROTOCOL_VERSION, ...frame }));
  }

  private key(opcode: number, seq: number): string {
    return `${opcode}:${seq}`;
  }

  private onMessage(data: WebSocket.RawData): void {
    let frame: WireFrame;
    try {
      frame = JSON.parse(data.toString()) as WireFrame;
    } catch (err) {
      this.emit('error', new Error(`Bad frame: ${(err as Error).message}`));
      return;
    }

    this.emit('raw', frame);

    if (frame.cmd === Cmd.RESPONSE) {
      const k = this.key(frame.opcode, frame.seq);
      const p = this.pending.get(k);
      if (p) {
        clearTimeout(p.timer);
        this.pending.delete(k);
        p.resolve(frame.payload);
      }
      return;
    }

    if (frame.cmd === Cmd.ERROR) {
      const k = this.key(frame.opcode, frame.seq);
      const p = this.pending.get(k);
      if (p) {
        clearTimeout(p.timer);
        this.pending.delete(k);
        const errObj = (frame.payload ?? {}) as { error?: string; message?: string };
        const msg = errObj.error ? `${errObj.error}${errObj.message ? ': ' + errObj.message : ''}` : 'unknown server error';
        p.reject(new Error(`Server error op=${frame.opcode}: ${msg}`));
      }
      return;
    }

    // Server-pushed event (cmd:0 from server). Emit; consumer decides whether to ack.
    this.emit('push', frame);
  }

  /**
   * Ack a server push with a cmd:1 frame mirroring its opcode+seq.
   */
  ackPush(frame: WireFrame, payload?: unknown): void {
    this.sendRaw({
      cmd: Cmd.RESPONSE,
      seq: frame.seq,
      opcode: frame.opcode,
      ...(payload !== undefined ? { payload } : {}),
    });
  }

  private onClose(code: number, reason: string): void {
    this.stopPing();
    this.emit('close', code, reason);
    if (this.closedByUser) return;
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    const attempt = ++this.reconnectAttempts;
    const delay = Math.min(
      this.opts.reconnectDelayMs * 2 ** Math.min(attempt - 1, 6),
      this.opts.maxReconnectDelayMs,
    );
    setTimeout(() => {
      if (this.closedByUser) return;
      this.emit('reconnect', attempt);
      this.connect().catch((err) => this.emit('error', err));
    }, delay);
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      this.request(1, { interactive: true }).catch((err) => this.emit('error', err));
    }, this.opts.pingIntervalMs);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}
