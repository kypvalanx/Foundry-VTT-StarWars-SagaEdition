import {SWSEActor} from "./actor.mjs";
import {resolveValueArray, toNumber} from "../common/util.mjs";
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
export function generateArmorBlock(actor, armor) {
    let attributes = getInheritableAttribute({
        entity: armor,
        attributeKey: "special",
        reduce: "VALUES",


    });
    if (!armor._parentIsProficientWithArmor()) {
        attributes.push("(Not Proficient)");
    }
    const notes = attributes.join(", ");
    return {
        name: armor.name,
        refDefense: armor.armorReflexDefenseBonus,
        fortDefense: armor.fortitudeDefenseBonus,
        maxDex: armor.maximumDexterityBonus,
        notes: notes,
        subtype: armor.armorType,
        notesHTML: notes,
        notesText: notes,
        modes : armor.modes
    };
}

/**
 *
 * @param actor {SWSEActor}
 * @returns
 */
export function resolveDefenses(actor) {
    const fn = () => {
        if(!actor){
            return {};
        }
        let condition = getInheritableAttribute({
            entity: actor,
            attributeKey: "condition",
            reduce: "FIRST"
        }) || "0"


        //TODO can we filter attributes by proficiency in the get search so we can get rid of some of the complex armor logic?

        let defense = actor.system.defense || {};

        defense.fortitude = {...defense.fortitude, ..._resolveFort(actor, condition)};
        if(actor.type !== "vehicle"){
            defense.will = {...defense.will, ..._resolveWill(actor, condition)};
        }
        defense.reflex = {...defense.reflex, ..._resolveRef(actor, condition)};
        defense.damageThreshold = {...defense.damageThreshold, ..._resolveDt(actor, defense.fortitude.total)};
        defense.situationalBonuses = _getSituationalBonuses(actor);

        defense.damageReduction = getInheritableAttribute({
            entity: actor,
            attributeKey: "damageReduction",
            reduce: "SUM"
        })

        return defense;

    }

    return actor?.getCached ? actor.getCached("defenses", fn) : fn();
}

/**
 *
 * @param actor {SWSEActor}
 * @param condition
 * @returns
 * @private
 */
function _resolveFort(actor, condition) {
    const conditionBonus = condition === "OUT" ? "0" : condition

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

function implantInterference(actor) {
    let disruption = getInheritableAttribute({
        entity: actor,
        attributeKey: "implantDisruption",
        reduce: "OR"
    })
    let training = getInheritableAttribute({
        entity: actor,
        attributeKey: "implantTraining",
        reduce: "OR"
    })

    if(disruption && !training){
        return [-2]
    }

    return [];
}

/**
 *
 * @param actor {SWSEActor}
 * @param condition
 * @returns {{classBonus, total: number, miscBonus: number, abilityBonus, armorBonus: number}}
 * @private
 */
function _resolveWill(actor, condition) {

    const conditionBonus = condition === "OUT" ? "0" : condition
    let skip = ['vehicle', 'npc-vehicle'].includes(actor.type);
    let bonuses = [];
    bonuses.push(10);
    let heroicLevel = actor.heroicLevel;
    bonuses.push(heroicLevel);
    let abilityBonus = _getWisMod(actor);
    bonuses.push(abilityBonus);

    bonuses.push(...implantInterference(actor))


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

function applyBonuses(defense, total, bonuses) {
    defense.total = defense.override ? defense.override : total;
    defense.abilityBonus = bonuses.find(b => b.type === "Ability")?.value || 0;
    defense.armorBonus = bonuses.find(b => b.type === "Armor")?.value || 0;
    defense.classBonus = bonuses.find(b => b.type === "Class")?.value || 0;
    const miscBonus = bonuses.filter(b => !(b.type === "Ability" || b.type === "Armor" || b.type === "Class" || b.type === "Base"));
    defense.miscBonus = miscBonus.reduce((acc, obj) => acc + obj.value, 0);
    defense.miscBonusTip = miscBonus.map(b => `${b.type} ${b.value > -1 ? "Bonus" : "Modifier"}: ${b.value}`).join("\n");
}

/**
 *
 * @param actor {SWSEActor}
 * @param condition
 * @returns {{classBonus, total: number, miscBonus: number, abilityBonus: number, armorBonus: (*)}}
 * @private
 */
function _resolveRef(actor, condition) {
    let bonuses = [{value: 10, type: "Base"}];

    const conditionBonus = condition === "OUT" ? 0 : parseInt(condition)
    bonuses.push({value: conditionBonus, type: "Condition"});

    let armorBonus = getArmorBonus(actor);
    bonuses.push({value: armorBonus, type: "Armor"});

    let abilityBonus = condition === "OUT" ? -5 : Math.min(_getDexMod(actor), _getEquipmentMaxDexBonus(actor));
    bonuses.push({value: abilityBonus, type: "Ability"});


    let reflexDefenseBonus = getInheritableAttribute({
        entity: actor,
        attributeKey: "reflexDefenseBonus",
        reduce: "SUM",
        attributeFilter: attr => !attr.modifier
    })
    bonuses.push({value: reflexDefenseBonus, type: "Miscellaneous"});

    let naturalArmorBonus = getInheritableAttribute({
        entity: actor,
        attributeKey: "naturalArmorReflexDefenseBonus",
        reduce: "SUM",
        attributeFilter: attr => !attr.modifier
    })

    bonuses.push({value: naturalArmorBonus, type: "Natural"});

    let classBonus = getInheritableAttribute({
        entity: actor,
        attributeKey: "classReflexDefenseBonus",
        reduce: "MAX"
    }) || 0;

    bonuses.push({value: classBonus, type: "Class"});


    let dodgeBonus = getInheritableAttribute({
        entity: actor,
        attributeKey: "bonusDodgeReflexDefense",
        reduce: "SUM",
        attributeFilter: attr => !attr.modifier
    })

    bonuses.push({value: dodgeBonus, type: "Dodge"});
    if(game.settings.get("swse", "enableEncumbranceByWeight") && actor.weight >= actor.strainCapacity){
        const negativeAbilityBonus = abilityBonus*-1;
        bonuses.push({value: negativeAbilityBonus, type: "Encumbrance"});
    }
    let total = resolveValueArray(bonuses, actor);
    let name = 'Reflex';
    actor.setResolvedVariable("@RefDef", total, name, name);

    let reflexDefense = actor.system.defense?.reflex || {};
    applyBonuses(reflexDefense, total, bonuses);
    reflexDefense.bonuses = bonuses
    reflexDefense.name = name;
    reflexDefense.skip = false;
    reflexDefense.defenseBlock = true;
    reflexDefense.defenseModifiers = [_resolveFFRef(actor, bonuses,  reflexDefense.defenseModifiers)];
    return reflexDefense
}


function getArmorBonus(actor) {
    let armorReflexDefenseBonus = getInheritableAttribute({
        entity: actor,
        attributeKey: "armorReflexDefenseBonus",
        reduce: "SUM",
        attributeFilter: attr => !attr.modifier
    })
    if (["vehicle", "npc-vehicle"].includes(actor.type)) {
        if (actor.pilot) {
            let armorBonus = actor.pilot.items.filter(i => i.type === "class" && Object.values(i.system.changes).find(a => a.key === "isHeroic").value).length;
            return Math.max(armorBonus, armorReflexDefenseBonus);
        } else {
            return armorReflexDefenseBonus;
        }
    } else {
        return _selectRefBonus(actor, armorReflexDefenseBonus);
    }
}

/**
 *
 * @param actor {SWSEActor}
 * @param bonuses
 * @param defenseModifiers
 * @returns {{classBonus, total: number, miscBonus: number, abilityBonus: number, armorBonus: (*)}}
 * @private
 */
function _resolveFFRef(actor, bonuses, defenseModifiers) {
    bonuses = JSON.parse(JSON.stringify(bonuses));

    bonuses = bonuses.filter(b => !((b.type === "Ability" && b.value > -1) || b.type === "Encumbrance"));

    let total = resolveValueArray(bonuses, actor);
    let name = 'Reflex (Flat-Footed)';

    actor.setResolvedVariable("@RefFFDef", total, name, name);

    let ffReflexDefense =  {};
    if(defenseModifiers){
        ffReflexDefense = defenseModifiers['reflex (flat-footed)'] || {};
    }

    applyBonuses(ffReflexDefense, total, bonuses)
    ffReflexDefense.name = name;
    ffReflexDefense.skip = false;
    ffReflexDefense.defenseBlock = true;
    return ffReflexDefense
}



/**
 *
 * @param actor {SWSEActor}
 * @param fortitudeTotal
 * @returns {{total: number}}
 * @private
 */
function _resolveDt(actor, fortitudeTotal) {
    let total = [];
    total.push(fortitudeTotal);
    total.push(getInheritableAttribute({
        entity: actor,
        attributeKey: "damageThresholdSizeModifier",
        reduce: "SUM"
    }));
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

function _selectRefBonus(actor, armorBonus) {
    if (armorBonus) {
        let proficientWithEquipped = true;
        for (const armor of actor.equipped.filter(item => item.type === 'armor')) {
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
                return Math.max(armorBonus, actor.heroicLevel + Math.floor(armorBonus / 2))
            }
            let armoredDefense = getInheritableAttribute({
                entity: actor,
                attributeKey: "armoredDefense",
                reduce: "OR"
            })
            if (armoredDefense || actor.isFollower) {
                return Math.max(armorBonus, actor.heroicLevel)
            }
        }

        return armorBonus;
    }
    return actor.heroicLevel;
}

function _getDexMod(actor) {
    return actor.attributes.dex.mod;
}

function _getWisMod(actor) {
    return actor.attributes.wis?.mod || 0;
}

/**
 *
 * @param actor {SWSEActor}
 * @return {*}
 * @private
 */
function _getFortStatMod(actor) {
    let attributes = actor.attributes;
    return actor.ignoreCon() ? attributes.str.mod : attributes.con.mod;
}


/**
 *
 * @param actor {SWSEActor}
 * @returns {number}
 * @private
 */
function _getEquipmentFortBonus(actor) {
    let equipped = actor.equipped;
    let bonus = 0;
    for (let item of equipped) {
        if (item.fortitudeDefenseBonus) {
            bonus = Math.max(bonus, item.fortitudeDefenseBonus);
        }
    }
    return bonus;
}

function _getEquipmentMaxDexBonus(actor) {
    let equipped = actor.equipped;
    let bonus = 1000;
    for (let item of equipped) {
        if (item.type !== "armor") continue;
        let maximumDexterityBonus = item.maximumDexterityBonus;
        if (!isNaN(maximumDexterityBonus)) {
            bonus = Math.min(bonus, maximumDexterityBonus);
        }
    }
    return bonus;
}

//TODO, move to a proper quench test
// test()
//
// function test(){
//     resolveDefenses()
//     let actor = {}
//     //resolveDefenses(actor)
// }