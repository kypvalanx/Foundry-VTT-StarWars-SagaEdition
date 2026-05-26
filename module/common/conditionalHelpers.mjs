/**
 * Determines if the provided damage types can bypass shields.
 *
 * @param {string[]} damageTypes - An array of damage type strings to evaluate.
 * @return {boolean} Returns true if the shields can be bypassed, otherwise returns false.
 */
export function bypassShields(damageTypes) {
    // if(damageTypes.includes("Lightsabers")){
    //     return false;
    // }
    if (!damageTypes.includes("Energy") && !damageTypes.includes("Energy (Ion)")) {
        return true;
    }
    return false;
}