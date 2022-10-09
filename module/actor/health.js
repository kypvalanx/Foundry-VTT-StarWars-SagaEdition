import {resolveValueArray} from "../util.js";
import {getInheritableAttribute} from "../attribute-helper.js";
import {SWSEActor} from "./actor.js";
import {SWSEItem} from "../item/item.js";

/**
 *
 * @param {SWSEActor} actor
 * @returns {{temp, other: number, max: number, value: *, dr, sr}}
 */
export function resolveHealth(actor) {
    if (!actor || !actor) {
        return;
    }
    let system = actor.system;
    let ignoreCon = actor.ignoreCon();
    let health = [];
    for (let charClass of actor.classes || []) {
        health.push(charClass.classLevelHealth)
        health.push(resolveAttributeMod(actor, ignoreCon));
    }
    let others = [];
    let traitAttributes = getInheritableAttribute({
        entity: actor,
        attributeKey: 'hitPointEq'
    });
    let multipliers = [];
    for (let item of traitAttributes || []) {
        if (item) {
            others.push(item.value);
            health.push(item.value);
            if(item.value && (item.value.startsWith("*") || item.value.startsWith("/"))){
                multipliers.push(item.value)
            }
        }
    }
    let other = resolveValueArray(others, actor);

    //TODO add traits and stuff that boost HP
    let value = Array.isArray(system.health.value)? system.health.value[0]: system.health.value;
    let temp = system.health.temp;
    let max = resolveValueArray(health, actor);
    let dr = system.health.dr;
    let sr = system.health.sr;

    let invertedMultipliers = []
    for(let multiplier of multipliers){
        if(multiplier.startsWith("*")){
            invertedMultipliers.push("/" + multiplier.substring(1, multiplier.length));
        }
        else {
            invertedMultipliers.push("*" + multiplier.substring(1, multiplier.length));
        }
    }

    invertedMultipliers.push(system.hitPoints)
    let targetMaxHitPoints = Math.floor(resolveValueArray(invertedMultipliers, actor));
    if(targetMaxHitPoints && targetMaxHitPoints !== -1){
        let undestributedHitPoints = targetMaxHitPoints - max;
        if(undestributedHitPoints !== 0){
            for (let charClass of actor.classes || []) {
                if(charClass.actAsFirstLevel){
                    continue;
                }
                let maxHPThisLevel = getInheritableAttribute({entity: charClass, attributeKey: "levelUpHitPoints"}).map(attr => parseInt(attr.value.split("d")[1]))[0]
                let rolledHp = getInheritableAttribute({entity: charClass, attributeKey: "rolledHp", reduce: "SUM"});
                let newHPThisLevel = Math.max(Math.min(undestributedHitPoints + rolledHp, maxHPThisLevel), 1);

                if(maxHPThisLevel === rolledHp || newHPThisLevel === rolledHp){
                    continue;
                }
                console.debug("updating hitpoints for " + actor.name)
                charClass.setAttribute("rolledHp", newHPThisLevel);
                break;
            }
        } else{
            let data = {};
            data['data.hitPoints'] = -1;
            if(actor._id){
                actor.safeUpdate(data)
                console.debug("completed updating hitpoints for " + actor.name)
            }
        }
    }

    return {value, temp, other, max, dr, sr};
}

/**
 *
 * @param {SWSEActor} actor
 * @returns {{value: number, max: number}}
 */
export function resolveShield(actor) {
    if (!actor) {
        return;
    }
    let system = actor.system;
    let shieldRating = getInheritableAttribute({
        entity: actor,
        attributeKey: 'shieldRating',
        reduce: "SUM"
    })

    let advancedShieldRating = getInheritableAttribute({
        entity: actor,
        attributeKey: 'advancedShieldRating',
        reduce: "MAX"
    })
//TODO make sure the 0 state doesn't activate if a users shields are dropped to 0
    if(advancedShieldRating > 0){
        if(shieldRating === 0){
            shieldRating = advancedShieldRating * 2 + 10
        } else {
            shieldRating = shieldRating + advancedShieldRating;
        }
    }
    let value = Array.isArray(system.shields?.value)? system.shields?.value[0]: system.shields?.value || 0;
    let max = resolveValueArray(shieldRating, actor);
    let failureChance = getInheritableAttribute({
        entity: actor,
        attributeKey: 'shieldFailureChance',
        reduce: "MAX"
    });
    let active = !!actor.effects.find(effect => effect.flags?.core?.statusId === 'shield');
    return {value, max, failureChance, active};
}

function resolveAttributeMod(actor, ignoreCon) {
    if(ignoreCon){
        return 0;
    }
    return actor.system.attributes.con.mod;
}