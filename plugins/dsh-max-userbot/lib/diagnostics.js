import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export class StatusFile {
    constructor(file, redact = (text) => text) {
        this.file = file;
        this.redact = redact;
    }

    /** @param {'idle' | 'starting' | 'connected' | 'failed'} state */
    async publish(state, extra = {}) {
        const snapshot = {
            state,
            ...(extra.account !== undefined ? { account: extra.account } : {}),
            ...(extra.detail !== undefined ? { detail: this.redact(extra.detail) } : {}),
            updatedAt: new Date().toISOString(),
        };
        try {
            const temporary = `${this.file}.${process.pid}.tmp`;
            await mkdir(dirname(this.file), { recursive: true });
            await writeFile(temporary, `${JSON.stringify(snapshot, undefined, 2)}\n`, 'utf8');
            await rename(temporary, this.file);
        }
        catch {
            // Diagnostics must never break the plugin.
        }
    }
}

/** @param {unknown} error */
export function describeError(error) {
    if (error instanceof Error)
        return error.message;
    return String(error);
}
