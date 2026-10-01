export const COMMANDS = {
    start: 'Show what this connection is and list commands',
    help: 'List the commands',
    new: 'Start a fresh conversation, forgetting the current one',
    cd: 'Show or change the working directory: /cd ~/projects/app',
    model: 'Show or change the model: /model list, or /model provider/model',
    status: 'Show the session and working directory',
    stop: 'Cancel whatever the agent is doing right now',
    whoami: 'Show your MAX user id and phone (if known)',
};

/**
 * @param {string} text
 * @param {string} [botUsername] — unused for userbot; optional @suffix is ignored
 */
export function parseCommand(text, botUsername) {
    const match = /^\/([a-z0-9_]+)(?:@([a-z0-9_]+))?(?:\s+([\s\S]*))?$/i.exec(text.trim());
    if (!match)
        return undefined;
    const name = match[1].toLowerCase();
    if (!(name in COMMANDS))
        return undefined;
    return { name, args: (match[3] ?? '').trim() };
}

export function helpText() {
    const lines = Object.entries(COMMANDS).map(([name, description]) => `/${name} — ${description}`);
    return `Commands\n${lines.join('\n')}`;
}
