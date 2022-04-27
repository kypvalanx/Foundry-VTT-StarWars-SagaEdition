import {resolveValueArray} from "../util.js";
import {getInheritableAttribute} from "../attribute-helper.js";

/**
 *
 * @param {SWSEActor} actor
 * @returns {{temp, other: number, max: number, value: *, dr, sr}}
 */
export function resolveHealth(actor) {
    if (!actor || !actor.data) {
        return;
    }
    let actorData = actor.data;
    let ignoreCon = actor.ignoreCon();
    let health = [];
    for (let charClass of actor.classes || []) {
        health.push(charClass.classLevelHealth)
        health.push(resolveAttributeMod(actor, ignoreCon));
    }
    let other = [];
    let traitAttributes = getInheritableAttribute({
        entity: actor,
        attributeKey: 'hitPointEq'
    });
    for (let item of traitAttributes || []) {
        if (item) {
            other.push(item.value);
            health.push(item.value);
        }
    }
    let otherBonuses = resolveValueArray(other, actor);

    //TODO add traits and stuff that boost HP
    return {value: Array.isArray(actorData.data.health.value)? actorData.data.health.value[0]: actorData.data.health.value,temp: actorData.data.health.temp, other: otherBonuses,max: resolveValueArray(health, actor), dr: actorData.data.health.dr, sr: actorData.data.health.sr};
}

function resolveAttributeMod(actor, ignoreCon) {
    if(ignoreCon){
        return 0;
    }
    return actor.data.data.attributes.con.mod;
}

