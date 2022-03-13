import {getBonusString, increaseDieSize, resolveValueArray} from "../util.js";
import {SWSEItem} from "../item/item.js";
import {Attack} from "./attack.js";
import {d20, sizeArray} from "../constants.js";


/**
 *
 * @param {SWSEActor} actor
 * @returns {Promise<void>}
 */
export function generateVehicleAttacks(actor) {
    let map = {}
    actor.data.data.equippedIds.forEach(
        equippedId => {

            map[equippedId.id] =
                actor.getCrewByPosition(equippedId.position, equippedId.slot)
        }
    )

    let attacks = [];
    attacks.push(...actor.getAvailableItemsFromRelationships()
        .filter(item => item.data.subtype && item.data.subtype.toLowerCase() === 'weapon systems')
        .map(weapon => generateAttackFromShipWeapon(weapon,map[weapon._id] )));
    return attacks;
}


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
    attacks.push(...actor.getAvailableItemsFromRelationships()
        .filter(item => item.data.subtype.toLowerCase() === 'weapon systems')
        .map(weapon => generateAttackFromShipWeapon(weapon, actor.data)))
    // attacks.push(...actor.getAvailableItemsFromRelationships().filter(item => item.type === "vehicleSystem"))
    return attacks;
}

function canFinesse(size, item, focus) {
    let sizes = compareSizes(size, item.size);
    let isOneHanded = sizes < 1;
    let isLight = sizes < 0;
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

    let attackBonuses = [actorData.data.offense.bab, actor.conditionBonus]
    let weaponTypes = getPossibleProficiencies(actor, item);
    damageBonuses.push(...getSpecializationDamageBonuses(actor, weaponTypes));

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
    attackBonuses.push(...getProficiencyBonus(actor, weaponTypes));
    attackBonuses.push(...getFocusAttackBonuses(actor, weaponTypes))
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

    return new Attack({
        name: item.name,
        attackRoll: attackRoll,
        attackRollBreakDown:attackBonuses.join(" + "),
        damage: damage,
        notes: notes.join(", "),
        range,
        critical,
        type,
        sound: "",
        itemId: item.id,
        actorId: actor.id,
        modes: groupedModes,
        hasStun,
        source: item
    })
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
    return LIGHTSABER_WEAPON_TYPES.includes(weapon.data.data.subtype.toLowerCase());
}

/**
 *
 * @param actor {SWSEActor}
 * @param weaponTypes {[string]}
 * @returns {[]}
 */
function getFocusAttackBonuses(actor, weaponTypes) {
    let bonuses = [];
    let weaponFocus = explodeProficiencies(actor.getInheritableAttributesByKey("weaponFocus", ["VALUES_TO_LOWERCASE", "UNIQUE"]));
    if (weaponTypes.filter(wt => weaponFocus.includes(wt.toLowerCase())).length > 0) {
        bonuses.push(1); //{value:1,source:"Weapon Focus"}
    }

    let greaterWeaponFocus = explodeProficiencies(actor.getInheritableAttributesByKey("greaterWeaponFocus", ["VALUES_TO_LOWERCASE", "UNIQUE"]));
    if (weaponTypes.filter(wt => greaterWeaponFocus.includes(wt.toLowerCase())).length > 0) {
        bonuses.push(1); //{value:1,source:"Greater Weapon Focus"}
    }

    return bonuses;
}

/**
 *
 * @param actor {SWSEActor}
 * @param weaponTypes {[string]}
 * @returns {[]}
 */
function getSpecializationDamageBonuses(actor, weaponTypes) {
    let bonuses = [];
    let weaponFocus = explodeProficiencies(actor.getInheritableAttributesByKey("weaponSpecialization", ["VALUES_TO_LOWERCASE", "UNIQUE"]));
    if (weaponTypes.filter(wt => weaponFocus.includes(wt.toLowerCase())).length > 0) {
        bonuses.push(2); //{value:1,source:"Weapon Specialization"}
    }

    let greaterWeaponFocus = explodeProficiencies(actor.getInheritableAttributesByKey("greaterWeaponSpecialization", ["VALUES_TO_LOWERCASE", "UNIQUE"]));
    if (weaponTypes.filter(wt => greaterWeaponFocus.includes(wt.toLowerCase())).length > 0) {
        bonuses.push(2); //{value:1,source:"Greater Weapon Specialization"}
    }

    return bonuses;
}


/**
 *
 * @param actor {SWSEActor}
 * @param weaponTypes {[string]}
 * @returns {boolean}
 */
function isFocus(actor, weaponTypes) {
    let weaponFocus = explodeProficiencies(actor.getInheritableAttributesByKey("weaponFocus", ["VALUES_TO_LOWERCASE", "UNIQUE"]));
    return weaponTypes.filter(wt => weaponFocus.includes(wt.toLowerCase())).length > 0;

}

/**
 *
 * @param actor {SWSEActor}
 * @param weaponDescriptors
 * @returns {[]}
 */
function getProficiencyBonus(actor, weaponDescriptors) {
    let bonuses = [];
    let proficiencies = explodeProficiencies(actor.getInheritableAttributesByKey("weaponProficiency", ["VALUES_TO_LOWERCASE", "UNIQUE"]));
    bonuses.push(weaponDescriptors.filter(wd => proficiencies.includes(wd.toLowerCase())).length > 0 ? 0 : -5)
    return bonuses
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


    let offense = actorData.data?.offense;

    let atkBonuses = [];
    atkBonuses.push(offense?.bab)
    atkBonuses.push(actor.conditionBonus);

    let finesseStats = [{value: "STR"}];
    finesseStats.push(...actor.getInheritableAttributesByKey("finesseStat"));
    atkBonuses.push(resolveFinesseBonus(actor, finesseStats));
    atkBonuses.push(...(getFocusAttackBonuses(actor, UNARMED_WEAPON_TYPES)))
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

    let attackRoll = d20 + getBonusString(resolveValueArray(atkBonuses));

    damageBonuses.push(actor.halfHeroicLevel)
    damageBonuses.push(...getSpecializationDamageBonuses(actor, UNARMED_WEAPON_TYPES));
    damageBonuses.push(actor.getAttributeMod("str"))

    let damage = resolveUnarmedDamageDie(actor) + getBonusString(resolveValueArray(damageBonuses));

    let range = "Simple Melee Weapon";
    let critical = "x2";
    return new Attack({
        name,
        attackRoll,
        attackRollBreakDown:atkBonuses.join(" + "),
        damage,
        notes,
        range,
        critical,
        type,
        actorId: actor.data._id,
    });
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

export function generateAttackFromShipWeapon(weapon, actor) {
    let parent = weapon.document?.parent;
    if(!parent){
        parent = game.data.actors.find(actor => actor._id === weapon.parentId)
    }

    if(!actor){
        let equippedId = parent.data.data.equippedIds.find(id => id.id === weapon._id)
        actor = parent.getCrewByPosition(equippedId.position, equippedId.slot);
    }

    let offense = actor.data?.offense;

    let atkBonuses = [];
    atkBonuses.push(offense?.bab)
    atkBonuses.push(parent.data?.attributes?.int?.mod ||parent.data?.data.attributes.int.mod)
    //trained pilots get a bonus to hit when using weapons in the pilot slot
    if (weapon.position === 'pilot' && actor.data.skills.pilot.trained) {
        atkBonuses.push("2")
    }

    let notes = [`Weapon Emplacement on ${parent.name}`];

    let th = d20 + getBonusString(resolveValueArray(atkBonuses));

    let dam = Object.values(weapon.data?.attributes || weapon.data.data.attributes).filter(x => x.key === 'damage').map(attr => attr.value).join(' + ')
    return new Attack({
        name: weapon.name,
        attackRoll: th,
        attackRollBreakDown:atkBonuses.join(" + "),
        damage: dam,
        notes: notes.join(', '),
        range: "Vehicle Weapon",
        itemId: weapon._id,
        actorId: actor.data._id,
        provider: parent._id
    });
}