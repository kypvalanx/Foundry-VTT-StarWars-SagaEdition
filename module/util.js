#!/usr/bin/env node

import {SWSE} from "./config.js";
import {dieSize} from "./constants.js";

export function resolveValueArray(values, actor) {
    if (!Array.isArray(values)) {
        values = [resolveExpression(values, actor)];
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

        } else if (typeof value === 'string') {
            total += parseInt(value);
        } else if (typeof value === 'object') {
            total += parseInt(value.value);
        }
    }
    return total;
}

//test()

function test(){
    console.log("running tests...");
    console.log(5 === resolveExpression("MAX(1,5)", null))
    console.log(1 === resolveExpression("MIN(1,5)", null))
    console.log(8 === resolveExpression("MAX(1,5)+3", null))
    console.log(8 === resolveExpression("MAX(1,MAX(2,5))+3", null))
    console.log(1 === resolveExpression("1+2-3+5-4", null))
    console.log(-9 === resolveExpression("1+2-(3+5)-4", null))
    console.log(27 === resolveExpression("3*9", null))
    console.log(39 === resolveExpression("3+4*9", null))
    console.log(-24 === resolveExpression("-3*8", null))
    console.log(-24 === resolveExpression("3*-8", null))
}


function resolveFunction(expression, deepestStart, deepestEnd, func, actor) {
    let preceeding = expression.substring(0, deepestStart);
    if (preceeding.endsWith(func.name)) {
        let payload = expression.substring(deepestStart + 1, deepestEnd);
        let toks = payload.split(",").map(a => resolveExpression(a.trim(), actor));
        let result = func.function(toks);
        //let max = Math.max(...toks);
        return resolveExpression(expression.substring(0, deepestStart - func.name.length) + result + expression.substring(deepestEnd + 1), actor);

    }
}

function resolveFunctions(expression, deepestStart, deepestEnd, actor) {
    let functions = [{name: "MAX", function: a => Math.max(...a)},
        {name: "MIN", function: a => Math.min(...a)}];
    let result;
    for (let func of functions) {
        result = resolveFunction(expression, deepestStart, deepestEnd, func, actor);
        if(result){
            return result;
        }
    }
}

/**
 *
 * @param expression
 * @param actor {SWSEActor}
 */
function resolveParensAndFunctions(expression, actor){
    let depth = 0;
    let deepest = 0;
    let deepestStart = 0;
    let deepestEnd = 0;
    for(let index = 0; index < expression.length; index++){
        if(expression.charAt(index) === "("){
            depth++;
            if(depth > deepest){
                deepest = depth;
                deepestStart = index;
            }
        } else if(expression.charAt(index) === ")"){
            if(depth === deepest){
                deepestEnd = index;
            }
            depth--;
        }
    }
    let result = resolveFunctions(expression, deepestStart, deepestEnd, actor);
    if(result){
        return result;
    }
    // if(preceeding.endsWith("MIN")){
    //     let toks = expression.substring(deepestStart+1, deepestEnd).split(",").map(a => resolveExpression(a.trim(), actor));
    //     return Math.min(toks);
    // }
    return resolveExpression(expression.substring(0, deepestStart) + resolveExpression(expression.substring(deepestStart+1, deepestEnd), actor) + expression.substring(deepestEnd+1), actor);

}

/**
 *
 * @param expression
 * @param actor {SWSEActor}
 */
export function resolveExpression(expression, actor){
    if(!actor){
        console.warn("actor is null");
    }

    if(typeof expression === "number"){
        return expression;
    }
    if(expression.includes("(")){
        return resolveParensAndFunctions(expression, actor);
    }
    if(expression.includes("*") || expression.includes("/")){
        let raw = expression.replace(/\*/g, " * ").replace(/\//g, " / ").replace(/\+/g, " + ").replace(/-/g, " - ")
        let holder = null;
        while (raw !== holder) {
            holder = raw;
            raw = raw.replace(/  /g, " ");
        }
        let toks = raw.trim().split(" ");

        for(let i = 1; i < toks.length; i++){
            if(toks[i] === "*" || toks[i] === "/") {
                if(toks[i + 1] === "-"){
                    toks[i + 1] = "-" + toks[i + 2];
                    toks[i+2] = "";
                }
                if (toks[i] === "*") {
                    toks[i] = resolveExpression(toks[i - 1], actor) * resolveExpression(toks[i + 1], actor);
                    toks[i - 1] = "";
                    toks[i + 1] = "";
                    return resolveExpression(toks.join(""), actor)
                } else if (toks[i] === "/") {
                    toks[i] = resolveExpression(toks[i - 1], actor) / resolveExpression(toks[i + 1]);
                    toks[i - 1] = "";
                    toks[i + 1] = "";
                    return resolveExpression(toks.join(""), actor)
                }
            }
        }
    }

    if(expression.includes("+") || expression.includes("-")){
        let raw = expression.replace(/\+/g, " + ").replace(/-/g, " - ")
        let holder = null;
        while (raw !== holder) {
            holder = raw;
            raw = raw.replace(/  /g, " ");
        }
        let toks = raw.trim().split(" ");

        if(toks[0] === "-"){
            toks[0] = "";
            toks[1] = "-"+toks[1];
        }

        for(let i = 1; i < toks.length; i++){
            if(toks[i] === "+" || toks[i] === "-") {
                if (toks[i + 1] === "-") {
                    toks[i + 1] = "-" + toks[i + 2];
                    toks[i + 2] = "";
                }
                if (toks[i] === "+") {
                    toks[i] = resolveExpression(toks[i - 1], actor) + resolveExpression(toks[i + 1], actor);
                    toks[i - 1] = "";
                    toks[i + 1] = "";
                    return resolveExpression(toks.join(""), actor)
                } else if (toks[i] === "-") {
                    toks[i] = resolveExpression(toks[i - 1], actor) - resolveExpression(toks[i + 1], actor);
                    toks[i - 1] = "";
                    toks[i + 1] = "";
                    return resolveExpression(toks.join(""), actor)
                }
            }
        }

    }


    if(typeof expression === "string"){
        if(expression.startsWith("@")){
            let variable = actor.getVariable(expression);
            if (variable !== undefined) {
                return resolveExpression(variable, actor);
            }
        }else {
            return parseInt(expression);
        }
    }
    console.log(expression)
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

export function toBoolean(value){
    if (typeof value === "undefined") {
        return false;
    }
    if (value.value) {
        return toBoolean(value.value)
    }
    if (typeof value === "boolean") {
        return value;
    }

    if (typeof value === "number") {
        return value > 0;
    }

    return value.toLowerCase() === "true" || value.toLowerCase() === "t";

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

export function getRangeModifierBlock(range, accurate, innacurate, id) {
    if (range === 'Grenades') {
        range = 'Thrown Weapons'
    }

    let table = document.createElement("table");
    let thead = table.appendChild(document.createElement("thead"));
    let tbody = table.appendChild(document.createElement("tbody"));

    let firstHeader = thead.appendChild(document.createElement("tr"));
    let secondHeader = thead.appendChild(document.createElement("tr"));
    let radioButtons = tbody.appendChild(document.createElement("tr"));
    let selected = true;

    for (let [rangeName, rangeIncrement] of Object.entries(SWSE.Combat.range[range] || {})) {
        let rangePenaltyElement = SWSE.Combat.rangePenalty[rangeName];
        if (accurate && rangeName === 'short') {
            rangePenaltyElement = 0;
        }
        if (innacurate && rangeName === 'long') {
            continue;
        }
        let th1 = firstHeader.appendChild(document.createElement("th"));

        let r1Div = th1.appendChild(document.createElement("div"));
        r1Div.classList.add("swse", "padding-3", "center")
        r1Div.innerText = `${rangeName.titleCase()} (${rangePenaltyElement})`;

        let th2 = secondHeader.appendChild(document.createElement("th"));

        let rangeValue = th2.appendChild(document.createElement("div"));
        rangeValue.classList.add("swse", "padding-3", "center")
        rangeValue.innerText = `${rangeIncrement.string.titleCase()}`;

        let td = radioButtons.appendChild(document.createElement("td"));

        let radioButtonDiv = td.appendChild(td.appendChild(document.createElement("div")));
        radioButtonDiv.classList.add("swse", "center")

        let label = radioButtonDiv.appendChild(document.createElement("label"));
        label.setAttribute("for", `range-${rangeName}`);

        let input = radioButtonDiv.appendChild(document.createElement("input"));
        input.classList.add("modifier", "center", "swse", "attack-modifier");
        input.setAttribute("type", "radio");
        input.setAttribute("id", `range-${rangeName}`);
        input.setAttribute("name", `range-selection-${id}`);
        input.setAttribute("value", `${rangePenaltyElement}`);
        input.dataset.source = "Range Modifier";
        if (selected) {
            input.setAttribute("checked", true);
            selected = false;
        }
    }

    return table;
}

export function reduceArray(reduce, values) {
    if (!reduce) {
        return values;
    }
    switch (reduce.toUpperCase()) {
        case "SUM":
            return values.map(attr => toNumber(attr.value)).reduce((a, b) => a + b, 0);
        case "AND":
            return values.map(attr => toBoolean(attr.value)).reduce((a, b) => a && b, true);
        case "OR":
            return values.map(attr => toBoolean(attr.value)).reduce((a, b) => a || b, false);
        case "MAX":
            return values.map(attr => toNumber(attr.value)).reduce((a, b) => Math.max(a, b), 0);
        case "MIN":
            return values.map(attr => toNumber(attr.value)).reduce((a, b) => Math.min(a, b), 0);
        case "VALUES":
            return values.map(attr => attr.value);
        case "NUMERIC_VALUES":
            return values.map(attr => toNumber(attr.value));
        default:
            return values.map(attr => toNumber(attr.value)).reduce(reduce);
    }
}