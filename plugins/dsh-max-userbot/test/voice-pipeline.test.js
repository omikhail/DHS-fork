import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import { processVoiceMessage } from '../lib/voice/pipeline.js';

const limits = { maxBytes: 1_000_000, downloadTimeoutMs: 5000, mimeType: 'audio/ogg' };

function voiceItem(overrides = {}) {
    return {
        channel: 'max',
        chatId: 1,
        messageId: 'm1',
        fromId: 2,
        text: '',
        messageType: 'voice',
        voiceUrl: 'https://a.oneme.ru/audio?cid=1',
        raw: {},
        ...overrides,
    };
}

describe('processVoiceMessage', () => {
    it('returns unavailable when stt is missing', async () => {
        const result = await processVoiceMessage({ item: voiceItem(), stt: undefined, limits });
        assert.equal(result.kind, 'reply');
        assert.ok(result.text.includes('Расшифровка'));
    });

    it('returns unavailable when stt.available is false', async () => {
        const stt = { available: async () => false, transcribe: async () => 'x' };
        const result = await processVoiceMessage({ item: voiceItem(), stt, limits });
        assert.equal(result.kind, 'reply');
        assert.ok(result.text.includes('Расшифровка'));
    });

    it('returns prompt with microphone prefix on success', async () => {
        const audio = new Uint8Array([9]);
        const fetchImpl = mock.fn(async () => ({
            ok: true,
            headers: { get: () => String(audio.byteLength) },
            arrayBuffer: async () => audio.buffer,
            body: null,
        }));
        const stt = {
            available: async () => true,
            transcribe: async (bytes, opts) => {
                assert.deepEqual(bytes, audio);
                assert.equal(opts.mimeType, 'audio/ogg');
                return 'привет';
            },
        };
        const result = await processVoiceMessage({
            item: voiceItem({ text: 'caption' }),
            stt,
            limits,
            fetchImpl,
        });
        assert.equal(result.kind, 'prompt');
        assert.equal(result.parts[0].text, 'caption\n\n🎤 привет');
    });

    it('returns empty transcript message', async () => {
        const fetchImpl = mock.fn(async () => ({
            ok: true,
            headers: { get: () => '1' },
            arrayBuffer: async () => new Uint8Array([1]).buffer,
            body: null,
        }));
        const stt = { available: async () => true, transcribe: async () => '' };
        const result = await processVoiceMessage({ item: voiceItem(), stt, limits, fetchImpl });
        assert.equal(result.kind, 'reply');
        assert.ok(result.text.includes('не распознано'));
    });

    it('returns error when transcribe throws', async () => {
        const fetchImpl = mock.fn(async () => ({
            ok: true,
            headers: { get: () => '1' },
            arrayBuffer: async () => new Uint8Array([1]).buffer,
            body: null,
        }));
        const stt = {
            available: async () => true,
            transcribe: async () => {
                throw new Error('Whisper down');
            },
        };
        const result = await processVoiceMessage({ item: voiceItem(), stt, limits, fetchImpl });
        assert.equal(result.kind, 'reply');
        assert.ok(result.text.includes('Whisper down'));
    });
});
