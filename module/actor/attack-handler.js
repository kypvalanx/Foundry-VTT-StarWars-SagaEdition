import {getBonusString, increaseDamageDie, resolveValueArray} from "../util.js";
import {SWSEItem} from "../item/item.js";
import {d20, sizeArray} from "../swse.js";


/**
 *
 * @param {SWSEActor} actor
 * @returns {Promise<void>}
 */
export async function generateAttacks(actor) {
    actor.data.data.attacks = [];
    actor.data.data.attacks.push(generateUnarmedAttacks(actor));
    actor.data.data.attacks.push(...actor.getEquippedItems()
        .filter(item => item.type === 'weapon')
        .map(weapon => generateAttackFromWeapon(weapon, actor)));
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

    let toHit = item.getAttribute("toHitModifier")
    let proficiencies = actorData.proficiency.weapon;
    let weaponTypes = getPossibleProficiencies(item);
    let proficient = isProficient(proficiencies, weaponTypes);
    let proficiencyBonus = proficient ? 0 : -5;
    let ranged = isRanged(item);
    let hasWeaponFinesse = actorData.prerequisites.feats.includes("weapon finesse");
    let focus = isFocus(actorData.proficiency.focus, weaponTypes);
    let isOneHanded = compareSizes(size, item.size) < 1;
    let isLight = compareSizes(size, item.size) < 0;// || (isOneHanded && focus && hasWeaponFinesse) || (isLightsaber(item));
    let isTwoHanded = compareSizes(size, item.size) === 1;

    let offense = actorData.data.offense;
    let meleeToHit = (hasWeaponFinesse && (isLight || (isOneHanded && focus) || isLightsaber(item))) ? Math.max(offense.mab, offense.fab) : offense.mab;
    let strMod = parseInt(actor.getAttributeMod("str"));
    let strBonus = isTwoHanded ? strMod * 2 : strMod;
    let notes = [];
    let modes = item.modes;
    let groupedModes = {}
    for(let mode of modes.filter(m => !!m)){
        if(!groupedModes[mode.group]){
            groupedModes[mode.group] = [];
        }
        groupedModes[mode.group].push(mode);
    }

    //let isAutofireOnly = rof ? rof.size === 1 && rof[0].toLowerCase() === 'autofire' : false;

    let damageBonuses = [];
    damageBonuses.push(actor.getHalfCharacterLevel())
    damageBonuses.push(ranged ? 0 : strBonus)
    damageBonuses.push(...item.getAttribute("bonusDamage"))

    let damageBonus = resolveValueArray(damageBonuses);
    let damage;

    let damageDie = item.damageDie;
    if (damageDie) {
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

    let attackBonuses = []
    attackBonuses.push(ranged ? offense.rab : meleeToHit);
    attackBonuses.push(proficiencyBonus);
    attackBonuses.push(focus ? 1 : 0)
    attackBonuses.push(actor.data.acPenalty)
    attackBonuses.push(...toHit)

    let atkBonus = resolveValueArray(attackBonuses, actor)


    let attackRoll = d20 + getBonusString(atkBonus);
    return createAttack(item.name, attackRoll, [damage, stunDamage].filter(t => !!t).join(", "), notes.join(", "), range, critical, type, item.id, actor.id, Object.values(groupedModes), hasStun)
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
        "heavy weapons", "simple ranged weapons"].includes(weapon.data.data.subtype.toLowerCase());
}

function isLightsaber(weapon) {
    return ["lightsabers", "lightsaber"].includes(weapon.subtype);
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
function createAttack(name, th, dam, notes, range, critical, type, itemId, actorId, modes, hasStun) {
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
        modes,
        hasStun
    };
}

export function generateUnarmedAttacks(actor) {
    if (!actor) {
        return undefined;
    }
    let unarmedDamage = actor.getInheritableAttributesByKey('unarmedDamage');
    let unarmedModifier = actor.getInheritableAttributesByKey('unarmedModifier');
    let actorData = actor.data;
    let size = actor.size;
    let feats = actorData.prerequisites?.feats || [];

    let proficiencies = actorData.proficiency.weapon;

    let proficient = isProficient(proficiencies, ["simple melee weapon"]);
    let proficiencyBonus = proficient ? 0 : -5;
    let focus = isFocus(actorData.proficiency?.focus, ["simple melee weapon"]);
    let hasWeaponFinesse = feats.includes("weapon finesse");
    let offense = actorData.data?.offense;

    let atkBonuses = [];
    atkBonuses.push(hasWeaponFinesse ? Math.max(offense?.mab, offense?.fab) : offense?.mab)
    atkBonuses.push(proficiencyBonus)
    atkBonuses.push(focus ? 1 : 0)
    atkBonuses.push(actor.data.acPenalty)
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

    damageBonuses.push(actor.getHalfCharacterLevel())
    damageBonuses.push(actor.getAttributeMod("str"))

    let dam = resolveUnarmedDamageDie(size, actor) + getBonusString(resolveValueArray(damageBonuses));

    let range = "Simple Melee Weapon";
    let critical = "x2";
    return createAttack(name, th, dam, notes, range, critical, type, null, actor.data._id, []);
}

/**
 *
 * @param {SWSEItem} size
 * @param {SWSEActor} actor
 * @returns {String}
 */
function resolveUnarmedDamageDie(size, actor) {
    let damageDie = getDamageDieSizeByCharacterSize(size);
    let bonus = actor.getInheritableAttributesByKey("bonusUnarmedDamageDieSize")
        .map(attr => parseInt(`${attr.value}`)).reduce((a, b) => a + b, 0)
    damageDie = increaseDamageDie(damageDie, bonus);
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

//test()

function test() {

    console.log("+5" === getBonusString(5))
    console.log("-5" === getBonusString(-5))
    console.log("" === getBonusString(0))

    console.log(undefined === increaseDamageDie(-1))
    console.log(undefined === increaseDamageDie(12))
    console.log(8 === increaseDamageDie(6))

}
