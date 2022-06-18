import {getInheritableAttribute} from "../attribute-helper.js";

/**
 *
 * @param actor {SWSEActor}
 * @returns {{bab: *}}
 */
export function resolveOffense(actor) {
    actor.data.data.offense = actor.data.data.offense || {}
    let offense = actor.data.data.offense;
    let old = offense.bab;
    offense.bab = getInheritableAttribute({
        entity: actor,
        attributeKey: "baseAttackBonus",
        reduce: "SUM"
    });

    let data = {};
    if (old !== offense.bab) {
        data[`data.offense.bab`] = offense.bab;
    }

    if(Object.values(data).length > 0 && !!actor.data._id){
        actor.update(data);
    }
}


export function resolveGrapple(actor){
    return actor.data.data.offense.bab + Math.max(actor.data.data.attributes.str.mod, actor.data.data.attributes.dex.mod) + getInheritableAttribute({entity: actor, attributeKey: "grappleSizeModifier", reduce: "SUM"})
}