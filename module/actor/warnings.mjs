import {getInheritableAttribute} from "../attribute-helper.mjs";
import {getAvailableTrainedSkillCount} from "./skill-handler.mjs";
import {XP_REQUIREMENT} from "../common/constants.mjs";

function getAvailableTrainedSkills(actor) {
    let trainedSkills = actor.trainedSkills;
    let trainedKnowledgeCount = trainedSkills.filter(s => s.label.includes('Knowledge')).length;
    const otherTrainedSkillCount = trainedSkills.length - trainedKnowledgeCount;

    let {availableTrainedSkillCount, availableTrainedKnowledgeSkillCount} = getAvailableTrainedSkillCount(actor);
    availableTrainedKnowledgeSkillCount = availableTrainedKnowledgeSkillCount - trainedKnowledgeCount;

    availableTrainedSkillCount = availableTrainedSkillCount - otherTrainedSkillCount;
    if (availableTrainedKnowledgeSkillCount < 0) {
        availableTrainedSkillCount = availableTrainedSkillCount + availableTrainedKnowledgeSkillCount;
    }
    return {availableTrainedSkillCount, availableTrainedKnowledgeSkillCount};
}

export function warningsFromActor(actor) {
    let warnings = [];


    if(actor.type === "character"){
        let naturalArmorBonus = getInheritableAttribute({
            entity: actor,
            attributeKey: "naturalArmorReflexDefenseBonus",
            reduce: "SUM",
            attributeFilter: attr => !attr.modifier
        })
        let beastClassLevels = actor.classLevels?.Beast || 0;
        if (beastClassLevels > 0 && naturalArmorBonus > beastClassLevels) {
            warnings.push(`Natural Armor Bonus (${naturalArmorBonus}) should not exceed Beast Level (${beastClassLevels}).`)
        }

        if (!actor.system.attributeGenerationType && !actor.system.finalAttributeGenerationType) {
            warnings.push(`<span class="attributeGenerationType">Please Select an attribute generation type</span>`)
        }

        if (!actor.species && !actor.classes.find(c => c.name === 'Beast')) {
            warnings.push(`<span data-action="compendium" data-type="Item" data-filter="-type:species" title="Open Species Compendium">Please Select a Species</span>`)
        }


        if (!actor.classes || actor.classes.length === 0) {
            warnings.push(`<span data-action="compendium" data-type="Item" data-filter="-type:class" title="Open Class Compendium">Please Select a Class</span>`)
        } else if(actor.characterLevel < 20 && XP_REQUIREMENT[actor.characterLevel + 1] <= actor.system.experience){
            warnings.push(`<span data-action="compendium" data-type="Item" data-filter="-type:class" title="Open Class Compendium">You have enough XP for a new level!</span>`)
        }
        let {availableTrainedSkillCount, availableTrainedKnowledgeSkillCount} = getAvailableTrainedSkills(actor);

        if (availableTrainedKnowledgeSkillCount > 0) {
            warnings.push(`<span>Remaining Trained Knowledge Skills: ${availableTrainedKnowledgeSkillCount}</span>`)
        }
        if (availableTrainedSkillCount > 0) {
            warnings.push(`<span>Remaining Trained Skills: ${availableTrainedSkillCount}</span>`)
        }
        if (availableTrainedSkillCount < 0) {
            warnings.push(`<span>Too Many Skills Selected: ${Math.abs(availableTrainedSkillCount)}</span>`)
        }
        for (let item of Object.entries(actor.availableItems || {})) {
            if (item[1] !== 0) {
                warnings.push(`<span data-action="compendium-web" data-type="feat, talent" data-provider-source="${item[0]}">Items from ${item[0]} remaining: ${item[1]}</span>`)
            }
        }
        for (let feat of actor.system.inactiveProvidedFeats || []) {
            warnings.push(`<span>The ${feat.finalName} feat is provided but cannot be added because of missing prerequisites: ${feat.system.prerequisite?.text}</span>`)
        }

        // for (let feat of actor.system.inactiveProvidedFeats || []) {
        //     warnings.push(`<span>The ${feat.finalName} feat is provided but cannot be added because of missing prerequisites: ${feat.system.prerequisite?.text}</span><a className="item-control item-delete" title="Delete Item"><i
        //     className="fas fa-trash"></i></a>`)
        // }



        for (let skill of Object.values(actor.system.skills)) {
            if (skill.blockedSkill) {
                warnings.push(`<span>The ${skill.label} skill is provided but is not a Class Skill</span>`)
            }
        }


        if (game.settings.get("swse", "enableEncumbranceByWeight")) {
            if (actor.weight >= actor.heavyLoad) {
                warnings.push(`<span title="When carrying a heavy load a character takes a -10 penalty on some checks and the character's speed is reduced to three-quarters normal. A character can move up to three times his or her speed when Running with a Heavy Load.">You're carrying a <b>Heavy Load</b></span>`)
            }

            if (actor.weight >= actor.strainCapacity) {
                warnings.push(`<span title="Loses Dexterity Bonus to Reflex Defense and can only move one square">You're carrying more than your <b>Carry Capacity</b></span>`)
            }

            if (actor.weight >= actor.maximumCapacity) {
                warnings.push(`<span>You're carrying more than your <b>Maximum Capacity</b></span>`)
            }
        }
    }


    return warnings;
}

export function errorsFromActor(actor) {
    let errors = [];

    const levelEffects = actor.effects.filter(effect => effect.flags?.swse?.isLevel);
    if(levelEffects.length > 0){
        errors.push(`<span data-action="remove-leaked-level-effects">CLICK ME!!! You have level Effects on your actor sheet.  You may notice strange behavior if you do not remove them from your "Modes" tab</span>`)
    }

    const weaponFireEffects = actor.effects.filter(effect => effect.flags?.swse?.group === "Fire Mode");
    if(weaponFireEffects.length > 0){
        errors.push(`<span data-action="remove-fire-mode-effects">CLICK ME!!!  You have Fire Mode Effects on your actor sheet (Single-Shot, Autofire, etc...).  You may notice strange behavior if you do not remove them from your "Modes" tab</span>`)
    }

    const itemTypes = actor.itemTypes
    if(itemTypes["vehicleBaseType"].length > 0){
        errors.push(`<span data-action="remove-vehicleBaseType">CLICK ME!!!  You have a vehicleBaseType item on your sheet.  You may notice strange behavior if you do not remove it.  Click here to update your sheet.</span>`)
    }

    for (const item of actor.items) {
        for (const warning of item.errors) {
            errors.push(warning);
        }
    }

    return errors;
}

/**
 *
 * @param level
 * @param entity
 * @returns {*[]}
 */
export function errors(level, entity){
    const checks = ERRORS[entity.type][level];
    const err = [];
    for (const item of checks){
        err.push(...item.check(entity));
    }
    return err;
}

const ERRORS = {
    "actor": {
        "error":[
            {
                check: (actor) = {},
                resolution
            }
        ],
        "warning":[]
    },
    "item": {
        "error":[],
        "warning":[]
    }
}