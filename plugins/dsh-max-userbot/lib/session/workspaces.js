import { isAbsolute, resolve } from 'node:path';

export function resolveDirectory(input, current, home) {
    const trimmed = unquote(input.trim());
    if (trimmed === '')
        return undefined;
    if (trimmed === '~')
        return resolve(home);
    if (trimmed.startsWith('~/'))
        return resolve(home, trimmed.slice(2));
    if (isAbsolute(trimmed))
        return resolve(trimmed);
    return resolve(current, trimmed);
}

function unquote(text) {
    const quoted = (text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"));
    return quoted && text.length >= 2 ? text.slice(1, -1) : text;
}

export function isUsableDirectory(value) {
    return isAbsolute(value);
}
