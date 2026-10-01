/**
 * HTTPS-only voice download with size and timeout limits.
 */

/**
 * @param {string} url
 * @returns {URL}
 */
export function assertAllowedVoiceUrl(url) {
  if (typeof url !== 'string' || !url.trim()) {
    throw new Error('Voice URL is missing');
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Voice URL is invalid');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('Voice URL must use HTTPS');
  }
  return parsed;
}

/**
 * @param {string} url
 * @param {object} options
 * @param {number} options.maxBytes
 * @param {number} options.timeoutMs
 * @param {AbortSignal} [options.signal]
 * @param {typeof fetch} [options.fetchImpl]
 * @returns {Promise<Uint8Array>}
 */
export async function downloadVoice(url, options) {
  assertAllowedVoiceUrl(url);
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  const onExternalAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onExternalAbort, { once: true });

  try {
    const res = await fetchImpl(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Voice download failed: HTTP ${res.status}`);
    }
    const contentLength = res.headers.get('content-length');
    if (contentLength !== null) {
      const length = Number(contentLength);
      if (Number.isFinite(length) && length > options.maxBytes) {
        throw new Error(`Voice file exceeds size limit (${options.maxBytes} bytes)`);
      }
    }
    const reader = res.body?.getReader();
    if (!reader) {
      const buf = await res.arrayBuffer();
      if (buf.byteLength > options.maxBytes) {
        throw new Error(`Voice file exceeds size limit (${options.maxBytes} bytes)`);
      }
      return new Uint8Array(buf);
    }
    const chunks = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done)
        break;
      total += value.byteLength;
      if (total > options.maxBytes) {
        throw new Error(`Voice file exceeds size limit (${options.maxBytes} bytes)`);
      }
      chunks.push(value);
    }
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return out;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Voice download timed out after ${options.timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onExternalAbort);
  }
}
