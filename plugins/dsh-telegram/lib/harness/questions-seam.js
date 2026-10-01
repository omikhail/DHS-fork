/**
 * Taking over the single user-questions provider without stealing it.
 *
 * `ctx.userQuestions` accepts exactly one provider and throws
 * `DUPLICATE_PROVIDER` on a second registration. In a profile that also runs
 * the web app, the browser has already claimed that slot — so a naive
 * registration here would either fail to load or, worse, silently take every
 * question away from the browser.
 *
 * Instead this seam swaps itself in and keeps the displaced provider as a
 * fallback, so a question belonging to a browser session is forwarded straight
 * back to it. Both surfaces keep working, and whichever one the user is
 * actually looking at is the one that answers.
 *
 * On unload the previous provider is put back, so unloading this plugin
 * restores exactly the arrangement that existed before it loaded.
 */
/**
 * Install a provider as the active one, chaining any incumbent.
 *
 * @param service - the live `ctx.userQuestions` service.
 * @param build - builds the provider, given the incumbent to delegate to.
 * @param logger - records which arrangement was chosen.
 */
export function installQuestionProvider(service, build, logger) {
    const previous = service.provider;
    if (previous === undefined) {
        const dispose = service.registerProvider(build(undefined));
        logger?.info('[dsh-telegram] answering the agent\'s questions in Telegram');
        return { previous: undefined, restore: dispose };
    }
    // Clearing the slot before re-registering is what makes the takeover
    // possible; registerProvider refuses while one is present.
    service.provider = undefined;
    const dispose = service.registerProvider(build(previous));
    logger?.info('[dsh-telegram] answering questions in Telegram, forwarding other sessions to the existing UI');
    return {
        previous,
        restore() {
            dispose();
            service.provider = previous;
        },
    };
}
//# sourceMappingURL=questions-seam.js.map