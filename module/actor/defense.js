import {SWSEActor} from "./actor.js";
import {resolveValueArray, toNumber} from "../util.js";
import {getInheritableAttribute} from "../attribute-helper.js";


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
    let attributes = getInheritableAttribute({
        entity: armor,
        attributeKey: "special",
        reduce: "VALUES",


    });
    if (!armor._parentIsProficientWithArmor()) {
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
    if(!actor){
        return {};
    }
     let conditionBonus = getInheritableAttribute({
        entity: actor,
        attributeKey: "condition",
        reduce: "FIRST"
    })

    if("OUT" === conditionBonus || !conditionBonus){
        conditionBonus = "0";
    }

    let fortitude = _resolveFort(actor, conditionBonus);
    let will = _resolveWill(actor, conditionBonus);
    let reflex = _resolveRef(actor, conditionBonus);
    let damageThreshold = _resolveDt(actor, conditionBonus);
    let situationalBonuses = _getSituationalBonuses(actor);
    let shield = _resolveShield(actor);

    let damageReduction = getInheritableAttribute({
        entity: actor,
        attributeKey: "damageReduction",
        reduce: "SUM"
    })

    let armors = []

    for (const armor of actor.getEquippedItems().filter(item => item.type === 'armor')) {
        armors.push(generateArmorBlock(actor, armor));
    }

    return {defense: {fortitude, will, reflex, damageThreshold, damageReduction, situationalBonuses, shield}, armors};
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
    let otherBonus = getInheritableAttribute({
        entity: actor,
        attributeKey: "fortitudeDefenseBonus",
        reduce: "SUM",

        attributeFilter: attr => !attr.modifier
    })

    let miscBonusTip = getInheritableAttribute({
        entity: actor,
        attributeKey: "fortitudeDefenseBonus",
        reduce: "SUMMARY",

        attributeFilter: attr => !attr.modifier
    })
    miscBonusTip += `Condition: ${conditionBonus};  `
    total.push(otherBonus);
    let classBonus = getInheritableAttribute({
        entity: actor,
        attributeKey: "classFortitudeDefenseBonus",
        reduce: "MAX"
    }) || 0;
    total.push(classBonus);
    let equipmentBonus = _getEquipmentFortBonus(actor);
    total.push(equipmentBonus);
    total.push(conditionBonus);
    let armorBonus = resolveValueArray([equipmentBonus, heroicLevel]);
    let miscBonuses = [];
    miscBonuses.push(conditionBonus)
    miscBonuses.push(otherBonus)
    let miscBonus = resolveValueArray(miscBonuses)
    return {total: resolveValueArray(total, actor), abilityBonus, armorBonus, classBonus, miscBonus, miscBonusTip,  name: 'Fortitude', defenseBlock:true}
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
    let classBonus = getInheritableAttribute({
        entity: actor,
        attributeKey: "classWillDefenseBonus",
        reduce: "MAX"
    }) || 0;
    total.push(classBonus);
    let otherBonus = getInheritableAttribute({
        entity: actor,
        attributeKey: "willDefenseBonus",
        reduce: "SUM",

        attributeFilter: attr => !attr.modifier
    })
    let miscBonusTip = getInheritableAttribute({
        entity: actor,
        attributeKey: "willDefenseBonus",
        reduce: "SUMMARY",

        attributeFilter: attr => !attr.modifier
    })
    miscBonusTip += `Condition: ${conditionBonus};  `
    total.push(otherBonus);
    total.push(conditionBonus);
    let miscBonus = resolveValueArray([otherBonus, conditionBonus])
    let armorBonus = resolveValueArray([heroicLevel]);
    return {total: resolveValueArray(total, actor), abilityBonus, armorBonus, classBonus, miscBonus, miscBonusTip, skip, name: 'Will', defenseBlock:true}
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
    if (["vehicle", "npc-vehicle"].includes(actor.data.type)) {
        if (actor.pilot) {
            armorBonus = actor.pilot.items.filter(i => i.type === "class" && Object.values(i.data.attributes).find(a => a.key === "isHeroic").value).length;
            let armorReflexDefenseBonus = getArmorReflexDefenseBonus(actor);
            if (armorReflexDefenseBonus) {
                armorBonus = Math.max(armorBonus, armorReflexDefenseBonus);
            }
        } else {
            armorBonus = getArmorReflexDefenseBonus(actor) || 0;
        }
    } else {
        armorBonus = _selectRefBonus(actor, actor.heroicLevel, getArmorReflexDefenseBonus(actor));
    }
    total.push(armorBonus);
    let abilityBonus = Math.min(_getDexMod(actorData), _getEquipmentMaxDexBonus(actor));
    total.push(abilityBonus);
    let otherBonus = getInheritableAttribute({
        entity: actor,
        attributeKey: "reflexDefenseBonus",
        reduce: "SUM",
        attributeFilter: attr => !attr.modifier
    })
    let miscBonusTip = getInheritableAttribute({
        entity: actor,
        attributeKey: "reflexDefenseBonus",
        reduce: "SUMMARY",
        attributeFilter: attr => !attr.modifier
    })
    total.push(otherBonus);
    let classBonus = getInheritableAttribute({
        entity: actor,
        attributeKey: "classReflexDefenseBonus",
        reduce: "MAX"
    }) || 0;
    total.push(classBonus);
    let dodgeBonus = getInheritableAttribute({
        entity: actor,
        attributeKey: "bonusDodgeReflexDefense",
        reduce: "SUM"
    });
    miscBonusTip += getInheritableAttribute({
        entity: actor,
        attributeKey: "bonusDodgeReflexDefense",
        reduce: "SUMMARY"
    });
    miscBonusTip += `Condition: ${conditionBonus};  `
    total.push(dodgeBonus);
    total.push(conditionBonus);
    let miscBonus = resolveValueArray([otherBonus, conditionBonus, dodgeBonus])
    let defenseModifiers = [_resolveFFRef(actor, conditionBonus)]
    return {
        total: resolveValueArray(total, actor),
        abilityBonus,
        armorBonus,
        classBonus,
        miscBonus,
        miscBonusTip,
        skip: false,
        name: 'Reflex',
        defenseBlock:true,
        defenseModifiers
    }
}


/**
 *
 * @param actor {SWSEActor}
 * @param conditionBonus
 * @returns {{classBonus, total: number, miscBonus: number, abilityBonus: number, armorBonus: (*)}}
 * @private
 */
function _resolveFFRef(actor, conditionBonus) {
    let total = [];
    total.push(10);

    let abilityBonus = Math.min(_getDexMod(actor.data), _getEquipmentMaxDexBonus(actor));
    if(abilityBonus < 0) {
        total.push(abilityBonus);
    }

    let armorBonus;
    if (["vehicle", "npc-vehicle"].includes(actor.data.type)) {
        if (actor.pilot) {
            armorBonus = actor.pilot.items.filter(i => i.type === "class" && Object.values(i.data.attributes).find(a => a.key === "isHeroic").value).length;
            let armorReflexDefenseBonus = getArmorReflexDefenseBonus(actor);
            if (armorReflexDefenseBonus) {
                armorBonus = Math.max(armorBonus, armorReflexDefenseBonus);
            }
        } else {
            armorBonus = getArmorReflexDefenseBonus(actor) || 0;
        }
    } else {
        armorBonus = _selectRefBonus(actor, actor.heroicLevel, getArmorReflexDefenseBonus(actor));
    }
    total.push(armorBonus);
    let otherBonus = getInheritableAttribute({
        entity: actor,
        attributeKey: "reflexDefenseBonus",
        reduce: "SUM",
        attributeFilter: attr => !attr.modifier
    })
    let miscBonusTip = getInheritableAttribute({
        entity: actor,
        attributeKey: "reflexDefenseBonus",
        reduce: "SUMMARY",
        attributeFilter: attr => !attr.modifier
    })
    total.push(otherBonus);
    let classBonus = getInheritableAttribute({
        entity: actor,
        attributeKey: "classReflexDefenseBonus",
        reduce: "MAX"
    }) || 0;
    total.push(classBonus);
    miscBonusTip += `Condition: ${conditionBonus};  `
    total.push(conditionBonus);
    let miscBonus = resolveValueArray([otherBonus, conditionBonus])
    return {
        total: resolveValueArray(total, actor),
        abilityBonus:0,
        armorBonus,
        classBonus,
        miscBonus,
        miscBonusTip,
        skip: false,
        name: 'Reflex (Flat-Footed)',
        defenseBlock:true
    }
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
    total.push(...(getInheritableAttribute({
        entity: actor,
        attributeKey: "damageThresholdBonus",
        reduce: "VALUES"
    })));
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
    total.push(...(getInheritableAttribute({
        entity: actor,
        attributeKey: "shieldRating",
        reduce: "VALUES"
    })));
    return {total: resolveValueArray(total, actor), current: resolveValueArray(total, actor)}
}

function _getSituationalBonuses(actor) {
    let defenseBonuses =
        getInheritableAttribute({
            entity: actor,
            attributeKey: ["fortitudeDefenseBonus", "reflexDefenseBonus", "willDefenseBonus"],
            attributeFilter: attr => !!attr.modifier
        })

    let situational = []
    for (let defenseBonus of defenseBonuses) {
        let value = toNumber(defenseBonus.value);
        let defense = defenseBonus.key.replace("DefenseBonus", "");
        situational.push(`${(value > -1 ? "+" : "") + value} ${value < 0 ? "penalty" : "bonus"} to their ${defense.titleCase()} Defense to resist ${defenseBonus.modifier}`);
    }

    let immunities =
        getInheritableAttribute({
            entity: actor,
            attributeKey: "immunity"
        })

    for (let immunity of immunities) {
        situational.push(`Immunity: ${immunity.value}`);
    }

    return situational;
}

function _selectRefBonus(actor, heroicLevel, armorBonus) {
    if (armorBonus) {
        let proficientWithEquipped = true;
        for (const armor of actor.getEquippedItems().filter(item => item.type === 'armor')) {
            if(!armor._parentIsProficientWithArmor()){
                proficientWithEquipped = false;
            }
        }
        if(proficientWithEquipped) {
            let improvedArmoredDefense = getInheritableAttribute({
                entity: actor,
                attributeKey: "improvedArmoredDefense",
                reduce: "OR"
            })
            if (improvedArmoredDefense) {
                return Math.max(armorBonus, heroicLevel + Math.floor(armorBonus / 2))
            }
            let armoredDefense = getInheritableAttribute({
                entity: actor,
                attributeKey: "armoredDefense",
                reduce: "OR"
            })
            if (armoredDefense) {
                return Math.max(armorBonus, heroicLevel)
            }
        }

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
    let bonuses = actor.inheritableItems.map(i => i.armorReflexDefenseBonus).filter(bonus => !!bonus)

    if (bonuses.length === 0) {
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

test()

function test(){
    resolveDefenses()
    let actor = {}
    //resolveDefenses(actor)
}