/**
 * HTTP client for the Whisper ASR webservice.
 *
 * Talks to the `onerahmet/openai-whisper-asr-webservice` API:
 *   POST /asr  (multipart/form-data, field: audio_file)
 *
 * Telegram voice notes are OGG/Opus, which Whisper accepts natively
 * via its internal FFmpeg — no conversion needed.
 */

const SILENT_LOGGER = {
  info() {},
  warn() {},
  error() {},
  debug() {},
};

export class WhisperClient {
  /**
   * @param {object} options
   * @param {string} options.baseURL   — e.g. "http://localhost:9000"
   * @param {string} [options.language] — ISO code like "ru", or empty for auto-detect
   * @param {number} options.timeoutMs — request timeout
   * @param {object} [options.logger]
   */
  constructor(options) {
    this.baseURL = options.baseURL.replace(/\/+$/, '');
    this.language = options.language || undefined;
    this.timeoutMs = options.timeoutMs ?? 30000;
    this.logger = options.logger ?? SILENT_LOGGER;
  }

  /**
   * Check whether the Whisper service is reachable.
   * @returns {Promise<boolean>}
   */
  async available() {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${this.baseURL}/docs`, { signal: controller.signal });
      clearTimeout(timer);
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Transcribe audio bytes via Whisper POST /asr.
   *
   * @param {Uint8Array} audio     — raw audio bytes (OGG/Opus from Telegram)
   * @param {object} [opts]
   * @param {string}   [opts.mimeType]  — e.g. "audio/ogg"
   * @param {string}   [opts.language]  — override per-call language
   * @param {AbortSignal} [opts.signal] — external cancellation
   * @returns {Promise<string>} transcribed text
   */
  async transcribe(audio, opts = {}) {
    const language = opts.language ?? this.language;
    const formData = new FormData();
    formData.append('audio_file', new Blob([audio], { type: opts.mimeType ?? 'audio/ogg' }), 'voice.ogg');
    if (language) {
      formData.append('language', language);
    }
    formData.append('output_format', 'text');
    formData.append('task', 'transcribe');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const onAbort = () => controller.abort();
    opts.signal?.addEventListener('abort', onAbort, { once: true });

    try {
      const res = await fetch(`${this.baseURL}/asr`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Whisper returned HTTP ${res.status}: ${body.slice(0, 200)}`);
      }
      const text = await res.text();
      this.logger.debug(`[dsh-telegram-voice] transcribed: "${text.slice(0, 100)}"`);
      return text.trim();
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`Whisper transcription timed out after ${this.timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onAbort);
    }
  }
}