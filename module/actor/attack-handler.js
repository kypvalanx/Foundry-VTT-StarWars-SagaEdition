import {getBonusString, resolveValueArray} from "../util.js";
import {SWSEItem} from "../item/item.js";
import {d20, dieSize, sizeArray} from "../swse.js";


/**
 *
 * @param {SWSEActor} actor
 * @returns {Promise<void>}
 */
export async function generateAttacks(actor) {
    actor.data.data.attacks = [];
    let unarmedAttack = generateUnarmedAttacks(actor);
    //let i = 0;
    //unarmedAttack.id = 0;
    actor.data.data.attacks.push(unarmedAttack);
    for (const weapon of actor.getEquippedItems().filter(item => item.type === 'weapon')) {
        let attack = generateAttackFromWeapon(weapon, actor);
        //attack.id = i++;
        actor.data.data.attacks.push(attack);
    }
}

/**
 *
 * @param {SWSEItem} item
 * @param {SWSEActor} actor
 * @returns {{dam, itemId, notes, actorId, th, critical, sound: string, name, range, type, ratesOfFire, hasStun}|undefined}
 */
export function generateAttackFromWeapon(item, actor) {
    let actorData = actor.data;
    //let itemData = item.data;
    if (!actorData || !item) {
        return undefined;
    }
    let size = actor.size;
    if (isOversized(size, item.size) || item.type !== 'weapon') {
        return undefined;
    }

    let proficiencies = actorData.proficiency.weapon;
    let weaponTypes = getPossibleProficiencies(item);
    let proficient = isProficient(proficiencies, weaponTypes);
    let proficiencyBonus = proficient ? 0 : -5;
    let ranged = isRanged(item);
    let hasWeaponFinesse = actorData.prerequisites.feats.includes("weapon finesse");
    let focus = isFocus(actorData.proficiency.focus, weaponTypes);
    let isOneHanded = compareSizes(size, item.size) === 0;
    let isLight = (compareSizes(size, item.size) < 0) || (isOneHanded && focus) || (isLightsaber(item));
    let isTwoHanded = compareSizes(size, item.size) === 1;

    let offense = actorData.data.offense;
    let meleeToHit = (hasWeaponFinesse && isLight) ? Math.max(offense.mab, offense.fab) : offense.mab;
    let strMod = parseInt(actor.getAttributeMod("str"));
    let strBonus = isTwoHanded ? strMod * 2 : strMod;
    let notes = [];
    let rof = item.ratesOfFire;
    if (rof.length > 0) {
        notes.push(`(ROF: ${rof.join(", ")})`)
    }
    let isAutofireOnly = rof ? rof.size === 1 && rof[0].toLowerCase === 'autofire' : false;

    let damageBonuses = [];
    damageBonuses.push(actor.getHalfCharacterLevel())
    damageBonuses.push(ranged ? 0 : strBonus)

    let damageBonus = resolveValueArray(damageBonuses);
    let damageDie = "";
    let damage;

    if (item.damageDie) {
        damageDie = item.damageDie;
        damage = damageDie + getBonusString(damageBonus);
    }
    let stunDamageDie = "";
    let stunDamage;
    let hasStun = false;
    if (item.stunDamageDie) {
        stunDamageDie = item.stunDamageDie;
        stunDamage = `(Stun: ${stunDamageDie + getBonusString(damageBonus)})`
        notes.push("(Stun Setting)")
        hasStun = true;
    }

    let specials = item.getAttribute('special');
    for(let special of specials) {
        notes.push(special?.value);
    }

    let range = item.effectiveRange;
    let critical = "x2"
    let type = item.damageType


    let atkBonus = (ranged ? offense.rab : meleeToHit) + proficiencyBonus + (focus ? 1 : 0) + actor.data.acPenalty;

    let attackRoll = d20 + getBonusString(atkBonus);
    return createAttack(item.name, attackRoll, [damage, stunDamage].filter(t => !!t).join(", "), notes.join(", "), range, critical, type, item.id, actor.id, rof, hasStun)
}

function isOversized(actorSize, itemSize) {
    return compareSizes(actorSize, itemSize) > 1;
}

function getPossibleProficiencies(weapon) {
    let descriptors = [weapon.name, weapon.subType];
    if (weapon.data.data.treatedAsForRange) {
        descriptors.push(weapon.data.data.treatedAsForRange);
    }
    return descriptors.filter(descriptor => !!descriptor);
}

function isRanged(weapon) {
    return ["pistols", "rifles", "exotic ranged weapons", "ranged weapons", "grenades",
        "heavy weapons", "simple ranged weapons"].includes(weapon.subType);
}

function isLightsaber(weapon) {
    return ["lightsabers", "lightsaber"].includes(weapon.subType);
}

function isFocus(focuses, categories) {
    focuses = explodeProficiencies(focuses);
    for (const focus of focuses) {
        if (categories.map(cat => cat.toLowerCase()).includes(focus.toLowerCase())) {
            return true;
        }
    }
    return false;
}

function isProficient(proficiencies, weaponDescriptors) {
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
            result.push(...['simple melee weapons', 'simple ranged weapons', 'simple melee weapon', 'simple ranged weapon']);
            continue;
        }
        result.push(proficiency)
    }
    return result;
}

function multipleAttacks(atkBonus, proficient, feats) {
    if (!proficient) {
        return atkBonus - 10;
    }
    if (feats.includes("dual weapon mastery iii")) {
        return atkBonus;
    }
    if (feats.includes("dual weapon mastery ii")) {
        return atkBonus - 2;
    }
    if (feats.includes("dual weapon mastery i")) {
        return atkBonus - 5;
    }
}

function createAttack(name, th, dam, notes, range, critical, type, itemId, actorId, rof, hasStun) {
    return {
        name,
        th,
        dam,
        notes,
        range,
        critical,
        type,
        sound: "",
        itemId: itemId,
        actorId: actorId,
        ratesOfFire: rof,
        hasStun
    };
}

export function generateUnarmedAttacks(actor) {
    if (!actor) {
        return undefined;
    }
    let equippedWeapons = actor.getEquippedItems();
    let actorData = actor.data;
    let size = actor.size;
    let feats = actorData.prerequisites?.feats;
    feats = feats ? feats : [];

    let proficiencies = actorData.proficiency.weapon;

    let proficient = isProficient(proficiencies, ["simple melee weapon"]);
    let proficiencyBonus = proficient ? 0 : -5;
    let focus = isFocus(actorData.proficiency?.focus, ["simple melee weapon"]);
    let hasWeaponFinesse = feats.includes("weapon finesse");
    let offense = actorData?.data?.offense;

    let atkBonuses = [];
    atkBonuses.push(hasWeaponFinesse ? Math.max(offense?.mab, offense?.fab) : offense?.mab)
    atkBonuses.push(proficiencyBonus)
    atkBonuses.push(focus ? 1 : 0)
    atkBonuses.push(actor.data.acPenalty)
    let notes = "";
    let damageBonuses = [];
    let type = "Bludgeoning";
    let name = "Unarmed Attack";
    for (let equippedWeapon of equippedWeapons ? equippedWeapons : []) {
        equippedWeapon = equippedWeapon.data;
        if (equippedWeapon.data.attributes.unarmedDamage || equippedWeapon.data.attributes.unarmedModifier) {
            name += " (" + equippedWeapon.name + ")"
        }
        if (equippedWeapon.data.attributes.unarmedDamage) {
            damageBonuses.push(equippedWeapon.data.attributes.unarmedDamage);
        }
        if (equippedWeapon.data.attributes.unarmedModifier) {
            type = equippedWeapon.data.attributes.unarmedModifier.substring(12);
            notes += equippedWeapon.data.attributes.unarmedModifier;
        }
    }

    let th = d20 + getBonusString(resolveValueArray(atkBonuses));

    damageBonuses.push(actor.getHalfCharacterLevel())
    damageBonuses.push(actor.getAttributeMod("str"))

    let dam = resolveUnarmedDamageDie(size, feats) + getBonusString(resolveValueArray(damageBonuses));

    let range = "Simple Melee Weapon";
    let critical = "x2";
    return createAttack(name, th, dam, notes, range, critical, type, null, actor.data._id);
}

/**
 *
 * @param {SWSEItem} size
 * @param feats
 * @returns {string}
 */
function resolveUnarmedDamageDie(size, feats) {
    //TODO make this a property of the feats
    let damageDie = getDamageDieSizeByCharacterSize(size);
    if (feats.includes("martial arts iii")) {
        damageDie = increaseDamageDie(damageDie);
    }
    if (feats.includes("martial arts ii")) {
        damageDie = increaseDamageDie(damageDie);
    }
    if (feats.includes("martial arts i")) {
        damageDie = increaseDamageDie(damageDie);
    }
    return `1d${damageDie}`;
}

/**
 *
 * @param {SWSEItem} size
 * @returns {number}
 */
function getDamageDieSizeByCharacterSize(size) {
    let attributes = size?.getAttribute('unarmedDieSize');
    let max = 0;
    for(let attribute of attributes || []){
        max = Math.max(max, attribute.value);
    }
    return max;
}

function increaseDamageDie(damageDieSize) {
    let index = dieSize.indexOf(damageDieSize);
    if (index === -1) {
        return undefined;
    }
    return dieSize[index + 1];
}

//test()

function test() {

    console.log("+5" === getBonusString(5))
    console.log("-5" === getBonusString(-5))
    console.log("" === getBonusString(0))

    console.log(undefined === increaseDamageDie(-1))
    console.log(undefined === increaseDamageDie(12))
    console.log(8 === increaseDamageDie(6))

}
