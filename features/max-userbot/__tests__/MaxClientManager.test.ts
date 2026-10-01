jest.mock('max-account-api', () => ({
  DEFAULT_USER_AGENT: { appVersion: '26.32.1' },
  MaxClient: jest.fn(),
}));

import type { IncomingMessage } from 'max-account-api';
import { MaxClient } from 'max-account-api';

import {
  closeClient,
  getClientCountForTests,
  getOrCreateClient,
  getOwnerId,
  getRecoverDebounceMsForTests,
  offMessage,
  onMessage,
  replyToMessage,
  resetClientsForTests,
  sendMessage,
  setClientForTests,
} from '../transport/MaxClientManager';

type MockListener = (...args: unknown[]) => void;

function createMockMaxClient() {
  const listeners = new Map<string, Set<MockListener>>();
  const start = jest.fn().mockResolvedValue(undefined);
  const stop = jest.fn().mockResolvedValue(undefined);

  const client = {
    start,
    stop,
    on: jest.fn((event: string, callback: MockListener) => {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)!.add(callback);
    }),
    emit: (event: string, ...args: unknown[]) => {
      for (const callback of listeners.get(event) ?? []) {
        callback(...args);
      }
    },
    getMe: jest.fn(() => ({ id: 42 })),
    reply: jest.fn().mockResolvedValue(undefined),
    sendMessage: jest.fn().mockResolvedValue(undefined),
  };

  return { client, start, stop, listeners };
}

const TEST_CREDS = {
  deviceId: 'dev',
  loginToken: 'tok',
};

describe('MaxClientManager', () => {
  afterEach(() => {
    jest.useRealTimers();
    resetClientsForTests();
  });

  it('wires client message events to registered handlers', async () => {
    const { client, start } = createMockMaxClient();
    (MaxClient as unknown as jest.Mock).mockImplementation(() => client);

    await getOrCreateClient('cred-wire', TEST_CREDS);

    const handler = jest.fn();
    onMessage('cred-wire', handler);

    const message = {
      chatId: 1,
      messageId: 'wire',
      fromId: 2,
      text: 'event',
      time: 1,
      raw: {
        id: 'wire',
        sender: 2,
        time: 1,
        type: 'USER',
      },
    } as IncomingMessage;

    client.emit('message', message);
    expect(handler).toHaveBeenCalledWith(message);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('reuses singleton client per credentials id when healthy (T1)', async () => {
    const { client, start } = createMockMaxClient();
    (MaxClient as unknown as jest.Mock).mockImplementation(() => client);

    await getOrCreateClient('cred-1', TEST_CREDS);
    await getOrCreateClient('cred-1', TEST_CREDS);

    expect(start).toHaveBeenCalledTimes(1);
    expect(getClientCountForTests()).toBe(1);
  });

  it('recovers unhealthy client on next getOrCreateClient after error (T2)', async () => {
    const starts: jest.Mock[] = [];
    const stops: jest.Mock[] = [];

    (MaxClient as unknown as jest.Mock).mockImplementation(() => {
      const { client, start, stop } = createMockMaxClient();
      starts.push(start);
      stops.push(stop);
      return client;
    });

    const first = await getOrCreateClient('cred-recover', TEST_CREDS);
    const handler = jest.fn();
    onMessage('cred-recover', handler);

    first.client.emit('error', new Error('WebSocket is not open'));

    (first.client.getMe as jest.Mock).mockReturnValue(null);

    const second = await getOrCreateClient('cred-recover', TEST_CREDS);

    expect(starts).toHaveLength(2);
    expect(starts[0]).toHaveBeenCalledTimes(1);
    expect(starts[1]).toHaveBeenCalledTimes(1);
    expect(stops[0]).toHaveBeenCalledTimes(1);
    expect(second.handlers.has(handler)).toBe(true);
    expect(getClientCountForTests()).toBe(1);
  });

  it('keeps handlers and delivers messages after debounced recover (T3)', async () => {
    jest.useFakeTimers();

    let currentClient: ReturnType<typeof createMockMaxClient>['client'] | undefined;
    const starts: jest.Mock[] = [];
    const stops: jest.Mock[] = [];

    (MaxClient as unknown as jest.Mock).mockImplementation(() => {
      const mock = createMockMaxClient();
      starts.push(mock.start);
      stops.push(mock.stop);
      currentClient = mock.client;
      return mock.client;
    });

    await getOrCreateClient('cred-debounce', TEST_CREDS);
    const handler = jest.fn();
    onMessage('cred-debounce', handler);

    currentClient!.emit('error', new Error('WebSocket is not open'));
    await jest.advanceTimersByTimeAsync(getRecoverDebounceMsForTests());

    expect(stops[0]).toHaveBeenCalledTimes(1);
    expect(starts).toHaveLength(2);
    expect(starts[1]).toHaveBeenCalledTimes(1);

    const message = {
      chatId: 1,
      messageId: 'after-recover',
      fromId: 2,
      text: 'hello again',
      time: 1,
      raw: {
        id: 'after-recover',
        sender: 2,
        time: 1,
        type: 'USER',
      },
    } as IncomingMessage;

    currentClient!.emit('message', message);
    expect(handler).toHaveBeenCalledWith(message);
  });

  it('coalesces burst errors into one recover (T4)', async () => {
    jest.useFakeTimers();

    const starts: jest.Mock[] = [];
    const stops: jest.Mock[] = [];

    (MaxClient as unknown as jest.Mock).mockImplementation(() => {
      const mock = createMockMaxClient();
      starts.push(mock.start);
      stops.push(mock.stop);
      return mock.client;
    });

    const entry = await getOrCreateClient('cred-burst', TEST_CREDS);

    entry.client.emit('error', new Error('one'));
    entry.client.emit('error', new Error('two'));
    entry.client.emit('close', 1006, 'gone');

    await jest.advanceTimersByTimeAsync(getRecoverDebounceMsForTests());

    expect(stops[0]).toHaveBeenCalledTimes(1);
    expect(stops.slice(1).every((stop) => stop.mock.calls.length === 0)).toBe(true);
    expect(starts).toHaveLength(2);
  });

  it('dispatches messages to registered handlers', async () => {
    const message = {
      chatId: 1,
      messageId: 'm1',
      fromId: 2,
      text: 'hi',
      time: 1,
      raw: {
        id: 'm1',
        sender: 2,
        time: 1,
        type: 'USER',
      },
    } as IncomingMessage;

    const reply = jest.fn().mockResolvedValue(undefined);
    const sendMessageMock = jest.fn().mockResolvedValue(undefined);
    const client = {
      reply,
      sendMessage: sendMessageMock,
      getMe: () => ({ id: 99 }),
    };

    const entry = setClientForTests('cred-2', client as never);
    const handler = jest.fn();
    onMessage('cred-2', handler);

    entry.dispatch(message);
    expect(handler).toHaveBeenCalledWith(message);

    offMessage('cred-2', handler);
    entry.dispatch(message);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('replyToMessage and sendMessage delegate to client', async () => {
    const reply = jest.fn().mockResolvedValue(undefined);
    const sendMessageMock = jest.fn().mockResolvedValue(undefined);
    setClientForTests('cred-3', {
      reply,
      sendMessage: sendMessageMock,
      getMe: () => ({ id: 42 }),
    } as never);

    const incoming = {
      chatId: 10,
      messageId: 'm10',
      fromId: 5,
      text: 'ping',
      time: 1,
      raw: {
        id: 'm10',
        sender: 5,
        time: 1,
        type: 'USER',
      },
    } as IncomingMessage;

    await replyToMessage('cred-3', incoming, 'pong');
    await sendMessage('cred-3', 10, 'hello');

    expect(reply).toHaveBeenCalledWith(incoming, 'pong');
    expect(sendMessageMock).toHaveBeenCalledWith(10, 'hello');
  });

  it('getOwnerId returns me id or undefined', async () => {
    setClientForTests('cred-owner', {
      getMe: () => ({ id: 437022255 }),
    } as never);

    expect(await getOwnerId('cred-owner')).toBe(437022255);
    expect(await getOwnerId('missing')).toBeUndefined();
  });

  it('closeClient stops client and clears registry', async () => {
    const stop = jest.fn().mockResolvedValue(undefined);
    setClientForTests('cred-close', { stop, getMe: () => ({ id: 1 }) } as never);

    await closeClient('cred-close');

    expect(stop).toHaveBeenCalledTimes(1);
    expect(getClientCountForTests()).toBe(0);
    await closeClient('cred-close');
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('throws when client is missing for message operations', async () => {
    const incoming = {
      chatId: 1,
      messageId: 'm',
      fromId: 2,
      text: 'x',
      time: 1,
      raw: {
        id: 'm',
        sender: 2,
        time: 1,
        type: 'USER',
      },
    } as IncomingMessage;

    expect(() => onMessage('missing', jest.fn())).toThrow(/not initialized/);
    await expect(replyToMessage('missing', incoming, 'x')).rejects.toThrow(/not initialized/);
    await expect(sendMessage('missing', 1, 'x')).rejects.toThrow(/not initialized/);
  });
});
