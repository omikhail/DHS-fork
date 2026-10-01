import { COMMANDS, helpText, parseCommand } from './commands.js';
import { SILENT_LOGGER } from './harness/types.js';
import { processVoiceMessage } from './voice/pipeline.js';

function statusLines(rows) {
    return rows.map((row) => `${row.label}: ${row.value}`).join('\n');
}

export class MaxUpdateRouter {
    constructor(options) {
        this.options = options;
        this.logger = options.logger ?? SILENT_LOGGER;
    }

    /**
     * @param {import('./normalizeMessage.js').normalizeMessage extends Function ? ReturnType<typeof import('./normalizeMessage.js').normalizeMessage> : never} item
     */
    async handle(item) {
        try {
            if (item.is_owner_message)
                return;
            const target = { chatId: item.chatId };
            const fromId = item.fromId;
            const decision = await this.options.access.check(fromId);
            if (decision !== 'allowed')
                return;
            const text = item.text?.trim() ?? '';
            if (item.messageType === 'voice') {
                return await this.handleVoice(item, target);
            }
            if (item.messageType === 'other' && !text) {
                return await this.say(item, 'Пока поддерживается только текст.');
            }
            if (text) {
                const command = parseCommand(text);
                if (command)
                    return await this.onCommand(item, target, fromId, command.name, command.args);
            }
            if (!text)
                return;
            return await this.runPrompt(item, target, [{ type: 'text', text }]);
        }
        catch (error) {
            this.logger.error('[dsh-max-userbot] message handling failed', error);
        }
    }

    async say(item, text) {
        await this.options.chat.reply(item, text);
    }

    async handleVoice(item, target) {
        const result = await processVoiceMessage({
            item,
            stt: this.options.stt,
            limits: this.options.voice,
            logger: this.logger,
        });
        if (result.kind === 'reply') {
            return await this.say(item, result.text);
        }
        return await this.runPrompt(item, target, result.parts);
    }

    async onCommand(item, target, fromId, name, args) {
        switch (name) {
            case 'start':
                return await this.say(item, `Connected to DeepSeek Harness.\nSend a message to talk to the agent.\n\n${helpText()}`);
            case 'help':
                return await this.say(item, helpText());
            case 'whoami': {
                const phone = await this.options.access.phoneFor(fromId);
                const phoneLine = phone ? `\nPhone (digits): ${phone}` : '\nPhone: unknown — add your number to allowPhones or use allowFrom.';
                return await this.say(item, `Your MAX user id is ${fromId}.${phoneLine}`);
            }
            case 'new':
                await this.options.runner.reset(target);
                return await this.say(item, 'Started a fresh conversation.');
            case 'cd':
                return await this.onChangeDirectory(item, target, args);
            case 'model':
                return await this.onModel(item, target, args);
            case 'stop': {
                const stopped = await this.options.runner.stop(target);
                return await this.say(item, stopped ? 'Stopped.' : 'Nothing was running.');
            }
            case 'status':
                return await this.describeConversation(item, target);
            default:
                return await this.say(item, `Unknown command. Try ${Object.keys(COMMANDS).join(', ')}.`);
        }
    }

    async runPrompt(item, target, content) {
        try {
            await this.options.runner.prompt(target, content);
            const sessionId = this.options.bindings.forChat(target)?.sessionId;
            if (sessionId)
                this.options.replyContext.remember(sessionId, item.raw);
        }
        catch (error) {
            const raw = error instanceof Error ? error.message : String(error);
            const reason = this.options.redact?.(raw) ?? raw;
            this.logger.error('[dsh-max-userbot] prompt failed', error);
            await this.say(item, `⚠️ ${reason}`);
        }
    }

    async describeConversation(item, target) {
        const rows = [...(await this.options.runner.status(target))];
        const models = this.options.models;
        if (models)
            rows.push({ label: 'Model', value: models.describe(target) });
        await this.say(item, statusLines(rows));
    }

    async onModel(item, target, args) {
        const models = this.options.models;
        if (!models)
            return await this.say(item, 'This deployment does not allow changing the model.');
        const wanted = args.trim();
        if (wanted === '') {
            return await this.say(item, `Model: ${models.describe(target)}\n\n/model list — list models\n/model provider/model — set model`);
        }
        if (wanted.toLowerCase() === 'default') {
            await models.clear(target);
            return await this.say(item, `Back to ${models.describe(target)}.`);
        }
        if (wanted.toLowerCase() === 'list')
            return await this.say(item, await models.list());
        const chosen = await models.choose(target, wanted);
        switch (chosen.kind) {
            case 'route':
                return await this.say(item, `Now talking to ${chosen.route}.\nApplies from your next message.`);
            case 'ambiguous':
                return await this.say(item, `Several providers offer that. Name one:\n${chosen.candidates.map((c) => `• ${c}`).join('\n')}`);
            default:
                return await this.say(item, `No configured model called "${wanted}". Try /model list.`);
        }
    }

    async onChangeDirectory(item, target, args) {
        const workspace = this.options.workspace;
        const current = workspace?.current(target);
        if (!workspace || current === undefined)
            return await this.say(item, 'This deployment does not allow changing directory.');
        if (args.trim() === '')
            return await this.say(item, `Directory: ${current}\n\nChange with /cd ~/projects/app`);
        const wanted = workspace.resolve(args, current);
        if (wanted === undefined)
            return await this.say(item, 'Give me a directory: /cd ~/projects/app');
        if (wanted === current)
            return await this.say(item, `Already in ${wanted}.`);
        const verdict = await workspace.inspect(wanted);
        if (verdict !== 'directory') {
            const why = verdict === 'file'
                ? 'that is a file, not a directory'
                : verdict === 'denied'
                    ? 'it cannot be read'
                    : 'no such directory';
            return await this.say(item, `Cannot use ${wanted} — ${why}.`);
        }
        try {
            await workspace.set(target, wanted);
        }
        catch (error) {
            this.logger.error('[dsh-max-userbot] could not record the working directory', error);
            return await this.say(item, 'The directory could not be saved.');
        }
        await this.options.runner.reset(target);
        return await this.say(item, `Now working in ${wanted}.\nStarted a fresh conversation — sessions keep the directory they opened in.`);
    }
}
