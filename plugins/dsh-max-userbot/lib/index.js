/**
 * @mikhail/dsh-max-userbot — MAX userbot front for DeepSeek Harness.
 */
import { homedir } from 'node:os';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';

import { PhoneWhitelistPolicy } from './access.js';
import { Config } from './config.js';
import { StatusFile, describeError } from './diagnostics.js';
import { createAgentHost } from './harness/host.js';
import { buildUserMessage } from './harness/message.js';
import { installModelSelection, parseRoute } from './harness/model-selection.js';
import { normalizeMessage } from './normalizeMessage.js';
import { PhoneCache } from './phone-cache.js';
import { MaxUpdateRouter } from './router.js';
import { ReplyContext } from './reply-context.js';
import { TurnReplyBridge } from './reply/turn-bridge.js';
import { SecretRegistry } from './secrets.js';
import { BindingStore } from './session/bindings.js';
import { formatRoute, listCatalog, matchRoute } from './session/models.js';
import { ChatPreferences } from './session/preferences.js';
import { SessionRunner } from './session/runner.js';
import { isUsableDirectory, resolveDirectory } from './session/workspaces.js';
import {
    closeClient,
    getClientEntry,
    getOrCreateClient,
    getOwnerId,
    offMessage,
    onMessage,
    replyToMessage,
} from './transport/MaxClientManager.js';

export { Config };

export const name = '@mikhail/dsh-max-userbot';
export const inject = ['agents', 'credentials'];

function dataDirectory() {
    const base = process.env.DSH_HOME?.trim() || join(homedir(), '.dsh');
    return join(base, 'dsh-max-userbot');
}

/** @param {import('@deepseek-ai/cordis').Context} ctx */
async function resolveCredentialRef(ctx, ref) {
    try {
        const resolved = await ctx.credentials.resolve(ref);
        const value = resolved?.value;
        return typeof value === 'string' && value !== '' ? value : undefined;
    }
    catch {
        return undefined;
    }
}

function buildModelControl(options) {
    return {
        describe: (target) => formatRoute(options.chosen(target) ?? options.fallback()),
        async list() {
            let providers;
            try {
                providers = await listCatalog(options.catalog);
            }
            catch {
                return 'Could not read the configured models.';
            }
            if (providers.length === 0)
                return 'No models are configured.';
            return providers
                .map((provider) => {
                    const rows = provider.models
                        .map((model) => `• ${provider.id}/${model.id}`)
                        .join('\n');
                    return `${provider.name ?? provider.id}\n${rows}`;
                })
                .join('\n\n');
        },
        async choose(target, input) {
            const providers = await listCatalog(options.catalog).catch(() => []);
            const matched = matchRoute(input, providers);
            if (matched.kind !== 'route')
                return matched;
            const route = `${matched.route.provider}/${matched.route.model}`;
            await options.store.set(target, route);
            return { kind: 'route', route };
        },
        clear: (target) => options.store.clear(target),
    };
}

function selectModel(ctx, logger) {
    const service = ctx.get('agentDefaultModel');
    if (!service) {
        logger.warn('[dsh-max-userbot] no agentDefaultModel service');
        return undefined;
    }
    try {
        const selection = service.currentSelection();
        if (selection)
            return { provider: selection.provider, model: selection.model };
    }
    catch (error) {
        logger.warn('[dsh-max-userbot] could not read the default model selection', error);
    }
    return undefined;
}

async function inspectDirectory(path) {
    try {
        const info = await stat(path);
        if (info.isDirectory())
            return 'directory';
        if (info.isFile())
            return 'file';
        return 'missing';
    }
    catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'EACCES')
            return 'denied';
        return 'missing';
    }
}

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {import('./config.js').Config.Type} config
 */
export function apply(ctx, config) {
    const secrets = new SecretRegistry();
    const logger = ctx.logger('dsh-max-userbot');
    let live = config;
    let abort;
    const status = new StatusFile(join(dataDirectory(), 'status.json'), secrets.redactor());

    const run = () => {
        abort?.abort();
        abort = new AbortController();
        const signal = abort.signal;
        void start(ctx, live, logger, signal, status, secrets).catch((error) => {
            if (signal.aborted)
                return;
            logger.error('[dsh-max-userbot] failed to start', error);
            void status.publish('failed', { detail: describeError(error) });
        });
    };

    ctx.effect(() => {
        if (!live.enabled) {
            void status.publish('idle', { detail: 'plugin disabled in config' });
            return () => undefined;
        }
        run();
        return () => abort?.abort();
    }, 'dsh-max-userbot: connection');

}

async function start(ctx, config, logger, signal, status, secrets) {
    if (signal.aborted)
        return;
    await status.publish('starting');

    const deviceId = await resolveCredentialRef(ctx, config.deviceIdRef);
    const loginToken = await resolveCredentialRef(ctx, config.loginTokenRef);
    if (!deviceId || !loginToken) {
        await status.publish('idle', {
            detail: `Missing credentials (${config.deviceIdRef}, ${config.loginTokenRef}). Run scripts/max-userbot-login.mjs first.`,
        });
        return;
    }

    if (!deviceId?.trim() || !loginToken?.trim()) {
        await status.publish('idle', {
            detail: 'Empty device id or login token. Run scripts/max-userbot-login.mjs to obtain credentials.',
        });
        return;
    }

    secrets.protect(deviceId);
    secrets.protect(loginToken);

    const credentialsId = deviceId.trim();
    const credentials = {
        deviceId: deviceId.trim(),
        loginToken: loginToken.trim(),
        appVersion: config.appVersion,
    };

    const dataDir = dataDirectory();
    const bindings = await BindingStore.open(join(dataDir, 'bindings.json'));
    const phoneCache = await PhoneCache.open(join(dataDir, 'phone-cache.json'));
    const chosenModels = await ChatPreferences.open(join(dataDir, 'model-preferences.json'), {
        accept: (value) => parseRoute(value) !== undefined,
    });
    const workspaces = await ChatPreferences.open(join(dataDir, 'workspace-preferences.json'), {
        accept: isUsableDirectory,
    });

    const defaultCwd = config.cwd?.trim() || process.cwd();
    const cwdFor = (target) => workspaces.forChat(target) ?? defaultCwd;
    const chosenRoute = (target) => {
        const stored = chosenModels.forChat(target);
        return stored ? parseRoute(stored) : undefined;
    };

    const presets = ctx.get('agentPresets');
    const host = createAgentHost({
        agents: ctx.agents,
        message: buildUserMessage,
        logger,
        installSelection: installModelSelection,
        ...(presets
            ? {
                presets,
                presetId: () => config.agentPreset?.trim() || undefined,
            }
            : {}),
        selectModel: () => selectModel(ctx, logger),
    });

    const runner = new SessionRunner({
        host,
        bindings,
        cwdFor,
        chosenRoute,
        defaultRoute: () => selectModel(ctx, logger),
        logger,
    });

    const catalog = ctx.get('llm');
    const replyContext = new ReplyContext();

    const entry = await getOrCreateClient(credentialsId, credentials);
    if (signal.aborted) {
        await closeClient(credentialsId);
        return;
    }

    const ownerId = await getOwnerId(credentialsId);
    const me = entry.client.getMe();

    const access = new PhoneWhitelistPolicy({
        allowFrom: config.allowFrom,
        allowPhones: config.allowPhones,
        cache: phoneCache,
        resolveContact: async (fromId) => {
            const client = getClientEntry(credentialsId)?.client;
            if (!client)
                return undefined;
            return await client.getContactInfo(fromId);
        },
    });

    if (!access.isConfigured()) {
        logger.warn('[dsh-max-userbot] allowPhones and allowFrom are empty — all inbound messages will be denied');
    }

    const deliver = async (incoming, text) => {
        await replyToMessage(credentialsId, incoming, text);
    };

    const bridge = new TurnReplyBridge({
        maxChars: config.reply.maxChars,
        replyContext,
        deliver,
        logger,
    });

    const models = catalog
        ? buildModelControl({
            catalog,
            store: chosenModels,
            chosen: (target) => chosenRoute(target) ?? selectModel(ctx, logger),
            fallback: () => selectModel(ctx, logger),
        })
        : undefined;

    const router = new MaxUpdateRouter({
        access,
        runner,
        bindings,
        replyContext,
        redact: secrets.redactor(),
        models,
        workspace: {
            current: cwdFor,
            resolve: (input, current) => resolveDirectory(input, current, homedir()),
            inspect: inspectDirectory,
            set: (target, directory) => workspaces.set(target, directory),
        },
        chat: {
            reply: async (item, text) => {
                await deliver(item.raw, text);
            },
        },
        logger,
    });

    const unsubscribe = ctx.on('session/event', (session, event) => {
        const sessionId = String(session.id);
        const target = bindings.forSession(sessionId);
        if (!target)
            return;
        if (event.type === 'turn/start')
            bridge.trackTurn(sessionId, event.data.turn);
        void bridge.handle(sessionId, event);
    });

    const handler = async (message) => {
        const item = normalizeMessage(message, ownerId);
        if (!item)
            return;
        await router.handle(item);
    };

    onMessage(credentialsId, handler);

    signal.addEventListener('abort', () => {
        offMessage(credentialsId, handler);
        unsubscribe();
        void bridge.dispose();
        void closeClient(credentialsId);
        replyContext.clear();
    }, { once: true });

    const account = me?.id !== undefined ? String(me.id) : credentialsId.slice(0, 8);
    logger.info(`[dsh-max-userbot] listening as MAX account ${account}`);
    await status.publish('connected', { account });
}
