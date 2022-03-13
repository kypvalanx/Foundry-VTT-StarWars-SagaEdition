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
        refDefense: armor.armorReflexDefenseBonus ? armor.armorReflexDefenseBonus : 0,
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
    let conditionBonus = actor.conditionBonus;
    let fort = _resolveFort(actor, conditionBonus);
    let will = _resolveWill(actor, conditionBonus);
    let ref = _resolveRef(actor, conditionBonus);
    let dt = _resolveDt(actor, conditionBonus);
    let situationalBonuses = _getSituationalBonuses(actor);
    let shield = _resolveShield(actor);

    let damageReduction = actor.getInheritableAttributesByKey("damageReduction", "SUM")


    let armors = []

    for (const armor of actor.getEquippedItems().filter(item => item.type === 'armor')) {
        armors.push(generateArmorBlock(actor, armor));
    }

    return {defense: {fort, will, ref, dt, damageThreshold: dt, damageReduction, situationalBonuses, shield}, armors};
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
    let heroicLevel = actor.heroicLevel;
    total.push(heroicLevel);
    let abilityBonus = _getFortStatMod(actor);
    total.push(abilityBonus);
    let otherBonus = actor.getInheritableAttributesByKey("fortitudeDefenseBonus", "SUM", undefined, attr => !attr.modifier)

    let miscBonusTip = actor.getInheritableAttributesByKey("fortitudeDefenseBonus", "SUMMARY", undefined, attr => !attr.modifier)
    miscBonusTip += `Condition: ${conditionBonus};  `
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
    return {total: resolveValueArray(total, actor), abilityBonus, armorBonus, classBonus, miscBonus, miscBonusTip}
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
    let skip = ['vehicle', 'npc-vehicle'].includes(actorData.type);
    let total = [];
    total.push(10);
    let heroicLevel = actor.heroicLevel;
    total.push(heroicLevel);
    let abilityBonus = _getWisMod(actorData);
    total.push(abilityBonus);
    let classBonus = actor.getInheritableAttributesByKey("classWillDefenseBonus", "MAX");
    total.push(classBonus);
    let otherBonus = actor.getInheritableAttributesByKey("willDefenseBonus", "SUM", undefined, attr => !attr.modifier)
    let miscBonusTip = actor.getInheritableAttributesByKey("willDefenseBonus", "SUMMARY", undefined, attr => !attr.modifier)
    miscBonusTip += `Condition: ${conditionBonus};  `
        total.push(otherBonus);
    total.push(conditionBonus);
    let miscBonus = resolveValueArray([otherBonus, conditionBonus])
    let armorBonus = resolveValueArray([heroicLevel]);
    return {total: resolveValueArray(total, actor), abilityBonus, armorBonus, classBonus, miscBonus, miscBonusTip, skip}
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
    let armorBonus;
    if(["vehicle", "npc-vehicle"].includes(actor.data.type)){
        if(actor.pilot){
            armorBonus = actor.pilot.items.filter(i => i.type === "class" && Object.values(i.data.attributes).find(a => a.key === "isHeroic").value).length;
            let armorReflexDefenseBonus = getArmorReflexDefenseBonus(actor);
            if(armorReflexDefenseBonus) {
                armorBonus = Math.max(armorBonus, armorReflexDefenseBonus);
            }
        } else {
            armorBonus = getArmorReflexDefenseBonus(actor)||0;
        }
    } else {
        armorBonus = _selectRefBonus(actor.heroicLevel, getArmorReflexDefenseBonus(actor));
    }
    total.push(armorBonus);
    let abilityBonus = Math.min(_getDexMod(actorData), _getEquipmentMaxDexBonus(actor));
    total.push(abilityBonus);
    let otherBonus = actor.getInheritableAttributesByKey("reflexDefenseBonus", "SUM", undefined, attr => !attr.modifier)
    let miscBonusTip = actor.getInheritableAttributesByKey("reflexDefenseBonus", "SUMMARY", undefined, attr => !attr.modifier)
    total.push(otherBonus);
    let classBonus = actor.getInheritableAttributesByKey("classReflexDefenseBonus", "MAX");
    total.push(classBonus);
    let dodgeBonus = actor.getInheritableAttributesByKey("bonusDodgeReflexDefense", "SUM");
    miscBonusTip += actor.getInheritableAttributesByKey("bonusDodgeReflexDefense", "SUMMARY");
    miscBonusTip += `Condition: ${conditionBonus};  `
    total.push(dodgeBonus);
    total.push(conditionBonus);
    let miscBonus = resolveValueArray([otherBonus, conditionBonus, dodgeBonus])
    return {total: resolveValueArray(total, actor), abilityBonus, armorBonus, classBonus, miscBonus, miscBonusTip, skip:false}
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
    total.push(_getDamageThresholdSizeMod(actor));
    total.push(...actor.getInheritableAttributesByKey("damageThresholdBonus", "VALUES"));
    return {total: resolveValueArray(total, actor)}
}

/**
 *
 * @param actor {SWSEActor}
 * @param conditionBonus
 * @returns {{total: number}}
 * @private
 */
function _resolveShield(actor, conditionBonus) {
    let total = [];
    total.push(...actor.getInheritableAttributesByKey("shieldRating", "VALUES"));
    return {total: resolveValueArray(total, actor), current: resolveValueArray(total, actor)}
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
    if (armorBonus) {
        return armorBonus;
    }
    return heroicLevel;
}

function _getDexMod(actorData) {
    return actorData.data.attributes.dex.mod;
}

function _getWisMod(actorData) {
    return actorData.data.attributes.wis?.mod || 0;
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

function getArmorReflexDefenseBonus(actor) {
    let bonuses = actor.inheritableItems.map(i => i.document.armorReflexDefenseBonus).filter(bonus => !!bonus)

    if(bonuses.length === 0){
        return undefined;
    }
    return Math.max(bonuses)
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
