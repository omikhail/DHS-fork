import { randomUUID } from 'node:crypto';

/** @param {Array<{ type: string, text?: string }>} content */
export function buildUserMessage(content) {
    return Object.freeze({
        id: randomUUID(),
        role: 'user',
        content: Object.freeze(content.map((block) => Object.freeze({ ...block }))),
        source: Object.freeze({ kind: 'user' }),
    });
}
