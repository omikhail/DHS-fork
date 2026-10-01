import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { MaxUpdateRouter } from '../lib/router.js';

function makeRouter(overrides = {}) {
    const replies = [];
    const prompts = [];
    const runner = {
        prompt: async (_t, parts) => { prompts.push(parts); },
        reset: async () => undefined,
        stop: async () => false,
        status: async () => [{ label: 'Session', value: 'max-1' }],
        ...overrides.runner,
    };
    const voice = {
        maxBytes: 20_000_000,
        downloadTimeoutMs: 60_000,
        mimeType: 'audio/ogg',
        ...overrides.voice,
    };
    const router = new MaxUpdateRouter({
        access: { check: async () => 'allowed', phoneFor: async () => '79001234567', ...overrides.access },
        runner,
        bindings: { forChat: () => undefined, ...overrides.bindings },
        replyContext: { remember() { } },
        models: overrides.models,
        workspace: overrides.workspace,
        stt: overrides.stt,
        voice,
        chat: { reply: async (_i, t) => { replies.push(t); } },
    });
    const item = {
        channel: 'max',
        chatId: 1,
        messageId: 'm1',
        fromId: 2,
        text: '',
        messageType: 'text',
        is_owner_message: false,
        raw: {},
        _reply: { chatId: 1, messageId: 'm1' },
    };
    return { router, item, replies, runner, prompts };
}

describe('router commands', () => {
    it('/whoami includes phone when known', async () => {
        const { router, item, replies } = makeRouter();
        item.text = '/whoami';
        await router.handle(item);
        assert.ok(replies[0].includes('79001234567'));
    });

    it('/stop reports nothing running', async () => {
        const { router, item, replies } = makeRouter();
        item.text = '/stop';
        await router.handle(item);
        assert.ok(replies[0].includes('Nothing'));
    });

    it('/new resets runner', async () => {
        let reset = 0;
        const { router, item, replies } = makeRouter({ runner: { reset: async () => { reset += 1; } } });
        item.text = '/new';
        await router.handle(item);
        assert.equal(reset, 1);
        assert.ok(replies[0].includes('fresh'));
    });

    it('voice without stt reports unavailable transcription', async () => {
        const { router, item, replies } = makeRouter();
        item.messageType = 'voice';
        item.voiceUrl = 'https://a.oneme.ru/audio?cid=1';
        item.text = '';
        await router.handle(item);
        assert.ok(replies[0].includes('Расшифровка'));
    });

    it('voice with mock stt prompts agent with transcript', async () => {
        const audio = new Uint8Array([1]);
        const fetchImpl = async () => ({
            ok: true,
            headers: { get: () => '1' },
            arrayBuffer: async () => audio.buffer,
            body: null,
        });
        const originalFetch = globalThis.fetch;
        globalThis.fetch = fetchImpl;
        try {
            const { router, item, prompts } = makeRouter({
                stt: {
                    available: async () => true,
                    transcribe: async () => 'test speech',
                },
            });
            item.messageType = 'voice';
            item.voiceUrl = 'https://a.oneme.ru/audio?cid=1';
            await router.handle(item);
            assert.equal(prompts.length, 1);
            assert.ok(prompts[0][0].text.includes('🎤 test speech'));
        } finally {
            globalThis.fetch = originalFetch;
        }
    });
});
