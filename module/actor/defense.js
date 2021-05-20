import {SWSEActor} from "./actor.js";
import {resolveValueArray} from "../util.js";

/**
 *
 * @param actor {SWSEActor}
 * @returns {{dt: number, ref: number, will: number, fort: number}}
 */
export function resolveDefenses(actor) {
    let defenseBonuses = actor.getTraitAttributesByKey('defenseBonuses');
    let conditionBonus = actor.getConditionBonus();
    let fort = _resolveFort(actor, defenseBonuses, conditionBonus);
    let will = _resolveWill(actor, defenseBonuses, conditionBonus);
    let ref = _resolveRef(actor, defenseBonuses, conditionBonus);
    let dt = _resolveDt(actor, defenseBonuses, conditionBonus);
    return {fort: fort, will: will, ref: ref, dt: dt};
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
    total.push(actor.getCharacterLevel());
    total.push(_getFortStatMod(actor));
    total.push(_getTraitDefBonus('fortitude', defenseBonuses));
    total.push(_getClassDefBonus('fortitude', actorData));
    total.push(_getEquipmentFortBonus(actor));
    total.push(conditionBonus);
    return resolveValueArray(total, actor)
}

function _resolveWill(actor, defenseBonuses, conditionBonus) {
    let actorData = actor.data
    let total = [];
    total.push(10);
    total.push(actor.getCharacterLevel());
    total.push(_getWisMod(actorData));
    total.push(_getClassDefBonus('will', actorData));
    total.push(_getTraitDefBonus('will', defenseBonuses));
    total.push(conditionBonus);
    return resolveValueArray(total, actor)
}

function _resolveRef(actor, defenseBonuses, conditionBonus) {
    let actorData = actor.data
    let total = [];
    total.push(10);
    total.push(_selectRefBonus(actor.getCharacterLevel(), _getEquipmentRefBonus(actor)));
    total.push(_getDexMod(actorData));
    total.push(_getTraitDefBonus('reflex', defenseBonuses));
    total.push(_getClassDefBonus('reflex', actorData));
    total.push(_getTraitRefMod(actor));
    total.push(conditionBonus);
    return resolveValueArray(total, actor)

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
        if (defenseBonus.defense === 'all' || defenseBonus.defense === defenseType) {
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
        if(actor.isProficientWith(item)) {
            if (item.data.data.armor.fortitudeBonus) {
                bonus = Math.max(bonus, parseInt(item.data.data.armor.fortitudeBonus));
            }
        }
    }
    return bonus;
}

function _getEquipmentRefBonus(actor) {
    let equipped = actor.getEquippedItems();
    let bonus = -1;
    for (let item of equipped) {
        if (item.data.data.armor?.reflexBonus) {
            bonus = Math.max(bonus, parseInt(item.data.data.armor.reflexBonus));
        }
    }
    return bonus;
}
