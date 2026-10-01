import { DEFAULT_USER_AGENT, MaxClient, type IncomingMessage } from 'max-account-api';

export interface MaxUserbotCredentials {
  deviceId: string;
  loginToken: string;
  appVersion?: string;
}

export type MessageHandler = (message: IncomingMessage) => void | Promise<void>;

interface ClientEntry {
  client: MaxClient;
  handlers: Set<MessageHandler>;
  dispatch: (message: IncomingMessage) => void;
  healthy: boolean;
  credentials: MaxUserbotCredentials;
  recoverTimer?: ReturnType<typeof setTimeout>;
}

const RECOVER_DEBOUNCE_MS = 2000;

const clients = new Map<string, ClientEntry>();
const inflightRecover = new Map<string, Promise<ClientEntry>>();

function createDispatch(entry: ClientEntry): (message: IncomingMessage) => void {
  return (message: IncomingMessage) => {
    for (const handler of entry.handlers) {
      void handler(message);
    }
  };
}

function clearRecoverTimer(entry: ClientEntry): void {
  if (entry.recoverTimer) {
    clearTimeout(entry.recoverTimer);
    entry.recoverTimer = undefined;
  }
}

export function isEntryHealthy(entry: ClientEntry): boolean {
  return entry.healthy === true && entry.client.getMe() != null;
}

function scheduleRecover(credentialsId: string, credentials: MaxUserbotCredentials): void {
  const entry = clients.get(credentialsId);
  if (!entry) {
    return;
  }

  clearRecoverTimer(entry);
  entry.recoverTimer = setTimeout(() => {
    entry.recoverTimer = undefined;
    void recoverClient(credentialsId, credentials);
  }, RECOVER_DEBOUNCE_MS);
}

function wireClientLifecycle(credentialsId: string, entry: ClientEntry): void {
  entry.client.on('error', () => {
    entry.healthy = false;
    scheduleRecover(credentialsId, entry.credentials);
  });
  entry.client.on('close', () => {
    entry.healthy = false;
    scheduleRecover(credentialsId, entry.credentials);
  });
}

async function createAndRegister(
  credentialsId: string,
  credentials: MaxUserbotCredentials,
): Promise<ClientEntry> {
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

  const entry: ClientEntry = {
    client,
    handlers: new Set<MessageHandler>(),
    dispatch: () => undefined,
    healthy: false,
    credentials,
  };
  entry.dispatch = createDispatch(entry);
  clients.set(credentialsId, entry);

  client.on('message', (message: IncomingMessage) => {
    entry.dispatch(message);
  });
  wireClientLifecycle(credentialsId, entry);

  await client.start();
  entry.healthy = true;
  return entry;
}

export async function recoverClient(
  credentialsId: string,
  credentials: MaxUserbotCredentials,
): Promise<ClientEntry> {
  const inflight = inflightRecover.get(credentialsId);
  if (inflight) {
    return inflight;
  }

  const promise = (async (): Promise<ClientEntry> => {
    const entry = clients.get(credentialsId);
    const savedHandlers = entry ? new Set(entry.handlers) : new Set<MessageHandler>();

    if (entry) {
      clearRecoverTimer(entry);
      clients.delete(credentialsId);
      try {
        await entry.client.stop();
      } catch {
        // Dead clients may reject stop(); evict anyway.
      }
    }

    const newEntry = await createAndRegister(credentialsId, credentials);
    for (const handler of savedHandlers) {
      newEntry.handlers.add(handler);
    }
    return newEntry;
  })().finally(() => {
    inflightRecover.delete(credentialsId);
  });

  inflightRecover.set(credentialsId, promise);
  return promise;
}

async function ensureHealthy(
  credentialsId: string,
  credentials: MaxUserbotCredentials,
  entry: ClientEntry,
): Promise<ClientEntry> {
  if (isEntryHealthy(entry)) {
    return entry;
  }
  return recoverClient(credentialsId, credentials);
}

export async function getOrCreateClient(
  credentialsId: string,
  credentials: MaxUserbotCredentials,
): Promise<ClientEntry> {
  const existing = clients.get(credentialsId);
  if (existing) {
    if (isEntryHealthy(existing)) {
      return existing;
    }
    return recoverClient(credentialsId, credentials);
  }

  return createAndRegister(credentialsId, credentials);
}

export async function getOwnerId(credentialsId: string): Promise<number | undefined> {
  const entry = clients.get(credentialsId);
  if (!entry) {
    return undefined;
  }
  return entry.client.getMe()?.id;
}

export function onMessage(credentialsId: string, handler: MessageHandler): void {
  const entry = clients.get(credentialsId);
  if (!entry) {
    throw new Error(`MAX client not initialized for credentials id ${credentialsId}`);
  }
  entry.handlers.add(handler);
}

export function offMessage(credentialsId: string, handler: MessageHandler): void {
  const entry = clients.get(credentialsId);
  if (!entry) {
    return;
  }
  entry.handlers.delete(handler);
}

export async function replyToMessage(
  credentialsId: string,
  incoming: IncomingMessage,
  text: string,
): Promise<void> {
  const entry = clients.get(credentialsId);
  if (!entry) {
    throw new Error(`MAX client not initialized for credentials id ${credentialsId}`);
  }
  const healthyEntry = await ensureHealthy(credentialsId, entry.credentials, entry);
  await healthyEntry.client.reply(incoming, text);
}

export async function sendMessage(
  credentialsId: string,
  chatId: number,
  text: string,
): Promise<void> {
  const entry = clients.get(credentialsId);
  if (!entry) {
    throw new Error(`MAX client not initialized for credentials id ${credentialsId}`);
  }
  const healthyEntry = await ensureHealthy(credentialsId, entry.credentials, entry);
  await healthyEntry.client.sendMessage(chatId, text);
}

export async function closeClient(credentialsId: string): Promise<void> {
  const inflight = inflightRecover.get(credentialsId);
  if (inflight) {
    await inflight.catch(() => undefined);
  }

  const entry = clients.get(credentialsId);
  if (!entry) {
    return;
  }

  clearRecoverTimer(entry);
  entry.handlers.clear();
  clients.delete(credentialsId);
  await entry.client.stop();
}

export function resetClientsForTests(): void {
  for (const entry of clients.values()) {
    clearRecoverTimer(entry);
  }
  clients.clear();
  inflightRecover.clear();
}

export function getClientCountForTests(): number {
  return clients.size;
}

export function getRecoverDebounceMsForTests(): number {
  return RECOVER_DEBOUNCE_MS;
}

export function setClientForTests(
  credentialsId: string,
  client: MaxClient,
  credentials: MaxUserbotCredentials = { deviceId: 'test-device', loginToken: 'test-token' },
): ClientEntry {
  const entry: ClientEntry = {
    client,
    handlers: new Set<MessageHandler>(),
    dispatch: () => undefined,
    healthy: true,
    credentials,
  };
  entry.dispatch = createDispatch(entry);
  clients.set(credentialsId, entry);
  return entry;
}
