import {resolveValueArray} from "../util.js";

/**
 *
 * @param actor {SWSEActor}
 */
export function generateAttributes(actor) {
    let actorData = actor.data;

    actorData.data.lockAttributes = actor.shouldLockAttributes()
    let attributeTraits = actorData.traits.filter(trait => {
        let result = /([+-])\d* (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)/.exec(trait.name);
        return !!result;
    })
    let prerequisites = actorData.prerequisites;
    prerequisites.attributes = {};
    for (let [key, attribute] of Object.entries(actorData.data.attributes)) {
        let longKey = actor._getLongKey(key);
        if (actorData.data.lockAttributes) {
            attribute.base = 10;
        }
        let bonuses = [];
        let classLevelBonuses = []; //TODO WIRE ME UP
        let speciesBonuses = [];
        let ageBonuses = [];
        let equipmentBonuses = []; //TODO WIRE ME UP
        let buffBonuses = []; //TODO WIRE ME UP
        let customBonuses = []; //TODO WIRE ME UP
        for (let trait of attributeTraits) {
            let result = /([+-\\d]*) (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)/.exec(trait.name)
            if (result[2].toLowerCase() !== longKey) {
                continue;
            }
            //TODO add them to correct variables for tooltip
            if (trait.data.prerequisites && trait.data.prerequisites.length > 0) {
                let prerequisite = trait.data.prerequisites[0];
                if (/ABILITY:(?:Child|Young adult|Adult|Middle age|Old|Venerable)/.exec(prerequisite)) {
                    ageBonuses.push(result[1]);
                    continue;
                }
            }
            if (trait.data.supplier?.type === 'species') {
                speciesBonuses.push(result[1]);
                continue;
            }
            bonuses.push(result[1])

        }
        attribute.classLevelBonus = resolveValueArray(classLevelBonuses, actor);
        attribute.speciesBonus = resolveValueArray(speciesBonuses, actor);
        attribute.ageBonus = resolveValueArray(ageBonuses, actor);
        attribute.equipmentBonus = resolveValueArray(equipmentBonuses, actor);
        attribute.buffBonus = resolveValueArray(buffBonuses, actor);
        // attribute.customBonus = resolveValueArray(customBonuses, actor
        //);

        bonuses.push(attribute.classLevelBonus);
        bonuses.push(attribute.speciesBonus);
        bonuses.push(attribute.ageBonus);
        bonuses.push(attribute.equipmentBonus);
        bonuses.push(attribute.buffBonus);
        bonuses.push(attribute.customBonus);

        for (let levelAttributeBonus of Object.values(actorData.data.levelAttributeBonus).filter(b => b != null)) {
            bonuses.push(levelAttributeBonus[key])
        }

        // Calculate the modifier using d20 rules.
        attribute.bonus = resolveValueArray(bonuses, actor);
        attribute.total = attribute.skip ? 10 : attribute.base + attribute.bonus;
        attribute.mod = Math.floor((attribute.total - 10) / 2);
        attribute.roll = attribute.mod + actor.getConditionBonus()
        attribute.label = key.toUpperCase();
        actor.resolvedVariables.set("@" + attribute.label, "1d20 + " + attribute.roll);
        actor.resolvedLabels.set("@" + attribute.label, attribute.label);

        prerequisites.attributes[key] = {};
        prerequisites.attributes[key].value = attribute.total;
        prerequisites.attributes[longKey] = {};
        prerequisites.attributes[longKey].value = attribute.total;
    }
}
