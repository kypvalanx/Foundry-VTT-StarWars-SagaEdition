import {getBonusString, resolveValueArray, toShortAttribute} from "../util.js";
import {SWSEItem} from "../item/item.js";
import {appendNumericTerm, Attack} from "./attack.js";
import {d20} from "../constants.js";
import {compareSizes} from "./size.js";
import {getInheritableAttribute} from "../attribute-helper.js";


/**
 *
 * @param {SWSEActor} actor
 * @returns {Promise<void>}
 */
export function generateVehicleAttacks(actor) {
    let map = {}
    actor.system.equippedIds.forEach(
        equippedId => {

            map[equippedId.id] =
                actor.getCrewByPosition(equippedId.position, equippedId.slot)?._id
        }
    )

    let attacks = [];
    attacks.push(...actor.getAvailableItemsFromRelationships()
        .filter(item => item.system.subtype && item.system.subtype.toLowerCase() === 'weapon systems')
        .map(weapon =>  new Attack(map[weapon._id], weapon._id, weapon.parentId, actor.parent?.id, {actor: actor.items})));
        //.map(weapon => generateAttackFromShipWeapon(weapon, map[weapon._id])));
    return attacks;
}


// let attacks = [];
// attacks.push(generateUnarmedAttack(actor));
// attacks.push(...actor.getEquippedItems()
//     .filter(item => item.type === 'weapon')
//     .map(weapon => generateAttackFromWeapon(weapon, actor)));
// attacks.push(...actor.getAvailableItemsFromRelationships()
//     .filter(item => item.data.subtype.toLowerCase() === 'weapon systems')
//     .map(weapon => generateAttackFromShipWeapon(weapon, actor.data)))
// // attacks.push(...actor.getAvailableItemsFromRelationships().filter(item => item.type === "vehicleSystem"))
// return attacks;

/**
 *
 * @param {SWSEActor} actor
 * @returns {Promise<void>}
 */
export function generateAttacks(actor) {
    let equippedItems = actor.getEquippedItems();
    let weaponIds = equippedItems
        .filter(item => 'weapon' === item.type)
        .map(item => item.id)

    let beastAttackIds = actor.naturalWeapons
        .filter(item => 'beastAttack' === item.type)
        .map(item => item.id);

    if(beastAttackIds.length > 0){
        weaponIds.push(...beastAttackIds)
    } else {
        weaponIds.push("Unarmed Attack")
    }

    let attacks = weaponIds.map(id => new Attack(actor.id, id, null, actor.parent?.id, {items: actor.items}));

    let items = actor.getAvailableItemsFromRelationships()

    attacks.push(...items.map(item => new Attack(actor.id, item._id, item.parentId, actor.parent?.id, {items: actor.items})))
    return attacks;
}


/**
 *
 * @param size
 * @param item {SWSEItem}
 * @param focus
 * @returns {boolean|boolean}
 */
export function canFinesse(size, item, focus) {
    let sizes = compareSizes(size, item.size);
    let isOneHanded = sizes < 1;
    let isLight = sizes < 0;
    return isLight || (isOneHanded && focus) || isLightsaber(item);
}


/**
 *
 * @param actor {SWSEActor}
 * @param weapon {SWSEItem}
 * @returns {(*|string)[]}
 */
export function getPossibleProficiencies(actor, weapon) {
    if(!weapon){
        return [];
    }
    let weaponFamiliarities = {};
    getInheritableAttribute({
        entity: actor,
        attributeKey: "weaponFamiliarity"
    }).forEach(fam => {
        let toks = fam.value.split(":");
        if (toks.length === 2) {
            weaponFamiliarities[toks[0]] = toks[1];
        }
    });

    let exoticWeaponTypes = getInheritableAttribute({entity: weapon, attributeKey: "exoticWeapon", reduce: "VALUES"})

    let descriptors = exoticWeaponTypes.length>0 ? exoticWeaponTypes : [weapon.name, weapon.system.subtype, weapon.type];
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

/**
 *
 * @param weapon {SWSEItem}
 * @returns {boolean}
 */
function isLightsaber(weapon) {
    let itemData = weapon.system;
    return LIGHTSABER_WEAPON_TYPES.includes(itemData.subtype.toLowerCase());
}

/**
 *
 * @param actor {ActorData}
 * @param weaponTypes {String[]}
 * @returns {DiceTerm[]}
 */
export function getFocusAttackBonuses(actor, weaponTypes) {
    let bonuses = [];
    let weaponFocus = explodeProficiencies(getInheritableAttribute({
        entity: actor,
        attributeKey: "weaponFocus",
        reduce: ["VALUES_TO_LOWERCASE", "UNIQUE"]
    }));
    if (weaponTypes.filter(wt => weaponFocus.includes(wt.toLowerCase())).length > 0) {
        bonuses.push(...appendNumericTerm(1, "Weapon Focus"));
    }

    let greaterWeaponFocus = explodeProficiencies(getInheritableAttribute({
        entity: actor,
        attributeKey: "greaterWeaponFocus",
        reduce: ["VALUES_TO_LOWERCASE", "UNIQUE"]
    }));
    if (weaponTypes.filter(wt => greaterWeaponFocus.includes(wt.toLowerCase())).length > 0) {
        bonuses.push(...appendNumericTerm(1, "Greater Weapon Focus"));
    }

    return bonuses;
}

/**
 *
 * @param actor {SWSEActor}
 * @param weaponTypes {[string]}
 * @returns {[]}
 */
export function getSpecializationDamageBonuses(actor, weaponTypes) {
    let bonuses = [];
    let weaponFocus = explodeProficiencies(getInheritableAttribute({
        entity: actor,
        attributeKey: "weaponSpecialization",
        reduce: ["VALUES_TO_LOWERCASE", "UNIQUE"]
    }));
    if (weaponTypes.filter(wt => weaponFocus.includes(wt.toLowerCase())).length > 0) {
        bonuses.push(...appendNumericTerm(2, "Weapon Specialization"));
    }

    let greaterWeaponFocus = explodeProficiencies(getInheritableAttribute({
        entity: actor,
        attributeKey: "greaterWeaponSpecialization",
        reduce: ["VALUES_TO_LOWERCASE", "UNIQUE"]
    }));
    if (weaponTypes.filter(wt => greaterWeaponFocus.includes(wt.toLowerCase())).length > 0) {
        bonuses.push(...appendNumericTerm(2, "Greater Weapon Specialization"));
    }

    return bonuses;
}


/**
 *
 * @param actor {SWSEActor}
 * @param weaponTypes {[string]}
 * @returns {boolean}
 */
export function isFocus(actor, weaponTypes) {
    let weaponFocus = explodeProficiencies(getInheritableAttribute({
        entity: actor,
        attributeKey: "weaponFocus",
        reduce: ["VALUES_TO_LOWERCASE", "UNIQUE"]
    }));
    return weaponTypes.filter(wt => weaponFocus.includes(wt.toLowerCase())).length > 0;

}

/**
 *
 * @param actor {ActorData}
 * @param weaponDescriptors {String[]}
 * @returns {DiceTerm[]}
 */
export function getProficiencyBonus(actor, weaponDescriptors) {
    let rawProficiencies = getInheritableAttribute({
        entity: actor,
        attributeKey: "weaponProficiency",
        reduce: ["VALUES_TO_LOWERCASE", "UNIQUE"]
    });
    let proficiencies = explodeProficiencies(rawProficiencies);
    if (weaponDescriptors.filter(wd => proficiencies.includes(wd.toLowerCase()) || wd === "Unarmed Attack"|| wd === "beastAttack").length > 0) {
        return []
    }

    return appendNumericTerm(-5, "Proficiency Modifier");
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
    let values = finesseStats.map(stat => getCharacterAttribute(actor, stat).mod);
    return Math.max(...values)
}

/**
 *
 * @param {SWSEActor} actor
 * @param {string} attributeName
 */
function getCharacterAttribute(actor, attributeName) {
    let data = actor.system
    let attributes = data.attributes;
    if(!!attributes) {
        return attributes[toShortAttribute(attributeName).toLowerCase()];
    }
    return {mod:0}
}


