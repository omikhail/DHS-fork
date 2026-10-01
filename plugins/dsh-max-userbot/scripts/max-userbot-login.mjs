#!/usr/bin/env node
/**
 * One-shot MAX login via QR. Prints device id and login token for ~/.dsh credentials.
 *
 * Usage: node scripts/max-userbot-login.mjs
 */
import { randomUUID } from 'node:crypto';
import { DEFAULT_USER_AGENT, MaxClient } from '../lib/vendor/max-account-api/dist/index.js';

const appVersion = process.env.MAX_USERBOT_APP_VERSION?.trim() || '26.32.1';
const deviceId = process.env.MAX_USERBOT_DEVICE_ID?.trim() || randomUUID();

const client = new MaxClient({
    deviceId,
    loginToken: '',
    userAgent: { ...DEFAULT_USER_AGENT, appVersion },
    printQr: true,
    printCredentialsAfterLogin: true,
});

console.log('\n[dsh-max-userbot] Starting QR login (scan with MAX app)...\n');

try {
    await client.start();
    console.log('\n--- Add to ~/.dsh/.credentials.yaml (or your credential store) ---\n');
    console.log(`MAX_USERBOT_DEVICE_ID: "${deviceId}"`);
    console.log('MAX_USERBOT_LOGIN_TOKEN: "<use loginToken printed above by max-account-api>"');
    console.log('\nCordis config refs: deviceIdRef: MAX_USERBOT_DEVICE_ID, loginTokenRef: MAX_USERBOT_LOGIN_TOKEN\n');
    await client.stop();
}
catch (error) {
    console.error('[dsh-max-userbot] Login failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
}
