import {resolveValueArray} from "../util.js";
import {getInheritableAttribute} from "../attribute-helper.js";
import {SWSEActor} from "./actor.js";

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
    let healthBonuses = [];
    for (let charClass of actor.classes || []) {
        healthBonuses.push(charClass.classLevelHealth)
        healthBonuses.push(resolveAttributeMod(actor, ignoreCon));
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
            healthBonuses.push(item.value);
            if (item.value && (item.value.startsWith("*") || item.value.startsWith("/"))) {
                multipliers.push(item.value)
            }
        }
    }
    let other = resolveValueArray(others, actor);

    //TODO add traits and stuff that boost HP
    let health = system.health;
    health.value = Array.isArray(system.health.value) ? system.health.value[0] : system.health.value;
    health.other = other;
    health.max = system.health.override ? system.health.override : resolveValueArray(healthBonuses, actor);
    health.multipliers = multipliers;
    health.override = system.health.override;
    return health;
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
    if (advancedShieldRating > 0) {
        if (shieldRating === 0) {
            shieldRating = advancedShieldRating * 2 + 10
        } else {
            shieldRating = shieldRating + advancedShieldRating;
        }
    }
    let value = Array.isArray(system.shields?.value) ? system.shields?.value[0] : system.shields?.value || 0;
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
    if (ignoreCon) {
        return 0;
    }
    return actor.system.attributes.con.mod;
}