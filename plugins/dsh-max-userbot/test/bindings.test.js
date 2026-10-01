import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { BindingStore } from '../lib/session/bindings.js';

describe('BindingStore', () => {
    it('binds and persists chat to session', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'max-bind-'));
        const file = join(dir, 'bindings.json');
        const store = await BindingStore.open(file);
        const target = { chatId: 100 };
        await store.bind(target, 'max-test-session');
        assert.equal(store.forChat(target)?.sessionId, 'max-test-session');
        assert.deepEqual(store.forSession('max-test-session'), { chatId: 100 });
        const raw = JSON.parse(await readFile(file, 'utf8'));
        assert.equal(raw['100'].sessionId, 'max-test-session');
    });
});
