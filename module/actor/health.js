import {resolveValueArray} from "../util.js";

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
    let level = 0;
    for (let charClass of actor.classes || []) {
        health.push(resolveRolledHp(charClass, ++level))
        health.push(resolveCharClass(actor, ignoreCon));
    }
    let other = [];
    let traitAttributes = actor.getInheritableAttributesByKey('hitPointEq');
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

function resolveCharClass(actor, ignoreCon) {
    if(ignoreCon){
        return null;
    }
    return actor.data.data.attributes.con.mod;
}

function resolveRolledHp(charClass, level) {
    let health = charClass.data.data.health;
    if (level === 1) {
        return health.firstLevel;
    }
    health.rolledHp = health.rolledHp ? health.rolledHp : 1;

    let max = parseInt(health.levelUp.split("d")[1]);
    health.rolledHp = max < health.rolledHp ? max : health.rolledHp;
    return health.rolledHp;
}