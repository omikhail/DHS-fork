import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import { assertAllowedVoiceUrl, downloadVoice } from '../lib/voice/download.js';

describe('assertAllowedVoiceUrl', () => {
    it('accepts https URLs', () => {
        const url = assertAllowedVoiceUrl('https://a.oneme.ru/audio?cid=1');
        assert.equal(url.hostname, 'a.oneme.ru');
    });

    it('rejects http', () => {
        assert.throws(() => assertAllowedVoiceUrl('http://a.oneme.ru/audio'), /HTTPS/);
    });

    it('rejects file', () => {
        assert.throws(() => assertAllowedVoiceUrl('file:///tmp/x'), /HTTPS/);
    });

    it('rejects empty', () => {
        assert.throws(() => assertAllowedVoiceUrl(''), /missing/);
    });
});

describe('downloadVoice', () => {
    it('returns body when under maxBytes', async () => {
        const body = new Uint8Array([1, 2, 3]);
        const fetchImpl = mock.fn(async () => ({
            ok: true,
            headers: { get: () => null },
            arrayBuffer: async () => body.buffer,
            body: null,
        }));
        const out = await downloadVoice('https://cdn.example/v.ogg', {
            maxBytes: 100,
            timeoutMs: 5000,
            fetchImpl,
        });
        assert.deepEqual(out, body);
    });

    it('rejects when content-length exceeds maxBytes', async () => {
        const fetchImpl = mock.fn(async () => ({
            ok: true,
            headers: { get: (name) => (name === 'content-length' ? '999' : null) },
        }));
        await assert.rejects(
            () => downloadVoice('https://cdn.example/v.ogg', { maxBytes: 10, timeoutMs: 5000, fetchImpl }),
            /exceeds size limit/,
        );
    });

    it('rejects non-ok HTTP', async () => {
        const fetchImpl = mock.fn(async () => ({ ok: false, status: 403 }));
        await assert.rejects(
            () => downloadVoice('https://cdn.example/v.ogg', { maxBytes: 100, timeoutMs: 5000, fetchImpl }),
            /HTTP 403/,
        );
    });

    it('streams and enforces maxBytes', async () => {
        const chunk = new Uint8Array(8);
        const fetchImpl = mock.fn(async () => ({
            ok: true,
            headers: { get: () => null },
            body: {
                getReader() {
                    let sent = false;
                    return {
                        read: async () => {
                            if (sent)
                                return { done: true, value: undefined };
                            sent = true;
                            return { done: false, value: chunk };
                        },
                    };
                },
            },
        }));
        await assert.rejects(
            () => downloadVoice('https://cdn.example/v.ogg', { maxBytes: 4, timeoutMs: 5000, fetchImpl }),
            /exceeds size limit/,
        );
    });
});
