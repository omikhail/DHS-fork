import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { chunkText } from '../lib/chunk.js';

describe('chunk', () => {
    it('returns single chunk when under limit', () => {
        assert.deepEqual(chunkText('hello', 100), ['hello']);
    });

    it('splits long text', () => {
        const text = 'a'.repeat(25);
        const chunks = chunkText(text, 10);
        assert.ok(chunks.length >= 2);
        assert.equal(chunks.join(''), text);
    });
});
