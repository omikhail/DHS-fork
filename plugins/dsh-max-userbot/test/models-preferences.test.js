import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { matchRoute, formatRoute } from '../lib/session/models.js';
import { ChatPreferences } from '../lib/session/preferences.js';
import { SessionRunner } from '../lib/session/runner.js';
import { BindingStore } from '../lib/session/bindings.js';

describe('models', () => {
    it('matchRoute finds qualified provider/model', () => {
        const providers = [{ id: 'openai', models: [{ id: 'gpt-4' }] }];
        const result = matchRoute('openai/gpt-4', providers);
        assert.equal(result.kind, 'route');
        assert.equal(formatRoute(result.route), 'openai/gpt-4');
    });
});

describe('preferences and runner stop', () => {
    it('stores per-chat cwd', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'max-pref-'));
        const store = await ChatPreferences.open(join(dir, 'cwd.json'), { accept: (v) => v.startsWith('/') });
        const target = { chatId: 3 };
        await store.set(target, '/tmp/a');
        assert.equal(store.forChat(target), '/tmp/a');
    });

    it('stop cancels live agent', async () => {
        let cancelled = false;
        const bindings = {
            data: { sessionId: 'max-1', createdAt: Date.now() },
            forChat: () => bindings.data,
            bind: async () => undefined,
            unbind: async () => undefined,
        };
        const host = {
            live: (id) => (id === 'max-1'
                ? { sessionId: 'max-1', followup() { }, useModel: () => true, cancel() { cancelled = true; }, dispose: async () => undefined }
                : undefined),
            create: async () => undefined,
            resume: async () => undefined,
        };
        const runner = new SessionRunner({ host, bindings, cwdFor: () => '/tmp' });
        assert.equal(await runner.stop({ chatId: 1 }), true);
        assert.equal(cancelled, true);
    });

    it('unbind removes binding', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'max-unbind-'));
        const store = await BindingStore.open(join(dir, 'b.json'));
        const target = { chatId: 5 };
        await store.bind(target, 'max-x');
        await store.unbind(target);
        assert.equal(store.forChat(target), undefined);
    });
});
