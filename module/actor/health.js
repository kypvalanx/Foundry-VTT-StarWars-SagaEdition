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
    for (let charClass of actor.classes || []) {
        health.push(resolveRolledHp(charClass))
        health.push(resolveCharClass(actor, ignoreCon));
    }
    let other = [];
    for (let item of actorData.items ? actorData.items : []) {
        let itemHpEq = item.data.attributes?.hitPointEq?.value;
        if (itemHpEq) {
            other.push(itemHpEq);
            health.push(itemHpEq);
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

function resolveRolledHp(charClass) {
    let health = charClass.data.health;
    if (charClass.data.attributes.first) {
        return health.rolledHp;
    }
    health.rolledHp = health.rolledHp ? health.rolledHp : 1;

    let max = parseInt(health.levelUp.split("d")[1]);
    health.rolledHp = max < health.rolledHp ? max : health.rolledHp;
    return health.rolledHp;
}