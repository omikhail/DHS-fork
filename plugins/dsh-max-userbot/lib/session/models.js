import { parseRoute } from '../harness/model-selection.js';

export async function listCatalog(catalog) {
    const providers = catalog.listProviders();
    const groups = await Promise.all(providers.map(async (provider) => {
        try {
            const models = await catalog.listModels(provider.id);
            return { id: provider.id, ...(provider.name ? { name: provider.name } : {}), models };
        }
        catch {
            return undefined;
        }
    }));
    return groups.filter((group) => group !== undefined && group.models.length > 0);
}

export function matchRoute(input, providers) {
    const wanted = input.trim();
    if (wanted === '')
        return { kind: 'unknown' };
    const qualified = parseRoute(wanted);
    if (qualified) {
        const provider = providers.find((entry) => entry.id === qualified.provider);
        if (provider)
            return { kind: 'route', route: qualified };
    }
    const matches = providers.flatMap((provider) => provider.models
        .filter((model) => model.id.toLowerCase() === wanted.toLowerCase())
        .map((model) => `${provider.id}/${model.id}`));
    if (matches.length === 1) {
        const route = parseRoute(matches[0]);
        if (route)
            return { kind: 'route', route };
    }
    if (matches.length > 1)
        return { kind: 'ambiguous', candidates: matches };
    return { kind: 'unknown' };
}

export function formatRoute(route) {
    if (!route)
        return 'the deployment default';
    return `${route.provider}/${route.model}`;
}
