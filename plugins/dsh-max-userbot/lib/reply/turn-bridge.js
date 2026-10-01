import { SILENT_LOGGER } from '../harness/types.js';
import { chunkText } from '../chunk.js';

export class TurnReplyBridge {
    constructor(options) {
        this.options = options;
        this.active = new Map();
        this.logger = options.logger ?? SILENT_LOGGER;
    }

    async handle(sessionId, event) {
        try {
            switch (event.type) {
                case 'turn/start':
                    return this.onTurnStart(sessionId, event);
                case 'assistant/message':
                    return this.onMessage(sessionId, event);
                case 'turn/end':
                    return await this.onTurnEnd(sessionId, event);
                default:
                    return;
            }
        }
        catch (error) {
            this.logger.warn('[dsh-max-userbot] failed to deliver a turn reply', error);
        }
    }

    onTurnStart(sessionId, event) {
        this.trackTurn(sessionId, event.data.turn);
    }

    onMessage(sessionId, event) {
        const entry = this.active.get(sessionId);
        if (!entry || entry.turn !== event.data.turn)
            return;
        const text = (event.data.message.content ?? [])
            .filter((block) => block.type === 'text')
            .map((block) => block.text ?? '')
            .join('');
        if (text !== '')
            entry.finalText = text;
    }

    async onTurnEnd(sessionId, event) {
        const entry = this.active.get(sessionId);
        if (!entry || entry.turn !== event.data.turn)
            return;
        this.active.delete(sessionId);
        const reason = event.data.reason;
        let text = entry.finalText ?? '';
        if (reason?.kind === 'error') {
            const failure = reason.error ?? { message: 'the turn failed' };
            if (!text)
                text = `⚠️ ${failure.message ?? 'the turn failed'}`;
        }
        if (text.trim() === '')
            return;
        const context = this.options.replyContext.forSession(sessionId);
        if (!context)
            return;
        const chunks = chunkText(text, this.options.maxChars);
        for (const chunk of chunks)
            await this.options.deliver(context, chunk);
    }

    /** @param {string} sessionId */
    trackTurn(sessionId, turn) {
        this.active.set(sessionId, { turn, finalText: undefined });
    }

    async dispose() {
        this.active.clear();
    }
}
