import {resolveValueArray} from "../util.js";
import {getInheritableAttribute} from "../attribute-helper.js";
import {generateArmorCheckPenalties} from "./armor-check-penalty.js";

/**
 *
 * @param actor {SWSEActor}
 * @returns {Promise<number>}
 */
export function getAvailableTrainedSkillCount(actor) {
    let intBonus = actor.getAttributeMod("int")
    let classBonus = getInheritableAttribute({
        entity: actor,
        attributeKey: "trainedSkillsFirstLevel",
        reduce: "SUM",
        itemFilter: item => getInheritableAttribute({
            entity: item.document,
            attributeKey: "isFirstLevel",
            reduce: "OR"
        })
    })
    let classSkills = Math.max(resolveValueArray([classBonus, intBonus]), 1);
    let otherSkills = getInheritableAttribute({
        entity: actor,
        attributeKey: "trainedSkills",
        reduce: "SUM"
    });
    return resolveValueArray([classSkills, otherSkills]);
}

/**
 *
 * @param actor
 */
export function generateSkills(actor) {
    let data = {};
    let prerequisites = actor.data.prerequisites;
    prerequisites.trainedSkills = [];
    let classSkills = actor._getClassSkills();
    let halfCharacterLevel = actor.getHalfCharacterLevel();

    let conditionBonus = getInheritableAttribute({
        entity: actor,
        attributeKey: "condition",
        reduce: "FIRST"
    })

    if("OUT" === conditionBonus || !conditionBonus){
        conditionBonus = "0";
    }

    let skillFocuses = getInheritableAttribute({
        entity: actor,
        attributeKey: "skillFocus",
        reduce: "VALUES"
    }).map(skill => (skill || "").toLowerCase())
    let shipModifier = getInheritableAttribute({
        entity: actor,
        attributeKey: "shipSkillModifier",
        reduce: "SUM"
    });

    for (let [key, skill] of Object.entries(actor.data.data.skills)) {
        skill.isClass = key === 'use the force' ? actor.isForceSensitive : classSkills.has(key);

        skill.title = "";

        let skillBonuses = [];

        skillBonuses.push(halfCharacterLevel);
        if(halfCharacterLevel !== 0) {
            skill.title += `
Half character level: ${halfCharacterLevel}`;
        }

        let attributeMod = actor.getAttributeMod(skill.attribute);
        skillBonuses.push(attributeMod);
        skill.title += `
Attribute Mod: ${attributeMod}`;

        let trainedSkillBonus = skill.trained === true ? 5 : 0;
        if(trainedSkillBonus !== 0) {
            skillBonuses.push(trainedSkillBonus);
            skill.title += `
Trained Skill Bonus: ${trainedSkillBonus}`;
        }

        let getAbilitySkillBonus = actor.getAbilitySkillBonus(key);
        if(getAbilitySkillBonus !== 0) {
            skillBonuses.push(getAbilitySkillBonus);
            skill.title += `
Ability Skill Modifier: ${getAbilitySkillBonus}`;
        }

        if(parseInt(conditionBonus) !== 0) {
            skillBonuses.push(parseInt(conditionBonus));
            skill.title += `
Condition Modifier: ${conditionBonus}`;
        }

        let acPenalty = skill.acp ? generateArmorCheckPenalties(actor.data) : 0;
        if(acPenalty !== 0) {
            skillBonuses.push(acPenalty);
            skill.title += `
Armor Class Penalty: ${acPenalty}`;
        }

        let skillFocusBonus = skillFocuses.includes(key) ? 5 : 0;
        if(skillFocusBonus !== 0) {
            skillBonuses.push(skillFocusBonus);
            skill.title += `
Skill Focus Bonus: ${skillFocusBonus}`;
        }

        let old = skill.value;
        //let skillBonuses = [halfCharacterLevel, attributeMod, trainedSkillBonus, conditionBonus, getAbilitySkillBonus, acPenalty, skillFocusBonus];

        if(key === "pilot (pilot)"){
            let pilot = actor.pilot
            if(pilot){

                let pilotSkillBonus = pilot.data.skills.pilot.value;
                if(pilotSkillBonus !== 0) {
                    skillBonuses.push(pilotSkillBonus)
                    skill.title += `
Pilot Skill Bonus (${pilot.name}): ${pilotSkillBonus}`;
                }

            }
            if(shipModifier !== 0) {
                skillBonuses.push(shipModifier)
                skill.title += `
Ship Size Modifier: ${shipModifier}`;
            }
        }
        if(key === "initiative (pilot)"){
            let pilot = actor.pilot
            if(pilot){

                let pilotSkillBonus = Math.max(pilot.data.skills.pilot.value || 0, pilot.data.skills.initiative.value || 0);
                if(pilotSkillBonus !== 0) {
                    skillBonuses.push(pilotSkillBonus)
                    skill.title += `
Pilot Initiative Bonus (${pilot.name}): ${pilotSkillBonus}`;
                }

            }
            if(shipModifier !== 0) {
                skillBonuses.push(shipModifier)
                skill.title += `
Ship Size Modifier: ${shipModifier}`;
            }
        }
        if(key === "pilot (copilot)"){
            skillBonuses = [];
            skill.title = ""
            let copilot = actor.copilot
            if(copilot){
                let pilotSkillBonus = copilot.data.skills.pilot.value;
                if(pilotSkillBonus !== 0) {
                    skillBonuses.push(pilotSkillBonus)
                    skill.title += `
Copilot Skill Bonus (${copilot.name}): ${pilotSkillBonus}`;
                }

            }
        }
        if(key === "use computer (commander)"){
            skill.title = ""
            let commander = actor.commander
            if(commander){
                let pilotSkillBonus = commander.data.skills['use computer'].value;
                if(pilotSkillBonus !== 0) {
                    skillBonuses.push(pilotSkillBonus)
                    skill.title += `
Commander Skill Bonus (${commander.name}): ${pilotSkillBonus}`;
                }

            }
        }
        if(key === "knowledge (tactics) (commander)"){
            skillBonuses = [];
            skill.title = ""
            let commander = actor.commander
            if(commander){
                let pilotSkillBonus = commander.data.skills['knowledge (tactics)'].value;
                if(pilotSkillBonus !== 0) {
                    skillBonuses.push(pilotSkillBonus)
                    skill.title += `
Commander Skill Bonus (${commander.name}): ${pilotSkillBonus}`;
                }

            }
        }
        if(key === "use computer (system operator)"){
            skill.title = ""
            let systemsOperator = actor.systemsOperator
            if(systemsOperator){
                let pilotSkillBonus = systemsOperator.data.skills['use computer'].value;
                if(pilotSkillBonus !== 0) {
                    skillBonuses.push(pilotSkillBonus)
                    skill.title += `
Systems Operator Skill Bonus (${systemsOperator.name}): ${pilotSkillBonus}`;
                }

            }
        }
        if(key === "mechanics (system operator)"){
            skillBonuses = [];
            skill.title = ""
            let systemsOperator = actor.systemsOperator
            if(systemsOperator){
                let pilotSkillBonus = systemsOperator.data.skills.mechanics.value;
                if(pilotSkillBonus !== 0) {
                    skillBonuses.push(pilotSkillBonus)
                    skill.title += `
Systems Operator Skill Bonus (${systemsOperator.name}): ${pilotSkillBonus}`;
                }

            }
        }
        if(key === "mechanics (engineer)"){
            skillBonuses = [];
            skill.title = ""
            let engineer = actor.engineer
            if(engineer){
                let pilotSkillBonus = engineer.data.skills.mechanics.value;
                if(pilotSkillBonus !== 0) {
                    skillBonuses.push(pilotSkillBonus)
                    skill.title += `
Engineer Skill Bonus (${engineer.name}): ${pilotSkillBonus}`;
                }

            }
        }

        skill.value = resolveValueArray( skillBonuses);
        skill.key = key;
        skill.variable = `@${actor.cleanSkillName(key)}`;
        actor.resolvedVariables.set(`@${actor.cleanSkillName(key)}`, "1d20 + " + skill.value);
        skill.label = key.titleCase().replace("Knowledge", "K.");
        actor.resolvedLabels.set(`@${actor.cleanSkillName(key)}`, skill.label);

        if (classSkills.size === 0 && skill.trained) {
            data[`data.skills.${key}.trained`] = false;
        }
        if(skill.value !== old){
            data[`data.skills.${key}.value`] = skill.value;
        }
        prerequisites.trainedSkills.push(key.toLowerCase());
    }
    if(Object.values(data).length > 0 && !!actor.data._id){
        actor.update(data);
    }
}
