import {getLongKey, resolveValueArray} from "../util.js";
import {SWSEItem} from "../item/item.js";

/**
 *
 * @param actor {SWSEActor}
 */
export function generateAttributes(actor) {
    let actorData = actor.data;

    actorData.data.lockAttributes = actor.shouldLockAttributes
    actorData.data.isBeast = actor.classes?.filter(clazz => clazz.name === "Beast").length > 0

    let data = {};

    let prerequisites = actorData.prerequisites;
    prerequisites.attributes = {};
    for (let [key, attribute] of Object.entries(actorData.data.attributes)) {
        let longKey = getLongKey(key);
        let attributeBonuses = actor.getInheritableAttributesByKey(`${longKey}Bonus`)
        let attributeMax = actor.getInheritableAttributesByKey(`${longKey}Max`, "MIN");
        let attributeBase = actor.getInheritableAttributesByKey(`base${longKey.titleCase()}`, "MAX");
        if (attributeBase > 0) {
            attribute.base = attributeBase;
        }
        if (attributeMax) {
            attribute.base = Math.min(attribute.base, attributeMax);
        }
        let bonuses = [];
        for (let bonusAttribute of attributeBonuses) {
            bonuses.push(bonusAttribute.value)
        }

        let attributeBonus = actorData.data.levelAttributeBonus;
        for (let levelAttributeBonus of Object.values(attributeBonus ? attributeBonus : []).filter(b => b != null)) {
            bonuses.push(levelAttributeBonus[key])
        }

        // Calculate the modifier using d20 rules.
        attribute.bonus = resolveValueArray(bonuses, actor);
        attribute.total = attribute.skip ? 10 : resolveValueArray([attribute.base, attribute.bonus], actor);
        let old = attribute.mod;
        attribute.mod = Math.floor((attribute.total - 10) / 2);


        if(attribute.mod !== old){
            data[`data.attributes.${key}.mod`] = attribute.mod;
        }

        attribute.roll = attribute.mod + actor.conditionBonus;
        attribute.label = key.toUpperCase();
        attribute.skip = (key === "con" && actor.isDroid) || (["con", "cha", "wis"].includes(key) && ["vehicle", "npc-vehicle"].includes(actor.data.type))
        actor.resolvedVariables.set("@" + attribute.label + "ROLL", "1d20 + " + attribute.roll);
        actor.resolvedLabels.set("@" + attribute.label + "ROLL", attribute.label);
        actor.resolvedVariables.set("@" + attribute.label + "MOD", attribute.roll);
        actor.resolvedLabels.set("@" + attribute.label + "MOD", attribute.label);
        actor.resolvedVariables.set("@" + attribute.label + "TOTAL", attribute.total);
        actor.resolvedLabels.set("@" + attribute.label + "TOTAL", attribute.label);

        prerequisites.attributes[key] = {};
        prerequisites.attributes[key].value = attribute.total;
        prerequisites.attributes[longKey] = {};
        prerequisites.attributes[longKey].value = attribute.total;
    }


    if(Object.values(data).length > 0 && !!actor.data._id){
        actor.update(data);
    }
}
