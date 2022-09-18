import {getInheritableAttribute} from "../attribute-helper.js";

export function warningsFromActor(actor) {
    let warnings = [];

    let naturalArmorBonus = getInheritableAttribute({
        entity: actor,
        attributeKey: "naturalArmorReflexDefenseBonus",
        reduce: "SUM",
        attributeFilter: attr => !attr.modifier
    })
    let beastClassLevels = actor.system.classLevels?.Beast || 0;
    if (beastClassLevels > 0 && naturalArmorBonus > beastClassLevels) {
        warnings.push(`Natural Armor Bonus (${naturalArmorBonus}) should not exceed Beast Level (${beastClassLevels}).`)
    }

    if(!actor.system.attributeGenerationType){
        warnings.push(`<span class="attributeGenerationTypePlease Select an attribute generation type"></span>`)
    }

    if(!actor.species){
        warnings.push(`<span data-action="compendium" data-type="Item" data-filter="-type:species">Please Select a Species</span>`)
    }
    if(!actor.classes){
        warnings.push(`<span>Please Select a Class</span>`)
    }
    if(actor.remainingSkills){
        warnings.push(`<span>Remaining Trained Skills: ${actor.remainingSkills}</span>`)
    }
    if(actor.tooManySkills){
        warnings.push(`<span>Too Many Skills Selected: ${actor.tooManySkills}</span>`)
    }
    for(let item of Object.entries(actor.system.availableItems || {})){
        warnings.push(`<span>Items from ${item[0]} remaining: ${item[1]}</span>`)
    }
    for(let feat of actor.system.inactiveProvidedFeats){
        warnings.push(`<span>The ${feat.finalName} feat is provided but cannot be added because of missing prerequisites: ${feat.system.prerequisite.text}</span>`)
    }

    return warnings;
}
export function errorsFromActor(actor) {
    let errors = [];


    return errors;
}