import { randomUUID } from 'node:crypto';
import { SILENT_LOGGER } from '../harness/types.js';
import { parseRoute } from '../harness/model-selection.js';

export class SessionRunner {
    constructor(options) {
        this.options = options;
        this.logger = options.logger ?? SILENT_LOGGER;
        this.newSessionId = options.newSessionId ?? (() => `max-${randomUUID()}`);
        this.chains = new Map();
    }

    async prompt(target, content) {
        if (content.length === 0)
            return;
        await this.serialize(target, async () => {
            const agent = await this.agentFor(target);
            const route = this.routeFor(target);
            if (route)
                agent.useModel(route);
            agent.followup(content);
        });
    }

    routeFor(target) {
        const stored = this.options.chosenRoute?.(target);
        if (stored) {
            const parsed = typeof stored === 'string' ? parseRoute(stored) : stored;
            if (parsed)
                return parsed;
        }
        return this.options.defaultRoute?.();
    }

    async reset(target) {
        await this.serialize(target, async () => {
            const binding = this.options.bindings.forChat(target);
            if (!binding)
                return;
            const live = this.options.host.live(binding.sessionId);
            if (live)
                await live.dispose().catch((error) => {
                    this.logger.warn('[dsh-max-userbot] could not dispose the previous agent', error);
                });
            await this.options.bindings.unbind(target);
        });
    }

    async stop(target) {
        const binding = this.options.bindings.forChat(target);
        if (!binding)
            return false;
        const live = this.options.host.live(binding.sessionId);
        if (!live)
            return false;
        live.cancel('stopped from MAX');
        return true;
    }

    async status(target) {
        const directory = this.options.cwdFor(target);
        const binding = this.options.bindings.forChat(target);
        if (!binding) {
            return [
                { label: 'Session', value: 'none yet — send a message to start one' },
                { label: 'Directory', value: directory },
            ];
        }
        const live = this.options.host.live(binding.sessionId) !== undefined;
        return [
            { label: 'Session', value: binding.sessionId },
            { label: 'Directory', value: directory },
            { label: 'State', value: live ? 'loaded' : 'idle, resumes on your next message' },
            {
                label: 'Since',
                value: new Date(binding.createdAt).toISOString().replace('T', ' ').slice(0, 16),
            },
        ];
    }

    async agentFor(target) {
        const binding = this.options.bindings.forChat(target);
        if (binding) {
            const live = this.options.host.live(binding.sessionId);
            if (live)
                return live;
            const resumed = await this.options.host.resume(binding.sessionId).catch((error) => {
                this.logger.warn(`[dsh-max-userbot] could not resume '${binding.sessionId}'`, error);
                return undefined;
            });
            if (resumed)
                return resumed;
            this.logger.warn(`[dsh-max-userbot] session '${binding.sessionId}' is gone; starting fresh`);
            await this.options.bindings.unbind(target);
        }
        const sessionId = this.newSessionId();
        const cwd = this.options.cwdFor(target);
        const agent = await this.options.host.create(sessionId, cwd);
        await this.options.bindings.bind(target, sessionId);
        return agent;
    }

    serialize(target, task) {
        const key = String(target.chatId);
        const previous = this.chains.get(key) ?? Promise.resolve();
        const next = previous.then(task, task);
        this.chains.set(key, next.then(() => undefined, () => undefined));
        return next;
    }
}
