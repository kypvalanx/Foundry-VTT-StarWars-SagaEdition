import {getInheritableAttribute} from "../attribute-helper.js";

/**
 *
 * @param actor {SWSEActor}
 * @returns {{bab: *}}
 */
export function resolveOffense(actor) {
    actor.system.offense = actor.system.offense || {}
    let offense = actor.system.offense;
    let old = offense.bab;
    offense.bab = getInheritableAttribute({
        entity: actor,
        attributeKey: "baseAttackBonus",
        reduce: "SUM"
    });

    let data = {};
    if (old !== offense.bab) {
        data[`offense.bab`] = offense.bab;
    }

    if(Object.values(data).length > 0 && !!actor._id){
        actor.update(data);
    }
}

/**
 *
 *
 * @param actor {SWSEActor}
 * @returns {*}
 */
export function resolveGrapple(actor){
    return actor.system.offense.bab + Math.max(actor.system.attributes.str.mod, actor.system.attributes.dex.mod) + getInheritableAttribute({entity: actor, attributeKey: "grappleSizeModifier", reduce: "SUM"})
}