/**
 * @param {import('max-account-api').IncomingMessage} message
 * @param {number} [ownerId]
 */
export function shouldSkipMessage(message, ownerId) {
    if (message.raw?.status)
        return true;
    return false;
}

function findAudioAttachment(attachments) {
    if (!attachments?.length)
        return undefined;
    return attachments.find((attach) => attach._type === 'AUDIO' && attach.url);
}

/**
 * @param {import('max-account-api').IncomingMessage} message
 * @param {number} [ownerId]
 */
export function normalizeMessage(message, ownerId) {
    if (shouldSkipMessage(message, ownerId))
        return null;
    const attachments = message.raw?.attaches ?? [];
    const audio = findAudioAttachment(attachments);
    const text = message.text ?? '';
    const hasMediaAttach = attachments.some((attach) => attach._type && attach._type !== 'AUDIO');
    let messageType = 'other';
    if (audio?.url)
        messageType = 'voice';
    else if (hasMediaAttach)
        messageType = 'other';
    else if (text.trim())
        messageType = 'text';
    const item = {
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
        if (audio.duration != null)
            item.voiceDurationMs = audio.duration;
    }
    return item;
}
