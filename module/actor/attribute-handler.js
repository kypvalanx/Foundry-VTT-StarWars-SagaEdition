import {getLongKey, resolveValueArray, toNumber} from "../util.js";
import {getInheritableAttribute} from "../attribute-helper.js";

/**
 *
 * @param actor {SWSEActor}
 */
export function generateAttributes(actor) {
    let system = actor.system;

    system.lockAttributes = actor.shouldLockAttributes
    system.isBeast = actor.classes?.filter(clazz => clazz.name === "Beast").length > 0

    let data = {};

    for (let [key, attribute] of Object.entries(system.attributes)) {
        let longKey = getLongKey(key);
        if(!longKey){
            continue;
        }
        let attributeBonuses = getInheritableAttribute({
            entity: actor,
            attributeKey: `${longKey}Bonus`
        })
        let attributeMax = getInheritableAttribute({
            entity: actor,
            attributeKey: `${longKey}Max`,
            reduce: "MIN"
        });
        let attributeBase = getInheritableAttribute({
            entity: actor,
            attributeKey: `base${longKey.titleCase()}`,
            reduce: "MAX"
        });
        if (attributeBase > 0) {
            attribute.base = attributeBase;
        }
        if (!isNaN(attributeMax)) {
            attribute.base = Math.min(attribute.base, attributeMax);
        }
        let bonuses = [];
        for (let bonusAttribute of attributeBonuses) {
            bonuses.push(bonusAttribute.value)
        }

        let attributeBonus = system.levelAttributeBonus;
        for (let levelAttributeBonus of Object.values(attributeBonus ? attributeBonus : []).filter(b => b != null)) {
            bonuses.push(levelAttributeBonus[key])
        }

        // Calculate the modifier using d20 rules.
        attribute.bonus = resolveValueArray(bonuses, actor);

        let attributeMaxBonus = getInheritableAttribute({
            entity: actor,
            attributeKey: `${longKey}MaxBonus`,
            reduce: "MIN"
        });

        if (!isNaN(attributeMaxBonus)) {
            attribute.bonus = Math.min(attribute.bonus, attributeMaxBonus);
        }

        let oldTotal = attribute.total;
        attribute.total = attribute.skip ? 10 : resolveValueArray([attribute.base, attribute.bonus], actor);

        if(attribute.estimate){
            let estimate = toNumber(attribute.estimate);
            let difference = estimate - attribute.total
            attribute.total = estimate;

            data[`data.attributes.${key}.base`] = attribute.base + difference;
            data[`data.attributes.${key}.estimate`] = null;
        }

        if(attribute.total !== oldTotal){
            data[`data.attributes.${key}.total`] = attribute.total;
        }

        let old = attribute.mod;
        attribute.mod = Math.floor((attribute.total - 10) / 2);

        if(attribute.mod !== old){
            data[`data.attributes.${key}.mod`] = attribute.mod;
        }

        let conditionBonus = getInheritableAttribute({
            entity: actor,
            attributeKey: "condition",
            reduce: "FIRST"
        })

        if("OUT" === conditionBonus || !conditionBonus){
            conditionBonus = "0";
        }

        attribute.roll = attribute.mod + parseInt(conditionBonus);
        attribute.label = key.toUpperCase();
        attribute.skip = (key === "con" && actor.isDroid) || (["con", "cha", "wis"].includes(key) && ["vehicle", "npc-vehicle"].includes(actor.data.type))
        actor.resolvedVariables.set("@" + attribute.label + "ROLL", "1d20 + " + attribute.roll);
        actor.resolvedLabels.set("@" + attribute.label + "ROLL", attribute.label);
        actor.resolvedVariables.set("@" + attribute.label + "MOD", attribute.roll);
        actor.resolvedLabels.set("@" + attribute.label + "MOD", attribute.label);
        actor.resolvedVariables.set("@" + attribute.label + "TOTAL", attribute.total);
        actor.resolvedLabels.set("@" + attribute.label + "TOTAL", attribute.label);
    }


    if(Object.values(data).length > 0 && !!actor.data._id){
        actor.update(data);
    }
}
