import {filterItemsByType} from "../util.js";

async function getAvailableTrainedSkillCount(actor) {
    let firstClass = await actor.getFirstClass();
    let remainingSkills = 0;
    if (firstClass) {
        let intBonus = await actor.getAttributeMod("int")
        remainingSkills = parseInt(firstClass.data.data.skills.perLevel) + parseInt(intBonus);
    }
    remainingSkills += filterItemsByType(actor.items.values(), "feat").filter(item => item.data.name === 'Skill Training').length;
    return remainingSkills;
}

/**
 *
 * @param actor {SWSEActor}
 * @returns {Promise<void>}
 */
export async function generateSkills(actor) {
    let actorData = actor.data;
    let remainingSkills = await getAvailableTrainedSkillCount(actor, actorData);

    let prerequisites = actorData.prerequisites;
    prerequisites.trainedSkills = [];
    let classSkills = await actor._getClassSkills();
    let halfCharacterLevel = actor.getHalfCharacterLevel();
    let conditionBonus = actor.conditionBonus;
    for (let [key, skill] of Object.entries(actorData.data.skills)) {
        skill.isClass = key === 'use the force' ? actor.isForceSensitive : classSkills.has(key);

        // Calculate the modifier using d20 rules.
        let attributeMod = actor.getAttributeMod(skill.attribute);
        let trainedSkillBonus = skill.trained === true ? 5 : 0;
        let getAbilitySkillBonus = actor._getAbilitySkillBonus(key);
        let acPenalty = skill.acp ? actorData.acPenalty : 0;

        skill.value = halfCharacterLevel + attributeMod + trainedSkillBonus + conditionBonus + getAbilitySkillBonus + acPenalty;
        skill.key = `@${actor.cleanSkillName(key)}`;
        actor.resolvedVariables.set(skill.key, "1d20 + " + skill.value);
        skill.label = await actor._uppercaseFirstLetters(key).replace("Knowledge", "K.");
        actor.resolvedLabels.set(skill.key, skill.label);

        skill.title = `Half character level: ${halfCharacterLevel}
            Attribute Mod: ${attributeMod}
            Trained Skill Bonus: ${trainedSkillBonus}
            Condition Bonus: ${conditionBonus}
            Ability Skill Bonus: ${getAbilitySkillBonus}
            Armor Check Penalty: ${acPenalty}`;

        if (!skill.trained) {
            continue
        }
        if (classSkills.size === 0) {
            let data = {};
            data["data.skills." + key + ".trained"] = false;
            await actor.update(data);
            return;
        }
        remainingSkills = remainingSkills - 1;
        prerequisites.trainedSkills.push(key.toLowerCase());
    }
    if (remainingSkills > 0) {
        actorData.data.remainingSkills = remainingSkills;
    } else if (remainingSkills < 0) {
        actorData.data.tooManySkills = Math.abs(remainingSkills);
    }
}
