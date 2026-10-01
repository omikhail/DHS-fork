import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseCommand } from '../lib/commands.js';

describe('commands', () => {
    it('parses bare slash commands', () => {
        assert.deepEqual(parseCommand('/help'), { name: 'help', args: '' });
        assert.deepEqual(parseCommand('/model list'), { name: 'model', args: 'list' });
    });

    it('ignores unknown commands', () => {
        assert.equal(parseCommand('/claim'), undefined);
    });

    it('accepts optional @suffix without bot username', () => {
        assert.deepEqual(parseCommand('/help@somebot'), { name: 'help', args: '' });
    });
});
