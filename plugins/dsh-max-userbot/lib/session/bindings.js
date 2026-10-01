import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/** @param {{ chatId: number }} target */
function keyOf(target) {
    return String(target.chatId);
}

export class BindingStore {
    constructor(file) {
        this.file = file;
        this.bindings = new Map();
        this.bySession = new Map();
    }

    static async open(file) {
        const store = new BindingStore(file);
        store.replaceAll(await readBindings(file));
        return store;
    }

    forChat(target) {
        return this.bindings.get(keyOf(target));
    }

    forSession(sessionId) {
        const key = this.bySession.get(sessionId);
        const binding = key === undefined ? undefined : this.bindings.get(key);
        if (!binding)
            return undefined;
        return { chatId: binding.chatId };
    }

    async bind(target, sessionId) {
        const key = keyOf(target);
        const now = Date.now();
        const previous = this.bindings.get(key);
        const next = new Map(this.bindings);
        next.set(key, {
            chatId: target.chatId,
            sessionId,
            createdAt: previous?.createdAt ?? now,
            updatedAt: now,
        });
        this.replaceAll(next);
        await this.persist();
    }

    async unbind(target) {
        const next = new Map(this.bindings);
        if (!next.delete(keyOf(target)))
            return;
        this.replaceAll(next);
        await this.persist();
    }

    replaceAll(bindings) {
        this.bindings = new Map(bindings);
        this.bySession = new Map([...bindings].map(([key, binding]) => [binding.sessionId, key]));
    }

    async persist() {
        const document = Object.fromEntries(this.bindings);
        const temporary = `${this.file}.${process.pid}.tmp`;
        await mkdir(dirname(this.file), { recursive: true });
        await writeFile(temporary, `${JSON.stringify(document, undefined, 2)}\n`, 'utf8');
        await rename(temporary, this.file);
    }
}

async function readBindings(file) {
    const bindings = new Map();
    let raw;
    try {
        raw = await readFile(file, 'utf8');
    }
    catch {
        return bindings;
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        return bindings;
    }
    if (typeof parsed !== 'object' || parsed === null)
        return bindings;
    for (const [key, value] of Object.entries(parsed)) {
        const binding = asBinding(value);
        if (binding)
            bindings.set(key, binding);
    }
    return bindings;
}

function asBinding(value) {
    if (typeof value !== 'object' || value === null)
        return undefined;
    const record = value;
    if (typeof record.chatId !== 'number' || typeof record.sessionId !== 'string')
        return undefined;
    return {
        chatId: record.chatId,
        sessionId: record.sessionId,
        createdAt: typeof record.createdAt === 'number' ? record.createdAt : Date.now(),
        updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : Date.now(),
    };
}
