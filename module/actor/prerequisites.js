export class PrerequisitesHandler {
    async resolvePrerequisites(actor) {
        let actorData = actor.data
        actorData.prerequisites = {};
        let prerequisites = actorData.prerequisites;
        prerequisites.trainedSkills = [];
        prerequisites.focusSkills = [];
        prerequisites.masterSkills = [];
        for (let [key, skill] of Object.entries(actorData.data.skills)) {
            if (skill.trained) {
                prerequisites.trainedSkills.push(key.toLowerCase());
            }
        }
        for (let feat of actorData.feats) {
            let proficiency = /Skill Focus \(([\w\s]*)\)/g.exec(feat.name);
            if (proficiency) {
                prerequisites.focusSkills.push(proficiency[1].toLowerCase());
            }
            proficiency = /Skill Mastery \(([\w\s]*)\)/g.exec(feat.name);
            if (proficiency) {
                prerequisites.masterSkills.push(proficiency[1].toLowerCase());
            }
        }

        prerequisites.charLevel = actor.getCharacterLevel(actorData);
        prerequisites.feats = [];
        prerequisites.isForceTrained = false;
        for (let feat of actorData.feats) {
            prerequisites.feats.push(feat.name.toLowerCase());
            if ('force training' === feat.name.toLowerCase()) {
                prerequisites.isForceTrained = true;
            }
        }
        prerequisites.talentTrees = {}
        prerequisites.talents = [];
        prerequisites.forceTalentTreesCount = 0;
        for (let talent of actorData.talents) {
            prerequisites.talents.push(talent.name.split(" - ")[1].toLowerCase());
            if (prerequisites.talentTrees[talent.talentTree.toLowerCase()]) {
                prerequisites.talentTrees[talent.talentTree.toLowerCase()] = prerequisites.talentTrees[talent.talentTree.toLowerCase()] + 1;
            } else {
                prerequisites.talentTrees[talent.talentTree.toLowerCase()] = 1;
            }

            if (talent.talentTrees.includes("Force Talent Trees")) {
                prerequisites.forceTalentTreesCount++;
            }
        }

        prerequisites.attributes = {};
        for(let [key,ability] of Object.entries(actorData.data.abilities)){
            prerequisites.attributes[key] = {};
            prerequisites.attributes[key].value = ability.total;
            let longKey = this._getLongKey(key);
            prerequisites.attributes[longKey] = {};
            prerequisites.attributes[longKey].value = ability.total;
        }

        prerequisites.techniques = [];
        for (let technique of actorData.techniques) {
            prerequisites.techniques.push(technique.name.toLowerCase());
        }

        prerequisites.secrets = [];
        for (let secret of actorData.secrets) {
            prerequisites.secrets.push(secret.name.toLowerCase());
        }

        prerequisites.powers = [];
        for (let power of actorData.powers) {
            prerequisites.powers.push(power.name.toLowerCase());
        }

        prerequisites.species = actorData.species?.name.toLowerCase();

        prerequisites.equippedItems = [];
        for (let item of actorData.equipped) {
            prerequisites.equippedItems.push(item.name.toLowerCase());
        }

        prerequisites.bab = actorData.data.offense.bab;

        prerequisites.isDroid = actorData.data.isDroid;
    }

    _getLongKey(key) {
        switch (key){
            case 'str':
                return 'strength';
            case 'dex':
                return 'dexterity';
            case 'con':
                return 'constitution';
            case 'int':
                return 'intelligence';
            case 'wis':
                return 'wisdom';
            case 'cha':
                return 'charisma';
        }
        return undefined;
    }
}