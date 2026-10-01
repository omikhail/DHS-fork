/** Maps harness session id → last inbound MAX message used for reply threading. */
export class ReplyContext {
    constructor() {
        this.bySession = new Map();
    }

    remember(sessionId, incoming) {
        this.bySession.set(sessionId, incoming);
    }

    forSession(sessionId) {
        return this.bySession.get(sessionId);
    }

    clear() {
        this.bySession.clear();
    }
}
