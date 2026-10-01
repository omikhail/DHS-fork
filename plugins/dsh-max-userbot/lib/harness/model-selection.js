export function installModelSelection(agentCtx, selection) {
    const disposeAssembly = agentCtx.on('system-prompt/assemble', async (_assembly, _context, next) => {
        const selected = selection.current;
        const assembled = await next();
        selection.assembled = selected;
        if (selected === undefined)
            return assembled;
        return {
            ...assembled,
            variables: {
                ...assembled.variables,
                provider: selected.provider,
                model: selected.model,
            },
        };
    });
    const disposeRequest = agentCtx.on('agent/request', async (_payload, next) => {
        const resolved = await next();
        const selected = selection.assembled;
        if (selected === undefined)
            return resolved;
        const { reasoningEffort: _inherited, ...withoutInheritedEffort } = resolved;
        return {
            ...withoutInheritedEffort,
            provider: selected.provider,
            model: selected.model,
            ...(selected.reasoningEffort === undefined
                ? {}
                : { reasoningEffort: selected.reasoningEffort }),
        };
    });
    return () => {
        disposeAssembly();
        disposeRequest();
    };
}

export function sameRoute(a, b) {
    if (a === undefined || b === undefined)
        return a === b;
    return a.provider === b.provider && a.model === b.model;
}

/** @param {string | undefined} value */
export function parseRoute(value) {
    const trimmed = value?.trim();
    if (!trimmed)
        return undefined;
    const separator = trimmed.indexOf('/');
    if (separator <= 0 || separator === trimmed.length - 1)
        return undefined;
    return {
        provider: trimmed.slice(0, separator),
        model: trimmed.slice(separator + 1),
    };
}
