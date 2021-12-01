import {getLongKey, resolveValueArray} from "../util.js";
import {SWSEItem} from "../item/item.js";

/**
 *
 * @param actor {SWSEActor}
 */
export function generateAttributes(actor) {
    let actorData = actor.data;

    actorData.data.lockAttributes = actor.shouldLockAttributes
    let prerequisites = actorData.prerequisites;
    prerequisites.attributes = {};
    for (let [key, attribute] of Object.entries(actorData.data.attributes)) {
        let longKey = getLongKey(key);
        let attributeBonuses = actor.getInheritableAttributesByKey(`${longKey}Bonus`)
        if (actorData.data.lockAttributes) {
            attribute.base = 10;
        }
        let bonuses = [];
        // let classLevelBonuses = []; //TODO WIRE ME UP
        // let speciesBonuses = [];
        // let ageBonuses = [];
        // let equipmentBonuses = []; //TODO WIRE ME UP
        // let buffBonuses = []; //TODO WIRE ME UP
        for (let bonusAttribute of attributeBonuses) {
            //let sourceItem = actor.items.find(item => item.id === bonusAttribute.source)
            //console.warn(sourceItem.name) TODO we need to add a source field when generating these.  it would be great to show users where bonuses come from.
            bonuses.push(bonusAttribute.value)
        }
        // attribute.classLevelBonus = resolveValueArray(classLevelBonuses, actor);
        // attribute.speciesBonus = resolveValueArray(speciesBonuses, actor);
        // attribute.ageBonus = resolveValueArray(ageBonuses, actor);
        // attribute.equipmentBonus = resolveValueArray(equipmentBonuses, actor);
        // attribute.buffBonus = resolveValueArray(buffBonuses, actor);
        // // attribute.customBonus = resolveValueArray(customBonuses, actor
        // //);
        //
        // bonuses.push(attribute.classLevelBonus);
        // bonuses.push(attribute.speciesBonus);
        // bonuses.push(attribute.ageBonus);
        // bonuses.push(attribute.equipmentBonus);
        // bonuses.push(attribute.buffBonus);
        // bonuses.push(attribute.customBonus );

        let attributeBonus = actorData.data.levelAttributeBonus;
        for (let levelAttributeBonus of Object.values(attributeBonus ? attributeBonus : []).filter(b => b != null)) {
            bonuses.push(levelAttributeBonus[key])
        }

        // Calculate the modifier using d20 rules.
        attribute.bonus = resolveValueArray(bonuses, actor);
        attribute.total = attribute.skip ? 10 : attribute.base + attribute.bonus;
        attribute.mod = Math.floor((attribute.total - 10) / 2);
        attribute.roll = attribute.mod + actor.conditionBonus;
        attribute.label = key.toUpperCase();
        actor.resolvedVariables.set("@" + attribute.label, "1d20 + " + attribute.roll);
        actor.resolvedLabels.set("@" + attribute.label, attribute.label);

        prerequisites.attributes[key] = {};
        prerequisites.attributes[key].value = attribute.total;
        prerequisites.attributes[longKey] = {};
        prerequisites.attributes[longKey].value = attribute.total;
    }
}
