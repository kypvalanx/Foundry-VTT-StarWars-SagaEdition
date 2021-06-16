export class OffenseHandler {
    async resolveOffense(actor) {
        let bab = await this._resolveBab(actor) + actor.getConditionBonus();
        let mab = await this._resolveMab(bab, actor.data.data.attributes.str.mod);
        let rab = await this._resolveRab(bab, actor.data.data.attributes.dex.mod);
        let fab = await this._resolveRab(bab, actor.data.data.attributes.dex.mod);
        return {bab: bab, mab: mab, rab: rab, fab: fab};
    }

    async _resolveBab(actor) {
        let actorData = actor.data;
        //TODO CLEANUP
        let bab = 0;
        let classLevels = new Map()
        for (let charClass of actorData.classes) {
            if (!classLevels.has(charClass.name)) {
                classLevels.set(charClass.name, {
                    level: 1,
                    bab: parseInt(charClass.data.levels[1]['BASE ATTACK BONUS'])
                })
            } else {
                let current = classLevels.get(charClass.name);
                classLevels.set(charClass.name, {
                    level: current.level + 1,
                    bab: parseInt(charClass.data.levels[current.level + 1]['BASE ATTACK BONUS'])
                })
            }
        }
        for (let value of classLevels.values()) {
            bab += value.bab;
        }
        actorData.prerequisites.bab = bab;
        return bab;
    }

    async _resolveMab(bab, mod) {
        return bab + mod;
    }

    async _resolveRab(bab, mod) {
        return bab + mod;
    }
}