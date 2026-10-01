import { downloadVoice } from './download.js';

const UNAVAILABLE = '⚠️ Расшифровка голоса недоступна.';
const EMPTY = '⚠️ Голосовое не распознано.';

/**
 * @typedef {{ kind: 'prompt', parts: Array<{ type: 'text', text: string }> }} VoicePromptResult
 * @typedef {{ kind: 'reply', text: string }} VoiceReplyResult
 * @typedef {VoicePromptResult | VoiceReplyResult} VoiceProcessResult
 */

/**
 * @param {object} params
 * @param {import('../normalizeMessage.js').normalizeMessage extends Function ? ReturnType<typeof import('../normalizeMessage.js').normalizeMessage> : never} params.item
 * @param {{ available(): Promise<boolean>, transcribe(audio: Uint8Array, opts?: object): Promise<string> } | undefined} params.stt
 * @param {{ maxBytes: number, downloadTimeoutMs: number, mimeType: string }} params.limits
 * @param {object} [params.logger]
 * @param {typeof fetch} [params.fetchImpl]
 * @returns {Promise<VoiceProcessResult>}
 */
export async function processVoiceMessage(params) {
  const { item, stt, limits, logger, fetchImpl } = params;
  const caption = item.text?.trim() ?? '';
  const prefix = caption ? `${caption}\n\n` : '';

  if (!stt) {
    return { kind: 'reply', text: UNAVAILABLE };
  }

  let available = true;
  try {
    available = await stt.available();
  } catch {
    available = false;
  }
  if (!available) {
    return { kind: 'reply', text: UNAVAILABLE };
  }

  const voiceUrl = item.voiceUrl;
  if (!voiceUrl) {
    return { kind: 'reply', text: '⚠️ Не удалось расшифровать голосовое: voice URL is missing' };
  }

  try {
    const bytes = await downloadVoice(voiceUrl, {
      maxBytes: limits.maxBytes,
      timeoutMs: limits.downloadTimeoutMs,
      fetchImpl,
    });
    const text = await stt.transcribe(bytes, { mimeType: limits.mimeType });
    if (!text) {
      return { kind: 'reply', text: EMPTY };
    }
    return {
      kind: 'prompt',
      parts: [{ type: 'text', text: `${prefix}🎤 ${text}` }],
    };
  } catch (error) {
    logger?.warn?.('[dsh-max-userbot] voice transcription failed', error);
    const reason = error instanceof Error ? error.message : String(error);
    return { kind: 'reply', text: `⚠️ Не удалось расшифровать голосовое: ${reason}` };
  }
}
