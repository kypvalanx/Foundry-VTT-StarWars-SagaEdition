/**
 *
 * @param actor {SWSEActor}
 * @returns {{bab: *}}
 */
    export function resolveOffense(actor) {
        let bab = actor.getInheritableAttributesByKey("baseAttackBonus", "SUM", undefined);
        return {bab: bab};
    }
