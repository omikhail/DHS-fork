import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { installModelSelection, parseRoute } from '../lib/harness/model-selection.js';

describe('installModelSelection', () => {
    it('wires agent request override', async () => {
        const selection = { current: { provider: 'p', model: 'm' } };
        const listeners = new Map();
        const agentCtx = {
            on(event, handler) {
                listeners.set(event, handler);
                return () => listeners.delete(event);
            },
        };
        installModelSelection(agentCtx, selection);
        const assemble = listeners.get('system-prompt/assemble');
        const request = listeners.get('agent/request');
        assert.ok(assemble);
        assert.ok(request);
        const assembled = await assemble({}, {}, async () => ({ variables: {} }));
        assert.equal(assembled.variables.provider, 'p');
        const resolved = await request({}, async () => ({ provider: 'x', model: 'y' }));
        assert.equal(resolved.provider, 'p');
        assert.equal(resolved.model, 'm');
    });

    it('parseRoute rejects malformed values', () => {
        assert.equal(parseRoute(''), undefined);
        assert.equal(parseRoute('noseparator'), undefined);
    });
});
