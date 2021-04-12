import {SWSEActor} from "./actor.mjs";

export class OffenseHandler {
    async resolveOffense(actor) {
        let bab = await this._resolveBab(actor) + SWSEActor.getConditionBonus(actor.data.condition);
        let mab = await this._resolveMab(actor, bab);
        let rab = await this._resolveRab(actor, bab);
        let fab = await this._resolveRab(actor, bab);
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
        return bab;
    }

    async _resolveMab(actor, bab) {
        let actorData = actor.data;
        return bab + actorData.data.abilities.str.mod + SWSEActor.getConditionBonus(actor);
    }

    async _resolveRab(actor, bab) {
        let actorData = actor.data;
        return bab + actorData.data.abilities.dex.mod + SWSEActor.getConditionBonus(actor);
    }
}