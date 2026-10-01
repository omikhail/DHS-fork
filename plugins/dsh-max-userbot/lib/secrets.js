/** Values that must never appear in logs, status files, or chat replies. */
const MIN_SECRET_LENGTH = 8;

export class SecretRegistry {
    secrets = new Set();

    /** @param {string | undefined} secret */
    protect(secret) {
        if (secret === undefined)
            return;
        if (secret.length < MIN_SECRET_LENGTH)
            return;
        this.secrets.add(secret);
    }

    /** @param {string} text */
    redact(text) {
        let safe = text;
        for (const secret of this.secrets)
            safe = safe.split(secret).join('<redacted>');
        return safe;
    }

    redactor() {
        return (text) => this.redact(text);
    }
}
