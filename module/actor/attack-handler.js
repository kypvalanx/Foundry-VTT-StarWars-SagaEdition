import {getBonusString, increaseDieSize, resolveValueArray} from "../util.js";
import {SWSEItem} from "../item/item.js";
import {Attack} from "./attack.js";
import {d20, sizeArray} from "../constants.js";


/**
 *
 * @param {SWSEActor} actor
 * @returns {Promise<void>}
 */
export function generateAttacks(actor) {
    let attacks = [];
    attacks.push(generateUnarmedAttack(actor));
    attacks.push(...actor.getEquippedItems()
        .filter(item => item.type === 'weapon')
        .map(weapon => generateAttackFromWeapon(weapon, actor)));
    return attacks;
}

function canFinesse(size, item, focus) {
    let isOneHanded = compareSizes(size, item.size) < 1;
    let isLight = compareSizes(size, item.size) < 0;
    return isLight || (isOneHanded && focus) || isLightsaber(item);
}

function getGroupedModes(item) {
    let modes = item.modes;
    let groupedModes = {}
    for (let mode of modes.filter(m => !!m)) {
        if (!groupedModes[mode.group]) {
            groupedModes[mode.group] = [];
        }
        groupedModes[mode.group].push(mode);
    }
    return Object.values(groupedModes);
}

/**
 *
 * @param {SWSEItem} item
 * @param {SWSEActor} actor
 * @param {number} attackIteration
 * @returns {Attack|undefined}
 */
export function generateAttackFromWeapon(item, actor, attackIteration) {
    let actorData = actor.data;
    if (!actorData || !item) {
        return undefined;
    }
    let size = actor.size;
    if (isOversized(size, item.size) || item.type !== 'weapon') {
        return undefined;
    }

    let groupedModes = getGroupedModes(item);

    let notes = item.getInheritableAttributesByKey('special').filter(s => !!s).map(s => s.value);

    let range = item.effectiveRange;
    let critical = "x2"
    let type = item.damageType

    let damageBonuses = [];
    damageBonuses.push(actor.halfHeroicLevel)
    damageBonuses.push(...item.getInheritableAttributesByKey("bonusDamage"))

    let attackBonuses = [actorData.data.offense.bab]
    let weaponTypes = getPossibleProficiencies(actor, item);

    if (isRanged(item)) {
        attackBonuses.push(resolveFinesseBonus(actor, [{value: "DEX"}]));
    } else {
        let strMod = parseInt(actor.getAttributeMod("str"));
        let isTwoHanded = compareSizes(size, item.size) === 1;
        damageBonuses.push(isTwoHanded ? strMod * 2 : strMod)
        let finesseStats = [{value: "STR"}];
        if (canFinesse(size, item, isFocus(actor, weaponTypes))) {
            finesseStats.push(...actor.getInheritableAttributesByKey("finesseStat"));
        }
        attackBonuses.push(resolveFinesseBonus(actor, finesseStats));
    }
    attackBonuses.push(isProficient(actor, weaponTypes) ? 0 : -5);
    attackBonuses.push(isFocus(actor, weaponTypes) ? 1 : 0)
    attackBonuses.push(actor.acPenalty) //TODO this looks like it could use some TLC
    attackBonuses.push(...(item.getInheritableAttributesByKey("toHitModifier")))

    let attackRoll = d20 + getBonusString(resolveValueArray(attackBonuses, actor));

    let damageBonus = resolveValueArray(damageBonuses);
    let damage;

    let damageDie = item.damageDie;
    if (attackIteration) {
        damageDie = item.additionalDamageDice[attackIteration - 1]
    }

    if (damageDie) {
        damage = damageDie + getBonusString(damageBonus);
    }
    let stunDamageDie = "";
    let hasStun = false;
    if (item.stunDamageDie) {
        stunDamageDie = item.stunDamageDie;
        damage = stunDamageDie + getBonusString(damageBonus)
        notes.push("(Stun Setting)")
        hasStun = true;
    }

    return createAttack(item.name, attackRoll, damage, notes.join(", "), range, critical, type, item.id, actor.id, groupedModes, hasStun, item)
}

function isOversized(actorSize, itemSize) {
    return compareSizes(actorSize, itemSize) > 1;
}

/**
 *
 * @param actor {SWSEActor}
 * @param weapon {SWSEItem}
 * @returns {(*|string)[]}
 */
function getPossibleProficiencies(actor, weapon) {
    let weaponFamiliarities = {};
    actor.getInheritableAttributesByKey("weaponFamiliarity").forEach(fam => {
        let toks = fam.value.split(":");
        if (toks.length === 2) {
            weaponFamiliarities[toks[0]] = toks[1];
        }
    });

    let descriptors = [weapon.name, weapon.subType];
    let explodedDescriptors = [];

    for (let descriptor of descriptors) {
        let familiarity = weaponFamiliarities[descriptor];
        if (familiarity) {
            explodedDescriptors.push(familiarity);
        }
    }

    descriptors.push(...explodedDescriptors);

    return descriptors.filter(descriptor => !!descriptor);
}

const RANGED_WEAPON_TYPES = ["pistols", "rifles", "exotic ranged weapons", "ranged weapons", "grenades",
    "heavy weapons", "simple ranged weapons"];
const LIGHTSABER_WEAPON_TYPES = ["lightsabers", "lightsaber"];
const SIMPLE_WEAPON_TYPES = ['simple melee weapons', 'simple ranged weapons', 'simple melee weapon', 'simple ranged weapon', "grenades"];
const UNARMED_WEAPON_TYPES = ["simple melee weapon"];

function isRanged(weapon) {
    return RANGED_WEAPON_TYPES.includes(weapon.data.data.subtype.toLowerCase());
}


function isLightsaber(weapon) {
    return LIGHTSABER_WEAPON_TYPES.includes(weapon.subtype);
}

/**
 *
 * @param actor {SWSEActor}
 * @param categories
 * @returns {boolean}
 */
function isFocus(actor, categories) {
    let focuses = actor.getInheritableAttributesByKey("weaponFocus").map(prof => prof.value.toLowerCase())
    focuses = explodeProficiencies(focuses);
    for (const focus of focuses) {
        if (categories.map(cat => cat.toLowerCase()).includes(focus.toLowerCase())) {
            return true;
        }
    }
    return false;
}

/**
 *
 * @param actor {SWSEActor}
 * @param weaponDescriptors
 * @returns {boolean}
 */
function isProficient(actor, weaponDescriptors) {
    let proficiencies = actor.getInheritableAttributesByKey("weaponProficiency").map(prof => prof.value.toLowerCase())
    proficiencies = explodeProficiencies(proficiencies);
    for (let proficiency of proficiencies) {
        if (weaponDescriptors.map(cat => cat.toLowerCase()).includes(proficiency.toLowerCase())) {
            return true;
        }
    }
    return false;
}

/**
 *
 * @param size1
 * @param size2
 * @returns {number}
 */
function compareSizes(size1, size2) {
    if (size1?.name) {
        size1 = size1.name
    }
    if (size2?.name) {
        size2 = size2.name
    }

    return sizeArray.indexOf(size1) - sizeArray.indexOf(size2);
}


/**
 *
 * @param proficiencies {[]}
 * @returns {[]}
 */
function explodeProficiencies(proficiencies) {
    let result = [];
    for (let proficiency of proficiencies ? proficiencies : []) {
        if (proficiency === 'simple weapons') {
            result.push(...SIMPLE_WEAPON_TYPES);
            continue;
        }
        result.push(proficiency)
    }
    return result;
}

/**
 *
 * @param name
 * @param th
 * @param dam
 * @param notes
 * @param range
 * @param critical
 * @param type
 * @param itemId
 * @param actorId
 * @param modes
 * @param hasStun
 * @param source
 * @returns {Attack}
 */
function createAttack(name, th, dam, notes, range, critical, type, itemId, actorId, modes, hasStun, source) {
    return new Attack(
        name,
        th,
        dam,
        notes,
        range,
        critical,
        type,
        "",
        itemId,
        actorId,
        modes,
        hasStun,
        source);
}

export function resolveFinesseBonus(actor, finesseStats) {
    let bonus = -9999;
    for (let stat of finesseStats) {
        bonus = Math.max(bonus, actor.getCharacterAttribute(stat.value).mod);
    }
    return bonus;
}

/**
 *
 * @param actor {SWSEActor}
 * @returns {Attack|undefined}
 */

export function generateUnarmedAttack(actor) {
    if (!actor) {
        return undefined;
    }
    let unarmedDamage = actor.getInheritableAttributesByKey('unarmedDamage');
    let unarmedModifier = actor.getInheritableAttributesByKey('unarmedModifier');
    let actorData = actor.data;

    let proficient = isProficient(actor, UNARMED_WEAPON_TYPES);
    let proficiencyBonus = proficient ? 0 : -5;
    let focus = isFocus(actor, UNARMED_WEAPON_TYPES);
    let finesseStats = actor.getInheritableAttributesByKey("finesseStat");
    finesseStats.push({value: "STR"});
    let finesseBonus = resolveFinesseBonus(actor, finesseStats);
    let offense = actorData.data?.offense;

    let atkBonuses = [];
    atkBonuses.push(offense?.bab)
    atkBonuses.push(finesseBonus)
    atkBonuses.push(proficiencyBonus)
    atkBonuses.push(focus ? 1 : 0)
    atkBonuses.push(actor.acPenalty)
    let notes = "";
    let damageBonuses = [];
    let type = "Bludgeoning";
    let name = "Unarmed Attack";

    if (unarmedDamage.length > 0 || unarmedModifier.length > 0) {
        let sources = unarmedDamage.map(obj => obj.source);
        sources.push(...(unarmedModifier.map(obj => obj.source)));
        sources = sources.distinct();

        let names = sources.map(source => actor.inheritableItems.find(item => item._id === source)?.name)

        name += " (" + names.join(", ") + ")"
    }
    if (unarmedDamage.length > 0) {
        damageBonuses.push(...unarmedDamage.map(o => o.value));
    }
    if (unarmedModifier.length > 0) {
        type = unarmedModifier.map(modifier => modifier.value.substring(12)).join(", ")
        notes += unarmedModifier.map(modifier => modifier.value).join(", ")
    }

    let th = d20 + getBonusString(resolveValueArray(atkBonuses));

    damageBonuses.push(actor.halfHeroicLevel)
    damageBonuses.push(actor.getAttributeMod("str"))

    let dam = resolveUnarmedDamageDie(actor) + getBonusString(resolveValueArray(damageBonuses));

    let range = "Simple Melee Weapon";
    let critical = "x2";
    return createAttack(name, th, dam, notes, range, critical, type, null, actor.data._id, []);
}

/**
 * Resolves the die to be thrown when making an unarmed attack
 * @param {SWSEActor} actor
 * @returns {String}
 */
function resolveUnarmedDamageDie(actor) {
    let damageDie = actor.getInheritableAttributesByKey(actor.isDroid ? "droidUnarmedDamageDie" : "unarmedDamageDie", "MAX");
    let bonus = actor.getInheritableAttributesByKey("bonusUnarmedDamageDieSize")
        .map(attr => parseInt(`${attr.value}`)).reduce((a, b) => a + b, 0)
    return increaseDieSize(damageDie, bonus);
}
