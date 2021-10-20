import {dieSize} from "./swse.js";

export function resolveValueArray(values, actor) {
    if (!Array.isArray(values)) {
        values = [values];
    }
    let total = 0;
    for (let value of values) {
        if (typeof value === 'undefined') {

        } else if (typeof value === 'number') {
            total += value;
        } else if (typeof value === 'string' && value.startsWith("@")) {
            //ask Actor to resolve
            try {
                let variable = actor.getVariable(value);
                if (variable) {
                    total += resolveValueArray(variable, actor);
                }
            }
            catch(e){
                console.log("actor has not been initialised", e);
            }

        } else if (typeof value === 'string') {
            total += parseInt(value);
        } else if (typeof value === 'object') {
            total += parseInt(value.value);
        }
    }
    return total;
}

/**
 *
 * @param type
 * @param items
 * @returns {[SWSEItem]}
 */
export function filterItemsByType(items, type) {
    let types = [];
    types[0] = type;
    if (arguments.length > 2) {
        for (let i = 2; i < arguments.length; i++) {
            types[i - 1] = arguments[i];
        }
    }
    let filtered = [];
    for (let item of items) {
        if (types.includes(item.type) || types.includes(item.data.type)) {
            filtered.push(item);
        }
    }
    return filtered;
}
/**
 *
 * @param type
 * @param items
 * @returns {[SWSEItem]}
 */
export function excludeItemsByType(items, type) {
    let types = [];
    types[0] = type;
    if (arguments.length > 2) {
        for (let i = 2; i < arguments.length; i++) {
            types[i - 1] = arguments[i];
        }
    }
    let filtered = [];
    for (let item of items) {
        if (!types.includes(item.type)) {
            filtered.push(item);
        }
    }
    return filtered;
}

export function getBonusString(atkBonus) {
    return (atkBonus > 0 ? `+${atkBonus}` : (atkBonus < 0 ? `${atkBonus}` : ""));
}

export function getLongKey(key) {
    switch (key) {
        case 'str':
            return 'strength';
        case 'dex':
            return 'dexterity';
        case 'con':
            return 'constitution';
        case 'int':
            return 'intelligence';
        case 'wis':
            return 'wisdom';
        case 'cha':
            return 'charisma';
    }
    return undefined;
}

/**
 *
 * @param {string} attributeName
 */
export function toShortAttribute(attributeName) {
    switch (attributeName.toLowerCase()) {
        case 'strength':
            return 'STR';
        case 'dexterity':
            return 'DEX';
        case 'constitution':
            return 'CON';
        case 'wisdom':
            return 'WIS';
        case 'intelligence':
            return 'INT';
        case 'charisma':
            return 'CHA';
    }
}

export function increaseDamageDie(damageDieSize, bonus) {
    let index = dieSize.indexOf(damageDieSize);
    if (index === -1) {
        return undefined;
    }
    return dieSize[index + bonus];
}

export function toNumber(value) {
    if (Array.isArray(value)) {
        return value.reduce((a, b) => toNumber(a) + toNumber(b), 0)
    }

    if (typeof value === "undefined") {
        return 0;
    }
    if (value.value) {
        return toNumber(value.value)
    }
    if (typeof value === "boolean") {
        return value ? 1 : 0;
    }

    if (typeof value === "number") {
        return value;
    }

    let number = parseInt(value);
    if (isNaN(number)) {
        return 0;
    }

    return number;
}