
    export function resolveOffense(actor) {
        let bab = actor.getInheritableAttributesByKey("baseAttackBonus", "SUM", undefined) + actor.conditionBonus;
        return {bab: bab};
    }
