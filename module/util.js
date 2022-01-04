import {dieSize} from "./swse.js";
import {SWSE} from "./config.js";

export function resolveValueArray(values, actor) {
    if (!Array.isArray(values)) {
        if(false) {
            //build parser here
            let raw = `${values}`.replace(/-/g, " - ").replace(/\+/g, " + ");
            let holder = null;
            while (raw !== holder) {
                holder = raw;
                raw = raw.replace(/  /g, " ");
            }
            raw = raw.replace(/ - /g, " + -");
            let values = raw.split(" + ");
        }

        values = [values];
    }
    let total = 0;
    for (let value of values) {
        if (!value) {
            continue;
        }
        if (typeof value === 'number') {
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

        } else if (typeof value === 'string' && value.startsWith("MAX(") && value.endsWith(")")) {

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
        case 'str':
            return 'STR';
        case 'dexterity':
        case 'dex':
            return 'DEX';
        case 'constitution':
        case 'con':
            return 'CON';
        case 'wisdom':
        case 'wis':
            return 'WIS';
        case 'intelligence':
        case 'int':
            return 'INT';
        case 'charisma':
        case 'cha':
            return 'CHA';
    }
}

export function increaseDamageDie(damageDieSize, bonus) {
    if(typeof damageDieSize === "string"){
        damageDieSize = parseInt(damageDieSize);
    }
    let index = dieSize.indexOf(damageDieSize);
    if (index === -1) {
        return 0;
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

/**
 * returns a list of attribute values from a given attribute
 * @param attribute {Object}
 * @param attribute.value {*}
 * @param source {String}
 * @returns {Array.<{source: String, value: String}>}
 */
export function extractAttributeValues(attribute, source) {
    let values = [];
    let value = attribute.value;
    if (value) {
        if (Array.isArray(value)) {
            for (let v of value) {
                values.push({source, value: v})
            }
        } else {
            values.push({source, value})
        }
    }
    return values
}

export function resolveRangeAttackModifier(effectiveRange, distance, accurate, inaccurate){
    let range = SWSE.Combat.range[effectiveRange];
    if(!range){
        return 0;
    }

    let resolvedRange = Object.entries(range).filter(entry => entry[1].low <=distance && entry[1].high >=distance)[0][0];

    if(resolvedRange === 'short range' && accurate){
        return 0;
    }

    if(resolvedRange === 'long range' && inaccurate){
        return "out of range";
    }

    return SWSE.Combat.rangePenalty[resolvedRange];
}

export function handleExclusiveSelect(e, selects) {
    let selected = {};
    for (let select of selects) {
        for (let o of select.options) {
            o.disabled = false
        }

        if (select.value) {
            selected[select.id] = select.value;
        }
    }
    for (let select of selects) {
        for (let entry of Object.entries(selected)) {
            if (select.id !== entry[0]) {
                for (let o of select.options) {
                    if (o.value === entry[1]) {
                        o.disabled = true
                    }
                }
            }
        }
    }
}


export function handleAttackSelect(selects) {
    let selectedValuesBySelect = {};
    let availableDoubleAttacks = [];
    let availableTripleAttacks = [];
    for (let select of selects) {
        for (let o of select.options) {
            o.disabled = false
        }

        if (select.value) {
            selectedValuesBySelect[select.id] = select.value;
            if(select.value !== "--") {
                let selected = JSON.parse(select.value)
                availableDoubleAttacks.push(selected.itemId);
                if (selected.mods === "doubleAttack") {
                    availableTripleAttacks.push(selected.itemId);
                }
            }
        }
    }
    availableDoubleAttacks = availableDoubleAttacks.filter((value, index, self) => self.indexOf(value) === index)
    availableTripleAttacks = availableTripleAttacks.filter((value, index, self) => self.indexOf(value) === index)

    //disable options in other selects that match a selected select
    for (let select of selects) {
        for (let entry of Object.entries(selectedValuesBySelect)) {
            if (select.id !== entry[0]) {
                for (let o of select.options) {
                    if (o.value !== "--" && o.value === entry[1]) {
                        o.disabled = true
                    }
                }
            }
        }

        for (let o of select.options) {
            if(o.value !== "--"){
                let selected = JSON.parse(o.value);
                if (selected.mods === "doubleAttack" && !availableDoubleAttacks.includes(selected.itemId)){
                    o.disabled = true
                }
                if (selected.mods === "tripleAttack" && !availableTripleAttacks.includes(selected.itemId)){
                    o.disabled = true
                }
            }
        }

    }
}

export function getOrdinal(i) {
    switch (i) {
        case 1:
            return "primary";
        case 2:
            return "secondary";
        case 3:
            return "tertiary";
        case 4:
            return "quaternary";
        case 5:
            return "quinary";
        case 6:
            return "senary";
        case 7:
            return "septenary";
        case 8:
            return "octonary";
        case 9:
            return "nonary";
        case 10:
            return "denary";
    }
    return `${i}`
}

export function getRangedAttackMod(range, isAccurate, isInaccurate, actor) {
    let targets = Array.from(game.user.targets); //get targeted tokens

    let sources = Object.values(canvas.tokens.controlled).filter(token => token.data.actorId === actor.id); //get selected tokens of this actor
    if (sources.length === 0) {
        sources = canvas.tokens.objects.children.filter(token => token.data.actorId === actor.id);
    }

    let rangedAttackModifier;
    if (sources.length > 0 && targets.length > 0) {
        if (sources.length > 1 || targets.length > 1) {
            console.warn("found too many selected targets or resolved too many sources");
        }
        let source = sources[0];
        let target = targets[0];
        let distance = getTokenDistanceInSquares(source, target)

        rangedAttackModifier = resolveRangeAttackModifier(range, distance, isAccurate, isInaccurate)
    }
    return rangedAttackModifier;
}

export function getTokenDistanceInSquares(source, target) {
    let xDiff = Math.abs(source.x - target.x);
    let yDiff = Math.abs(source.y - target.y);
    let squareSize = source.scene.dimensions.size;

    return Math.max(xDiff, yDiff) / squareSize;
}