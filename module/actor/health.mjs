import {resolveValueArray} from "../util.mjs";

export function resolveHealth(actor) {
    if (!actor || !actor.data) {
        return;
    }
    let actorData = actor.data;
    let ignoreCon = actor.ignoreCon(actorData);
    let health = [];
    for (let charClass of actorData.classes ? actorData.classes : []) {
        health.push(resolveRolledHp(charClass))
        health.push(resolveCharClass(actorData, ignoreCon));
    }
    for (let item of actorData.items ? actorData.items : []) {
        let itemHpEq = item.data.attributes?.hitPointEq?.value;
        if (itemHpEq) {
            health.push(itemHpEq);
        }
    }

    //TODO add traits and stuff that boost HP
    return {max: resolveValueArray(health, actor)};
}

function resolveCharClass(actorData, ignoreCon) {
    if(ignoreCon){
        return null;
    }
    return actorData.data.abilities.con.mod;
}

function resolveRolledHp(charClass) {
    let health = charClass.data.health;
    if (charClass.first) {
        health.rolledHp = health.firstLevel;
        return health.rolledHp;
    }
    health.rolledHp = health.rolledHp ? health.rolledHp : 1;

    let max = parseInt(health.levelUp.split("d")[1]);
    health.rolledHp = max < health.rolledHp ? max : health.rolledHp;
    return health.rolledHp;
}