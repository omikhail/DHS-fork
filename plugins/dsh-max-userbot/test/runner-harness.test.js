import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildUserMessage } from '../lib/harness/message.js';
import { parseRoute, sameRoute } from '../lib/harness/model-selection.js';
import { SessionRunner } from '../lib/session/runner.js';
import { resolveDirectory } from '../lib/session/workspaces.js';

describe('harness helpers', () => {
    it('buildUserMessage freezes content', () => {
        const msg = buildUserMessage([{ type: 'text', text: 'hi' }]);
        assert.equal(msg.role, 'user');
        assert.equal(msg.content[0].text, 'hi');
    });

    it('parseRoute splits provider and model', () => {
        assert.deepEqual(parseRoute('openai/gpt-4'), { provider: 'openai', model: 'gpt-4' });
        assert.equal(sameRoute(parseRoute('a/b'), parseRoute('a/b')), true);
    });

    it('resolveDirectory handles tilde', () => {
        assert.ok(resolveDirectory('~/proj', '/tmp', '/home/u')?.endsWith('home/u/proj'));
    });
});

describe('SessionRunner', () => {
    it('reset unbinds conversation', async () => {
        const bindings = {
            data: undefined,
            forChat: () => bindings.data,
            bind: async (_t, id) => { bindings.data = { sessionId: id, createdAt: Date.now() }; },
            unbind: async () => { bindings.data = undefined; },
        };
        const host = {
            live: () => undefined,
            create: async (id) => ({ sessionId: id, followup() { }, useModel: () => true, cancel() { }, dispose: async () => undefined }),
            resume: async () => undefined,
        };
        const runner = new SessionRunner({
            host,
            bindings,
            cwdFor: () => '/tmp',
            newSessionId: () => 'max-fixed',
        });
        const target = { chatId: 9 };
        await runner.prompt(target, [{ type: 'text', text: 'hello' }]);
        assert.equal(bindings.data?.sessionId, 'max-fixed');
        await runner.reset(target);
        assert.equal(bindings.data, undefined);
    });
});
