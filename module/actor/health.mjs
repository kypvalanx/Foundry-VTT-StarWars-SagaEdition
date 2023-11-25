import {resolveValueArray} from "../common/util.mjs";
import {getInheritableAttribute} from "../attribute-helper.mjs";
import {SWSEActor} from "./actor.mjs";

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

    healthBonuses.push(... getInheritableAttribute({
        entity: actor,
        attributeKey: 'healthHardenedMultiplier',
        reduce: "NUMERIC_VALUES"
    }).map(value => "*"+value))
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
    let shields = actor.system.shields
    shields.max = shields.override ;
    if(!shields.override){
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
        shields.max = shieldRating;
    }

    let value = Array.isArray(shields?.value) ? shields?.value[0] : shields?.value || 0;
    let failureChance = getInheritableAttribute({
        entity: actor,
        attributeKey: 'shieldFailureChance',
        reduce: "MAX"
    });
    let active = !!actor.effects.find(effect => effect.statuses && effect.statuses.has('shield') && effect.disabled === false);
    shields.value = value;
    shields.failureChance = failureChance;
    shields.active = active;
    return shields;
}

function resolveAttributeMod(actor, ignoreCon) {
    if (ignoreCon) {
        return 0;
    }
    return actor.system.attributes.con.mod;
}