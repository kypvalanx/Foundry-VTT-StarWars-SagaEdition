import {getInheritableAttribute} from "../attribute-helper.mjs";
import {getAvailableTrainedSkillCount} from "./skill-handler.mjs";

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

    if(!actor.system.attributeGenerationType && !actor.system.finalAttributeGenerationType){
        warnings.push(`<span class="attributeGenerationType">Please Select an attribute generation type</span>`)
    }

    if(!actor.species && !actor.classes.find(c => c.name === 'Beast')){
        warnings.push(`<span data-action="compendium" data-type="Item" data-filter="-type:species">Please Select a Species</span>`)
    }
    if(!actor.classes || actor.classes.length === 0){
        warnings.push(`<span data-action="compendium-web" data-type="class">Please Select a Class</span>`)
    }

    const availableTrainedSkills = getAvailableTrainedSkillCount(actor) -  actor.trainedSkills.length;

    if(availableTrainedSkills > 0){
        warnings.push(`<span>Remaining Trained Skills: ${availableTrainedSkills}</span>`)
    }
    if(availableTrainedSkills < 0){
        warnings.push(`<span>Too Many Skills Selected: ${Math.abs(availableTrainedSkills)}</span>`)
    }
    for(let item of Object.entries(actor.availableItems || {})){
        if(item[1] !== 0){
            warnings.push(`<span data-action="compendium-web" data-type="feat, talent" data-provider-source="${item[0]}">Items from ${item[0]} remaining: ${item[1]}</span>`)
        }
    }
    for(let feat of actor.system.inactiveProvidedFeats || []){
        warnings.push(`<span>The ${feat.finalName} feat is provided but cannot be added because of missing prerequisites: ${feat.system.prerequisite?.text}</span>`)
    }

    for(let skill of Object.values(actor.system.skills)){
        if(skill.blockedSkill){
            warnings.push(`<span>The ${skill.label} skill is provided but is not a Class Skill</span>`)
        }
    }


    if(game.settings.get("swse", "enableEncumbranceByWeight")){
        if(actor.weight >= actor.heavyLoad){
            warnings.push(`<span title="When carrying a heavy load a character takes a -10 penalty on some checks and the character's speed is reduced to three-quarters normal. A character can move up to three times his or her speed when Running with a Heavy Load.">You're carrying a <b>Heavy Load</b></span>`)
        }

        if(actor.weight >= actor.strainCapacity){
            warnings.push(`<span title="Loses Dexterity Bonus to Reflex Defense and can only move one square">You're carrying more than your <b>Carry Capacity</b></span>`)
        }

        if(actor.weight >= actor.maximumCapacity){
            warnings.push(`<span>You're carrying more than your <b>Maximum Capacity</b></span>`)
        }
    }

    return warnings;
}
export function errorsFromActor(actor) {
    let errors = [];

    return errors;
}