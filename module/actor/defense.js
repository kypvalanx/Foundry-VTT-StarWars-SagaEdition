import {SWSEActor} from "./actor.js";
import {resolveValueArray, toNumber} from "../util.js";


function reduceSpeedForArmorType(speed, armorType) {
    if ("Light" === armorType) {
        return speed;
    }
    return speed.replace("4", "3").replace("6", "4");
}

/**
 *
 * @param {SWSEActor} actor
 * @param {SWSEItem} armor
 * @returns {{fortDefense: (*|number), notes: (*|string), refDefense: (*|number), name, type: string, maxDex: (*|number), speed}}
 */
function generateArmorBlock(actor, armor) {
    let attributes = armor.getInheritableAttributesByKey("special", "VALUES");
    if(!armor._parentIsProficientWithArmor()){
        attributes.push("(Not Proficient)");
    }
    let speed = actor.speed


    return {
        name: armor.name,
        speed: speed,
        refDefense: armor.reflexDefenseBonus ? armor.reflexDefenseBonus : 0,
        fortDefense: armor.fortitudeDefenseBonus ? armor.fortitudeDefenseBonus : 0,
        maxDex: armor.maximumDexterityBonus ? armor.maximumDexterityBonus : 0,
        notes: attributes.join(", "),
        type: armor.armorType
    };
}

/**
 *
 * @param actor {SWSEActor}
 * @returns
 */
export function resolveDefenses(actor) {
    let fort = _resolveFort(actor, actor.conditionBonus);
    let will = _resolveWill(actor, actor.conditionBonus);
    let ref = _resolveRef(actor, actor.conditionBonus);
    let dt = _resolveDt(actor, actor.conditionBonus);
    let situationalBonuses = _getSituationalBonuses(actor);

    let damageReduction = actor.getInheritableAttributesByKey("damageReduction", "SUM")


    let armors = []

    for (const armor of actor.getEquippedItems().filter(item => item.type === 'armor')) {
        armors.push(generateArmorBlock(actor, armor));
    }

    return {defense: {fort, will, ref, dt, damageThreshold: dt, damageReduction, situationalBonuses}, armors};
}

/**
 *
 * @param actor {SWSEActor}
 * @param conditionBonus {number}
 * @returns {number}
 * @private
 */
function _resolveFort(actor, conditionBonus) {
    let total = [];
    total.push(10);
    let heroicLevel = actor.getHeroicLevel();
    total.push(heroicLevel);
    let abilityBonus = _getFortStatMod(actor);
    total.push(abilityBonus);
    let otherBonus = actor.getInheritableAttributesByKey("fortitudeDefenseBonus", "SUM", undefined, attr => !attr.modifier)
    total.push(otherBonus);
    let classBonus = actor.getInheritableAttributesByKey("classFortitudeDefenseBonus", "MAX");
    total.push(classBonus);
    let equipmentBonus = _getEquipmentFortBonus(actor);
    total.push(equipmentBonus);
    total.push(conditionBonus);
    let armorBonus = resolveValueArray([equipmentBonus, heroicLevel]);
    let miscBonuses = [];
    miscBonuses.push(conditionBonus)
    miscBonuses.push(otherBonus)
    let miscBonus = resolveValueArray(miscBonuses)
    return {total: resolveValueArray(total, actor), abilityBonus, armorBonus, classBonus, miscBonus}
}

/**
 *
 * @param actor {SWSEActor}
 * @param conditionBonus
 * @returns {{classBonus, total: number, miscBonus: number, abilityBonus, armorBonus: number}}
 * @private
 */
function _resolveWill(actor, conditionBonus) {
    let actorData = actor.data
    let total = [];
    total.push(10);
    let heroicLevel = actor.getHeroicLevel();
    total.push(heroicLevel);
    let abilityBonus = _getWisMod(actorData);
    total.push(abilityBonus);
    let classBonus = actor.getInheritableAttributesByKey("classWillDefenseBonus", "MAX");
    total.push(classBonus);
    let otherBonus = actor.getInheritableAttributesByKey("willDefenseBonus", "SUM", undefined, attr => !attr.modifier)
    total.push(otherBonus);
    total.push(conditionBonus);
    let miscBonus = resolveValueArray([otherBonus, conditionBonus])
    let armorBonus = resolveValueArray([heroicLevel]);
    return {total: resolveValueArray(total, actor), abilityBonus, armorBonus, classBonus, miscBonus}
}

/**
 *
 * @param actor {SWSEActor}
 * @param conditionBonus
 * @returns {{classBonus, total: number, miscBonus: number, abilityBonus: number, armorBonus: (*)}}
 * @private
 */
function _resolveRef(actor, conditionBonus) {
    let actorData = actor.data
    let total = [];
    total.push(10);
    let armorBonus = _selectRefBonus(actor.getHeroicLevel(), _getEquipmentRefBonus(actor));
    total.push(armorBonus);
    let abilityBonus = Math.min(_getDexMod(actorData), _getEquipmentMaxDexBonus(actor));
    total.push(abilityBonus);
    let otherBonus = actor.getInheritableAttributesByKey("reflexDefenseBonus", "SUM", undefined, attr => !attr.modifier)
    total.push(otherBonus);
    let classBonus = actor.getInheritableAttributesByKey("classReflexDefenseBonus", "MAX");
    total.push(classBonus);
    let dodgeBonus = actor.getInheritableAttributesByKey("bonusDodgeReflexDefense", "SUM");
    total.push(dodgeBonus);
    let sizeBonus = actor.getInheritableAttributesByKey("sizeModifier", "SUM");
    total.push(sizeBonus);
    total.push(conditionBonus);
    let miscBonus = resolveValueArray([otherBonus, conditionBonus, dodgeBonus, sizeBonus])
    return {total: resolveValueArray(total, actor), abilityBonus, armorBonus, classBonus, miscBonus}
}

/**
 *
 * @param actor {SWSEActor}
 * @returns {number}
 * @private
 */
function _getDamageThresholdSizeMod(actor) {
    let attributes = actor.getTraitAttributesByKey('damageThresholdSizeModifier')

    let total = [];
    for (let attribute of attributes) {
        total.push(attribute)
    }

    return resolveValueArray(total, actor)
}

/**
 *
 * @param actor {SWSEActor}
 * @param conditionBonus
 * @returns {{total: number}}
 * @private
 */
function _resolveDt(actor, conditionBonus) {
    let total = [];
    total.push(_resolveFort(actor, conditionBonus).total);
    total.push(_getDamageThresholdSizeMod(actor))
    return {total: resolveValueArray(total, actor)}
}

function capFirst(word) {
    return word.charAt(0).toUpperCase() + word.slice(1)
}

function _getSituationalBonuses(actor) {
    let defenseBonuses =
        actor.getInheritableAttributesByKey(["fortitudeDefenseBonus", "reflexDefenseBonus", "willDefenseBonus"],
            undefined, undefined, attr => attr.modifier)

    let situational = []
    for (let defenseBonus of defenseBonuses) {
        let value = toNumber(defenseBonus.value);
        let defense = defenseBonus.key.replace("DefenseBonus", "");
        situational.push(`${(value > -1 ? "+" : "") + value} ${value < 0 ? "penalty" : "bonus"} to their ${defense.titleCase()} Defense to resist ${defenseBonus.modifier}`);
    }

    let immunities =
        actor.getInheritableAttributesByKey("immunity")

    for (let immunity of immunities) {
        situational.push(`Immunity: ${immunity.value}`);
    }

    return situational;
}

function _selectRefBonus(heroicLevel, armorBonus) {
    if (armorBonus > -1) {
        return armorBonus;
    }
    return heroicLevel;
}

function _getDexMod(actorData) {
    return actorData.data.attributes.dex.mod;
}

function _getWisMod(actorData) {
    return actorData.data.attributes.wis.mod;
}

function _getFortStatMod(actor) {
    let attributes = actor.data.data.attributes;
    return actor.ignoreCon() ? attributes.str.mod : attributes.con.mod;
}


/**
 *
 * @param actor {SWSEActor}
 * @returns {number}
 * @private
 */
function _getEquipmentFortBonus(actor) {
    let equipped = actor.getEquippedItems();
    let bonus = 0;
    for (let item of equipped) {
        if (item.fortitudeDefenseBonus) {
            bonus = Math.max(bonus, item.fortitudeDefenseBonus);
        }
    }
    return bonus;
}

function _getEquipmentRefBonus(actor) {
    let equipped = actor.getEquippedItems();
    let bonus = -1;
    for (let item of equipped) {
        if (item.reflexDefenseBonus) {
            bonus = Math.max(bonus, item.reflexDefenseBonus);
        }
    }
    return bonus;
}

function _getEquipmentMaxDexBonus(actor) {
    let equipped = actor.getEquippedItems();
    let bonus = 1000;
    for (let item of equipped) {
        let maximumDexterityBonus = item.maximumDexterityBonus;
        if (!isNaN(maximumDexterityBonus)) {
            bonus = Math.min(bonus, maximumDexterityBonus);
        }
    }
    return bonus;
}
