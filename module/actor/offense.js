export class OffenseHandler {
    async resolveOffense(actor, resolvedBab) {
        let bab = resolvedBab + actor.getConditionBonus();
        let mab = await this._resolveMab(bab, actor.data.data.attributes.str.mod);
        let rab = await this._resolveRab(bab, actor.data.data.attributes.dex.mod);
        let fab = await this._resolveRab(bab, actor.data.data.attributes.dex.mod);
        return {bab: bab, mab: mab, rab: rab, fab: fab};
    }

    async _resolveMab(bab, mod) {
        return bab + mod;
    }

    async _resolveRab(bab, mod) {
        return bab + mod;
    }
}