import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ReplyContext } from '../lib/reply-context.js';
import { MaxUpdateRouter } from '../lib/router.js';
import { listCatalog } from '../lib/session/models.js';
import { PhoneWhitelistPolicy } from '../lib/access.js';
import { TurnReplyBridge } from '../lib/reply/turn-bridge.js';

describe('extras coverage', () => {
    it('ReplyContext remembers session incoming', () => {
        const ctx = new ReplyContext();
        ctx.remember('s1', { id: 'm' });
        assert.deepEqual(ctx.forSession('s1'), { id: 'm' });
        ctx.clear();
        assert.equal(ctx.forSession('s1'), undefined);
    });

    it('access phoneFor uses cache', async () => {
        const policy = new PhoneWhitelistPolicy({
            allowPhones: ['7900'],
            allowFrom: [],
            cache: { get: () => '79001112233', remember: async () => undefined },
            resolveContact: async () => undefined,
        });
        assert.equal(await policy.phoneFor(1), '79001112233');
    });

    it('listCatalog skips failing providers', async () => {
        const catalog = {
            listProviders: () => [{ id: 'a' }, { id: 'b' }],
            listModels: async (id) => (id === 'a' ? [{ id: 'm1' }] : Promise.reject(new Error('fail'))),
        };
        const groups = await listCatalog(catalog);
        assert.equal(groups.length, 1);
        assert.equal(groups[0].id, 'a');
    });

    it('router runPrompt remembers reply context', async () => {
        const remembered = [];
        const router = new MaxUpdateRouter({
            access: { check: async () => 'allowed', phoneFor: async () => undefined },
            runner: {
                prompt: async () => undefined,
                reset: async () => undefined,
                stop: async () => false,
                status: async () => [],
            },
            bindings: { forChat: () => ({ sessionId: 'max-sess' }) },
            replyContext: { remember: (id, raw) => remembered.push([id, raw]) },
            chat: { reply: async () => undefined },
        });
        const item = {
            channel: 'max',
            chatId: 1,
            messageId: 'm1',
            fromId: 2,
            text: 'hello agent',
            messageType: 'text',
            is_owner_message: false,
            raw: { id: 'm1' },
            _reply: { chatId: 1, messageId: 'm1' },
        };
        await router.handle(item);
        assert.deepEqual(remembered[0], ['max-sess', { id: 'm1' }]);
    });

    it('turn bridge sends error text when turn fails with no content', async () => {
        const delivered = [];
        const bridge = new TurnReplyBridge({
            maxChars: 4000,
            replyContext: { forSession: () => ({}) },
            deliver: async (_c, text) => { delivered.push(text); },
        });
        bridge.trackTurn('s', 1);
        await bridge.handle('s', { type: 'turn/end', data: { turn: 1, reason: { kind: 'error', error: { message: 'boom' } } } });
        assert.ok(delivered[0].includes('boom'));
    });
});
