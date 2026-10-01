import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { MaxUpdateRouter } from '../lib/router.js';

function item(text) {
    return {
        channel: 'max',
        chatId: 1,
        messageId: 'm1',
        fromId: 2,
        text,
        messageType: 'text',
        is_owner_message: false,
        raw: {},
        _reply: { chatId: 1, messageId: 'm1' },
    };
}

describe('router model and cd', () => {
    it('/status includes model when configured', async () => {
        const replies = [];
        const router = new MaxUpdateRouter({
            access: { check: async () => 'allowed', phoneFor: async () => undefined },
            runner: { prompt: async () => undefined, reset: async () => undefined, stop: async () => false, status: async () => [{ label: 'Session', value: 's' }] },
            bindings: { forChat: () => undefined },
            replyContext: { remember() { } },
            models: { describe: () => 'openai/gpt-4' },
            chat: { reply: async (_i, t) => { replies.push(t); } },
        });
        await router.handle(item('/status'));
        assert.ok(replies[0].includes('openai/gpt-4'));
    });

    it('/cd empty shows current directory', async () => {
        const replies = [];
        const router = new MaxUpdateRouter({
            access: { check: async () => 'allowed', phoneFor: async () => undefined },
            runner: { prompt: async () => undefined, reset: async () => undefined, stop: async () => false, status: async () => [] },
            bindings: { forChat: () => undefined },
            replyContext: { remember() { } },
            workspace: {
                current: () => '/tmp/work',
                resolve: () => '/tmp/other',
                inspect: async () => 'directory',
                set: async () => undefined,
            },
            chat: { reply: async (_i, t) => { replies.push(t); } },
        });
        await router.handle(item('/cd'));
        assert.ok(replies[0].includes('/tmp/work'));
    });
});
