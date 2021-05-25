import {resolveValueArray} from "../util.js";

const dieSize = [2, 3, 4, 6, 8, 10, 12];
const sizeArray = ["Colossal", "Gargantuan", "Huge", "Large", "Medium", "Small", "Tiny", "Diminutive", "Fine"];

const d20 = "1d20";


export async function generateAttacks(actor) {


    actor.data.data.attacks = [];
    actor.data.data.attacks.push(...generateUnarmedAttacks(actor.data.equipped, actor));
    for (const weapon of actor.data.equipped) {
        actor.data.data.attacks.push(...generateAttacksFromWeapon(weapon, actor));
    }
    actor.resolvedAttacks = new Map();
    let i = 0;
    for (let attack of actor.data.data.attacks) {
        attack.id = i++;
        actor.resolvedAttacks.set(`${actor.data._id} ${attack.name}`, attack);
    }
}

function generateAttacksFromWeapon(item, actor) {
    let actorData = actor.data;
    let itemData = item.data;
    if (!actorData || !itemData) {
        return [];
    }
    let size = getActorSize(actorData);
    let weapon = itemData.weapon;
    if (isOversized(size, itemData) || !weapon) {
        return [];
    }

    let proficiencies = actorData.proficiency.weapon;
    let weaponCategories = getWeaponCategories(item);
    let proficient = isProficient(proficiencies, weaponCategories);
    let proficiencyBonus = proficient ? 0 : -5;
    let ranged = isRanged(item);
    let hasWeaponFinesse = actorData.prerequisites.feats.includes("weapon finesse");
    let focus = isFocus(actorData.proficiency.focus, weaponCategories);
    let isOneHanded = compareSizes(size, itemData.finalSize) === 0;
    let isLight = (compareSizes(size, itemData.finalSize) < 0) || (isOneHanded && focus) || (isLightsaber(item));
    let isTwoHanded = compareSizes(size, itemData.finalSize) === 1;

    let offense = actorData.data.offense;
    let meleeToHit = (hasWeaponFinesse && isLight) ? Math.max(offense.mab, offense.fab) : offense.mab;
    let strMod = parseInt(actor.getAttributeMod("str"));
    let strBonus = isTwoHanded ? strMod * 2 : strMod;
    let rof = weapon.ratesOfFire;
    let isAutofireOnly = rof ? rof.size === 1 && rof[0].toLowerCase === 'autofire' : false;

    let attacks = [];

    let stunAttacks = resolveStunAttack(item, actor, ranged, offense, meleeToHit, focus, proficiencyBonus, isAutofireOnly, strBonus);
    attacks = attacks.concat(stunAttacks.attacks);

    if (stunAttacks.isStunOnly || !(weapon.damage?.attacks)) {
        return attacks;
    }

    let dieEquation = weapon.damage.finalDamage;
    if (dieEquation.includes("/")) {
        dieEquation = dieEquation.split("/");
    } else {
        dieEquation = [dieEquation];
    }

    let custom = weapon.damage ? weapon.damage.custom : null;
    let damageBonuses = [];
    damageBonuses.push(actor.getHalfCharacterLevel())
    damageBonuses.push(ranged ? 0 : strBonus)

    let damageBonus = resolveValueArray(damageBonuses);
    let dam = [];
    for (let eq of dieEquation) {
        dam.push(eq + getBonusString(damageBonus));
    }
    if (custom) {
        dam = [custom];
    }

    let atkBonus = (ranged ? offense.rab : meleeToHit) + proficiencyBonus + (focus ? 1 : 0) + actor.data.acPenalty;

    if (rof) {
        for (const rate of rof) {
            let th = getBonusString(getToHit(rate, atkBonus, item));
            attacks.push({
                name: item.name + " [" + rate.toUpperCase() + "]",
                th,
                dam, sound: "", itemId: item._id, actorId: actor.data._id, img: item.img
            });
        }
        return attacks;
    }

    if (dam.length === 1) {
        let th = d20 + getBonusString(atkBonus);
        attacks.push({
            name: item.name,
            th,
            dam,
            sound: "",
            itemId: item._id,
            actorId: actor.data._id,
            img: item.img
        });
        return attacks;
    }

    let attkRoll = d20 + getBonusString(multipleAttacks(atkBonus, proficient, actorData.prerequisites.feats));
    let frAtk = "";
    let damMap = new Map();
    for (let da of dam) {
        if (frAtk !== "") {
            frAtk = frAtk + ",";
        }
        frAtk = frAtk + attkRoll;
        let th = d20 + getBonusString(atkBonus);
        damMap.set(da, {
            name: item.name,
            th: th,
            dam: da,
            sound: "",
            itemId: item._id,
            actorId: actor.data._id,
            img: item.img
        });
    }
    attacks.push({
        name: item.name + " [FULL ROUND]",
        th: frAtk,
        dam,
        sound: "",
        itemId: item._id,
        actorId: actor.data._id,
        img: item.img
    });
    attacks.push(...damMap.values())

    return attacks;
}

function resolveStunAttack(item, actor, isRanged, offense, meleeToHit, isFocus, proficiencyBonus, isAutofireOnly, strBonus) {
    let isStunOnly = false;
    let attacks = [];

    let weapon = item?.data?.weapon;

    if (weapon?.stun?.isAvailable) {
        if (weapon.stun.isOnly) {
            isStunOnly = true;
        }
        let dieEquation = weapon.stun.dieEquation ? weapon.stun.dieEquation : weapon.damage.finalDamage;

        let atkBonuses = [];
        atkBonuses.push(isRanged ? offense.rab : meleeToHit);
        atkBonuses.push(isFocus ? 1 : 0)
        atkBonuses.push(proficiencyBonus)
        atkBonuses.push(isAutofireOnly ? -5 : 0)
        atkBonuses.push(actor.data.acPenalty)

        let th = d20 + getBonusString(resolveValueArray(atkBonuses));
        let halfCharacterLevel = actor.getHalfCharacterLevel();

        let dmgBonuses = [];
        dmgBonuses.push(halfCharacterLevel)
        dmgBonuses.push(isRanged ? 0 : strBonus)

        let dam = dieEquation + getBonusString(resolveValueArray(dmgBonuses));
        attacks.push({
            name: `${item.name} [STUN${isAutofireOnly ? ", AUTOFIRE" : ""}]`,
            th,
            dam,
            sound: "",
            itemId: item._id,
            actorId: actor.data._id,
            img: item.img
        });
    }

    return {isStunOnly, attacks};
}

function getBonusString(atkBonus) {
    return (atkBonus > 0 ? `+${atkBonus}` : (atkBonus < 0 ? `${atkBonus}` : ""));
}

function isOversized(actorSize, itemData) {
    return compareSizes(actorSize, itemData.finalSize) > 1;
}

function getToHit(rate, atkBonus, itemData) {
    if (rate.toLowerCase() === 'single-shot') {
        return d20 + getBonusString(atkBonus);
    } else if (rate.toLowerCase() === 'autofire') {
        return d20 + getBonusString(atkBonus - 5);
    } else {
        console.error("UNRECOGNIZED ROF", itemData);
    }
}

function getWeaponCategories(weapon) {
    let weaponCategories = [weapon.name];
    weaponCategories.push(...weapon.data.categories);
    return weaponCategories;
}

function isRanged(weapon) {
    for (const category of weapon.data.categories) {
        if (["pistols", "rifles", "exotic ranged weapons", "ranged weapons", "grenades", "heavy weapons", "simple ranged weapons"].includes(category.toLowerCase())) {
            return true;
        }
    }
    return false;
}

function isLightsaber(weapon) {
    for (const category of weapon.data.categories) {
        if (["lightsabers", "lightsaber"].includes(category.toLowerCase())) {
            return true;
        }
    }
    return false;
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

function isProficient(proficiencies, categories) {
    proficiencies = explodeProficiencies(proficiencies);
    for (let proficiency of proficiencies) {
        if (categories.map(cat => cat.toLowerCase()).includes(proficiency.toLowerCase())) {
            return true;
        }
    }
    return false;
}

function getActorSize(actorData) {
    for (let ability of actorData?.traits ? actorData.traits : []) {
        if (sizeArray.includes(ability.name)) {
            return ability;
        }
    }
    return undefined;
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

function generateUnarmedAttacks(equippedWeapons, actor) {
    if (!actor) {
        return [];
    }
    let actorData = actor.data;
    let size = getActorSize(actorData);
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
    for (let equippedWeapon of equippedWeapons ? equippedWeapons : []) {
        if (equippedWeapon.data.weaponAttributes?.damage?.unarmed) {
            atkBonuses.push(equippedWeapon.data.weaponAttributes.damage.unarmed.damage);
        }
    }

    let th = d20 + getBonusString(resolveValueArray(atkBonuses));

    let damageBonuses = [];
    damageBonuses.push(actor.getHalfCharacterLevel())
    damageBonuses.push(actor.getAttributeMod("str"))

    let dam = resolveUnarmedDamageDie(size, feats) + getBonusString(resolveValueArray(damageBonuses));

    let attacks = [];
    attacks.push({
        name: "Unarmed Attack",
        th,
        dam,
        sound: "",
        itemId: "unarmed",
        actorId: actor.data._id
    });
    return attacks;
}

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

function getDamageDieSizeByCharacterSize(size) {
    if (size?.data?.attributes?.unarmedDieSize) {
        return size.data.attributes.unarmedDieSize;
    }
    return 0;
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
