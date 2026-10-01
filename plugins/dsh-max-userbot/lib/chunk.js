/**
 * Split text into chunks no longer than maxChars, preferring newline boundaries.
 * @param {string} text
 * @param {number} maxChars
 */
export function chunkText(text, maxChars) {
    if (maxChars <= 0 || text.length <= maxChars)
        return [text];
    const chunks = [];
    let rest = text;
    while (rest.length > maxChars) {
        let cut = rest.lastIndexOf('\n', maxChars);
        if (cut < maxChars * 0.5)
            cut = maxChars;
        chunks.push(rest.slice(0, cut));
        rest = rest.slice(cut).replace(/^\n/, '');
    }
    if (rest.length > 0)
        chunks.push(rest);
    return chunks;
}
