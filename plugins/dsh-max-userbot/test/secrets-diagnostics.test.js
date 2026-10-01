import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { StatusFile } from '../lib/diagnostics.js';
import { SecretRegistry } from '../lib/secrets.js';
import { PhoneCache } from '../lib/phone-cache.js';

describe('secrets and diagnostics', () => {
    it('redacts registered secrets', () => {
        const registry = new SecretRegistry();
        registry.protect('short');
        registry.protect('longsecretvalue');
        assert.equal(registry.redact('token longsecretvalue here'), 'token <redacted> here');
    });

    it('writes status file', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'max-status-'));
        const file = join(dir, 'status.json');
        const status = new StatusFile(file);
        await status.publish('connected', { account: '42' });
        const raw = JSON.parse(await readFile(file, 'utf8'));
        assert.equal(raw.state, 'connected');
        assert.equal(raw.account, '42');
    });
});

describe('PhoneCache', () => {
    it('persists phone lookups', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'max-phone-'));
        const cache = await PhoneCache.open(join(dir, 'phone-cache.json'));
        await cache.remember(7, '79001112233');
        assert.equal(cache.get(7), '79001112233');
        const reopened = await PhoneCache.open(join(dir, 'phone-cache.json'));
        assert.equal(reopened.get(7), '79001112233');
    });
});
