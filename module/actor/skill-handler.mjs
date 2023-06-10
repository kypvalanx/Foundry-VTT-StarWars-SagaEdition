import {resolveValueArray, toNumber} from "../util.mjs";
import {getInheritableAttribute} from "../attribute-helper.mjs";
import {generateArmorCheckPenalties} from "./armor-check-penalty.mjs";
import {HEAVY_LOAD_SKILLS, NEW_LINE} from "../common/constants.mjs";


/**
 *
 * @param actor
 */
export function generateSkills(actor) {
    let data = {};

    let conditionBonus = getInheritableAttribute({
        entity: actor,
        attributeKey: "condition",
        reduce: "FIRST"
    })

    if ("OUT" === conditionBonus || !conditionBonus) {
        conditionBonus = "0";
    }
    let classSkills
    let skillBonusAttr
    let untrainedSkillBonuses
    let skillFocuses
    let shipModifier
    let reRollSkills
    let halfCharacterLevel
    let halfCharacterLevelRoundedUp
    let skillFocus
    let heavyLoadAffected = [];


    if(game.settings.get("swse", "enableEncumbranceByWeight") && actor.weight >= actor.heavyLoad){
        heavyLoadAffected = HEAVY_LOAD_SKILLS;
    }

    if (actor.system.sheetType === "Auto") {
        classSkills = actor._getClassSkills();
        skillBonusAttr = getInheritableAttribute({
            entity: actor,
            attributeKey: "skillBonus",
            reduce: "VALUES"
        }).map(skill => (skill?.replace(" ", "") || "").toLowerCase())
        untrainedSkillBonuses = getInheritableAttribute({
            entity: actor,
            attributeKey: "untrainedSkillBonus",
            reduce: "VALUES"
        }).map(skill => (skill || "").toLowerCase())
        skillFocuses = getInheritableAttribute({
            entity: actor,
            attributeKey: "skillFocus",
            reduce: "VALUES"
        }).map(skill => (skill || "").toLowerCase())
        shipModifier = getInheritableAttribute({
            entity: actor,
            attributeKey: "shipSkillModifier",
            reduce: "SUM"
        });
        reRollSkills = getInheritableAttribute({
            entity: actor,
            attributeKey: "skillReRoll"
        });
        halfCharacterLevel = actor.getHalfCharacterLevel();
        halfCharacterLevelRoundedUp = actor.getHalfCharacterLevel("up");
        skillFocus = getSkillFocus(halfCharacterLevelRoundedUp, halfCharacterLevel);
    }

    for (let [key, skill] of Object.entries(actor.system.skills)) {
        let dirtyKey = key.toLowerCase()
            .replace(" ", "").trim()
        let old = skill.value;
        let bonuses = [];
        let attributeMod = actor.getAttributeMod(skill.attribute);
        if (actor.system.sheetType === "Auto") {
            skill.isClass = key === 'use the force' ? actor.isForceSensitive : classSkills.has(key);

            let applicableRerolls = reRollSkills.filter(reroll => reroll.value.toLowerCase() === key || reroll.value.toLowerCase() === "any")

            bonuses.push({value: halfCharacterLevel, description: `Half character level: ${halfCharacterLevel}`})
            bonuses.push({value: attributeMod, description: `Attribute Mod: ${attributeMod}`})

            let trainedSkillBonus = skill.trained === true ? 5 : 0;
            bonuses.push({value: trainedSkillBonus, description: `Trained Skill Bonus: ${trainedSkillBonus}`})

            let untrainedSkillBonus = !skill.trained && untrainedSkillBonuses.includes(key) ? 2 : 0;
            bonuses.push({value: untrainedSkillBonus, description: `Untrained Skill Bonus: ${untrainedSkillBonus}`})

            let abilitySkillBonus = actor.getAbilitySkillBonus(key);
            bonuses.push({value: abilitySkillBonus, description: `Ability Skill Modifier: ${abilitySkillBonus}`})

            bonuses.push({value: parseInt(conditionBonus), description: `Condition Modifier: ${conditionBonus}`})

            let acPenalty = skill.acp ? generateArmorCheckPenalties(actor) : 0;
            bonuses.push({value: acPenalty, description: `Armor Class Penalty: ${acPenalty}`})

            let skillFocusBonus = skillFocuses.includes(key) ? skillFocus : 0;
            bonuses.push({value: skillFocusBonus, description: `Skill Focus Bonus: ${skillFocusBonus}`})

            bonuses.push(...getVehicleSkillBonuses(key, actor, shipModifier, applicableRerolls));

            let miscBonuses = skillBonusAttr.filter(bonus => bonus.startsWith(dirtyKey)).map(bonus => bonus.split(":")[1]);
            let miscBonus = miscBonuses.reduce((prev, curr) => prev + toNumber(curr), 0);

            bonuses.push({value: miscBonus, description: `Miscellaneous Bonus: ${miscBonus}`})
            bonuses.push({value: skill.manualBonus, description: `Manual Bonus: ${skill.manualBonus}`});

            if(heavyLoadAffected.includes(key)){
                bonuses.push({value: -10, description: `Heavy Load Penalty: -10`})
            }

            skill.trainedBonus = trainedSkillBonus + untrainedSkillBonus;
            skill.focusBonus = skillFocusBonus;
            skill.miscBonus = miscBonus;
            skill.armorPenalty = acPenalty;

            skill.notes = []
            for (let reroll of applicableRerolls) {
                skill.notes.push(`[[/roll 1d20 + ${skill.value}]] ${reroll.sourceDescription}`)
            }
            actor.resolvedNotes.set(skill.variable, skill.notes)

            if (classSkills.size === 0 && skill.trained) {
                data[`data.skills.${key}.trained`] = false;
            }
        } else {
            bonuses.push({value: attributeMod, description: `Attribute Mod: ${attributeMod}`})
            bonuses.push({value: skill.manualBonus, description: `Miscellaneous Bonus: ${skill.manualBonus}`});
            bonuses.push({
                value: skill.manualTrainingBonus,
                description: `Training Bonus: ${skill.manualTrainingBonus}`
            });
            bonuses.push({value: skill.manualFocusBonus, description: `Focus Bonus: ${skill.manualFocusBonus}`});
            bonuses.push({value: skill.manualArmorBonus, description: `Armor Penalty: ${skill.manualArmorBonus}`});
        }
        let nonZeroBonuses = bonuses.filter(bonus => bonus.value !== 0);
        skill.title = nonZeroBonuses.map(bonus => bonus.description).join(NEW_LINE);
        skill.value = resolveValueArray(nonZeroBonuses.map(bonus => bonus.value));
        skill.variable = `@${actor.cleanSkillName(key)}`;
        actor.resolvedVariables.set(skill.variable, "1d20 + " + skill.value);
        skill.label = key.titleCase().replace("Knowledge", "K.");
        actor.resolvedLabels.set(skill.variable, skill.label);
        skill.abilityBonus = attributeMod;
        skill.rowColor = key === "initiative" || key === "perception" ? "highlighted-skill" : "";

        if (skill.value !== old) {
            data[`data.skills.${key}.value`] = skill.value;
        }
    }
    if (Object.values(data).length > 0 && !!actor._id && !actor.pack && game.actors.get(actor._id)) {
        actor.safeUpdate(data);
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
            entity: item,
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

function getVehicleSkillBonuses(key, actor, shipModifier, applicableReRolls) {
    let bonuses = [];

    let crew;
    let positionlessKey;
    if (key.endsWith("(pilot)")) {
        positionlessKey = key.slice(0, key.length - 7).trim()
        crew = actor.pilot;
    } else if (key.endsWith('(copilot)')) {
        positionlessKey = key.slice(0, key.length - 9).trim()
        crew = actor.copilot;
    } else if (key.endsWith('(commander)')) {
        positionlessKey = key.slice(0, key.length - 11).trim()
        crew = actor.commander;
    } else if (key.endsWith('(system operator)')) {
        positionlessKey = key.slice(0, key.length - 17).trim()
        crew = actor.systemsOperator;
    } else if (key.endsWith('(engineer)')) {
        positionlessKey = key.slice(0, key.length - 10).trim()
        crew = actor.systemsOperator;
    }

    if (!crew) {
        return [];
    }


    let reRollSkills = getInheritableAttribute({
        entity: crew,
        attributeKey: "skillReRoll"
    });

    applicableReRolls.push(...reRollSkills.filter(reroll => reroll.value.toLowerCase() === positionlessKey || reroll.value.toLowerCase() === "any"))

    if (key === "pilot (pilot)") {
        let pilotSkillBonus = crew.system.skills.pilot?.value || 0;
        bonuses.push({
            value: pilotSkillBonus,
            description: `Pilot Skill Bonus (${crew.name}): ${pilotSkillBonus}`
        })
        bonuses.push({value: shipModifier, description: `Ship Size Modifier: ${shipModifier}`})
    }
    if (key === "initiative (pilot)") {

        let pilotSkillBonus = Math.max(crew.system.skills.pilot?.value || 0, crew.system.skills.initiative?.value || 0);
        bonuses.push({
            value: pilotSkillBonus,
            description: `Pilot Initiative Bonus (${crew.name}): ${pilotSkillBonus}`
        })
        bonuses.push({value: shipModifier, description: `Ship Size Modifier: ${shipModifier}`})
    }
    if (key === "pilot (copilot)") {
        let pilotSkillBonus = crew.system.skills.pilot?.value || 0;
        bonuses.push({
            value: pilotSkillBonus,
            description: `Copilot Skill Bonus (${crew.name}): ${pilotSkillBonus}`
        })

    }
    if (key === "use computer (commander)") {
        let pilotSkillBonus = crew.system.skills['use computer']?.value || 0;
        bonuses.push({
            value: pilotSkillBonus,
            description: `Commander Skill Bonus (${crew.name}): ${pilotSkillBonus}`
        })

    }
    if (key === "knowledge (tactics) (commander)") {
        let pilotSkillBonus = crew.system.skills['knowledge (tactics)']?.value || 0;
        bonuses.push({
            value: pilotSkillBonus,
            description: `Commander Skill Bonus (${crew.name}): ${pilotSkillBonus}`
        })

    }


    if (key === "use computer (system operator)") {
        let pilotSkillBonus = crew.system.skills['use computer']?.value || 0;
        bonuses.push({
            value: pilotSkillBonus,
            description: `Systems Operator Skill Bonus (${crew.name}): ${pilotSkillBonus}`
        })

    }
    if (key === "mechanics (system operator)") {
        let pilotSkillBonus = crew.system.skills.mechanics?.value || 0;
        bonuses.push({
            value: pilotSkillBonus,
            description: `Systems Operator Skill Bonus (${crew.name}): ${pilotSkillBonus}`
        })

    }
    if (key === "mechanics (engineer)") {
        let pilotSkillBonus = crew.system.skills.mechanics?.value || 0;
        bonuses.push({
            value: pilotSkillBonus,
            description: `Engineer Skill Bonus (${crew.name}): ${pilotSkillBonus}`
        })

    }
    return bonuses;
}
