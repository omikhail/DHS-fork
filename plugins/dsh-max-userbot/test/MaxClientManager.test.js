import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import {
    closeClient,
    getClientCountForTests,
    getOwnerId,
    offMessage,
    onMessage,
    replyToMessage,
    resetClientsForTests,
    sendMessage,
    setClientForTests,
} from '../lib/transport/MaxClientManager.js';

const incoming = {
    chatId: 10,
    messageId: 'm10',
    fromId: 5,
    text: 'ping',
    time: 1,
    raw: { id: 'm10', sender: 5, time: 1, type: 'USER' },
};

describe('MaxClientManager', () => {
    afterEach(() => {
        resetClientsForTests();
    });

    it('dispatches messages to registered handlers', () => {
        const calls = [];
        const client = {
            reply: async () => undefined,
            sendMessage: async () => undefined,
            getMe: () => ({ id: 99 }),
        };
        const entry = setClientForTests('cred-2', client);
        const handler = (message) => calls.push(message);
        onMessage('cred-2', handler);
        entry.dispatch(incoming);
        assert.equal(calls.length, 1);
        offMessage('cred-2', handler);
        entry.dispatch(incoming);
        assert.equal(calls.length, 1);
    });

    it('replyToMessage and sendMessage delegate to client', async () => {
        const replies = [];
        const sends = [];
        setClientForTests('cred-3', {
            reply: async (_m, text) => { replies.push(text); },
            sendMessage: async (chatId, text) => { sends.push([chatId, text]); },
            getMe: () => ({ id: 42 }),
        });
        await replyToMessage('cred-3', incoming, 'pong');
        await sendMessage('cred-3', 10, 'hello');
        assert.deepEqual(replies, ['pong']);
        assert.deepEqual(sends, [[10, 'hello']]);
    });

    it('getOwnerId returns me id or undefined', async () => {
        setClientForTests('cred-owner', { getMe: () => ({ id: 437022255 }) });
        assert.equal(await getOwnerId('cred-owner'), 437022255);
        assert.equal(await getOwnerId('missing'), undefined);
    });

    it('closeClient stops client and clears registry', async () => {
        let stopped = 0;
        setClientForTests('cred-close', { stop: async () => { stopped += 1; }, getMe: () => ({ id: 1 }) });
        await closeClient('cred-close');
        assert.equal(stopped, 1);
        assert.equal(getClientCountForTests(), 0);
    });

    it('throws when client is missing for message operations', async () => {
        assert.throws(() => onMessage('missing', () => undefined), /not initialized/);
        await assert.rejects(() => replyToMessage('missing', incoming, 'x'), /not initialized/);
    });
});
