import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import { WhisperClient } from '../lib/whisper-client.js';

describe('WhisperClient', () => {
  /** @type {typeof globalThis.fetch} */
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('available returns true when /docs is ok', async () => {
    globalThis.fetch = mock.fn(async (url) => {
      assert.equal(url, 'http://localhost:9000/docs');
      return { ok: true };
    });
    const client = new WhisperClient({ baseURL: 'http://localhost:9000', timeoutMs: 30000 });
    assert.equal(await client.available(), true);
  });

  it('available returns false on network error', async () => {
    globalThis.fetch = mock.fn(async () => {
      throw new Error('offline');
    });
    const client = new WhisperClient({ baseURL: 'http://localhost:9000', timeoutMs: 30000 });
    assert.equal(await client.available(), false);
  });

  it('transcribe returns trimmed text on success', async () => {
    globalThis.fetch = mock.fn(async (url, init) => {
      assert.equal(url, 'http://localhost:9000/asr');
      assert.equal(init?.method, 'POST');
      return { ok: true, text: async () => '  hello world  \n' };
    });
    const client = new WhisperClient({ baseURL: 'http://localhost:9000', language: 'ru', timeoutMs: 30000 });
    const text = await client.transcribe(new Uint8Array([1, 2, 3]), { mimeType: 'audio/ogg' });
    assert.equal(text, 'hello world');
  });

  it('transcribe throws on non-ok HTTP', async () => {
    globalThis.fetch = mock.fn(async () => ({
      ok: false,
      status: 500,
      text: async () => 'server error',
    }));
    const client = new WhisperClient({ baseURL: 'http://localhost:9000', timeoutMs: 30000 });
    await assert.rejects(
      () => client.transcribe(new Uint8Array([1])),
      /Whisper returned HTTP 500/,
    );
  });
});
