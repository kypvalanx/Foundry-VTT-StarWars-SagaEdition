import {getEquippedItems, SWSEActor} from "./actor.js";
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


    let refDefense = armor.armorReflexDefenseBonus || 0;
    let fortDefense = armor.fortitudeDefenseBonus || 0;
    let maxDex = armor.maximumDexterityBonus || 0;
    return {
        name: armor.name,
        speed: speed,
        refDefense,
        fortDefense,
        maxDex,
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

    //TODO can we filter attributes by proficiency in the get search so we can get rid of some of the complex armor logic?


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
    let defense = actor.system.defense;
    defense.fortitude = fortitude;
    defense.will = will;
    defense.reflex = reflex;
    defense.damageThreshold = damageThreshold;
    defense.damageReduction = damageReduction;
    defense.situationalBonuses = situationalBonuses;
    defense.shield = shield;
    return {defense, armors};
}

/**
 *
 * @param actor {SWSEActor}
 * @param conditionBonus {number}
 * @returns
 * @private
 */
function _resolveFort(actor, conditionBonus) {
    let bonuses = [];
    bonuses.push(10);
    let heroicLevel = actor.heroicLevel;
    bonuses.push(heroicLevel);
    let abilityBonus = _getFortStatMod(actor);
    bonuses.push(abilityBonus);
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
    bonuses.push(otherBonus);
    let classBonus = getInheritableAttribute({
        entity: actor,
        attributeKey: "classFortitudeDefenseBonus",
        reduce: "MAX"
    }) || 0;
    bonuses.push(classBonus);
    let equipmentBonus = _getEquipmentFortBonus(actor);
    bonuses.push(equipmentBonus);
    bonuses.push(conditionBonus);
    let armorBonus = resolveValueArray([equipmentBonus, heroicLevel]);
    let miscBonuses = [];
    miscBonuses.push(conditionBonus)
    miscBonuses.push(otherBonus)
    let miscBonus = resolveValueArray(miscBonuses)

    let name = 'Fortitude';
    let total = resolveValueArray(bonuses, actor);
    actor.setResolvedVariable("@FortDef", total, name, name);
    let fortitudeDefense = {total, abilityBonus, armorBonus, classBonus, miscBonus, miscBonusTip,  name, defenseBlock:true};
    return fortitudeDefense
}

/**
 *
 * @param actor {SWSEActor}
 * @param conditionBonus
 * @returns {{classBonus, total: number, miscBonus: number, abilityBonus, armorBonus: number}}
 * @private
 */
function _resolveWill(actor, conditionBonus) {
    let system = actor.system
    let skip = ['vehicle', 'npc-vehicle'].includes(actor.type);
    let bonuses = [];
    bonuses.push(10);
    let heroicLevel = actor.heroicLevel;
    bonuses.push(heroicLevel);
    let abilityBonus = _getWisMod(actor);
    bonuses.push(abilityBonus);
    let classBonus = getInheritableAttribute({
        entity: actor,
        attributeKey: "classWillDefenseBonus",
        reduce: "MAX"
    }) || 0;
    bonuses.push(classBonus);
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

    let miscBonuses = [otherBonus, conditionBonus];

    for(let val of getInheritableAttribute({entity:actor, attributeKey: "applyBonusTo", reduce:"VALUES"})){
        if(val.toLowerCase().endsWith(":will")){
            let toks = val.split(":");
            let attributeKey = toks[0];

            if(attributeKey === "equipmentFortitudeDefenseBonus"){
                let equipmentFortBonus = _getEquipmentFortBonus(actor);
                miscBonuses.push(equipmentFortBonus)
                miscBonusTip += "Equipment Fort Bonus: " + equipmentFortBonus
            } else {

                miscBonuses.push(getInheritableAttribute({
                    entity: actor,
                    attributeKey: attributeKey,
                    reduce: "SUM",

                    attributeFilter: attr => !attr.modifier
                }))
                miscBonusTip += getInheritableAttribute({
                    entity: actor,
                    attributeKey: attributeKey,
                    reduce: "SUMMARY",

                    attributeFilter: attr => !attr.modifier
                })
            }
        }
    }


    miscBonusTip += `Condition: ${conditionBonus};  `
    let miscBonus = resolveValueArray(miscBonuses)
    bonuses.push(miscBonus);
    let armorBonus = resolveValueArray([heroicLevel]);
    let total = resolveValueArray(bonuses, actor);
    let name = 'Will';
    actor.setResolvedVariable("@WillDef", total, name, name);
    return {total, abilityBonus, armorBonus, classBonus, miscBonus, miscBonusTip, skip, name, defenseBlock:true}
}

/**
 *
 * @param actor {SWSEActor}
 * @param conditionBonus
 * @returns {{classBonus, total: number, miscBonus: number, abilityBonus: number, armorBonus: (*)}}
 * @private
 */
function _resolveRef(actor, conditionBonus) {
    let bonuses = [];
    bonuses.push(10);

    let armorBonus = getArmorBonus(actor);
    bonuses.push(armorBonus);
    let abilityBonus = Math.min(_getDexMod(actor), _getEquipmentMaxDexBonus(actor));
    bonuses.push(abilityBonus);
    let otherBonus = getInheritableAttribute({
        entity: actor,
        attributeKey: "reflexDefenseBonus",
        reduce: "SUM",
        attributeFilter: attr => !attr.modifier
    })
    let naturalArmorBonus = getInheritableAttribute({
        entity: actor,
        attributeKey: "naturalArmorReflexDefenseBonus",
        reduce: "SUM",
        attributeFilter: attr => !attr.modifier
    })
    let miscBonusTip = getInheritableAttribute({
        entity: actor,
        attributeKey: "reflexDefenseBonus",
        reduce: "SUMMARY",
        attributeFilter: attr => !attr.modifier
    })
    bonuses.push(otherBonus);
    let classBonus = getInheritableAttribute({
        entity: actor,
        attributeKey: "classReflexDefenseBonus",
        reduce: "MAX"
    }) || 0;
    bonuses.push(classBonus);
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
    bonuses.push(dodgeBonus);
    bonuses.push(conditionBonus);
    bonuses.push(naturalArmorBonus);
    let miscBonus = resolveValueArray([otherBonus, conditionBonus, dodgeBonus, naturalArmorBonus])
    let defenseModifiers = [_resolveFFRef(actor, conditionBonus)]
    let total = resolveValueArray(bonuses, actor);
    let name = 'Reflex';
    actor.setResolvedVariable("@RefDef", total, name, name);
    return {
        total,
        abilityBonus,
        armorBonus,
        classBonus,
        miscBonus,
        miscBonusTip,
        skip: false,
        name,
        defenseBlock:true,
        defenseModifiers
    }
}


function getArmorBonus(actor) {
    let armorReflexDefenseBonus = getArmorReflexDefenseBonus(actor) || 0;
    if (["vehicle", "npc-vehicle"].includes(actor.type)) {
        if (actor.pilot) {
            let armorBonus = actor.pilot.items.filter(i => i.type === "class" && Object.values(i.data.attributes).find(a => a.key === "isHeroic").value).length;
            return Math.max(armorBonus, armorReflexDefenseBonus);
        } else {
            return armorReflexDefenseBonus;
        }
    } else {
        return _selectRefBonus(actor, actor.heroicLevel, armorReflexDefenseBonus);
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
    let bonuses = [];
    bonuses.push(10);

    let abilityBonus = Math.min(_getDexMod(actor), _getEquipmentMaxDexBonus(actor));
    if(abilityBonus < 0) {
        bonuses.push(abilityBonus);
    }
    let armorBonus = getArmorBonus(actor);
    bonuses.push(armorBonus);
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
    bonuses.push(otherBonus);
    let classBonus = getInheritableAttribute({
        entity: actor,
        attributeKey: "classReflexDefenseBonus",
        reduce: "MAX"
    }) || 0;
    bonuses.push(classBonus);
    miscBonusTip += `Condition: ${conditionBonus};  `
    bonuses.push(conditionBonus);
    let miscBonus = resolveValueArray([otherBonus, conditionBonus])
    let total = resolveValueArray(bonuses, actor);
    let name = 'Reflex (Flat-Footed)';

    actor.setResolvedVariable("@RefFFDef", total, name, name);
    return {
        total,
        abilityBonus:0,
        armorBonus,
        classBonus,
        miscBonus,
        miscBonusTip,
        skip: false,
        name,
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
    total.push(getInheritableAttribute({
        entity: actor,
        attributeKey: "damageThresholdBonus",
        reduce: "SUM"
    }));
    let damageThreshold = actor.system.defense.damageThreshold;
    damageThreshold.total = resolveValueArray(total, actor);
    return damageThreshold
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

function _getDexMod(actor) {
    return actor.system.attributes.dex.mod;
}

function _getWisMod(actor) {
    return actor.system.attributes.wis?.mod || 0;
}

function _getFortStatMod(actor) {
    let attributes = actor.system.attributes;
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
    let bonuses = getEquippedItems(actor).map(i => i.armorReflexDefenseBonus).filter(bonus => !!bonus)

    if (bonuses.length === 0) {
        return undefined;
    }
    return Math.max(...bonuses)
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