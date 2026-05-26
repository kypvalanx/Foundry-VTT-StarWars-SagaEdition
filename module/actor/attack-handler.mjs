import {appendNumericTerm} from "../common/util.mjs";
import {SWSEItem} from "../item/item.mjs";
import {compareSizes} from "./size.mjs";
import {getInheritableAttribute} from "../attribute-helper.mjs";
import {LIGHTSABER_WEAPON_TYPES, RANGED_WEAPON_TYPES, SIMPLE_WEAPON_TYPES, weaponGroup} from "../common/constants.mjs";


;


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

/**
 *
 * @param weapon {SWSEItem}
 * @returns {boolean}
 */
export function isRanged(weapon) {
    let itemData = weapon.system;
    return RANGED_WEAPON_TYPES.includes(itemData.subtype.toLowerCase());
}

/**
 *
 * @param weapon {SWSEItem}
 * @returns {boolean}
 */
export function isMelee(weapon) {
    let itemData = weapon.system;
    let subtype = itemData.subtype;
    if (!subtype && weapon.type === 'beastAttack') {
        subtype = "Melee Natural Weapons"
    }
    return weaponGroup['Melee Weapons'].includes(subtype);
}

/**
 *
 * @param weapon {SWSEItem}
 * @returns {boolean}
 */
export function isLightsaber(weapon) {
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


