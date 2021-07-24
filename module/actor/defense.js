import {SWSEActor} from "./actor.js";
import {resolveValueArray} from "../util.js";


function reduceSpeedForArmorType(speed, armorType) {
    if("Light" === armorType){
        return speed;
    }
    console.log(speed, armorType);
    return speed.replace("4","3").replace("6", "4");
}

function generateArmorBlock(actor, armor) {
    let attributes = armor.data.data.attributes;
    let speed = reduceSpeedForArmorType(actor.getSpeed(),armor.armorType);


    return {name: armor.data.data.finalName, speed: speed, refDefense: attributes.reflexDefenseBonus ? attributes.reflexDefenseBonus?.value: 0,
        fortDefense: attributes.fortitudeDefenseBonus ? attributes.fortitudeDefenseBonus?.value:0,
        maxDex: attributes.maximumDexterityBonus ? attributes.maximumDexterityBonus?.value :0, notes: attributes.special && Array.isArray(attributes.special.value) ? attributes.special.value.join(", "): ""};
}

/**
 *
 * @param actor {SWSEActor}
 * @returns
 */
export function resolveDefenses(actor) {
    let defenseBonuses = actor.getTraitAttributesByKey('defenseBonuses');
    let conditionBonus = actor.getConditionBonus();
    let fort = _resolveFort(actor, defenseBonuses, conditionBonus);
    let will = _resolveWill(actor, defenseBonuses, conditionBonus);
    let ref = _resolveRef(actor, defenseBonuses, conditionBonus);
    let dt = _resolveDt(actor, defenseBonuses, conditionBonus);
    let situationalBonuses = _getSituationalBonuses(defenseBonuses);

    let armors = []

    for (const armor of actor.getEquippedItems().filter(item => item.type === 'armor')) {
        armors.push(generateArmorBlock(actor, armor));
    }


    return {defense: {fort,will, ref,dt, situationalBonuses}, armors};
}

/**
 *
 * @param actor {SWSEActor}
 * @param defenseBonuses {[]}
 * @param conditionBonus {number}
 * @returns {number}
 * @private
 */
function _resolveFort(actor, defenseBonuses, conditionBonus) {
    let actorData = actor.data
    let total = [];
    total.push(10);
    let heroicLevel = actor.getHeroicLevel();
    total.push(heroicLevel);
    let abilityBonus = _getFortStatMod(actor);
    total.push(abilityBonus);
    let traitBonus = _getTraitDefBonus('fortitude', defenseBonuses);
    total.push(traitBonus);
    let classBonus = _getClassDefBonus('fortitude', actorData);
    total.push(classBonus);
    let equipmentBonus = _getEquipmentFortBonus(actor);
    total.push(equipmentBonus);
    total.push(conditionBonus);
    let armorBonus = resolveValueArray([equipmentBonus, heroicLevel]);
    let miscBonus = resolveValueArray([traitBonus, conditionBonus])
    return {total:resolveValueArray(total, actor), abilityBonus, armorBonus, classBonus, miscBonus}
}

function _resolveWill(actor, defenseBonuses, conditionBonus) {
    let actorData = actor.data
    let total = [];
    total.push(10);
    total.push(actor.getCharacterLevel());
    let abilityBonus = _getWisMod(actorData);
    total.push(abilityBonus);
    let classBonus = _getClassDefBonus('will', actorData);
    total.push(classBonus);
    let traitBonus = _getTraitDefBonus('will', defenseBonuses);
    total.push(traitBonus);
    total.push(conditionBonus);
    let miscBonus = resolveValueArray([traitBonus, conditionBonus])
    let armorBonus = 0;
    return {total:resolveValueArray(total, actor), abilityBonus, armorBonus, classBonus, miscBonus}
}

function _resolveRef(actor, defenseBonuses, conditionBonus) {
    let actorData = actor.data
    let total = [];
    total.push(10);
    let armorBonus = _selectRefBonus(actor.getHeroicLevel(), _getEquipmentRefBonus(actor));
    total.push(armorBonus);
    let abilityBonus = _selectDexMod(_getDexMod(actorData), _getEquipmentMaxDexBonus(actor));
    total.push(abilityBonus);
    let traitBonus = _getTraitDefBonus('reflex', defenseBonuses);
    total.push(traitBonus);
    let classBonus = _getClassDefBonus('reflex', actorData);
    total.push(classBonus);
    total.push(_getTraitRefMod(actor));
    total.push(conditionBonus);
    let miscBonus = resolveValueArray([traitBonus, conditionBonus])
    return {total:resolveValueArray(total, actor), abilityBonus, armorBonus, classBonus, miscBonus}
}

function _getDamageThresholdSizeMod(actor) {
    let attributes = actor.getTraitAttributesByKey('damageThresholdSizeModifier')

    let total = [];
    for(let attribute of attributes){
        total.push(attribute)
    }

    return resolveValueArray(total, actor)
}

function _resolveDt(actor, defenseBonuses, conditionBonus) {
    let total = [];
    total.push(_resolveFort(actor, defenseBonuses, conditionBonus));
    total.push(_getDamageThresholdSizeMod(actor))
    return resolveValueArray(total, actor)
}

function capFirst(word) {
    return word.charAt(0).toUpperCase() + word.slice(1)
}

function _getSituationalBonuses(defenseBonuses) {
    let situational = []
    for (let defenseBonus of defenseBonuses) {
        if (defenseBonus.modifier) {
            situational.push(`${(defenseBonus.bonus>-1?"+":"")+ defenseBonus.bonus} ${defenseBonus.bonus < 0? "penalty":"bonus"} to their ${capFirst(defenseBonus.defense)} Defense to resist ${defenseBonus.modifier}`);
        }
    }
    return situational;
}

function _selectRefBonus(heroicLevel, armorBonus) {
    if (armorBonus > -1) {
        return armorBonus;
    }
    return heroicLevel;
}

function _selectDexMod(dexterityModifier, maxDexterityBonus) {
    return Math.min(dexterityModifier, maxDexterityBonus);
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

function _getClassDefBonus(stat, actorData) {
    let bonus = 0;
    for (let charclass of actorData.classes) {
        bonus = Math.max(bonus, charclass.data.defense[stat]);
    }
    return bonus;
}

/**
 *
 * @param defenseType {string}
 * @param defenseBonuses {[]}
 * @returns {number}
 * @private
 */
function _getTraitDefBonus(defenseType, defenseBonuses) {
    let bonus = 0;
    for (let defenseBonus of defenseBonuses) {
        if (!defenseBonus.modifier && (defenseBonus.defense === 'all' || defenseBonus.defense === defenseType)) {
            bonus = bonus + defenseBonus.bonus;
        }
    }
    return bonus;
}

function _getTraitRefMod(actor) {
    let sizeBonuses = actor.getTraitAttributesByKey('sizeModifier');
    let total = 0;
    for (let sizeBonus of sizeBonuses) {
        total = total + sizeBonus;
    }
    return total;
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
        //if(actor.isProficientWith(item)) {
            if (item.data.data.attributes.fortitudeDefenseBonus) {
                bonus = Math.max(bonus, parseInt(item.data.data.attributes.fortitudeDefenseBonus.value));
            }
        //}
    }
    return bonus;
}

function _getEquipmentRefBonus(actor) {
    let equipped = actor.getEquippedItems();
    let bonus = -1;
    for (let item of equipped) {
        if (item.data.data.attributes.reflexDefenseBonus) {
            bonus = Math.max(bonus, parseInt(item.data.data.attributes.reflexDefenseBonus.value));
        }
    }
    return bonus;
}

function _getEquipmentMaxDexBonus(actor) {
    let equipped = actor.getEquippedItems();
    let bonus = 1000;
    for (let item of equipped) {
        if (item.data.data.attributes.maximumDexterityBonus) {
            bonus = Math.min(bonus, parseInt(item.data.data.attributes.maximumDexterityBonus.value));
        }
    }
    return bonus;
}
