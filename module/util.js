export function resolveValueArray(actor, healths) {
    if (!Array.isArray(healths)) {
        healths = [healths];
    }
    let total = 0;
    for (let health of healths) {
        if (typeof health === 'undefined') {

        } else if (typeof health === 'number') {
            total += health;
        } else if (typeof health === 'string' && health.startsWith("@")) {
            //ask Actor to resolve
            let value = actor.resolveValue(health);
            if (value) {
                total += resolveValueArray(actor, value);
            }

        } else if (typeof health === 'string') {
            total += parseInt(health);
        }
    }
    return total;
}

export function filterItemsByType(type, items) {
    let types = [];
    types[0] = type;
    if (arguments.length > 2) {
        for (let i = 2; i < arguments.length; i++) {
            types[i - 1] = arguments[i];
        }
    }
    let filtered = [];
    for (let i = 0; i < items.length; i++) {
        if (types.includes(items[i].type)) {
            filtered.push(items[i]);
        }
    }
    return filtered;
}