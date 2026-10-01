import type { IncomingMessage } from 'max-account-api';

import {
  normalizeMessage,
  shouldSkipMessage,
} from '../helpers/normalizeMessage';

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
} as IncomingMessage;

describe('normalizeMessage', () => {
  it('normalizes text messages', () => {
    const item = normalizeMessage(baseMessage, 999);
    expect(item).toMatchObject({
      channel: 'max',
      chatId: 447047328,
      messageId: 'msg-1',
      fromId: 123,
      text: 'hello',
      messageType: 'text',
      _reply: {
        chatId: 447047328,
        messageId: 'msg-1',
      },
    });
    expect(item?.raw).toBe(baseMessage);
  });

  it('normalizes voice messages with AUDIO attach', () => {
    const voiceMessage = {
      chatId: 447047328,
      messageId: 'msg-voice',
      fromId: 123,
      text: '',
      time: 1_700_000_001,
      raw: {
        id: 'msg-voice',
        sender: 123,
        time: 1_700_000_001,
        type: 'USER',
        attaches: [
          {
            _type: 'AUDIO',
            url: 'https://a.oneme.ru/audio?cid=1',
            duration: 2960,
          },
        ],
      },
    } as IncomingMessage;

    const item = normalizeMessage(voiceMessage, 999);
    expect(item).toMatchObject({
      messageType: 'voice',
      voiceUrl: 'https://a.oneme.ru/audio?cid=1',
      voiceDurationMs: 2960,
      text: '',
    });
  });

  it('returns other for photo with caption (D1 escalate, not Sales text)', () => {
    const item = normalizeMessage(
      {
        chatId: 1,
        messageId: 'pic-cap',
        fromId: 2,
        text: 'образец, так сможете постричь?',
        time: 1,
        raw: {
          id: 'pic-cap',
          sender: 2,
          time: 1,
          type: 'USER',
          attaches: [{ _type: 'PHOTO', url: 'https://example.com/p.jpg' }],
        },
      } as IncomingMessage,
      999,
    );
    expect(item?.messageType).toBe('other');
    expect(item?.text).toBe('образец, так сможете постричь?');
  });

  it('returns other for messages without text or voice', () => {
    const item = normalizeMessage(
      {
        chatId: 1,
        messageId: 'x',
        fromId: 2,
        text: '',
        time: 1,
        raw: {
          id: 'x',
          sender: 2,
          time: 1,
          type: 'USER',
          attaches: [{ _type: 'PHOTO', url: 'https://example.com/p.jpg' }],
        },
      } as IncomingMessage,
      999,
    );
    expect(item?.messageType).toBe('other');
  });

  it('skips edited or removed messages', () => {
    expect(
      normalizeMessage(
        {
          ...baseMessage,
          raw: { ...baseMessage.raw, status: 'EDITED' },
        } as IncomingMessage,
        999,
      ),
    ).toBeNull();
    expect(
      shouldSkipMessage(
        {
          ...baseMessage,
          raw: { ...baseMessage.raw, status: 'REMOVED' },
        } as IncomingMessage,
        999,
      ),
    ).toBe(true);
  });

  it('does not skip owner messages; sets is_owner_message', () => {
    const item = normalizeMessage(baseMessage, 123);
    expect(item).not.toBeNull();
    expect(item?.is_owner_message).toBe(true);
    expect(shouldSkipMessage(baseMessage, 123)).toBe(false);
  });
});
