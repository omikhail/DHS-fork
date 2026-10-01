import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PhoneWhitelistPolicy, normalizePhone } from '../lib/access.js';

function mockCache(map = new Map()) {
    return {
        get: (id) => map.get(String(id)),
        remember: async (id, phone) => { map.set(String(id), phone); },
    };
}

describe('access', () => {
    it('normalizePhone strips non-digits', () => {
        assert.equal(normalizePhone('+7 (900) 123-45-67'), '79001234567');
    });

    it('denies everyone when lists are empty', async () => {
        const policy = new PhoneWhitelistPolicy({
            allowPhones: [],
            allowFrom: [],
            cache: mockCache(),
            resolveContact: async () => undefined,
        });
        assert.equal(await policy.check(1), 'denied');
    });

    it('allows allowFrom without phone lookup', async () => {
        const policy = new PhoneWhitelistPolicy({
            allowPhones: [],
            allowFrom: [42],
            cache: mockCache(),
            resolveContact: async () => undefined,
        });
        assert.equal(await policy.check(42), 'allowed');
        assert.equal(await policy.check(99), 'denied');
    });

    it('allows whitelisted phone from contact lookup', async () => {
        const cache = mockCache();
        const policy = new PhoneWhitelistPolicy({
            allowPhones: ['+79001234567'],
            allowFrom: [],
            cache,
            resolveContact: async () => ({ phone: '79001234567' }),
        });
        assert.equal(await policy.check(5), 'allowed');
        assert.equal(cache.get(5), '79001234567');
    });
});
