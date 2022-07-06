import {resolveValueArray, toNumber} from "../util.js";
import {getInheritableAttribute} from "../attribute-helper.js";
import {generateArmorCheckPenalties} from "./armor-check-penalty.js";
import {NEW_LINE} from "../constants.js";


/**
 *
 * @param actor
 */
export function generateSkills(actor) {
    let data = {};
    let prerequisites = actor.data.prerequisites;
    prerequisites.trainedSkills = [];
    let classSkills = actor._getClassSkills();

    let conditionBonus = getInheritableAttribute({
        entity: actor,
        attributeKey: "condition",
        reduce: "FIRST"
    })

    if ("OUT" === conditionBonus || !conditionBonus) {
        conditionBonus = "0";
    }

    let skillBonusAttr = getInheritableAttribute({
        entity: actor,
        attributeKey: "skillBonus",
        reduce: "VALUES"
    }).map(skill => (skill?.replace(" ", "") || "").toLowerCase())

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

    let halfCharacterLevel = actor.getHalfCharacterLevel();
    let halfCharacterLevelRoundedUp = actor.getHalfCharacterLevel("up");
    let skillFocus = getSkillFocus(halfCharacterLevelRoundedUp, halfCharacterLevel);
    for (let [key, skill] of Object.entries(actor.data.data.skills)) {
        let dirtyKey = key.toLowerCase()
            .replace(" ", "").trim()
        skill.isClass = key === 'use the force' ? actor.isForceSensitive : classSkills.has(key);

        let bonuses = [];

        bonuses.push({value: halfCharacterLevel, description: `Half character level: ${halfCharacterLevel}`})

        let attributeMod = actor.getAttributeMod(skill.attribute);
        bonuses.push({value: attributeMod, description: `Attribute Mod: ${attributeMod}`})

        let trainedSkillBonus = skill.trained === true ? 5 : 0;
        bonuses.push({value: trainedSkillBonus, description: `Trained Skill Bonus: ${trainedSkillBonus}`})

        let getAbilitySkillBonus = actor.getAbilitySkillBonus(key);
        bonuses.push({value: getAbilitySkillBonus, description: `Ability Skill Modifier: ${getAbilitySkillBonus}`})

        bonuses.push({value: parseInt(conditionBonus), description: `Condition Modifier: ${conditionBonus}`})

        let acPenalty = skill.acp ? generateArmorCheckPenalties(actor.data) : 0;
        bonuses.push({value: acPenalty, description: `Armor Class Penalty: ${acPenalty}`})

        let skillFocusBonus = skillFocuses.includes(key) ? skillFocus : 0;
        bonuses.push({value: skillFocusBonus, description: `Skill Focus Bonus: ${skillFocusBonus}`})
        
        bonuses.push(...getVehicleSkillBonuses(key, actor, shipModifier));

        let miscBonuses = skillBonusAttr.filter(bonus => bonus.startsWith(dirtyKey)).map(bonus => bonus.split(":")[1]);
        let miscBonus = miscBonuses.reduce((prev, curr) => prev + toNumber(curr), 0);

        bonuses.push({value: miscBonus, description: `Miscellaneous Bonus: ${miscBonus}`})

        let nonZeroBonuses = bonuses.filter(bonus => bonus.value !== 0);
        skill.title = nonZeroBonuses.map(bonus => bonus.description).join(NEW_LINE);
        skill.value = resolveValueArray(nonZeroBonuses.map(bonus => bonus.value));
        skill.key = key;
        skill.variable = `@${actor.cleanSkillName(key)}`;
        actor.resolvedVariables.set(`@${actor.cleanSkillName(key)}`, "1d20 + " + skill.value);
        skill.label = key.titleCase().replace("Knowledge", "K.");
        actor.resolvedLabels.set(`@${actor.cleanSkillName(key)}`, skill.label);

        if (classSkills.size === 0 && skill.trained) {
            data[`data.skills.${key}.trained`] = false;
        }

        let old = skill.value;
        if (skill.value !== old) {
            data[`data.skills.${key}.value`] = skill.value;
        }
        prerequisites.trainedSkills.push(key.toLowerCase());
    }
    if (Object.values(data).length > 0 && !!actor.data._id) {
        actor.update(data);
    }
}

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

function getSkillFocus(halfCharacterLevelRoundedUp, halfCharacterLevel) {
    let skillFocus = 5;
    let skillFocusCalculationOption = game.settings.get("swse", "skillFocusCalculation");
    if (skillFocusCalculationOption === "charLevelUp") {
        skillFocus = halfCharacterLevelRoundedUp;
    } else if (skillFocusCalculationOption === "charLevelDown") {
        skillFocus = halfCharacterLevel;
    }
    return skillFocus;
}

function getVehicleSkillBonuses(key, actor, shipModifier) {
    let bonuses = [];
    if (key.endsWith("(pilot)")) {
        if (key === "pilot (pilot)") {
            let pilot = actor.pilot
            if (pilot) {
                let pilotSkillBonus = pilot.data.skills.pilot.value || 0;
                bonuses.push({
                    value: pilotSkillBonus,
                    description: `Pilot Skill Bonus (${pilot.name}): ${pilotSkillBonus}`
                })
            }
            bonuses.push({value: shipModifier, description: `Ship Size Modifier: ${shipModifier}`})
        }
        if (key === "initiative (pilot)") {
            let pilot = actor.pilot
            if (pilot) {
                let pilotSkillBonus = Math.max(pilot.data.skills.pilot.value || 0, pilot.data.skills.initiative.value || 0);
                bonuses.push({
                    value: pilotSkillBonus,
                    description: `Pilot Initiative Bonus (${pilot.name}): ${pilotSkillBonus}`
                })
            }
            bonuses.push({value: shipModifier, description: `Ship Size Modifier: ${shipModifier}`})
        }
    }
    if (key === "pilot (copilot)") {
        bonuses = [];
        let copilot = actor.copilot
        if (copilot) {
            let pilotSkillBonus = copilot.data.skills.pilot.value;
            bonuses.push({
                value: pilotSkillBonus,
                description: `Copilot Skill Bonus (${copilot.name}): ${pilotSkillBonus}`
            })
        }
    }
    if (key.endsWith("(commander)")) {
        if (key === "use computer (commander)") {
            bonuses = [];
            let commander = actor.commander
            if (commander) {
                let pilotSkillBonus = commander.data.skills['use computer'].value;
                bonuses.push({
                    value: pilotSkillBonus,
                    description: `Commander Skill Bonus (${commander.name}): ${pilotSkillBonus}`
                })
            }
        }
        if (key === "knowledge (tactics) (commander)") {
            bonuses = [];
            let commander = actor.commander
            if (commander) {
                let pilotSkillBonus = commander.data.skills['knowledge (tactics)'].value;
                bonuses.push({
                    value: pilotSkillBonus,
                    description: `Commander Skill Bonus (${commander.name}): ${pilotSkillBonus}`
                })
            }
        }
    }

    if (key.endsWith("(system operator)")) {
        if (key === "use computer (system operator)") {
            bonuses = [];
            let systemsOperator = actor.systemsOperator
            if (systemsOperator) {
                let pilotSkillBonus = systemsOperator.data.skills['use computer'].value;
                bonuses.push({
                    value: pilotSkillBonus,
                    description: `Systems Operator Skill Bonus (${systemsOperator.name}): ${pilotSkillBonus}`
                })
            }
        }
        if (key === "mechanics (system operator)") {
            bonuses = [];
            let systemsOperator = actor.systemsOperator
            if (systemsOperator) {
                let pilotSkillBonus = systemsOperator.data.skills.mechanics.value;
                bonuses.push({
                    value: pilotSkillBonus,
                    description: `Systems Operator Skill Bonus (${systemsOperator.name}): ${pilotSkillBonus}`
                })
            }
        }
    }
    if (key === "mechanics (engineer)") {
        bonuses = [];
        let engineer = actor.engineer
        if (engineer) {
            let pilotSkillBonus = engineer.data.skills.mechanics.value;
            bonuses.push({
                value: pilotSkillBonus,
                description: `Engineer Skill Bonus (${engineer.name}): ${pilotSkillBonus}`
            })
        }
    }
    return bonuses;
}
