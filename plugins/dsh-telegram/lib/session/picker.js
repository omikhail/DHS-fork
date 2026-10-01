/**
 * Picking up a conversation that `/new` left behind.
 *
 * The harness keeps every session's log, but the binding naming the current
 * one is replaced, so from a phone `/new` is a one-way door: someone who
 * starts a fresh conversation to ask one quick thing loses the one they were
 * in the middle of.
 *
 * Offered as buttons rather than as `/resume 3`, for the same reason the
 * recovery offer is: the list is already on screen, and asking someone to read
 * an index off it and type a number back is asking them to do a computer's
 * job. It also means there is nothing to mistype.
 *
 * ## Why this does not use PendingRegistry
 *
 * Earlier versions awaited a button press inside `offer()`, which blocked
 * the poll loop: `getUpdates` is not called again until the current update's
 * handler returns, and the callback query that would settle the promise
 * arrives as a new update the blocked loop cannot fetch.  Moving the
 * adoption into `handleCallback` frees the loop: `offer()` returns after
 * sending the keyboard, and the button press is handled in a separate
 * update.
 */
import { randomUUID } from 'node:crypto';
import { escapeHtml } from '../render/escape.js';
import { SILENT_LOGGER } from '../harness/types.js';
/** Prefix marking callback data as belonging to a session picker. */
const KIND = 's';
/** How many to offer; Telegram keyboards get unusable long before this. */
const OFFER = 8;
export class SessionPicker {
    options;
    logger;
    /** Open pickers keyed by token: target + past sessions, stored so handleCallback can find them. */
    openPickers = new Map();
    constructor(options) {
        this.options = options;
        this.logger = options.logger ?? SILENT_LOGGER;
    }
    /** Mint a short, collision-free token for one picker's callback data. */
    mintToken() {
        for (;;) {
            const token = randomUUID().replace(/-/g, '').slice(0, 12);
            if (!this.openPickers.has(token))
                return token;
        }
    }
    /**
     * Offer this chat's earlier conversations.
     *
     * Sends the keyboard and returns immediately — the poll loop is not blocked.
     * When the user presses a button, `handleCallback` picks up the stored
     * data and performs the adoption in a separate async turn.
     *
     * @param target - the conversation asking.
     */
    async offer(target) {
        const current = this.options.currentSession(target);
        const past = this.options
            .history.forChat(target)
            .filter((entry) => entry.sessionId !== current)
            .slice(0, OFFER);
        if (past.length === 0) {
            await this.say(target, current === undefined
                ? 'No conversations yet — send a message to start one.'
                : 'This is the only conversation in this chat so far.');
            return;
        }
        const token = this.mintToken();
        this.openPickers.set(token, { target, past });
        this.logger.info(`[dsh-telegram] session picker: opened with ${past.length} session(s), token=${token}, chat=${target.chatId}`);
        const keyboard = past.map((entry, index) => [
            {
                text: labelOf(entry),
                callbackData: `${KIND}:${token}:${index}`,
            },
        ]);
        await this.say(target, [
            '<b>Earlier conversations</b>',
            '',
            'Pick one to carry on with. The one you are in now stays where it is.',
        ].join('\n'), keyboard);
        this.logger.info(`[dsh-telegram] session picker: keyboard sent to chat=${target.chatId}, offer() returning — poll loop is free`);
    }
    /**
     * Route one button press.
     *
     * Called from the poll loop when a callback_query arrives.  Looks up
     * the stored picker data, adopts the chosen session, and confirms in
     * chat — all in a fire-and-forget async turn so `handleCallback`
     * returns `true` immediately and never blocks the poll loop.
     *
     * @param data - raw `callback_data` from the update.
     * @returns whether the press belonged to an open picker.
     */
    handleCallback(data) {
        if (data === undefined)
            return false;
        const parts = data.split(':');
        if (parts.length !== 3 || parts[0] !== KIND)
            return false;
        const token = parts[1];
        const index = parts[2];
        if (token === '' || !/^\d+$/.test(index))
            return false;
        const stored = this.openPickers.get(token);
        if (!stored) {
            this.logger.info(`[dsh-telegram] session picker callback: expired or unknown token=${token}`);
            return false;
        }
        // Consume the token — one use only.
        this.openPickers.delete(token);
        const entryIndex = Number.parseInt(index, 10);
        const chosen = stored.past[entryIndex];
        if (!chosen) {
            this.logger.info(`[dsh-telegram] session picker callback: index=${index} out of range (${stored.past.length} sessions), ignoring`);
            return true;
        }
        this.logger.info(`[dsh-telegram] session picker callback: adopting session=${chosen.sessionId} chat=${stored.target.chatId}`);
        // Fire-and-forget: the adoption runs in its own async turn and never
        // blocks the poll loop.  handleCallback returns true immediately.
        this.adoptAndConfirm(stored.target, chosen).catch((error) => {
            this.logger.error('[dsh-telegram] session picker: adoption failed', error);
        });
        return true;
    }
    /**
     * Adopt a chosen session and confirm in chat.
     *
     * Separated from handleCallback so it can run async without blocking
     * the poll loop.  Logs and reports errors in chat.
     */
    async adoptAndConfirm(target, chosen) {
        try {
            await this.options.adopt(target, chosen.sessionId);
            await this.say(target, `↩️ Back in <b>${escapeHtml(labelOf(chosen))}</b>.\n\n` +
                `<code>${escapeHtml(chosen.cwd)}</code>`);
            this.logger.info(`[dsh-telegram] session picker: adopted session=${chosen.sessionId} cwd=${chosen.cwd} for chat=${target.chatId}`);
        }
        catch (error) {
            this.logger.error('[dsh-telegram] session picker: could not adopt session', error);
            await this.say(target, '⚠️ That conversation could not be reopened.');
        }
    }
    /** Post one message, swallowing delivery failures. */
    async say(target, html, keyboard) {
        try {
            await this.options.surface.send(target, html, keyboard);
        }
        catch (error) {
            this.logger.warn('[dsh-telegram] could not offer the session list', error);
        }
    }
}
/** A button label: what the conversation opened with, or when it started. */
function labelOf(entry) {
    if (entry.label !== undefined && entry.label !== '')
        return entry.label;
    return new Date(entry.startedAt).toISOString().slice(0, 16).replace('T', ' ');
}
//# sourceMappingURL=picker.js.map