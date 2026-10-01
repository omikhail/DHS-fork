import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { TurnReplyBridge } from '../lib/reply/turn-bridge.js';

describe('TurnReplyBridge', () => {
    it('delivers final text on turn/end', async () => {
        const delivered = [];
        const incoming = { chatId: 1, messageId: 'm' };
        const bridge = new TurnReplyBridge({
            maxChars: 4000,
            replyContext: {
                forSession: (id) => (id === 'sess-1' ? incoming : undefined),
            },
            deliver: async (_ctx, text) => { delivered.push(text); },
        });
        bridge.trackTurn('sess-1', 1);
        bridge.onMessage('sess-1', {
            type: 'assistant/message',
            data: {
                turn: 1,
                message: { content: [{ type: 'text', text: 'Hello from agent' }] },
            },
        });
        await bridge.handle('sess-1', { type: 'turn/end', data: { turn: 1, reason: { kind: 'complete' } } });
        assert.deepEqual(delivered, ['Hello from agent']);
    });
});
