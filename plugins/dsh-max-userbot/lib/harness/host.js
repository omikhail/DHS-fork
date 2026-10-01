import { sameRoute } from './model-selection.js';

/**
 * @param {{
 *   agents: import('@deepseek-ai/cordis').Context['agents'],
 *   message: (content: unknown[]) => unknown,
 *   logger?: { debug?: Function, warn?: Function },
 *   installSelection?: Function,
 *   presets?: { resolve: (id?: string) => Promise<{ id: string }>, mount: Function },
 *   presetId?: () => string | undefined,
 *   selectModel?: () => { provider: string, model: string } | undefined,
 * }} options
 */
export function createAgentHost(options) {
    const owned = new Map();
    const wrap = (agent, sessionId) => ({
        sessionId,
        followup(content) {
            agent.followup(options.message(content));
        },
        useModel(route) {
            const entry = owned.get(sessionId);
            if (!entry)
                return false;
            if (sameRoute(entry.selection.current, route))
                return true;
            entry.selection.current = route;
            return true;
        },
        cancel(reason) {
            agent.cancel(reason);
        },
        async dispose() {
            const entry = owned.get(sessionId);
            owned.delete(sessionId);
            if (entry)
                await entry.handle.dispose();
        },
    });
    const adopt = (handle, sessionId, selection) => {
        owned.set(sessionId, { handle, selection });
        return wrap(handle.agent, sessionId);
    };
    const prepareAgent = async () => {
        const selection = { current: undefined };
        const install = options.installSelection;
        let preset;
        if (options.presets) {
            try {
                preset = (await options.presets.resolve(options.presetId?.())).id;
            }
            catch (error) {
                options.logger?.warn('[dsh-max-userbot] could not resolve the agent preset', error);
                preset = (await options.presets.resolve().catch(() => undefined))?.id;
            }
        }
        const setup = async (agentCtx) => {
            if (install)
                install(agentCtx, selection);
            if (options.presets)
                await options.presets.mount(agentCtx, preset);
        };
        return {
            selection,
            ...(install || options.presets ? { setup } : {}),
            ...(preset === undefined ? {} : { preset }),
        };
    };
    return {
        live(sessionId) {
            const owner = owned.get(sessionId);
            if (owner)
                return wrap(owner.handle.agent, sessionId);
            const bare = options.agents.get(sessionId);
            return bare ? wrap(bare, sessionId) : undefined;
        },
        async create(sessionId, cwd, forced) {
            const route = forced ?? options.selectModel?.();
            const prepared = await prepareAgent();
            const handle = await options.agents.create({
                sessionId,
                meta: { cwd, ...(prepared.preset === undefined ? {} : { agentPreset: prepared.preset }) },
                ...(route ? { agentOptions: route } : {}),
                ...(prepared.setup ? { setup: prepared.setup } : {}),
            });
            return adopt(handle, sessionId, prepared.selection);
        },
        async resume(sessionId) {
            try {
                const route = options.selectModel?.();
                const prepared = await prepareAgent();
                const handle = await options.agents.resume({
                    resumeSessionId: sessionId,
                    ...(route ? { agentOptions: route } : {}),
                    ...(prepared.setup ? { setup: prepared.setup } : {}),
                });
                return adopt(handle, sessionId, prepared.selection);
            }
            catch (error) {
                options.logger?.debug(`[dsh-max-userbot] resume of '${sessionId}' failed`, error);
                return undefined;
            }
        },
    };
}
