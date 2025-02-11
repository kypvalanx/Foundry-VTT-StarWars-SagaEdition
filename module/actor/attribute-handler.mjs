import {getLongKey, resolveValueArray, toNumber} from "../common/util.mjs";
import {getInheritableAttribute} from "../attribute-helper.mjs";



/**
 *
 * @param actor {SWSEActor}
 * @param options
 * @param options.embeded
 */
export function generateAttributes(actor, options={}) {
    let system = actor.system;

    system.lockAttributes = actor.shouldLockAttributes
    let attributeGenType = actor.system.finalAttributeGenerationType;
    //let data = {};

    let embeddedItemOverride = options?.embeddedItemOverride;

    for (let [key, attribute] of Object.entries(system.attributes)) {
        let longKey = getLongKey(key);
        if(!longKey){
            continue;
        }

        attribute.skip = (key === "con" && actor.isDroid) || (["con", "cha", "wis"].includes(key) && ["vehicle", "npc-vehicle"].includes(actor.type))
        if(attribute.skip){
            attribute.total = 10
        } else if(attributeGenType === 'Manual'){
            attribute.total = attribute.manual || 10;
        } else {
            let attributeBase = getInheritableAttribute({
                entity: actor,
                attributeKey: `base${longKey.titleCase()}`,
                reduce: "MAX",
                embeddedItemOverride
            });
            if (attributeBase > 0) {
                attribute.base = attributeBase;
            }

            let attributeMax = getInheritableAttribute({
                entity: actor,
                attributeKey: `${longKey}Max`,
                reduce: "MIN",
                embeddedItemOverride
            });
            if (!isNaN(attributeMax)) {
                attribute.base = Math.min(attribute.base, attributeMax);
            }
            if(attributeGenType === 'Semi-Manual'){
                attribute.base = attribute.manual
            }

            let bonuses = getInheritableAttribute({
                entity: actor,
                attributeKey: `${longKey}Bonus`,
                reduce: "VALUES",
                embeddedItemOverride
            })
            let attributeBonus = system.levelAttributeBonus;
            for (let levelAttributeBonus of Object.values(attributeBonus ? attributeBonus : []).filter(b => b != null)) {
                bonuses.push(levelAttributeBonus[key])
            }

            attribute.bonus = resolveValueArray(bonuses, actor);

            let attributeMaxBonus = getInheritableAttribute({
                entity: actor,
                attributeKey: `${longKey}MaxBonus`,
                reduce: "MIN",
                embeddedItemOverride
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

                actor._pendingUpdates[`system.attributes.${key}.base`] = attribute.base + difference;
                actor._pendingUpdates[`system.attributes.${key}.estimate`] = null;
            }


            if(attribute.total !== oldTotal){
                actor._pendingUpdates[`system.attributes.${key}.total`] = attribute.total;
            }
        }


        let old = attribute.mod;
        attribute.mod = Math.floor((toNumber(attribute.total) + toNumber(attribute.customBonus) - 10) / 2);

        if(attribute.mod !== old){
            actor._pendingUpdates[`system.attributes.${key}.mod`] = attribute.mod;
        }

        let conditionBonus = system.condition;

        if("OUT" === conditionBonus || !conditionBonus){
            conditionBonus = "0";
        }

        attribute.roll = attribute.mod + parseInt(conditionBonus);
        attribute.label = key.toUpperCase();
        actor.setResolvedVariable("@" + attribute.label + "ROLL", "1d20 + " + attribute.roll, attribute.label, attribute.label);
        actor.setResolvedVariable("@" + attribute.label + "MOD", attribute.roll, attribute.label, attribute.label);
        actor.setResolvedVariable("@" + attribute.label + "TOTAL", attribute.total, attribute.label, attribute.label);
    }


    // if(Object.values(data).length > 0 && !actor.pack && !actor.flags.core?.sourceId?.includes(actor._id)){
    //     if(actor._id){
    //         actor.safeUpdate(data);
    //     }
    // }
}
