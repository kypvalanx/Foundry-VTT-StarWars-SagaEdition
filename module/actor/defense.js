import {SWSEActor} from "./actor.js";
import {resolveValueArray} from "../util.js";

export function resolveDefenses(actor) {
    let fort = _resolveFort(actor);
    let will = _resolveWill(actor);
    let ref = _resolveRef(actor);
    let dt = _resolveDt(actor);
    return {fort: fort, will: will, ref: ref, dt: dt};
}

export function _resolveFort(actor) {
    let actorData = actor.data
    let total = [];
    total.push(10);
    total.push(actor.getCharacterLevel(actorData));
    total.push(_getFortStatMod(actor));
    total.push(_getAbilityDefBonus('fortitude', actor));
    total.push(_getClassDefBonus('fortitude', actorData));
    total.push(_getEquipmentFortBonus(actorData));
    total.push(actor.getConditionBonus());
    return resolveValueArray(total, actor)
}

export function _resolveWill(actor) {
    let actorData = actor.data
    let total = [];
    total.push(10);
    total.push(actor.getCharacterLevel(actorData));
    total.push(_getWisMod(actorData));
    total.push(_getClassDefBonus('will', actorData));
    total.push(_getAbilityDefBonus('will', actor));
    total.push(actor.getConditionBonus());
    return resolveValueArray(total, actor)
}

export function _resolveRef(actor) {
    let actorData = actor.data
    let total = [];
    total.push(10);
    total.push(_selectRefBonus(actor.getCharacterLevel(actorData), _getEquipmentRefBonus(actorData)));
    total.push(_getDexMod(actorData));
    total.push(_getAbilityDefBonus('reflex', actor));
    total.push(_getClassDefBonus('reflex', actorData));
    total.push(_getNaturalArmorBonus(actorData));
    total.push(_getAbilityRefMod(actor));
    total.push(actor.getConditionBonus());
    return resolveValueArray(total, actor)

}

export function _resolveDt(actor) {
    return _resolveFort(actor);
}


export function _selectRefBonus(heroicLevel, armorBonus) {
    if (armorBonus > -1) {
        return armorBonus;
    }
    return heroicLevel;
}

export function _getDexMod(actorData) {
    return actorData.data.attributes.dex.mod;
}

export function _getWisMod(actorData) {
    return actorData.data.attributes.wis.mod;
}

export function _getFortStatMod(actor) {
    let actorData = actor.data;
    if (!actor.ignoreCon(actorData)) {
        return actorData.data.attributes.con.mod;
    } else {
        return actorData.data.attributes.str.mod;
    }
}

export function _getClassDefBonus(stat, actorData) {
    let bonus = 0;
    for (let charclass of actorData.classes) {
        bonus = Math.max(bonus, charclass.data.defense[stat]);
    }
    return bonus;
}

export function _getNaturalArmorBonus(actorData) {
    if (actorData.species) {
        actorData.species.data.categories.forEach(category => {
            category = category instanceof String ? category : category.category
            let results = /natural armor \(\+(\d*)\)/.exec(category.toLowerCase());
            if (results) {
                return results[1]
            }
        });
    }
    return 0;
}


export function _getAbilityDefBonus(defenseType, actor) {
    let actorData = actor.data
    let defenseBonuses = actor.getAbilityAttribute(actorData, 'defenseBonus');
    let bonus = 0;
    for (let defenseBonus of defenseBonuses) {
        if (defenseBonus.defense === 'all' || defenseBonus.defense === defenseType) {
            bonus = bonus + defenseBonus.bonus;
        }
    }
    return bonus;
}

export function _getAbilityRefMod(actor) {
    let actorData = actor.data
    let sizeBonuses = actor.getAbilityAttribute(actorData, 'sizeModifier');
    let total = 0;
    for (let sizeBonus of sizeBonuses) {
        total = total + sizeBonus;
    }
    return total;
}

export function _getEquipmentFortBonus(actorData) {
    let equipped = actorData.equipped;
    let bonus = 0;
    for (let item of equipped) {
        if (item.data.attributes.BonustoFortitudeDefense) {
            bonus = Math.max(bonus, parseInt(item.data.attributes.BonustoFortitudeDefense.value));
        }
    }
    return bonus;
}

export function _getEquipmentRefBonus(actorData) {
    let equipped = actorData.equipped;
    let bonus = -1;
    for (let item of equipped) {
        if (item.data.attributes.BonustoReflexDefense) {
            bonus = Math.max(bonus, parseInt(item.data.attributes.BonustoReflexDefense.value));
        }
    }
    return bonus;
}
