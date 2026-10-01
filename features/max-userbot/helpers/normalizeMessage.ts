import type { IncomingMessage } from 'max-account-api';

export interface MaxUserbotTriggerItem {
  channel: 'max';
  chatId: number;
  messageId: string;
  fromId: number;
  text: string;
  messageType: 'text' | 'voice' | 'other';
  voiceUrl?: string;
  voiceDurationMs?: number;
  attachments?: unknown[];
  is_owner_message?: boolean;
  raw: unknown;
  _reply: {
    chatId: number;
    messageId: string;
  };
}

export function shouldSkipMessage(
  message: IncomingMessage,
  ownerId?: number,
): boolean {
  if (message.raw?.status) {
    return true;
  }
  return false;
}

function findAudioAttachment(
  attachments: Array<{ _type?: string; url?: string; duration?: number }> | undefined,
): { _type?: string; url?: string; duration?: number } | undefined {
  if (!attachments?.length) {
    return undefined;
  }
  return attachments.find((attach) => attach._type === 'AUDIO' && attach.url);
}

export function normalizeMessage(
  message: IncomingMessage,
  ownerId?: number,
): MaxUserbotTriggerItem | null {
  if (shouldSkipMessage(message, ownerId)) {
    return null;
  }

  const attachments = message.raw?.attaches ?? [];
  const audio = findAudioAttachment(attachments);
  const text = message.text ?? '';
  const hasMediaAttach = attachments.some(
    (attach) => attach._type && attach._type !== 'AUDIO',
  );

  let messageType: MaxUserbotTriggerItem['messageType'] = 'other';
  if (audio?.url) {
    messageType = 'voice';
  } else if (hasMediaAttach) {
    messageType = 'other';
  } else if (text.trim()) {
    messageType = 'text';
  }

  const item: MaxUserbotTriggerItem = {
    channel: 'max',
    chatId: message.chatId,
    messageId: String(message.messageId),
    fromId: message.fromId,
    text,
    messageType,
    attachments,
    is_owner_message: ownerId != null && message.fromId === ownerId,
    raw: message,
    _reply: {
      chatId: message.chatId,
      messageId: String(message.messageId),
    },
  };

  if (audio?.url) {
    item.voiceUrl = audio.url;
    if (audio.duration != null) {
      item.voiceDurationMs = audio.duration;
    }
  }

  return item;
}
