/**
 * dsh-max-voice — STT provider for dsh-max-userbot.
 *
 * Registers a `maxStt` Cordis service:
 *   available(): Promise<boolean>
 *   transcribe(audio: Uint8Array, opts?: { mimeType?, language?, signal? }): Promise<string>
 */
import { Config } from './config.js';
import { WhisperClient } from './whisper-client.js';

export { Config };

export const name = '@mikhail/dsh-max-voice';

export function apply(ctx, config) {
  const client = new WhisperClient({
    baseURL: config.baseURL,
    language: config.language,
    timeoutMs: config.timeoutMs,
    logger: ctx.logger,
  });

  const service = {
    async available() {
      return client.available();
    },

    async transcribe(audio, opts) {
      return client.transcribe(audio, opts);
    },
  };

  ctx.provide('maxStt', service);

  ctx.logger.info(`[dsh-max-voice] STT service registered (Whisper at ${config.baseURL}, language=${config.language || 'auto'})`);

  void client.available().then((ok) => {
    if (ok) {
      ctx.logger.info('[dsh-max-voice] Whisper is reachable');
    } else {
      ctx.logger.warn(`[dsh-max-voice] Whisper at ${config.baseURL} is not reachable — voice messages will fall back to a stub`);
    }
  });
}
