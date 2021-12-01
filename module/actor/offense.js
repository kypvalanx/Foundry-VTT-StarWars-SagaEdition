
    export function resolveOffense(actor) {
        let bab = actor.getInheritableAttributesByKey("baseAttackBonus", undefined, "SUM") + actor.conditionBonus;
        return {bab: bab};
    }
