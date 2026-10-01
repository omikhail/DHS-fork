import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

function keyOf(target) {
    return String(target.chatId);
}

export class ChatPreferences {
    constructor(file, accept) {
        this.file = file;
        this.accept = accept;
        this.values = new Map();
    }

    static async open(file, options) {
        const store = new ChatPreferences(file, options.accept);
        store.values = await read(file, options.accept);
        return store;
    }

    forChat(target) {
        return this.values.get(keyOf(target));
    }

    async set(target, value) {
        if (!this.accept(value))
            return;
        const next = new Map(this.values);
        next.set(keyOf(target), value);
        this.values = next;
        await this.persist();
    }

    async clear(target) {
        const next = new Map(this.values);
        if (!next.delete(keyOf(target)))
            return;
        this.values = next;
        await this.persist();
    }

    async persist() {
        const document = Object.fromEntries(this.values);
        const temporary = `${this.file}.${process.pid}.tmp`;
        await mkdir(dirname(this.file), { recursive: true });
        await writeFile(temporary, `${JSON.stringify(document, undefined, 2)}\n`, 'utf8');
        await rename(temporary, this.file);
    }
}

async function read(file, accept) {
    const values = new Map();
    let raw;
    try {
        raw = await readFile(file, 'utf8');
    }
    catch {
        return values;
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        return values;
    }
    if (typeof parsed !== 'object' || parsed === null)
        return values;
    for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'string' && accept(value))
            values.set(key, value);
    }
    return values;
}
