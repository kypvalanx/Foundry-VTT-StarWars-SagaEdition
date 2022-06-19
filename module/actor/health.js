import {resolveValueArray} from "../util.js";
import {getInheritableAttribute} from "../attribute-helper.js";
import {SWSEActor} from "./actor.js";

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
    let others = [];
    let traitAttributes = getInheritableAttribute({
        entity: actor,
        attributeKey: 'hitPointEq'
    });
    for (let item of traitAttributes || []) {
        if (item) {
            others.push(item.value);
            health.push(item.value);
        }
    }
    let other = resolveValueArray(others, actor);

    //TODO add traits and stuff that boost HP
    let value = Array.isArray(actorData.data.health.value)? actorData.data.health.value[0]: actorData.data.health.value;
    let temp = actorData.data.health.temp;
    let max = resolveValueArray(health, actor);
    let dr = actorData.data.health.dr;
    let sr = actorData.data.health.sr;
    return {value, temp, other, max, dr, sr};
}

/**
 *
 * @param {SWSEActor} actor
 * @returns {{value: number, max: number}}
 */
export function resolveShield(actor) {
    if (!actor || !actor.data) {
        return;
    }
    let actorData = actor.data;
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
    let value = Array.isArray(actorData.data?.shields?.value)? actorData.data?.shields?.value[0]: actorData.data?.shields?.value || 0;
    let max = resolveValueArray(shieldRating, actor);
    let failureChance = getInheritableAttribute({
        entity: actor,
        attributeKey: 'shieldFailureChance',
        reduce: "MAX"
    });
    let active = !!actor.effects.find(effect => effect.data?.flags?.core?.statusId === 'shield');
    return {value, max, failureChance, active};
}

function resolveAttributeMod(actor, ignoreCon) {
    if(ignoreCon){
        return 0;
    }
    return actor.data.data.attributes.con.mod;
}