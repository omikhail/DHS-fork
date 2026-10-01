import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'vendor', 'max-account-api');

describe('vendored max-account-api', () => {
    it('uses MAX client version 26.32.1 in auth source', () => {
        const auth = fs.readFileSync(path.join(root, 'src', 'auth.ts'), 'utf8');
        assert.ok(auth.includes("appVersion: '26.32.1'"));
    });

    it('ships built dist with patched appVersion', () => {
        const authDist = path.join(root, 'dist', 'auth.js');
        assert.ok(fs.existsSync(authDist));
        const built = fs.readFileSync(authDist, 'utf8');
        assert.ok(built.includes("appVersion: '26.32.1'"));
    });

    it('imports from package entry', async () => {
        const mod = await import('max-account-api');
        assert.ok(mod.MaxClient);
        assert.ok(mod.DEFAULT_USER_AGENT);
    });
});
