import {resolveValueArray} from "../util.js";

export function resolveHealth(actor) {
    let actorData = actor.data;
    let health = [];
    if (actorData.classes) {
        for (let charClass of Object.values(actorData.classes)) {
            if (charClass.first) {
                charClass.data.health.rolledHp = charClass.data.health.firstLevel;
            } else {
                if (!charClass.data.health.rolledHp) {
                    charClass.data.health.rolledHp = 1;
                }
                let max = parseInt(charClass.data.health.levelUp.split("d")[1]);
                charClass.data.health.rolledHp = max < charClass.data.health.rolledHp ? max : charClass.data.health.rolledHp;
            }
            health.push( charClass.data.health.rolledHp);

            if (!actor.ignoreCon(actorData)) {

                health.push( actorData.data.abilities.con.mod);
            }
        }
    }
    for(let item of actorData.items){
        let itemHpEq = item.data.attributes.hitPointEq?.value;
        if(itemHpEq){
            health.push(itemHpEq);
        }
    }



    //TODO add traits and stuff that boost HP
    return {max:resolveValueArray(actor, health)};
}


