#!/usr/bin/env node

import {SWSE} from "./config.js";
import {dieSize, dieType} from "./constants.js";
import {SWSEActor} from "./actor/actor.js";
import {SWSEItem} from "./item/item.js";
import {meetsPrerequisites} from "./prerequisite.js";
import {SWSEActiveEffect} from "./active-effect/active-effect.js";

export function unique(value, index, self) {
    return self.indexOf(value) === index;
}

export function resolveValueArray(values, actor, options) {
    if (!Array.isArray(values)) {
        values = [values];
    }
    let total = 0;
    let multiplier = 1;
    for (let value of values) {
        if (!value) {
            continue;
        }
        if (`${value}`.startsWith("\*")) {
            multiplier *= resolveExpression(value.substring(1, value.length), actor, options)
        } else if (`${value}`.startsWith("/")) {
            multiplier /= resolveExpression(value.substring(1, value.length), actor, options)
        } else {
            const result = resolveExpression(value, actor, options);
            if(typeof result !== 'number'){
                if(total === 0){
                    total = "";
                } else {
                    total += " + ";
                }
            }
            total += result;
        }
    }
    if(typeof total === 'number'){
        return total * multiplier;
    }
    return total + (multiplier === 1 ? "" : " * " + multiplier)
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
        if (!!result) {
            return result;
        }
    }
}

/**
 *
 * @param expression
 * @param actor {SWSEActor}
 */
function resolveParensAndFunctions(expression, actor) {
    let depth = 0;
    let deepest = 0;
    let deepestStart = 0;
    let deepestEnd = 0;
    for (let index = 0; index < expression.length; index++) {
        if (expression.charAt(index) === "(") {
            depth++;
            if (depth > deepest) {
                deepest = depth;
                deepestStart = index;
            }
        } else if (expression.charAt(index) === ")") {
            if (depth === deepest) {
                deepestEnd = index;
            }
            depth--;
        }
    }
    let result = resolveFunctions(expression, deepestStart, deepestEnd, actor);
    if (!!result) {
        return result;
    }
    if (deepestStart > deepestEnd) {
        return;
    }
    return resolveExpression(expression.substring(0, deepestStart) + resolveExpression(expression.substring(deepestStart + 1, deepestEnd), actor) + expression.substring(deepestEnd + 1), actor);

}

function resolveComparativeExpression(expression, actor) {
    let raw = expression.replace(/>/g, " > ").replace(/</g, " < ").replace(/=/g, " = ")
    let holder = null;
    while (raw !== holder) {
        holder = raw;
        raw = raw.replace(/  /g, " ");
    }
    let toks = raw.trim().split(" ");
    if (toks.length !== 3) {
        console.error("this kind of expression only accepts 2 terms and an operator");
    }

    for (let i = 1; i < toks.length; i++) {
        if (toks[i] === ">" || toks[i] === "<" || toks[i] === "=") {
            const first = resolveExpression(toks[i - 1], actor);
            const second = resolveExpression(toks[i + 1], actor);
            if (toks[i] === ">") {
                return first > second
            } else if (toks[i] === "<") {
                return first < second
            }
            return first === second
        }
    }
}

function resolveMultiplicativeExpression(expression, actor) {
    let raw = expression.replace(/\*/g, " * ").replace(/\//g, " / ").replace(/\+/g, " + ").replace(/-/g, " - ")
    let holder = null;
    while (raw !== holder) {
        holder = raw;
        raw = raw.replace(/  /g, " ");
    }
    let toks = raw.trim().split(" ");

    for (let i = 1; i < toks.length; i++) {
        if (toks[i] === "*" || toks[i] === "x" || toks[i] === "/") {
            if (toks[i + 1] === "-") {
                toks[i + 1] = "-" + toks[i + 2];
                toks[i + 2] = "";
            }
            const first = resolveExpression(toks[i - 1], actor);
            const second = resolveExpression(toks[i + 1], actor);
            if (toks[i] === "*" || toks[i] === "x") {
                toks[i] = first * second;
            } else {
                toks[i] = first / second;
            }
            toks[i - 1] = "";
            toks[i + 1] = "";
            return resolveExpression(toks.join(""), actor)
        }
    }
}

function resolveAdditiveExpression(expression, actor) {
    let raw = expression.replace(/\+/g, " + ").replace(/-/g, " - ")
    let holder = null;
    while (raw !== holder) {
        holder = raw;
        raw = raw.replace(/ +/g, " ");
    }
    let tokens = raw.trim().split(" ");
    if (tokens[0] === "-") {
        tokens[1] = "-" + tokens[1];
        tokens[0] = "";
    }
    //
    // if (tokens[0] === "+") {
    //     tokens[0] = "";
    // }

    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i] === "+" || tokens[i] === "-") {
            if (tokens[i + 1] === "-") {
                tokens[i + 1] = "-" + tokens[i + 2];
                tokens[i + 2] = "";
            }
            const first = resolveExpression(tokens[i - 1], actor);
            const second = resolveExpression(tokens[i + 1], actor);
            if (tokens[i] === "+") {
                tokens[i] = first + second;
            } else {
                tokens[i] = first - second;
            }
            tokens[i - 1] = "";
            tokens[i + 1] = "";
            return resolveExpression(tokens.join(""), actor)
        }
    }
}

/**
 *
 * @param expression
 * @param actor {SWSEActor}
 */
export function resolveExpression(expression, actor) {
    if (!expression) {
        return 0;
    }
    if (typeof expression === 'object') {
        return resolveExpression(expression.value, actor);
    }
    if (typeof expression === "number") {
        return expression;
    }
    if (expression.includes("(")) {
        return resolveParensAndFunctions(expression, actor);
    }

    //exponents would be evaluated here if we wanted to do that.

    if (expression.includes("*") || expression.includes("/")) {
        return resolveMultiplicativeExpression(expression, actor);
    }

    if (expression.includes("+") || expression.substring(1).includes("-")) {
        return resolveAdditiveExpression(expression, actor);
    }

    if (expression.includes(">") || expression.includes("<") || expression.includes("=")) {
        return resolveComparativeExpression(expression, actor);
    }

    if (typeof expression === "string") {
        if (expression.startsWith("@")) {
            if(!!actor){
                let variable = getVariableFromActorData(actor, expression);
                if (variable !== undefined) {
                    return resolveExpression(variable, actor);
                }
            }
            return expression;
        } else if(diePattern.test(expression)){
            return expression;
        }else {
            return toNumber(expression);
        }
    }

}

export function getVariableFromActorData(swseActor, variableName) {
    if (!swseActor?.resolvedVariables) {
        return undefined;
    }

    let value = swseActor.resolvedVariables?.get(variableName);
    if (value === undefined) {
        console.warn("could not find " + variableName, swseActor.resolvedVariables);
    }
    return value;
}

/**
 *
 * @param type {string|[string]}
 * @param items {[SWSEItem]}
 * @returns {[SWSEItem]}
 */
export function filterItemsByType(items, type) {
    let types = [];
    if (Array.isArray(type)) {
        types = type;
    } else {
        if (arguments.length > 1) {
            for (let i = 1; i < arguments.length; i++) {
                types[i - 1] = arguments[i];
            }
        }
    }
    let filtered = [];
    for (let item of items) {
        if (types.includes(item.type)) {// || types.includes(item.data.type)) {
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
    const stringify = `${atkBonus}`;
    if (stringify === "0" || stringify === "") {
        return "";
    }
    if (stringify.startsWith("-") || stringify.startsWith("+")) {
        return stringify;
    }
    return `+${atkBonus}`
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


/**
 *
 * @param die {string}
 * @param bonus {number}
 * @returns {string}
 */
export function increaseDieType(die, bonus = 0) {
    let size;
    let quantity;
    die = `${die}`;
    if (die === "1") {
        quantity = "1"
        size = "1"
    } else if (die.includes("d")) {
        let toks = die.split("d");
        quantity = toks[0].trim();
        size = toks[1].trim();
    }
    let index = dieType.indexOf(`${size}`);
    if (index === -1) {
        return "0";
    }
    size = dieType[index + bonus];
    if (size === "1") {
        return quantity;
    }
    return `${quantity}d${size}` || "0";
}

/**
 *
 * @param die {string}
 * @param bonus {number}
 * @returns {string}
 */
export function increaseDieSize(die, bonus) {
    let index = dieSize.indexOf(`${die}`);
    if (index === -1) {
        return "0";
    }
    return dieSize[index + bonus] || "0";
}

export function toBoolean(value) {
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

    if (typeof value === "undefined" || value === null) {
        return 0;
    }
    if (typeof value === "object") {
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
        return value;
    }

    return number;
}

export function resolveAttackRange(effectiveRange, distance, accurate, inaccurate) {
    let range = SWSE.Combat.range[effectiveRange];
    if (!range) {
        return 0;
    }

    //TODO add homebrew option for a range multiplier here

    let resolvedRange = Object.entries(range).filter(entry => entry[1].low <= distance && entry[1].high >= distance)[0][0];

    if (resolvedRange === 'short' && accurate) {
        return "point-blank";
    }

    if (resolvedRange === 'long' && inaccurate) {
        return "out of range";
    }

    return resolvedRange;
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

    let hasStandard = false;
    let hasDoubleAttack = false;
    let hasTripleAttack = false;

    for (let select of selects) {
        for (let o of select.options) {
            o.disabled = false
        }

        if (select.value) {
            selectedValuesBySelect[select.id] = select.value;
            if (select.value !== "--") {
                let selected = JSON.parse(unescape(select.value))

                if (selected.options.standardAttack) {
                    hasStandard = true;
                }
                if (selected.options.doubleAttack) {
                    hasDoubleAttack = true;
                }
                if (selected.options.tripleAttack) {
                    hasTripleAttack = true;
                }
            }
        }
    }
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

        let selectValue = select.value !== "--" ? JSON.parse(unescape(select.value)) : {options: {}};
        for (let o of select.options) {
            if (o.value !== "--" && !o.selected) {
                let selected = JSON.parse(unescape(o.value));

                //disable this doubleattack option if no standard attacks have been selected or we already have a double attack and it's not the current selection of this select box
                if (selected.options.doubleAttack && (!hasStandard || (hasDoubleAttack && !selectValue.options.doubleAttack))) {
                    o.disabled = true
                }
                //disable this triple attack option if no double attacks have been selected or we already have a triple attack and it's not the current selection of this select box or if this select is currently selecting a double attack.
                if (selected.options.tripleAttack && (!hasDoubleAttack || (hasTripleAttack && !selectValue.options.tripleAttack) || selectValue.options.doubleAttack)) {
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

export function getAttackRange(range, isAccurate, isInaccurate, actor) {
    let targets = Array.from(game.user.targets); //get targeted tokens

    let sources = Object.values(canvas.tokens.controlled).filter(token => token.document.actorId === (actor._id || actor.id)) || []; //get selected tokens of this actor
    if (sources.length === 0) {
        sources = canvas.tokens.objects?.children.filter(token => token.document.actorId === (actor?._id || actor?.id)) || [];
    }

    let attackRange;
    if (sources.length > 0 && targets.length > 0) {
        if (sources.length > 1 || targets.length > 1) {
            console.warn("found too many selected targets or resolved too many sources");
        }
        let source = sources[0];
        let target = targets[0];
        let distance = getTokenDistanceInSquares(source, target)

        attackRange = resolveAttackRange(range, distance, isAccurate, isInaccurate)
    }
    return attackRange;
}

export function getTokenDistanceInSquares(source, target) {
    let xDiff = Math.abs(source.x - target.x);
    let yDiff = Math.abs(source.y - target.y);
    let squareSize = source.scene.dimensions.size;

    return Math.max(xDiff, yDiff) / squareSize;
}

export function getRangeModifierBlock(range, accurate, innacurate, id, defaultValue) {
    if (range === 'Grenades') {
        range = 'Thrown Weapons'
    }

    let table = document.createElement("table");
    let thead = table.appendChild(document.createElement("thead"));
    let tbody = table.appendChild(document.createElement("tbody"));

    let firstHeader = thead.appendChild(document.createElement("tr"));
    let secondHeader = thead.appendChild(document.createElement("tr"));
    let radioButtons = tbody.appendChild(document.createElement("tr"));
    let selected = !defaultValue;

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
        if (selected || rangeName === defaultValue) {
            input.setAttribute("checked", true);
            selected = false;
        }
    }

    return table;
}

const ATTRIBUTE_RESOLUTION_ORDER = [CONST.ACTIVE_EFFECT_MODES.ADD, CONST.ACTIVE_EFFECT_MODES.DOWNGRADE, CONST.ACTIVE_EFFECT_MODES.UPGRADE, CONST.ACTIVE_EFFECT_MODES.MULTIPLY, CONST.ACTIVE_EFFECT_MODES.OVERRIDE, 6];

const quantityPattern = new RegExp('(.+):(.+)');
const diePattern = new RegExp('(\\d+)d(\\d+)');

function resolveValue(a) {
    if(a === undefined){
        return [];
    }
    if(Array.isArray(a)){
        let values = [];
        for(const b of a){
            values.push(...resolveValue(b));
        }
        return values;
    }
    a = !!a.value ? a.value : a;
    // if(typeof a === 'number'){
    //     return [{value:a}]
    // }
    if (typeof a === 'string') {
        const toks = a.replace(/-/g, " - ").replace(/\+/g, " + ").split(" ")

        let results = [];

        let negMult = 1;
        for (const tok of toks) {
            if('-' === tok){
                negMult = -1;
                continue;
            }
            if('+' === tok){
                continue;
            }
            if (quantityPattern.test(tok)) {
                let result = quantityPattern.exec(tok);
                let resolved = resolveValue(result[2])
                resolved.forEach(res => res.item = result[1])
                results.push(...resolved)
                negMult = 1
            } else if (diePattern.test(tok)) {
                let result = diePattern.exec(tok);
                results.push({value: negMult*toNumber(result[1]), sides: toNumber(result[2])})
                negMult = 1
            } else {
                const num = toNumber(tok);
                if(typeof num === 'number'){
                    results.push({value: negMult*num})
                } else {
                    results.push({value:num})
                }
                negMult = 1
            }
        }
        return results;
    }
    return [{value: a}]
}

function addValues(a, b) {
    let terms = resolveValue(a);
    terms.push(...resolveValue(b));

    let summedTerms = {};
    for (const term of terms) {
        const groupId = term.item || "default"
        const i = typeof term.value === 'string' && term.value.startsWith("@") ? -1 : term.sides || 0;
        summedTerms[groupId] = summedTerms[groupId] || [];
        let group = summedTerms[groupId];

        let sum = group[i] || (typeof term.value === "number" ? 0 : "");
        if(typeof sum === 'string' && sum.length > 0 && term.value.startsWith("@")){
            sum += " + "
        }
        group[i] = sum + term.value;
    }

    let singleResponse = true;
    let responses = [];

    for(let summedTerm of Object.entries(summedTerms)){
        if(summedTerm[0] !== 'default'){
            singleResponse = false;
        }
        const currentTerm = summedTerm[1];
        let response = currentTerm.length ===1 && typeof currentTerm[0] === 'number'? 0 : "";

        for(let i = currentTerm.length-1; i>-2; i--){
            if(!currentTerm[i]){
                continue;
            }
            if(i < currentTerm.length-1){
                response += " + "
            }
            response+=currentTerm[i];
            if( i>0){
                response += `d${i}`;
            }
            if(summedTerm[0] !== 'default'){
                response = summedTerm[0] + ":" + response;
            }
        }

        if(response){
            responses.push(response)
        }
    }


    if(singleResponse){
        return responses[0];
    }
return responses;
}

function multiplyValues(currentValue, multiplier) {
    multiplier = parseInt(multiplier);
    let terms = resolveValue(currentValue);

    let summedTerms = [];
    for (const term of terms) {
        const i = term.sides || 0;
        let sum = summedTerms[i] || (typeof term.value === "number" ? 0 : "");
        if(typeof sum === 'string' && sum !== ""){

            summedTerms[i] = sum + " " + term.value;
        } else {
            summedTerms[i] = sum + term.value;
        }
    }

    let response = summedTerms.length ===1 && typeof summedTerms[0] === 'number'? 0 : "";

    for(let i = summedTerms.length-1; i>-1; i--){
        if(!summedTerms[i]){
            continue;
        }
        if(i < summedTerms.length-1){
            response += " + "
        }
        if(typeof summedTerms[i] === 'number' && typeof multiplier === 'number'){
            response+=summedTerms[i] * multiplier;
        } else {
            response+=summedTerms[i];
        }
        if( i>0){
            response += `d${i}`;
        }
    }

    return response;
}

function reduceValue(terms) {
    let response = 0;
    for (const term of terms) {
        const i = term.sides || 1;
        response += i * term.value;
    }
    return response;
}

function downgradeValues(a, b) {
    let aReduced = reduceValue(resolveValue(a));
    let bReduced = reduceValue(resolveValue(b));
    if(aReduced === Math.min(aReduced, bReduced))
    {return a}return b;
}
function upgradeValues(a, b) {
    let aReduced = reduceValue(resolveValue(a));
    let bReduced = reduceValue(resolveValue(b));
    if(aReduced === Math.max(aReduced, bReduced))
    {return a}return b;
}

function resolveExpressionReduce(values, actor) {
    const resolutionSorting = {};
    for (const value of values) {
        const priority = value.priority || 1;
        resolutionSorting[priority] = resolutionSorting[priority] || {};
        const mode = value.mode || 2;
        resolutionSorting[priority][mode] = resolutionSorting[priority][mode] || [];
        value.value = resolveExpression(value, actor)
        resolutionSorting[priority][mode].push(value)
    }

    let currentValue = 0;
    let priorities = Object.keys(resolutionSorting).sort();
    for (const priority of priorities) {
        let z = resolutionSorting[priority];
        for (const mode of ATTRIBUTE_RESOLUTION_ORDER) {
            for (const value of z[mode] || []) {
                switch (mode) {
                    case CONST.ACTIVE_EFFECT_MODES.ADD:
                        currentValue = addValues(currentValue, value.value);
                        break;
                    case CONST.ACTIVE_EFFECT_MODES.DOWNGRADE:
                        currentValue = downgradeValues(currentValue, value.value);
                        break;
                    case CONST.ACTIVE_EFFECT_MODES.UPGRADE:
                        currentValue = upgradeValues(currentValue, value.value);
                        break;
                    case CONST.ACTIVE_EFFECT_MODES.MULTIPLY:
                        currentValue = multiplyValues(currentValue, value.value);
                        break;
                    case CONST.ACTIVE_EFFECT_MODES.OVERRIDE:
                        currentValue = value.value;
                        break;
                    case 6:
                        currentValue += " X "+value.value;
                        break;
                }
            }
        }
    }
    return currentValue;
}

function getValueSize(value) {
    if (typeof value === 'string' && value.includes("d")) {
        let toks = value.split("d")
        return toNumber(toks[0]) * toNumber(toks[1]);
    } else {
        return toNumber(value);
    }
}

function maxValue(values, actor) {
    return values.map(attr => resolveValueArray(attr.value, actor)).reduce((a, b) => {
        let sub = {};
        sub[getValueSize(a)] = a;
        sub[getValueSize(b)] = b;
        return sub[a === undefined ? b : Math.max(a, b)];
    }, undefined);
}

function minValue(values, actor) {
    return values.map(attr => resolveValueArray(attr.value, actor)).reduce((a, b) => {
        let sub = {};
        sub[getValueSize(a)] = a;
        sub[getValueSize(b)] = b;
        return sub[a === undefined ? b : Math.min(a, b)];
    }, undefined);
}

export function reduceArray(reduce, values, actor) {
    if (!reduce) {
        return values;
    }
    if (!Array.isArray(values)) {
        values = [values];
    }
    if (Array.isArray(reduce) && !reduce.includes("MAPPED")) {
        for (let r of reduce) {
            values = reduceArray(r, values, actor);
        }
        return values;
    }

    if (typeof reduce === "string") {
        reduce = reduce.toUpperCase();
    }

    if (Array.isArray(reduce) && reduce.includes("MAPPED")) {
        let reduction = {};
        for (let r of reduce) {
            reduction[r] = reduceArray(r, values, actor);
        }
        return reduction;
    }

    switch (reduce) {
        case "EXPRESSION":
        case "SUM":
            return resolveExpressionReduce(values, actor);
        case "AND":
            return values.map(attr => toBoolean(attr.value)).reduce((a, b) => a && b, true);
        case "OR":
            return values.map(attr => toBoolean(attr.value)).reduce((a, b) => a || b, false);
        case "MAX":
            return maxValue(values, actor);
        case "MIN":
            return minValue(values, actor);
        case "FIRST":
            let map = values.map(attr => attr.value);
            if (map.length > 0) {
                return map[0];
            }
            return undefined;
        case "VALUES":
            return values.map(attr => attr.value);
        case "VALUES_TO_LOWERCASE":
            return values.map(attr => attr.value.toLowerCase());
        case "UNIQUE":
            return values.filter(unique);
        case "NUMERIC_VALUES":
            return values.map(attr => toNumber(attr.value));
        case "SUMMARY":
            let summary = "";
            values.forEach(value => summary += `${value.sourceString}: ${value.value};  `)
            return summary;
        case "MAPPED":
            return values;
        default:
            return values.map(attr => attr.value).reduce(reduce, "");
    }
}

/**
 *
 * @param type
 * @returns {CompendiumCollection}
 */
export function getCompendium(item) {
    if (item.pack) {
        return game.packs.find(pack => pack.collection.startsWith(item.pack));
    }
    switch (item.type.toLowerCase()) {
        case 'item':
            return game.packs.find(pack => pack.collection.startsWith("swse.items"));
        case 'trait':
            return game.packs.find(pack => pack.collection.startsWith("swse.traits"));
        case 'feat':
            return game.packs.find(pack => pack.collection.startsWith("swse.feats"));
        case 'species':
            return game.packs.find(pack => pack.collection.startsWith("swse.species"));
        case 'talent':
            return game.packs.find(pack => pack.collection.startsWith("swse.talents"));
        case 'vehicletemplate':
            return game.packs.find(pack => pack.collection.startsWith("swse.vehicle templates"));
        case 'vehiclebasetype':
            return game.packs.find(pack => pack.collection.startsWith("swse.vehicle base types"));
        case 'vehiclesystem':
            return game.packs.find(pack => pack.collection.startsWith("swse.vehicle systems"));
        case 'template':
            return game.packs.find(pack => pack.collection.startsWith("swse.templates"));
        case 'affiliation':
            return game.packs.find(pack => pack.collection.startsWith("swse.affiliations"));
        case 'class':
            return game.packs.find(pack => pack.collection.startsWith("swse.classes"));
        case 'forceregimen':
            return game.packs.find(pack => pack.collection.startsWith("swse.force regimens"));
        case 'forcepower':
            return game.packs.find(pack => pack.collection.startsWith("swse.force powers"));
        case 'forcesecret':
            return game.packs.find(pack => pack.collection.startsWith("swse.force secrets"));
        case 'forcetechnique':
            return game.packs.find(pack => pack.collection.startsWith("swse.force techniques"));
        case 'beasttype':
            return game.packs.find(pack => pack.collection.startsWith("swse.beast components"));
        case 'background':
            return game.packs.find(pack => pack.collection.startsWith("swse.background"));
        case 'destiny':
            return game.packs.find(pack => pack.collection.startsWith("swse.destiny"));
        case 'language':
            return game.packs.find(pack => pack.collection.startsWith("swse.languages"));
    }
}


export async function getIndexAndPack(indices, item) {

    let compendiumReference = item.pack || item.type;
    let index = indices[compendiumReference];
    let pack = getCompendium(item);
    if (!pack) {
        console.error(`${compendiumReference} compendium not defined`)
        return {}
    }
    if (!index) {
        index = await pack.getIndex();
        indices[compendiumReference] = index;
    }
    return {index, pack};
}

export function getEntityFromCompendiums(type, id) {
    let packs = game.packs.filter(pack => pack.metadata.type === type);

    for (let pack of packs) {
        //let index = await pack.getIndex();
        let entity = pack.get(id)///.find(thing => thing._id === id);

        //let entity = await pack.getDocument(id)
        if (entity) {
            return entity;
        }
    }
}

/**
 *
 * @param args [[string]]
 */
export function innerJoin(...args) {
    let response = args[0];
    for (let i = 1; i < args.length; i++) {
        response = response.filter(r => args[i].includes(r))
    }
    return response;
}

/**
 *
 * @param args [[string]]
 */
export function fullJoin(...args) {
    let response = args[0];
    for (let i = 1; i < args.length; i++) {
        response = response.concat(args[i]);
    }
    return response;
}


/**
 * accepts an actor, item, or effect.  returns embeded entities that may have changes.
 * @param entity
 * @returns {*|*[]}
 */
export function equippedItems(entity) {
    let entities = [];
    if (entity.effects) {
        entities.push(...entity.effects?.filter(effect => !effect.disabled) || []);
    }
    if (entity.system?.equippedIds && entity.items) {
        let equippedIds = entity.system.equippedIds?.map(equipped => equipped.id) || []
        entities.push(...entity.items?.filter(item => equippedIds.includes(item?.id || item?._id)) || []);
    }
    return entities;
}

export function getItemParentId(id) {
    let a = []//game.data.actors || []
    let b = game.actors?.values() || []

    let actors = [...a, ...b];
    let actor = actors.find(actor => actor.items.find(item => item._id === id))
    return !actor ? undefined : actor._id// || actor.data._id;
}

/**
 * these types are always inherited by actors if they meet prerequisites.
 * @type {string[]}
 */
const CONDITIONALLY_INHERITABLE_TYPES = ["background", "destiny", "trait", "feat", "talent", "forcePower", "secret", "forceTechnique", "affiliation", "regimen", "species", "class", "vehicleBaseType", "beastAttack",
    "beastSense",
    "beastType",
    "beastQuality"];

export function inheritableItems(entity) {
    let fn = () => {
        let possibleInheritableItems = equippedItems(entity);
        if (entity instanceof SWSEItem || entity instanceof SWSEActiveEffect) {
            return possibleInheritableItems;
        }

        possibleInheritableItems.push(...filterItemsByType(entity.items || [], CONDITIONALLY_INHERITABLE_TYPES));

        let actualInheritable = [];
        let shouldRetry = possibleInheritableItems.length > 0;
        while (shouldRetry) {
            shouldRetry = false;
            for (let possible of possibleInheritableItems) {
                if (!possible.system?.prerequisite || !meetsPrerequisites(entity, possible.system.prerequisite, {
                    embeddedItemOverride: actualInheritable,
                    existingTraitPrerequisite: possible.type === "trait"
                }).doesFail) {
                    actualInheritable.push(possible);
                    shouldRetry = true;
                }
            }
            possibleInheritableItems = possibleInheritableItems.filter(possible => !actualInheritable.includes(possible));
        }

        return actualInheritable;
    }

    return entity.getCached ? entity.getCached("inheritableItems", fn) : fn();
}

test()

//test()

function assertEquals(expected, actual) {
    if (expected === actual) {
        console.log("passed")
    } else {
        console.warn(`expected "${expected}", but got "${actual}"`)
    }
}

function test() {

    console.log("running util tests...");
    const ADD = CONST.ACTIVE_EFFECT_MODES.ADD
    const MULTIPLY = CONST.ACTIVE_EFFECT_MODES.MULTIPLY
    const UPGRADE = CONST.ACTIVE_EFFECT_MODES.UPGRADE
    const DOWNGRADE = CONST.ACTIVE_EFFECT_MODES.DOWNGRADE
    const OVERRIDE = CONST.ACTIVE_EFFECT_MODES.OVERRIDE
    const CUSTOM = CONST.ACTIVE_EFFECT_MODES.CUSTOM
    const POST_ROLL_MULTIPLY = 6;

    assertEquals("1d10 + 2d8 + 3d6 + 1", addValues("1d6+2d8+1d10", "2d6 +1"))
    assertEquals(7, addValues(4, 3));
    assertEquals(7, addValues(3, 4));
    assertEquals("HelloWorld", addValues("Hello", "World"))
    assertEquals(13, addValues(7, {value: 6}))
    assertEquals("2d6", addValues("1d6", "1d6"))
    assertEquals("1d6 + 4", addValues(4, "1d6"))
    assertEquals("1d6 + 2", addValues("1d6", 2))

    assertEquals(2, multiplyValues(1, 2))
    assertEquals("2d6", multiplyValues("1d6", 2))
    assertEquals("4d8 + 2d6", multiplyValues("1d6 + 2d8", 2))
    assertEquals("HELLO WORLD", multiplyValues("HELLO WORLD", 2))


    assertEquals(0, resolveExpressionReduce([], {}))
    assertEquals(5, resolveExpressionReduce([{value: 5, mode: ADD}], {}))
    assertEquals("5 + @WISMOD", resolveExpressionReduce([{value: 5, mode: ADD}, {value: "@WISMOD", mode: ADD}], {}))
    assertEquals("5 + @WISMOD + @WISMOD", resolveExpressionReduce([{value: 5, mode: ADD}, {value: "@WISMOD", mode: ADD}, {value: "@WISMOD", mode: ADD}], {}))
    assertEquals(0, resolveExpressionReduce([{value: 5, mode: MULTIPLY}], {}))
    assertEquals(25, resolveExpressionReduce([{value: 5, mode: ADD}, {value: 5, mode: MULTIPLY}], {}))
    assertEquals(7, resolveExpressionReduce([{value: 5, mode: ADD}, {value: 7, mode: UPGRADE}], {}))
    assertEquals(5, resolveExpressionReduce([{value: 5, mode: ADD}, {value: 3, mode: UPGRADE}], {}))
    assertEquals("1d8", resolveExpressionReduce([{value: 5, mode: ADD}, {value: "1d8", mode: UPGRADE}], {}))
    //assertEquals("5d8 + 3d6", resolveExpressionReduce([{value: "2d6 + 5d8 + 1d6", mode: ADD}, {value: "1d8", mode: UPGRADE}], {}))
    assertEquals(5, resolveExpressionReduce([{value: 5, mode: ADD}, {value: 7, mode: DOWNGRADE}], {}))
    assertEquals(3, resolveExpressionReduce([{value: 5, mode: ADD}, {value: 3, mode: DOWNGRADE}], {}))
    assertEquals(13, resolveExpressionReduce([{value: 5, mode: ADD, priority: -1}, {
        value: 5,
        mode: ADD,
        priority: 2
    }, {value: 3, mode: 2}], {}))
    assertEquals(8, resolveExpressionReduce([{value: 50, mode: MULTIPLY, priority: -1}, {
        value: 5,
        mode: ADD,
        priority: 2
    }, {value: 3, mode: 2}], {}))


    assertEquals(`["ammo:155"]`, JSON.stringify(resolveExpressionReduce([{value: "ammo:100", mode: ADD},{value: "ammo:55", mode: ADD}], {})))
    assertEquals(`["ammo:100","ammo2:55"]`, JSON.stringify(resolveExpressionReduce([{value: "ammo:100", mode: ADD},{value: "ammo2:55", mode: ADD}], {})))



    assertEquals(5, resolveWeight("5", 1, 5))
    assertEquals(5, resolveWeight("5 kg", 1, 5))
    assertEquals(5, resolveWeight("5 KG", 1, 5))
    assertEquals(5, resolveWeight("5 KiloGrams", 1, 5))
    assertEquals(5000, resolveWeight("5 Ton", 1, 5))
    assertEquals(5, resolveWeight(5, 1, 5))
    assertEquals(15, resolveWeight(5, 3, 5))
    assertEquals(0, resolveWeight(5, 0, 5))
    assertEquals(200, resolveWeight("(40 x Cost Factor) kg", 1, 5))

    //console.log(resolveExpression("MAX(@WISMOD,@CHAMOD)", null, null))
    assertEquals(12, resolveValueArray(["2", 4, "*2"], null))
    assertEquals(2, resolveValueArray(["+2"], null))
    assertEquals(24, resolveValueArray(["2", 4, "*2", "*4", "/2"], null))

    assertEquals(2, resolveExpression("+2", null))
    assertEquals(-5, resolveExpression("-5", null))
    assertEquals(-10, resolveExpression("-5-5", null))
    assertEquals(0, resolveExpression("-5--5", null))
    assertEquals(5, resolveExpression("MAX(1,5)", null))
    assertEquals(1, resolveExpression("MIN(1,5)", null))
    assertEquals(8, resolveExpression("MAX(1,5)+3", null))
    assertEquals(8, resolveExpression("MAX(1,MAX(2,5))+3", null))
    assertEquals(1, resolveExpression("1+2-3+5-4", null))
    assertEquals(-9, resolveExpression("1+2-(3+5)-4", null))
    assertEquals(27, resolveExpression("3*9", null))
    assertEquals(39, resolveExpression("3+4*9", null))
    assertEquals(-24, resolveExpression("-3*8", null))
    assertEquals(-24, resolveExpression("3*-8", null))

    // console.log( '[1,2,3,4,5]' === JSON.stringify(innerJoin([1,2,3,4,5])))
    // console.log( '[2,3,4]' === JSON.stringify(innerJoin([1,2,3,4,5], [2,3,4])))
    // console.log( '[2,3,4]' === JSON.stringify(innerJoin(...[[1,2,3,4,5], [2,3,4]])))
    // console.log( '[3]' === JSON.stringify(innerJoin([1,2,3,4,5], [2,3,4], [3])))
    // console.log( '[]' === JSON.stringify(innerJoin([1,2,3,4,5], [2,3,4], [1])))
}

export function resolveWeight(weight, quantity = 1, costFactor = 1, actor) {
    weight = `${weight}`.toLowerCase();
    let unitMultiplier = 1;

    if (weight.endsWith(" ton")) {
        unitMultiplier = 1000;
    }
    if (weight.includes("cost factor")) {
        weight = weight.replace("cost factor", `${costFactor}`)
        weight = weight.replace(" x ", " * ")
        weight = weight.replace(/ kgs| kg| kilogram| ton/, "")
    }
    let numericWeight = resolveExpression(weight, actor)
    return numericWeight * unitMultiplier * quantity
} // noinspection JSClosureCompilerSyntax
export const COMMMA_LIST = /, or | or |, /;
export const ALPHA_FINAL_NAME = (a, b) => {
    let x = a.finalName?.toLowerCase();
    let y = b.finalName?.toLowerCase();
    if (x < y) {
        return -1;
    }
    if (x > y) {
        return 1;
    }
    return 0;
};

export function viewableEntityFromEntityType(type) {
    switch (type) {
        case 'forcePower':
            return 'Force Powers'
        case 'forceTechnique':
            return 'Force Technique'
        case 'forceSecret':
            return 'Force Secret'
    }
}

export function onCollapseToggle(event) {
    let down = "fa-minus";
    let up = "fa-plus";
    event.stopPropagation();
    let button = $(event.currentTarget);

    let children = button.find("i.fas");
    children.each((i, e) => {
        if (e.classList.contains(down)) {
            e.classList.remove(down);
            e.classList.add(up);
        } else if (e.classList.contains(up)) {
            e.classList.remove(up);
            e.classList.add(down);
        }
    })

    let container = button.closest(".collapsible-container")
    let collapsible = container.find(".collapsible")
    collapsible.each((i, div) => {
        if (div.style.display === "grid") {
            div.style.display = "none"
        } else {
            div.style.display = "grid"
        }
    })
}

export function safeInsert(object, s, value) {
    let update = {};
    let cursor = update;
    let itemCursor = object;
    let tokens = s.split("\.")
    let i = 0;
    let length = tokens.length;
    for (let tok of tokens) {
        if (i === length - 1) {
            cursor[tok] = value;
        } else if (Array.isArray(itemCursor[tok])) {
            cursor[tok] = itemCursor[tok];
            cursor = cursor[tok];
            itemCursor = itemCursor[tok]
        } else {
            cursor[tok] = cursor[tok] || {};
            cursor = cursor[tok];
            itemCursor = itemCursor[tok]
        }
        i++;
    }
    return update;
}

export function convertOverrideToMode(changes, update) {
    if (changes) {
        for (const [idx, change] of changes.entries()) {
            if (change.mode) {
                continue;
            }
            let override = change.override;
            delete change.override;
            if (override) {
                change.mode = CONST.ACTIVE_EFFECT_MODES.OVERRIDE;
            } else {
                change.mode = CONST.ACTIVE_EFFECT_MODES.ADD;
            }
            update[`system.changes.${idx}`] = change;
        }
    }
}