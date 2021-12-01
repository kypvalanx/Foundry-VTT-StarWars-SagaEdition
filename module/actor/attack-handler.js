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
 * @returns {{dam, itemId, notes, actorId, th, critical, sound: string, name, range, type, ratesOfFire, hasStun}|undefined}
 */
export function generateAttackFromWeapon(item, actor) {
    let actorData = actor.data;
    if (!actorData || !item) {
        return undefined;
    }
    let size = actor.size;
    if (isOversized(size, item.size) || item.type !== 'weapon') {
        return undefined;
    }

    let groupedModes = getGroupedModes(item);

    let notes = item.getAttribute('special').filter(s => !!s).map(s => s.value);

    let range = item.effectiveRange;
    let critical = "x2"
    let type = item.damageType

    let damageBonuses = [];
    damageBonuses.push(actor.getHalfCharacterLevel())
    damageBonuses.push(...item.getAttribute("bonusDamage"))

    let attackBonuses = [actorData.data.offense.bab]
    let weaponTypes = getPossibleProficiencies(actor, item);

    if(isRanged(item)){
        attackBonuses.push(resolveFinesseBonus(actor, [{value:"DEX"}]));
    } else {
        let strMod = parseInt(actor.getAttributeMod("str"));
        let isTwoHanded = compareSizes(size, item.size) === 1;
        damageBonuses.push(isTwoHanded ? strMod * 2 : strMod)
        let finesseStats = [{value: "STR"}];
        if(canFinesse(size, item, isFocus(actor,weaponTypes))) {
            finesseStats.push(...actor.getInheritableAttributesByKey("finesseStat"));
        }
        attackBonuses.push(resolveFinesseBonus(actor, finesseStats));
    }
    attackBonuses.push(isProficient(actor, weaponTypes) ? 0 : -5);
    attackBonuses.push(isFocus(actor, weaponTypes) ? 1 : 0)
    attackBonuses.push(actor.data.acPenalty) //TODO this looks like it could use some TLC
    attackBonuses.push(...(item.getAttribute("toHitModifier")))

    let attackRoll = d20 + getBonusString(resolveValueArray(attackBonuses, actor));

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

    return createAttack(item.name, attackRoll, [damage, stunDamage].filter(t => !!t).join(", "), notes.join(", "), range, critical, type, item.id, actor.id, groupedModes, hasStun)
}

function isOversized(actorSize, itemSize) {
    return compareSizes(actorSize, itemSize) > 1;
}

function getPossibleProficiencies(actor, weapon) {
    let weaponFamiliarities = {};
        actor.getInheritableAttributesByKey("weaponFamiliarity").forEach(fam => {
            let toks = fam.split(":");
            if (toks.length===2) {
                weaponFamiliarities[toks[0]] = toks[1];
            }
        });

    let descriptors = [weapon.name, weapon.subType];
    let explodedDescriptors = [];

    for(let descriptor of descriptors){
        let familiarity = weaponFamiliarities[descriptor];
        if(familiarity){
            explodedDescriptors.push(familiarity);
        }
    }

    descriptors.push(...explodedDescriptors);

    return descriptors.filter(descriptor => !!descriptor);
}

const RANGED_WEAPON_TYPES = ["pistols", "rifles", "exotic ranged weapons", "ranged weapons", "grenades",
    "heavy weapons", "simple ranged weapons"];
const LIGHTSABER_WEAPON_TYPES = ["lightsabers", "lightsaber"];
const SIMPLE_WEAPON_TYPES = ['simple melee weapons', 'simple ranged weapons', 'simple melee weapon', 'simple ranged weapon'];
const UNARMED_WEAPON_TYPES = ["simple melee weapon"];

function isRanged(weapon) {
    return RANGED_WEAPON_TYPES.includes(weapon.data.data.subtype.toLowerCase());
}


function isLightsaber(weapon) {
    return LIGHTSABER_WEAPON_TYPES.includes(weapon.subtype);
}

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

export function resolveFinesseBonus(actor, finesseStats) {
    let bonus = 0;
    for(let stat of finesseStats){
        bonus = Math.max(bonus, actor.getCharacterAttribute(stat.value).mod);
    }
    return bonus;
}


export function generateUnarmedAttacks(actor) {
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
    finesseStats.push({value:"STR"});
    let finesseBonus = resolveFinesseBonus(actor, finesseStats);
    let offense = actorData.data?.offense;

    let atkBonuses = [];
    atkBonuses.push(offense?.bab)
    atkBonuses.push(finesseBonus)
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

    let dam = resolveUnarmedDamageDie(actor) + getBonusString(resolveValueArray(damageBonuses));

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
function resolveUnarmedDamageDie(actor) {
    let inheritableAttributesByKey = actor.getInheritableAttributesByKey("unarmedDieSize");
    if(inheritableAttributesByKey.length>1) {
        console.warn("found multiple unarmedDieSize attributes")
    } else if(inheritableAttributesByKey.length<1){
        inheritableAttributesByKey = [1];
    }
    let damageDie = inheritableAttributesByKey[0];
    let bonus = actor.getInheritableAttributesByKey("bonusUnarmedDamageDieSize")
        .map(attr => parseInt(`${attr.value}`)).reduce((a, b) => a + b, 0)
    damageDie = increaseDamageDie(damageDie, bonus);
    return `1d${damageDie}`;
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
