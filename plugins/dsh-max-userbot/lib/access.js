/** @param {string | number | undefined | null} value */
export function normalizePhone(value) {
    if (value === undefined || value === null)
        return '';
    return String(value).replace(/\D/g, '');
}

export class PhoneWhitelistPolicy {
    constructor(options) {
        this.allowFrom = new Set(options.allowFrom ?? []);
        this.allowPhones = new Set((options.allowPhones ?? []).map((p) => normalizePhone(p)).filter(Boolean));
        this.cache = options.cache;
        this.resolveContact = options.resolveContact;
    }

    isConfigured() {
        return this.allowPhones.size > 0 || this.allowFrom.size > 0;
    }

    /** @returns {'allowed' | 'denied' | 'unconfigured'} */
    checkSync(fromId) {
        if (!this.isConfigured())
            return 'unconfigured';
        if (this.allowFrom.has(fromId))
            return 'allowed';
        const cached = this.cache.get(fromId);
        if (cached && this.allowPhones.has(cached))
            return 'allowed';
        return 'needs_phone';
    }

    /**
     * @param {number} fromId
     * @returns {Promise<'allowed' | 'denied'>}
     */
    async check(fromId) {
        const sync = this.checkSync(fromId);
        if (sync === 'allowed')
            return 'allowed';
        if (sync === 'unconfigured' || sync === 'denied')
            return 'denied';
        const contact = await this.resolveContact(fromId);
        const phone = normalizePhone(contact?.phone);
        if (phone) {
            await this.cache.remember(fromId, phone);
            if (this.allowPhones.has(phone))
                return 'allowed';
        }
        if (this.allowFrom.has(fromId))
            return 'allowed';
        return 'denied';
    }

    /** @param {number} fromId */
    async phoneFor(fromId) {
        const cached = this.cache.get(fromId);
        if (cached)
            return cached;
        const contact = await this.resolveContact(fromId);
        const phone = normalizePhone(contact?.phone);
        if (phone)
            await this.cache.remember(fromId, phone);
        return phone || undefined;
    }
}
