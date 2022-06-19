import {getInheritableAttribute} from "../attribute-helper.js";

export function warningsFromActor(actor) {
    let warnings = [];

    let naturalArmorBonus = getInheritableAttribute({
        entity: actor,
        attributeKey: "naturalArmorReflexDefenseBonus",
        reduce: "SUM",
        attributeFilter: attr => !attr.modifier
    })
    let beastClassLevels = actor.data.classLevels['Beast'];
    if (beastClassLevels > 0 && naturalArmorBonus > beastClassLevels) {
        warnings.push(`Natural Armor Bonus (${naturalArmorBonus}) should not exceed Beast Level (${beastClassLevels}).`)
    }

    return warnings;
}
export function errorsFromActor(actor) {
    let errors = [];


    return errors;
}