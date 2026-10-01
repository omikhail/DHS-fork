import fs from 'node:fs';
import path from 'node:path';

const VENDOR_ROOT = path.resolve(__dirname, '..', 'vendor', 'max-account-api');
const AUTH_SRC = path.join(VENDOR_ROOT, 'src', 'auth.ts');
const TRANSPORT_SRC = path.join(VENDOR_ROOT, 'src', 'raw-transport.ts');

describe('vendored max-account-api', () => {
  it('uses MAX client version 26.32.1 in auth source', () => {
    const auth = fs.readFileSync(AUTH_SRC, 'utf8');
    expect(auth).toContain("appVersion: '26.32.1'");
    expect(auth).not.toContain("appVersion: '26.5.5'");
  });

  it('uses updated HELLO template bytes in raw-transport source', () => {
    const transport = fs.readFileSync(TRANSPORT_SRC, 'utf8');
    expect(transport).toContain('732362e33322e31');
    expect(transport).not.toContain('732362e31352e31');
    expect(transport).toContain('cd1aaf');
    expect(transport).not.toContain('cd1a22');
  });

  it('ships built dist with patched appVersion', () => {
    const authDist = path.join(VENDOR_ROOT, 'dist', 'auth.js');
    expect(fs.existsSync(authDist)).toBe(true);
    const built = fs.readFileSync(authDist, 'utf8');
    expect(built).toContain("appVersion: '26.32.1'");
  });
});
