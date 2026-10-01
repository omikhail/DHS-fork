import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { MaxUpdateRouter } from '../lib/router.js';

function makeRouter(overrides = {}) {
    const replies = [];
    const runner = {
        prompt: async () => undefined,
        reset: async () => undefined,
        stop: async () => false,
        status: async () => [{ label: 'Session', value: 'max-1' }],
        ...overrides.runner,
    };
    const router = new MaxUpdateRouter({
        access: { check: async () => 'allowed', phoneFor: async () => '79001234567', ...overrides.access },
        runner,
        bindings: { forChat: () => undefined, ...overrides.bindings },
        replyContext: { remember() { } },
        models: overrides.models,
        workspace: overrides.workspace,
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
    return { router, item, replies, runner };
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

    it('voice gets unsupported message', async () => {
        const { router, item, replies } = makeRouter();
        item.messageType = 'voice';
        item.text = '';
        await router.handle(item);
        assert.ok(replies[0].includes('Голосовые'));
    });
});
