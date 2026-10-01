import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { normalizeMessage, shouldSkipMessage } from '../lib/normalizeMessage.js';

const baseMessage = {
    chatId: 447047328,
    messageId: 'msg-1',
    fromId: 123,
    text: 'hello',
    time: 1_700_000_000,
    raw: {
        id: 'msg-1',
        sender: 123,
        time: 1_700_000_000,
        type: 'USER',
        attaches: [],
    },
};

describe('normalizeMessage', () => {
    it('normalizes text messages', () => {
        const item = normalizeMessage(baseMessage, 999);
        assert.equal(item.channel, 'max');
        assert.equal(item.chatId, 447047328);
        assert.equal(item.messageType, 'text');
        assert.deepEqual(item._reply, { chatId: 447047328, messageId: 'msg-1' });
    });

    it('normalizes voice messages with AUDIO attach', () => {
        const voiceMessage = {
            ...baseMessage,
            messageId: 'msg-voice',
            text: '',
            raw: {
                ...baseMessage.raw,
                id: 'msg-voice',
                attaches: [{ _type: 'AUDIO', url: 'https://a.oneme.ru/audio?cid=1', duration: 2960 }],
            },
        };
        const item = normalizeMessage(voiceMessage, 999);
        assert.equal(item.messageType, 'voice');
        assert.equal(item.voiceUrl, 'https://a.oneme.ru/audio?cid=1');
    });

    it('skips edited or removed messages', () => {
        assert.equal(normalizeMessage({
            ...baseMessage,
            raw: { ...baseMessage.raw, status: 'EDITED' },
        }, 999), null);
        assert.equal(shouldSkipMessage({
            ...baseMessage,
            raw: { ...baseMessage.raw, status: 'REMOVED' },
        }, 999), true);
    });

    it('does not skip owner messages; sets is_owner_message', () => {
        const item = normalizeMessage(baseMessage, 123);
        assert.ok(item);
        assert.equal(item.is_owner_message, true);
    });
});
