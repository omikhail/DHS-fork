import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { normalizePhone } from './access.js';

export class PhoneCache {
    constructor(file) {
        this.file = file;
        this.byFromId = new Map();
    }

    static async open(file) {
        const cache = new PhoneCache(file);
        cache.byFromId = await read(file);
        return cache;
    }

    get(fromId) {
        return this.byFromId.get(String(fromId));
    }

    async remember(fromId, phoneDigits) {
        const key = String(fromId);
        if (this.byFromId.get(key) === phoneDigits)
            return;
        const next = new Map(this.byFromId);
        next.set(key, phoneDigits);
        this.byFromId = next;
        await this.persist();
    }

    async persist() {
        const document = Object.fromEntries(this.byFromId);
        const temporary = `${this.file}.${process.pid}.tmp`;
        await mkdir(dirname(this.file), { recursive: true });
        await writeFile(temporary, `${JSON.stringify(document, undefined, 2)}\n`, 'utf8');
        await rename(temporary, this.file);
    }
}

async function read(file) {
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
        if (typeof value === 'string' && normalizePhone(value))
            values.set(key, normalizePhone(value));
    }
    return values;
}
