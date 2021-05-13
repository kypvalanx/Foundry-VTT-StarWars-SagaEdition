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
export function filterItemsByType(type, items) {
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