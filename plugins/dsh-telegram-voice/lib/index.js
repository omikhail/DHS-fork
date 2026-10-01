/**
 * dsh-telegram-voice — STT provider for dsh-telegram.
 *
 * Registers a `telegramStt` Cordis service that the dsh-telegram plugin
 * (via a small pnpm patch) uses to transcribe voice messages.
 *
 * Service contract:
 *   available(): Promise<boolean>
 *   transcribe(audio: Uint8Array, opts?: { mimeType?, language?, signal? }): Promise<string>
 *
 * If this plugin is not loaded, dsh-telegram falls back to the old
 * "I can't read a voice note" stub.
 */
import { Config } from './config.js';
import { WhisperClient } from './whisper-client.js';

export { Config };

export const name = '@mikhail/dsh-telegram-voice';

export function apply(ctx, config) {
  const client = new WhisperClient({
    baseURL: config.baseURL,
    language: config.language,
    timeoutMs: config.timeoutMs,
    logger: ctx.logger,
  });

  const service = {
    /**
     * Whether the Whisper backend is currently reachable.
     * Called by dsh-telegram before attempting transcription.
     */
    async available() {
      return client.available();
    },

    /**
     * Transcribe audio bytes.
     * @param {Uint8Array} audio
     * @param {object} [opts] — { mimeType, language, signal }
     * @returns {Promise<string>}
     */
    async transcribe(audio, opts) {
      return client.transcribe(audio, opts);
    },
  };

  ctx.provide('telegramStt', service);

  ctx.logger.info(`[dsh-telegram-voice] STT service registered (Whisper at ${config.baseURL}, language=${config.language || 'auto'})`);

  // Log availability on startup (non-blocking).
  void client.available().then((ok) => {
    if (ok) {
      ctx.logger.info('[dsh-telegram-voice] Whisper is reachable');
    } else {
      ctx.logger.warn(`[dsh-telegram-voice] Whisper at ${config.baseURL} is not reachable — voice messages will fall back to a stub`);
    }
  });
}