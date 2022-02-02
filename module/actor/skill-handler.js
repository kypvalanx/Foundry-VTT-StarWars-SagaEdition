import {resolveValueArray} from "../util.js";

/**
 *
 * @param actor {SWSEActor}
 * @returns {Promise<number>}
 */
export function getAvailableTrainedSkillCount(actor) {
    let intBonus = actor.getAttributeMod("int")
    let classBonus = actor.getInheritableAttributesByKey("trainedSkillsFirstLevel", "SUM", item => item.document.getInheritableAttributesByKey("isFirstLevel", "OR"))
    let classSkills = Math.max(resolveValueArray([classBonus, intBonus]), 1);
    let otherSkills = actor.getInheritableAttributesByKey("trainedSkills", "SUM");
    return resolveValueArray([classSkills, otherSkills]);
}

/**
 *
 * @param actor
 */
export function generateSkills(actor) {
    let prerequisites = actor.data.prerequisites;
    prerequisites.trainedSkills = [];
    let classSkills = actor._getClassSkills();
    let halfCharacterLevel = actor.getHalfCharacterLevel();
    let conditionBonus = actor.conditionBonus;
    let skillFocuses = actor.getInheritableAttributesByKey("skillFocus", "VALUES").map(skill => (skill || "").toLowerCase())
    for (let [key, skill] of Object.entries(actor.data.data.skills)) {
        skill.isClass = key === 'use the force' ? actor.isForceSensitive : classSkills.has(key);

        // Calculate the modifier using d20 rules.
        let attributeMod = actor.getAttributeMod(skill.attribute);
        let trainedSkillBonus = skill.trained === true ? 5 : 0;
        let getAbilitySkillBonus = actor.getAbilitySkillBonus(key);
        let acPenalty = skill.acp ? actor.acPenalty : 0;
        let skillFocusBonus = skillFocuses.includes(key) ? 5 : 0;

        skill.value = resolveValueArray( [halfCharacterLevel, attributeMod, trainedSkillBonus, conditionBonus, getAbilitySkillBonus, acPenalty, skillFocusBonus]);
        skill.key = key;
        actor.resolvedVariables.set(`@${actor.cleanSkillName(key)}`, "1d20 + " + skill.value);
        skill.label = key.titleCase().replace("Knowledge", "K.");
        actor.resolvedLabels.set(`@${actor.cleanSkillName(key)}`, skill.label);

        skill.title = `Half character level: ${halfCharacterLevel}
            Attribute Mod: ${attributeMod}
            Trained Skill Bonus: ${trainedSkillBonus}
            Skill Focus Bonus: ${skillFocusBonus}
            Condition Bonus: ${conditionBonus}
            Ability Skill Bonus: ${getAbilitySkillBonus}
            Armor Check Penalty: ${acPenalty}`;

        if (!skill.trained) {
            continue
        }
        if (classSkills.size === 0) {
            let data = {};
            data["data.skills." + key + ".trained"] = false;
            actor.update(data);
            return;
        }
        prerequisites.trainedSkills.push(key.toLowerCase());
    }
}
