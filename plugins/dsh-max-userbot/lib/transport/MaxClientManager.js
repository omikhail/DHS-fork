import { DEFAULT_USER_AGENT, MaxClient } from 'max-account-api';

const RECOVER_DEBOUNCE_MS = 2000;

const clients = new Map();
const inflightRecover = new Map();

function createDispatch(entry) {
    return (message) => {
        for (const handler of entry.handlers)
            void handler(message);
    };
}

function clearRecoverTimer(entry) {
    if (entry.recoverTimer) {
        clearTimeout(entry.recoverTimer);
        entry.recoverTimer = undefined;
    }
}

export function isEntryHealthy(entry) {
    return entry.healthy === true && entry.client.getMe() != null;
}

function scheduleRecover(credentialsId, credentials) {
    const entry = clients.get(credentialsId);
    if (!entry)
        return;
    clearRecoverTimer(entry);
    entry.recoverTimer = setTimeout(() => {
        entry.recoverTimer = undefined;
        void recoverClient(credentialsId, credentials);
    }, RECOVER_DEBOUNCE_MS);
}

function wireClientLifecycle(credentialsId, entry) {
    entry.client.on('error', () => {
        entry.healthy = false;
        scheduleRecover(credentialsId, entry.credentials);
    });
    entry.client.on('close', () => {
        entry.healthy = false;
        scheduleRecover(credentialsId, entry.credentials);
    });
}

async function createAndRegister(credentialsId, credentials) {
    const client = new MaxClient({
        deviceId: credentials.deviceId,
        loginToken: credentials.loginToken,
        userAgent: {
            ...DEFAULT_USER_AGENT,
            appVersion: credentials.appVersion ?? '26.32.1',
        },
        printQr: false,
        printCredentialsAfterLogin: false,
    });
    const entry = {
        client,
        handlers: new Set(),
        dispatch: () => undefined,
        healthy: false,
        credentials,
    };
    entry.dispatch = createDispatch(entry);
    clients.set(credentialsId, entry);
    client.on('message', (message) => {
        entry.dispatch(message);
    });
    wireClientLifecycle(credentialsId, entry);
    await client.start();
    entry.healthy = true;
    return entry;
}

export async function recoverClient(credentialsId, credentials) {
    const inflight = inflightRecover.get(credentialsId);
    if (inflight)
        return inflight;
    const promise = (async () => {
        const entry = clients.get(credentialsId);
        const savedHandlers = entry ? new Set(entry.handlers) : new Set();
        if (entry) {
            clearRecoverTimer(entry);
            clients.delete(credentialsId);
            try {
                await entry.client.stop();
            }
            catch {
                // Dead clients may reject stop(); evict anyway.
            }
        }
        const newEntry = await createAndRegister(credentialsId, credentials);
        for (const handler of savedHandlers)
            newEntry.handlers.add(handler);
        return newEntry;
    })().finally(() => {
        inflightRecover.delete(credentialsId);
    });
    inflightRecover.set(credentialsId, promise);
    return promise;
}

async function ensureHealthy(credentialsId, credentials, entry) {
    if (isEntryHealthy(entry))
        return entry;
    return recoverClient(credentialsId, credentials);
}

export async function getOrCreateClient(credentialsId, credentials) {
    const existing = clients.get(credentialsId);
    if (existing) {
        if (isEntryHealthy(existing))
            return existing;
        return recoverClient(credentialsId, credentials);
    }
    return createAndRegister(credentialsId, credentials);
}

export async function getOwnerId(credentialsId) {
    const entry = clients.get(credentialsId);
    if (!entry)
        return undefined;
    return entry.client.getMe()?.id;
}

export function getClientEntry(credentialsId) {
    return clients.get(credentialsId);
}

export function onMessage(credentialsId, handler) {
    const entry = clients.get(credentialsId);
    if (!entry)
        throw new Error(`MAX client not initialized for credentials id ${credentialsId}`);
    entry.handlers.add(handler);
}

export function offMessage(credentialsId, handler) {
    const entry = clients.get(credentialsId);
    if (!entry)
        return;
    entry.handlers.delete(handler);
}

export async function replyToMessage(credentialsId, incoming, text) {
    const entry = clients.get(credentialsId);
    if (!entry)
        throw new Error(`MAX client not initialized for credentials id ${credentialsId}`);
    const healthyEntry = await ensureHealthy(credentialsId, entry.credentials, entry);
    await healthyEntry.client.reply(incoming, text);
}

export async function sendMessage(credentialsId, chatId, text) {
    const entry = clients.get(credentialsId);
    if (!entry)
        throw new Error(`MAX client not initialized for credentials id ${credentialsId}`);
    const healthyEntry = await ensureHealthy(credentialsId, entry.credentials, entry);
    await healthyEntry.client.sendMessage(chatId, text);
}

export async function closeClient(credentialsId) {
    const inflight = inflightRecover.get(credentialsId);
    if (inflight)
        await inflight.catch(() => undefined);
    const entry = clients.get(credentialsId);
    if (!entry)
        return;
    clearRecoverTimer(entry);
    entry.handlers.clear();
    clients.delete(credentialsId);
    await entry.client.stop();
}

export function resetClientsForTests() {
    for (const entry of clients.values())
        clearRecoverTimer(entry);
    clients.clear();
    inflightRecover.clear();
}

export function getClientCountForTests() {
    return clients.size;
}

export function getRecoverDebounceMsForTests() {
    return RECOVER_DEBOUNCE_MS;
}

export function setClientForTests(credentialsId, client, credentials = { deviceId: 'test-device', loginToken: 'test-token' }) {
    const entry = {
        client,
        handlers: new Set(),
        dispatch: () => undefined,
        healthy: true,
        credentials,
    };
    entry.dispatch = createDispatch(entry);
    clients.set(credentialsId, entry);
    return entry;
}
