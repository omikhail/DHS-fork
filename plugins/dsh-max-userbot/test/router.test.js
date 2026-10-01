import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { MaxUpdateRouter } from '../lib/router.js';

function baseItem(overrides = {}) {
    return {
        channel: 'max',
        chatId: 1,
        messageId: 'm1',
        fromId: 2,
        text: '/help',
        messageType: 'text',
        is_owner_message: false,
        raw: { chatId: 1, messageId: 'm1', fromId: 2, text: '/help' },
        _reply: { chatId: 1, messageId: 'm1' },
        ...overrides,
    };
}

describe('MaxUpdateRouter', () => {
    it('skips owner messages', async () => {
        const replies = [];
        const router = new MaxUpdateRouter({
            access: { check: async () => 'allowed', phoneFor: async () => undefined },
            runner: { prompt: async () => undefined, reset: async () => undefined, stop: async () => false, status: async () => [] },
            bindings: { forChat: () => undefined },
            replyContext: { remember() { } },
            chat: { reply: async (_i, t) => { replies.push(t); } },
        });
        await router.handle(baseItem({ is_owner_message: true }));
        assert.equal(replies.length, 0);
    });

    it('denies without replying when access fails', async () => {
        const replies = [];
        const router = new MaxUpdateRouter({
            access: { check: async () => 'denied', phoneFor: async () => undefined },
            runner: { prompt: async () => undefined, reset: async () => undefined, stop: async () => false, status: async () => [] },
            bindings: { forChat: () => undefined },
            replyContext: { remember() { } },
            chat: { reply: async (_i, t) => { replies.push(t); } },
        });
        await router.handle(baseItem({ text: 'hello', raw: {} }));
        assert.equal(replies.length, 0);
    });

    it('handles /help before prompt', async () => {
        const replies = [];
        let prompted = false;
        const router = new MaxUpdateRouter({
            access: { check: async () => 'allowed', phoneFor: async () => undefined },
            runner: {
                prompt: async () => { prompted = true; },
                reset: async () => undefined,
                stop: async () => false,
                status: async () => [],
            },
            bindings: { forChat: () => undefined },
            replyContext: { remember() { } },
            chat: { reply: async (_i, t) => { replies.push(t); } },
        });
        await router.handle(baseItem());
        assert.ok(replies.some((r) => r.includes('Commands')));
        assert.equal(prompted, false);
    });
});
