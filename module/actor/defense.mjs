import {SWSEActor} from "./actor.mjs";
import {equippedItems, resolveValueArray, toNumber} from "../common/util.mjs";
import {getInheritableAttribute} from "../attribute-helper.mjs";


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
    return {
        name: armor.name,
        speed: actor.speed,
        refDefense: armor.armorReflexDefenseBonus,
        fortDefense: armor.fortitudeDefenseBonus,
        maxDex: armor.maximumDexterityBonus,
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

    let defense = actor.system.defense || {};

    defense.fortitude = {...defense.fortitude, ..._resolveFort(actor, conditionBonus)};
    defense.will = {...defense.will, ..._resolveWill(actor, conditionBonus)};
    defense.reflex = {...defense.reflex, ..._resolveRef(actor, conditionBonus)};
    defense.damageThreshold = {...defense.damageThreshold, ..._resolveDt(actor, conditionBonus, defense.fortitude.total)};
    defense.situationalBonuses = _getSituationalBonuses(actor);

    defense.damageReduction = getInheritableAttribute({
        entity: actor,
        attributeKey: "damageReduction",
        reduce: "SUM"
    })

    let armors = []

    for (const armor of actor.getEquippedItems().filter(item => item.type === 'armor')) {
        armors.push(generateArmorBlock(actor, armor));
    }
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

    let fortitudeDefenseBonus = getInheritableAttribute({
        entity: actor,
        attributeKey: "fortitudeDefenseBonus",
        reduce: ["SUM", "SUMMARY", "MAPPED"],
        attributeFilter: attr => !attr.modifier
    })
    let otherBonus = fortitudeDefenseBonus["SUM"];
    let miscBonusTip = fortitudeDefenseBonus["SUMMARY"];

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
    let fortitudeDefense = actor.system.defense?.fortitude || {};
    fortitudeDefense.total = fortitudeDefense.override ? fortitudeDefense.override : total;
    fortitudeDefense.abilityBonus = abilityBonus;
    fortitudeDefense.armorBonus = armorBonus;
    fortitudeDefense.classBonus = classBonus;
    fortitudeDefense.miscBonus = miscBonus;
    fortitudeDefense.miscBonusTip = miscBonusTip;
    fortitudeDefense.name = name;
    fortitudeDefense.defenseBlock = true;
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

    let willDefenseBonus = getInheritableAttribute({
        entity: actor,
        attributeKey: "willDefenseBonus",
        reduce: ["SUM", "SUMMARY", "MAPPED"],
        attributeFilter: attr => !attr.modifier
    })
    let otherBonus = willDefenseBonus["SUM"];
    let miscBonusTip = willDefenseBonus["SUMMARY"];

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

                let inheritableAttribute = getInheritableAttribute({
                    entity: actor,
                    attributeKey: attributeKey,
                    reduce: ["SUM", "SUMMARY", "MAPPED"],

                    attributeFilter: attr => !attr.modifier
                })

                miscBonuses.push(inheritableAttribute["SUM"])
                miscBonusTip += inheritableAttribute["SUMMARY"]
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
    let willDefense = actor.system.defense?.will || {};
    willDefense.total = willDefense.override ? willDefense.override : total;
    willDefense.abilityBonus = abilityBonus;
    willDefense.armorBonus = armorBonus;
    willDefense.classBonus = classBonus;
    willDefense.miscBonus = miscBonus;
    willDefense.miscBonusTip = miscBonusTip;
    willDefense.name = name;
    willDefense.skip = skip;
    willDefense.defenseBlock = true;
    return willDefense
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


    let reflexDefenseBonus = getInheritableAttribute({
        entity: actor,
        attributeKey: "reflexDefenseBonus",
        reduce: ["SUM", "SUMMARY", "MAPPED"],
        attributeFilter: attr => !attr.modifier
    })
    let otherBonus = reflexDefenseBonus["SUM"];
    let miscBonusTip = reflexDefenseBonus["SUMMARY"];

    let naturalArmorBonus = getInheritableAttribute({
        entity: actor,
        attributeKey: "naturalArmorReflexDefenseBonus",
        reduce: "SUM",
        attributeFilter: attr => !attr.modifier
    })

    bonuses.push(otherBonus);
    let classBonus = getInheritableAttribute({
        entity: actor,
        attributeKey: "classReflexDefenseBonus",
        reduce: "MAX"
    }) || 0;
    bonuses.push(classBonus);


    let bonusDodgeReflexDefense = getInheritableAttribute({
        entity: actor,
        attributeKey: "bonusDodgeReflexDefense",
        reduce: ["SUM", "SUMMARY", "MAPPED"],
        attributeFilter: attr => !attr.modifier
    })

    let dodgeBonus = bonusDodgeReflexDefense["SUM"]
    miscBonusTip += bonusDodgeReflexDefense["SUMMARY"]
    miscBonusTip += `Condition: ${conditionBonus};  `
    const miscBonuses = [otherBonus, conditionBonus, dodgeBonus, naturalArmorBonus];
    if(game.settings.get("swse", "enableEncumbranceByWeight") && actor.weight >= actor.strainCapacity){
        const negativeAbilityBonus = abilityBonus*-1;
        miscBonuses.push(negativeAbilityBonus)
        bonuses.push(negativeAbilityBonus);
        miscBonusTip += `Strained Capacity: ${negativeAbilityBonus};  `
    }
    bonuses.push(dodgeBonus);
    bonuses.push(conditionBonus);
    bonuses.push(naturalArmorBonus);
    let miscBonus = resolveValueArray(miscBonuses)
    let defenseModifiers = [_resolveFFRef(actor, conditionBonus, abilityBonus, armorBonus, reflexDefenseBonus, classBonus)]
    let total = resolveValueArray(bonuses, actor);
    let name = 'Reflex';
    actor.setResolvedVariable("@RefDef", total, name, name);

    let reflexDefense = actor.system.defense?.reflex || {};
    reflexDefense.total = reflexDefense.override ? reflexDefense.override : total;
    reflexDefense.abilityBonus = abilityBonus;
    reflexDefense.armorBonus = armorBonus;
    reflexDefense.classBonus = classBonus;
    reflexDefense.miscBonus = miscBonus;
    reflexDefense.miscBonusTip = miscBonusTip;
    reflexDefense.name = name;
    reflexDefense.skip = false;
    reflexDefense.defenseBlock = true;
    reflexDefense.defenseModifiers = defenseModifiers;
    return reflexDefense
}


function getArmorBonus(actor) {
    let armorReflexDefenseBonus = getArmorReflexDefenseBonus(actor) || 0;
    if (["vehicle", "npc-vehicle"].includes(actor.type)) {
        if (actor.pilot) {
            let armorBonus = actor.pilot.items.filter(i => i.type === "class" && Object.values(i.system.attributes).find(a => a.key === "isHeroic").value).length;
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
 * @param abilityBonus
 * @param armorBonus
 * @param reflexDefenseBonus
 * @param classBonus
 * @returns {{classBonus, total: number, miscBonus: number, abilityBonus: number, armorBonus: (*)}}
 * @private
 */
function _resolveFFRef(actor, conditionBonus, abilityBonus, armorBonus, reflexDefenseBonus, classBonus) {
    let bonuses = [];
    bonuses.push(10);

    if(abilityBonus < 0) {
        bonuses.push(abilityBonus);
    }
    bonuses.push(armorBonus);

    let otherBonus = reflexDefenseBonus["SUM"];
    let miscBonusTip = reflexDefenseBonus["SUMMARY"];

    bonuses.push(otherBonus);
    bonuses.push(classBonus);
    miscBonusTip += `Condition: ${conditionBonus};  `
    bonuses.push(conditionBonus);
    let miscBonus = resolveValueArray([otherBonus, conditionBonus])
    let total = resolveValueArray(bonuses, actor);
    let name = 'Reflex (Flat-Footed)';

    actor.setResolvedVariable("@RefFFDef", total, name, name);

    let ffReflexDefense =  {};
    let defenseModifiers = actor.system.defense?.reflex?.defenseModifiers
    if(defenseModifiers){
        ffReflexDefense = defenseModifiers['reflex (flat-footed)'] || {};
    }
    ffReflexDefense.total = total;
    ffReflexDefense.abilityBonus = 0;
    ffReflexDefense.armorBonus = armorBonus;
    ffReflexDefense.classBonus = classBonus;
    ffReflexDefense.miscBonus = miscBonus;
    ffReflexDefense.miscBonusTip = miscBonusTip;
    ffReflexDefense.name = name;
    ffReflexDefense.skip = false;
    ffReflexDefense.defenseBlock = true;
    return ffReflexDefense
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
 * @param fortitudeTotal
 * @returns {{total: number}}
 * @private
 */
function _resolveDt(actor, conditionBonus, fortitudeTotal) {
    let total = [];
    total.push(fortitudeTotal);
    total.push(_getDamageThresholdSizeMod(actor));
    total.push(getInheritableAttribute({
        entity: actor,
        attributeKey: "damageThresholdBonus",
        reduce: "SUM"
    }));
    total.push(... getInheritableAttribute({
        entity: actor,
        attributeKey: 'damageThresholdHardenedMultiplier',
        reduce: "NUMERIC_VALUES"
    }).map(value => "*"+value))
    let damageThreshold = actor.system.defense?.damageThreshold || {};
    damageThreshold.total = resolveValueArray(total, actor);
    return damageThreshold
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
    let bonuses = equippedItems(actor).map(i => i.armorReflexDefenseBonus).filter(bonus => !!bonus)

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