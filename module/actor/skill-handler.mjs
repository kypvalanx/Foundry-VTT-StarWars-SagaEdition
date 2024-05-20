import {filterItemsByType, resolveValueArray, toNumber} from "../common/util.mjs";
import {getInheritableAttribute} from "../attribute-helper.mjs";
import {generateArmorCheckPenalties} from "./armor-check-penalty.mjs";
import {HEAVY_LOAD_SKILLS, NEW_LINE, skillDetails, skills} from "../common/constants.mjs";
import {DEFAULT_SKILL} from "../common/classDefaults.mjs";

export class SkillDelegate {
    constructor(swseActor) {
        this.actor = swseActor;
    }

    /**
     *
     * @return {[]}
     */
    get skills(){
        return generateSkills(this.actor)
    }
}
function applyGroupedSkills(skills, groupedSkillMap) {
    //add groupers
    skills.push(...Array.from(groupedSkillMap.keys()).flat())
    //remove
    const groupedSkills = Array.from(groupedSkillMap.values().map(skill => skill.grouped)).flat().distinct()

    skills = skills.filter(s => !groupedSkills.includes(s)).sort()

    return skills;
}

function createNewSkill(skill, actualSkill = {}, customSkill = {}) {

    return {...DEFAULT_SKILL, ...(skillDetails[skill] || {}), ...customSkill, ...actualSkill}

}

/**
 *
 * @param actor
 *
 * @return {[]}
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
    let automaticTrainedSkill;
    let heavyLoadAffected = [];


    if (game.settings.get("swse", "enableEncumbranceByWeight") && actor.weight >= actor.heavyLoad) {
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
        automaticTrainedSkill = getInheritableAttribute({
            entity: actor,
            attributeKey: "automaticTrainedSkill",
            reduce: "VALUES_TO_LOWERCASE"
        });
        halfCharacterLevel = actor.getHalfCharacterLevel();
        halfCharacterLevelRoundedUp = actor.getHalfCharacterLevel("up");
        skillFocus = getSkillFocus(halfCharacterLevelRoundedUp, halfCharacterLevel);
    }

    const groupedSkillMap = new Map();
    groupedSkillMap.set("Athletics", {grouped: ["Jump", "Climb", "Swim"], classes: ["Scout", "Soldier", "Jedi"], uut: true})

    const skillMap = new Map();

    const resolvedSkills = applyGroupedSkills(skills, groupedSkillMap);
    for (let resSkill of resolvedSkills) {
        let key = resSkill.toLowerCase();

        const customSkill = groupedSkillMap.get(resSkill)
        const skill = createNewSkill(resSkill, actor.system.skills[key] || {}, customSkill)
        skill.key = key;


        let dirtyKey = key.toLowerCase()
            .replace(" ", "").trim()
        let old = skill.value;
        let bonuses = [];
        let skillAttributeMod = getSkillAttributeMod(actor, key, skill);

        if (actor.system.sheetType === "Auto") {

            if(customSkill){
                for(const playerClass of actor.itemTypes.class){
                    if(customSkill.classes && customSkill.classes.includes(playerClass.name)){
                        classSkills.add(key)
                    }
                }

               // skill.situationalSkills = customSkill.grouped.map();
            }

            skill.isClass = resSkill === 'Use the Force' ? actor.isForceSensitive : classSkills.has(key)

            if (automaticTrainedSkill.includes(key)) {
                skill.trained = true;
                skill.locked = true;
                if (!skill.isClass) {
                    skill.blockedSkill = true;
                }
            }


            bonuses.push({value: halfCharacterLevel, description: `Half character level: ${halfCharacterLevel}`})
            bonuses.push({value: skillAttributeMod, description: `Attribute Mod: ${skillAttributeMod}`})

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

            let applicableRerolls = reRollSkills.filter(reroll => reroll.value.toLowerCase() === key || reroll.value.toLowerCase() === "any")
            bonuses.push(...getVehicleSkillBonuses(key, actor, shipModifier, applicableRerolls));

            if (skill.sizeMod) {
                bonuses.push({value: shipModifier, description: `Ship Size Modifier: ${shipModifier}`})
            }

            let miscBonuses = skillBonusAttr.filter(bonus => bonus.startsWith(dirtyKey)).map(bonus => bonus.split(":")[1]);
            let miscBonus = miscBonuses.reduce((prev, curr) => prev + toNumber(curr), 0);

            bonuses.push({value: miscBonus, description: `Miscellaneous Bonus: ${miscBonus}`})
            if (skill.manualBonus) {
                bonuses.push({value: skill.manualBonus, description: `Manual Bonus: ${skill.manualBonus}`});
            }

            if (heavyLoadAffected.includes(key)) {
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
                data[`system.skills.${key}.trained`] = false;
            }
        } else {
            bonuses.push({value: skillAttributeMod, description: `Attribute Mod: ${skillAttributeMod}`})
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
        skill.label = key.titleCase();//.replace("Knowledge", "K.");
        actor.resolvedLabels.set(skill.variable, skill.label);
        skill.abilityBonus = skillAttributeMod;
        skill.rowColor = key === "initiative" || key === "perception" ? "highlighted-skill" : "";


        if (skill.value !== old) {
            data[`system.skills.${key}.value`] = skill.value;
        }

        skillMap.set(key, skill);
    }
    if (Object.values(data).length > 0 && !!actor._id && !actor.pack && game.actors.get(actor._id)) {
        actor.safeUpdate(data);
    }
    return Array.from(skillMap.values());
}

function getModifiedSkillAttributes(skillAttributes, key) {
    let skillAttributeList = [];
    for (let skillAttribute of skillAttributes) {
        let value = skillAttribute.value;
        const [skillAttributeKey, skillAttributeValue] = value.split(":");
        if (skillAttributeKey.toLowerCase() === key) {
            skillAttributeList.push(skillAttributeValue);
        }
    }
    return skillAttributeList;
}

function getHighestSkillAttribute(actor, modifiedSkillAttributes, defaultSkillAttribute) {
    let highestAttribute = defaultSkillAttribute;
    let highestAttributeMod = actor.getAttributeMod(highestAttribute);
    for (let attribute of modifiedSkillAttributes) {
        try {
            let attributeMod = actor.getAttributeMod(attribute);
            if (attributeMod > highestAttributeMod) {
                highestAttribute = attribute;
                highestAttributeMod = attributeMod;
            }
        } catch (e) {
            console.warn(`swse: Attribute mod override not valid: "${attribute}". Please check the skillAttribute changes of actor "${actor.name}". Default attribute "${defaultSkillAttribute}" will be used`);
        }
    }

    return {highestAttribute, highestAttributeMod};
}

function getSkillAttributeMod(actor, key, skill) {
    const defaultSkillAttribute = skill.attribute;
    const skillAttributesChanges = getInheritableAttribute({
        entity: actor,
        attributeKey: 'skillAttribute'
    });

    const modifiedSkillAttributes = getModifiedSkillAttributes(skillAttributesChanges, key);
    const attribute = getHighestSkillAttribute(actor, modifiedSkillAttributes, defaultSkillAttribute);
    skill.attribute = attribute.highestAttribute;
    return attribute.highestAttributeMod;
}

/**
 *
 * @param actor {SWSEActor}
 * @returns {Promise<number>}
 */
export function getAvailableTrainedSkillCount(actor) {
    let intBonus = actor.getAttributeMod("int")
    let classBonus = 0;
    for (let co of actor.itemTypes.class) {
        if (co.levelsTaken.includes(1)) {
            classBonus = getInheritableAttribute({
                entity: co,
                attributeKey: "trainedSkillsFirstLevel",
                reduce: "SUM"
            })
            break;
        }
    }
    let classSkills = Math.max(resolveValueArray([classBonus, intBonus]), 1);
    let automaticTrainedSkill = getInheritableAttribute({
        entity: actor,
        attributeKey: "automaticTrainedSkill",
        reduce: "VALUES_TO_LOWERCASE"
    }).filter(value => value === "#payload#").length;
    let otherSkills = getInheritableAttribute({
        entity: actor,
        attributeKey: "trainedSkills",
        reduce: "SUM"
    });
    return resolveValueArray([classSkills, otherSkills, automaticTrainedSkill]);
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
    let position
    if (key.endsWith("(pilot)")) {
        positionlessKey = key.slice(0, key.length - 7).trim()
        position = "Pilot";
    } else if (key.endsWith('(copilot)')) {
        positionlessKey = key.slice(0, key.length - 9).trim()
        position = "Copilot";
    } else if (key.endsWith('(commander)')) {
        positionlessKey = key.slice(0, key.length - 11).trim()
        position = "Commander";
    } else if (key.endsWith('(system operator)')) {
        positionlessKey = key.slice(0, key.length - 17).trim()
        position = "Systems Operator";
    } else if (key.endsWith('(engineer)')) {
        positionlessKey = key.slice(0, key.length - 10).trim()
        position = "Engineer";
    } else {
        return [];
    }
    crew = actor.crewman(position);

    if (!crew) {
        return [];
    }


    let reRollSkills = getInheritableAttribute({
        entity: crew,
        attributeKey: "skillReRoll"
    });

    applicableReRolls.push(...reRollSkills.filter(reroll => reroll.value.toLowerCase() === positionlessKey || reroll.value.toLowerCase() === "any"))

    let crewSkillBonus = crew.system.skills[positionlessKey]?.value || 0;
    let bonus = {
        value: crewSkillBonus,
        description: `${position} Skill Bonus (${crew.name}): ${crewSkillBonus}`
    }
    bonuses.push(bonus);
    return bonuses;
}
