import {resolveHealth} from "./health.mjs";
import {AttackHandler} from "./attacks.mjs";
import {OffenseHandler} from "./offense.mjs";
import {SpeciesHandler} from "./species.mjs";
import {filterItemsByType, resolveValueArray} from "../util.mjs";
import {resolveDefenses} from "./defense.mjs";


/**
 * Extend the base Actor entity by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class SWSEActor extends Actor {
    resolvedVariables = new Map();
    resolvedLabels = new Map();

    /**
     * Augment the basic actor data with additional dynamic data.
     */
    async prepareData() {
        super.prepareData();
        const actorData = this.data;
        // Make separate methods for each Actor type (character, npc, etc.) to keep
        // things organized.
        if (actorData.type === 'character') await this._prepareCharacterData(actorData);
    }

    /**
     * Prepare Character type specific data
     */
    async _prepareCharacterData(actorData) {
        actorData.prerequisites = {};
        new SpeciesHandler().generateSpeciesData(this);
        if (await this._generateClassData(actorData)) {
            return; //do not continue to process.  this just set a class to the first class and will rerun the prepare method
        }
        await this._handleCondition(actorData);

        actorData.generalAbilities = filterItemsByType("ability", actorData.items);
        actorData.talents = this.getTalents(actorData);
        actorData.powers = this.getPowers(actorData);
        actorData.secrets = this.getSecrets(actorData);
        actorData.techniques = this.getTechniques(actorData);
        actorData.traditions = filterItemsByType("forceTradition", actorData.items);
        actorData.regimens = filterItemsByType("forceRegimen", actorData.items);
        actorData.equipped = this.getEquipped(actorData);
        actorData.unequipped = this._getUnequippedItems(actorData);
        actorData.inventory = this._getInventory(actorData);

        this._generateAttributes(this);
        await this._generateSkillData(actorData);

        let feats = this._getActiveFeats(actorData);
        actorData.feats = feats.activeFeats;

        this.generateProvidedItemsFromItems(actorData);
        this._reduceProvidedItemsByExistingItems(actorData);

        actorData.data.health = await resolveHealth(this);
        actorData.data.defense = await resolveDefenses(this);
        actorData.data.offense = await new OffenseHandler().resolveOffense(this);


        await new AttackHandler().generateAttacks(this);
        await this._manageAutomaticItems(actorData, feats.removeFeats);
        actorData.visibleAbilities = await this.filterOutInvisibleAbilities(actorData);

        try {
            if (this.sheet?.rendered) {
                this.sheet.render(true);
            } else {
                this.sheet.render(false)
            }
        } catch (e) {
            console.log("couldn't find charactersheet.  probably fine")
        }
    }

    getEquipped(actorData) {
        let getEquippedItems = this._getEquippedItems(actorData, this._getEquipable(actorData.items, actorData.data.isDroid));
        let prerequisites = actorData.prerequisites;
        prerequisites.equippedItems = [];
        for (let item of getEquippedItems) {
            prerequisites.equippedItems.push(item.name.toLowerCase());
        }
        return getEquippedItems;
    }

    getPowers(actorData) {
        let filterItemsByType1 = filterItemsByType("forcePower", actorData.items);
        let prerequisites = actorData.prerequisites;
        prerequisites.powers = [];
        for (let power of filterItemsByType1) {
            prerequisites.powers.push(power.name.toLowerCase());
        }
        return filterItemsByType1;
    }

    getSecrets(actorData) {
        let filterItemsByType1 = filterItemsByType("forceSecret", actorData.items);
        let prerequisites = actorData.prerequisites;
        prerequisites.secrets = [];
        for (let secret of filterItemsByType1) {
            prerequisites.secrets.push(secret.name.toLowerCase());
        }
        return filterItemsByType1;
    }

    getTechniques(actorData) {
        let filterItemsByType1 = filterItemsByType("forceTechnique", actorData.items);
        let prerequisites = actorData.prerequisites;
        prerequisites.techniques = [];
        for (let technique of filterItemsByType1) {
            prerequisites.techniques.push(technique.name.toLowerCase());
        }

        return filterItemsByType1;
    }

    getTalents(actorData) {
        let filterItemsByType1 = filterItemsByType("talent", actorData.items);
        let prerequisites = actorData.prerequisites;

        prerequisites.talentTrees = {}
        prerequisites.talents = [];
        prerequisites.forceTalentTreesCount = 0;
        for (let talent of filterItemsByType1) {
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

        return filterItemsByType1;
    }

    _getActiveFeats(actorData) {

        actorData.proficiency = {};
        actorData.proficiency.weapon = [];
        actorData.proficiency.armor = [];
        actorData.proficiency.focus = [];
        let prerequisites = actorData.prerequisites;
        prerequisites.feats = [];
        prerequisites.focusSkills = [];
        prerequisites.masterSkills = [];
        prerequisites.isForceTrained = false;
        let feats = filterItemsByType("feat", actorData.items);
        let activeFeats = [];
        let removeFeats = [];
        for (let feat of feats) {
            let doesFail = this.meetsFeatPrerequisites(feat.data.prerequisites, false).doesFail;
            if (!doesFail) {
                activeFeats.push(feat)

                prerequisites.feats.push(feat.name.toLowerCase());
                this.checkForForceTraining(feat, prerequisites);
                this.checkIsSkillFocus(feat, prerequisites);
                this.checkIsSkillMastery(feat, prerequisites);
                this.checkForProficiencies(feat, actorData);
            } else if(doesFail && !feat.data.isSupplied){
                removeFeats.push(feat);
            }
        }

        return {activeFeats, removeFeats};
    }

    checkForForceTraining(feat, prerequisites) {
        if ('force training' === feat.name.toLowerCase()) {
            prerequisites.isForceTrained = true;
        }
    }

    checkForProficiencies(feat, actorData) {
        let result = /(Weapon Proficiency|Armor Proficiency|Weapon Focus) \(([\w\s]*)\)/g.exec(feat.name);
        if (result === null) {
            return;
        }
        if (result[1] === 'Weapon Proficiency') {
            actorData.proficiency.weapon.push(result[2].toLowerCase());
        } else if (result[1] === 'Armor Proficiency') {
            actorData.proficiency.armor.push(result[2].toLowerCase());
        } else if (result[1] === 'Weapon Focus') {
            actorData.proficiency.focus.push(result[2].toLowerCase());
        }
    }

    checkIsSkillMastery(feat, prerequisites) {
        let proficiency2 = /Skill Mastery \(([\w\s]*)\)/g.exec(feat.name);
        if (proficiency2) {
            prerequisites.masterSkills.push(proficiency2[1].toLowerCase());
        }
    }

    checkIsSkillFocus(feat, prerequisites) {
        let proficiency = /Skill Focus \(([\w\s]*)\)/g.exec(feat.name);
        if (proficiency) {
            prerequisites.focusSkills.push(proficiency[1].toLowerCase());
        }
    }

    getVariable(variableName) {
        let value = this.resolvedVariables.get(variableName);
        if (!value) {
            console.error("could not find " + variableName);
        }
        return value;
    }

    _handleCondition(actorData) {
        let condition = actorData.data.health.condition;
        if (condition == null) {
            condition = 0;
        }
        actorData.data.health.condition = condition;
        actorData.data.condition = [];
        actorData.data.condition[0] = condition === 0;
        actorData.data.condition[1] = condition === 1;
        actorData.data.condition[2] = condition === 2;
        actorData.data.condition[3] = condition === 3;
        actorData.data.condition[4] = condition === 4;
        actorData.data.condition[5] = condition === 5;
    }

    _generateAttributes(actor) {
        let actorData = actor.data;


        let prerequisites = actorData.prerequisites;
        prerequisites.attributes = {};
        for (let [key, ability] of Object.entries(actorData.data.abilities)) {
            prerequisites.attributes[key] = {};
            prerequisites.attributes[key].value = ability.total;
            let longKey = this._getLongKey(key);
            prerequisites.attributes[longKey] = {};
            prerequisites.attributes[longKey].value = ability.total;

            let bonuses = [];
            bonuses.push(ability.classLevelBonus);
            bonuses.push(ability.speciesBonus);
            bonuses.push(ability.ageBonus);
            bonuses.push(ability.equipmentBonus);
            bonuses.push(ability.buffBonus);
            bonuses.push(ability.customBonus);

            for (let levelAttributeBonus of Object.values(actorData.data.levelAttributeBonus).filter(b => b != null)) {
                bonuses.push(levelAttributeBonus[key])
            }

            // Calculate the modifier using d20 rules.
            ability.bonus = resolveValueArray(bonuses, this)
            ability.total = ability.base + ability.bonus;
            ability.mod = Math.floor((ability.total - 10) / 2);
            ability.roll = ability.mod + SWSEActor.getConditionBonus(actorData.condition)
            ability.label = key.toUpperCase();
            this.resolvedVariables.set("@" + ability.label, "1d20 + " + ability.roll);
            this.resolvedLabels.set("@" + ability.label, ability.label);
        }
    }

    setAttributes(attributes) {
        let update = {};
        for (let [key, ability] of Object.entries(attributes)) {
            update[`data.abilities.${key}.base`] = ability;
        }
        this.update(update);
    }


    getAttributes() {
        let response = {};
        for (let [key, ability] of Object.entries(this.data.data.abilities)) {
            response[key] = ability.base;
        }
        return response;
    }

    async _generateSkillData(actorData) {
        let firstClass = await this._getFirstClass(actorData);
        let intBonus = await this.getAttributeMod("int")
        let remainingSkills = 0;
        if (firstClass) {
            remainingSkills = parseInt(firstClass.data.skills.perLevel) + parseInt(intBonus);
        }


        let prerequisites = actorData.prerequisites;
        prerequisites.trainedSkills = [];
        let classSkills = await this._getClassSkills(actorData);
        for (let [key, skill] of Object.entries(actorData.data.skills)) {
            skill.isClass = classSkills.has(key);
            // Calculate the modifier using d20 rules.
            skill.value = this.getHalfCharacterLevel(actorData) + this.getAttributeMod(skill.ability) + (skill.trained === true ? 5 : 0) + SWSEActor.getConditionBonus(actorData.condition) + this._getAbilitySkillBonus(key, actorData);
            skill.key = `@${this.cleanKey(key)}`;
            this.resolvedVariables.set(skill.key, "1d20 + " + skill.value);
            skill.title = `Half character level: ${this.getHalfCharacterLevel(actorData)}
            Attribute Mod: ${this.getAttributeMod(skill.ability)}
            Trained Skill Bonus: ${(skill.trained === true ? 5 : 0)}
            Condition Bonus: ${SWSEActor.getConditionBonus(actorData)}
            Ability Skill Bonus: ${this._getAbilitySkillBonus(key, actorData)}`;
            if (skill.trained) {
                prerequisites.trainedSkills.push(key.toLowerCase());
                if (classSkills.size === 0) {
                    let data = {};
                    data["data.skills." + key + ".trained"] = false;
                    await this.update(data);
                } else {
                    remainingSkills = remainingSkills - 1;
                }
            }
            skill.label = await this._uppercaseFirstLetters(key).replace("Knowledge", "K.");
            this.resolvedLabels.set(skill.key, skill.label);
        }
        if (remainingSkills > 0) {
            actorData.data.remainingSkills = remainingSkills;
        } else if (remainingSkills < 0) {
            actorData.data.tooManySkills = Math.abs(remainingSkills);
        }
    }

    getHalfCharacterLevel(actorData = this.data) {
        return Math.floor(this.getCharacterLevel(actorData) / 2);
    }

    getCharacterLevel(actorData = this.data) {
        if (actorData.classes) {
            this.resolvedVariables.set("@charLevel", actorData.classes.length);
            return actorData.classes.length;
        }
        return 0;
    }

    _excludeItemsByType(items, type) {
        let types = [];
        types[0] = type;
        if (arguments.length > 2) {
            for (let i = 2; i < arguments.length; i++) {
                types[i - 1] = arguments[i];
            }
        }
        let filtered = [];
        for (let i = 0; i < items.length; i++) {
            if (!types.includes(items[i].type)) {
                filtered.push(items[i]);
            }
        }
        return filtered;
    }

    _getEquipable(items, isDroid) {
        let filtered = [];
        for (let i = 0; i < items.length; i++) {
            if (items[i].data.equipable
                && ((isDroid && items[i].data.droidPart) || (!items[i].data.droidPart))
                && ((!isDroid && items[i].data.bioPart) || (!items[i].data.bioPart))) {
                filtered.push(items[i]);
            }
        }
        return filtered;
    }


    _getUnequipableItems(items, isDroid) {
        let filtered = [];
        for (let i = 0; i < items.length; i++) {
            if (!items[i].data.equipable || (!isDroid && items[i].data.droidPart) || (isDroid && items[i].data.bioPart)) {
                filtered.push(items[i]);
            }
        }
        return filtered;
    }

    getNonPrestigeClasses() {
        return this.data.classes.filter(charClass => {
            return !charClass.data.prerequisites.isPrestige;
        });
    }

    /**
     * Extracts important stats from the class
     */
    async _generateClassData(actorData) {
        actorData.classes = await filterItemsByType("class", actorData.items);
        let classLevels = await new Map();
        let classFeatures = [];

        let prerequisites = actorData.prerequisites;

        prerequisites.charLevel = this.getCharacterLevel(actorData);
        for (let charClass of actorData.classes) {
            let name = charClass.name;
            classLevels.computeIfAbsent(name, () => []).push(charClass);
        }
        this.handleClassFeatures(classLevels, classFeatures, actorData);

        let classCount = actorData.classes.length;
        if (classCount > 0) {
            actorData.classes[classCount - 1].isLatest = true;
        }
        return this.extracted(classCount, actorData);
    }

    extracted(classCount, actorData) {
        let hasUpdate = false;
        let numOfAttributeBonuses = Math.floor(classCount / 4);
        if (!actorData.data.levelAttributeBonus) {
            actorData.data.levelAttributeBonus = {};
            hasUpdate = true;
        }

        for (let [level, value] of Object.entries(actorData.data.levelAttributeBonus)) {
            if (level > numOfAttributeBonuses * 4 && value !== null) {
                actorData.data.levelAttributeBonus[level] = null;
                hasUpdate = true;
            }
        }
        for (let i = 1; i <= numOfAttributeBonuses; i++) {
            let level = i * 4;
            if (!actorData.data.levelAttributeBonus[level]) {
                actorData.data.levelAttributeBonus[level] = {};
                hasUpdate = true;
            }
        }

        if (hasUpdate) {
            return this.update({'data.levelAttributeBonus': actorData.data.levelAttributeBonus});
        }
        return undefined;
    }

    handleClassFeatures(classLevels, classFeatures, actorData) {
        for (let [name, classItems] of classLevels.entries()) {
            for (let i = 0; i < classItems.length; i++) {
                classFeatures.push(...(this._getClassFeatures(name, classItems[i], i)))
            }
        }

        this.resolveClassFeatures(actorData, classFeatures);
    }

    _getClassFeatures(className, classObject, i) {
        let classFeatures = classObject.data.levels[i + 1]['CLASS FEATURES'];
        let features = [];
        if (!classFeatures) {
            return features;
        }
        let split = classFeatures.split(', ');
        for (let feature of split) {
            if (feature === 'Defense Bonuses' || feature === 'Starting Feats') {
                continue;
            } else if (feature === 'Talent') {
                features.push({
                    className: className,
                    feature: `Talent (${className})`,
                    supplier: {id: classObject._id, name: classObject.name}
                });
                continue;
            }
            features.push({
                className: className,
                feature: feature,
                supplier: {id: classObject._id, name: classObject.name}
            });
        }

        return features;
    }

    ignoreCon(actorData) {
        return actorData.data.abilities.con.skip;
    }


    _getEquippedItems(actorData, items) {
        let equipped = [];
        for (let item of items) {
            if (actorData.data.equippedIds === undefined) {
                actorData.data.equippedIds = [];
            }

            if (actorData.data.equippedIds.includes(item._id)) {
                equipped.push(item);
            }
        }
        return equipped;
    }

    _getUnequippedItems(actorData) {
        let filterItemsByType = this._getEquipable(actorData.items, actorData.data.isDroid);
        let unequipped = [];
        for (let item of filterItemsByType) {
            if (!actorData.data.equippedIds.includes(item._id)) {
                unequipped.push(item);
            }
        }
        return unequipped;
    }

    _getInventory(actorData) {
        return this._getUnequipableItems(this._excludeItemsByType(actorData.items, "feat", "talent", "species", "class", "classFeature", "forcePower", "forceTechnique", "forceSecret", "ability"), actorData.data.isDroid).filter(i => !i.data.hasItemOwner);
    }

    _uppercaseFirstLetters(s) {
        const words = s.split(" ");

        for (let i = 0; i < words.length; i++) {
            if (words[i][0] === "(") {
                words[i] = words[i][0] + words[i][1].toUpperCase() + words[i].substr(2);
            } else {
                words[i] = words[i][0].toUpperCase() + words[i].substr(1);
            }
        }
        return words.join(" ");
    }

    _getClassSkills(actorData) {
        let classSkills = new Set()
        if (!actorData.classes) {
            return classSkills;
        }
        for (let charClass of actorData.classes) {
            if (charClass.data.skills) {
                for (let skill of charClass.data.skills.skills) {
                    if (skill.toLowerCase() === "knowledge (all skills, taken individually)") {
                        classSkills.add("knowledge (galactic lore)");
                        classSkills.add("knowledge (bureaucracy)");
                        classSkills.add("knowledge (life sciences)");
                        classSkills.add("knowledge (physical sciences)");
                        classSkills.add("knowledge (social sciences)");
                        classSkills.add("knowledge (tactics)");
                        classSkills.add("knowledge (technology)");
                    } else {
                        classSkills.add(skill.toLowerCase())
                    }
                }
            }
        }
        let abilityClassSkills = this.getAbilityAttribute(actorData, 'classSkill');
        for (let classSkill of abilityClassSkills) {
            classSkills.add(classSkill.toLowerCase());
        }

        return classSkills;
    }

    getAttributeMod(ability) {
        return this.data.data.abilities[ability].mod;
    }

    _getFirstClass(actorData) {
        for (let charClass of actorData?.classes ? actorData.classes : []) {
            if (charClass.data.attributes.first === true) {
                return charClass;
            }
        }
        return undefined;
    }

    static getConditionBonus(condition) {
        switch (condition) {
            case 0:
                break;
            case 1:
                return -1;
            case 2:
                return -2;
            case 3:
                return -5;
            case 4:
                return -10;
            case 5:
                break;
        }
        return 0;
    }

    async _manageAutomaticItems(actorData, removeFeats) {
        let itemIds = actorData.items.flatMap(i => [i._id, i.flags.core?.sourceId?.split(".")[3]]).filter(i => i !== undefined);

        let removal = [];
        removeFeats.forEach(f =>removal.push(f._id))
        for (let item of actorData.items) {
            let itemData = item.data;
            if (itemData.isSupplied) {
                //console.log(itemIds, itemData.supplier)
                if (!itemIds.includes(itemData.supplier.id) || !itemData.supplier) {
                    removal.push(item._id)
                }

                if (item.name === 'Precise Shot' && itemData.supplier.name === 'Point-Blank Shot' && !game.settings.get('swse', 'mergePointBlankShotAndPreciseShot')) {
                    removal.push(item._id);
                }
            }
        }
        if (removal.length > 0) {
            console.log("deleting:", removal)
            await this.deleteEmbeddedEntity("OwnedItem", removal, {});
        } else {
            //await this._addItemsFromItems(actorData);
        }
    }


    getAbilityAttribute(actorData, attribute) {
        let values = [];
        for (let ability of actorData.generalAbilities) {
            if (ability.data.attributes[attribute]) {
                values.push(ability.data.attributes[attribute])
            }
        }
        return values;
    }

    _getAbilitySkillBonus(skill, actorData) {
        if (skill.toLowerCase() === 'stealth') {
            let stealthBonuses = this.getAbilityAttribute(actorData, 'sneakModifier');
            let total = 0;
            for (let stealthBonus of stealthBonuses) {
                total = total + stealthBonus;
            }
            return total;
        }
        return 0;
    }


    async optionalRules(actorData, entities) {
        for (let feat of actorData.feats) {
            if (feat.name === 'Point-Blank Shot') {
                if (game.settings.get('swse', 'mergePointBlankShotAndPreciseShot')) {
                    if (undefined === actorData.feats.find(feat => feat.name === "Precise Shot")) {
                        console.log(feat)
                        await this.addItemsFromCompendium('feat', {
                            name: feat.name,
                            data: {type: 'feat'},
                            id: feat._id
                        }, entities, 'Precise Shot');
                    }
                }
            }
        }
    }

    async addItemsFromCompendium(compendium, parentItem, additionalEntitiesToAdd, itemNames) {
        if (!Array.isArray(itemNames)) {
            itemNames = [itemNames];
        }
        let entities = [];
        let notificationMessage = "";
        let pack = this.getCompendium(compendium);
        let index = await pack.getIndex();
        for (let itemName of itemNames.filter(itemName => itemName !== null)) {
            let result = /^([\w\s]*) \(([()\w\s*+]*)\)/.exec(itemName);
            let payload = "";
            if (result) {
                itemName = result[1];
                payload = result[2];
            }
            let entry = await index.find(f => f.name === this.cleanItemName(itemName));
            if (!entry) {
                entry = await index.find(f => f.name === this.cleanItemName(itemName + " (" + payload + ")"));
            }

            if (!entry) {
                console.warn(`attempted to add ${itemName}`, arguments)
                continue;
            }

            let entity = await pack.getEntity(entry._id);
            let data = entity.data.data;
            if (compendium === 'feat') {
                let exploded = [];
                for (let prerequisite of data.prerequisites) {
                    exploded.push(prerequisite.replace("#payload#", payload));
                }
                data.prerequisites = exploded;
            }

            if (parentItem) {
                data.supplier = {id: parentItem.id, name: parentItem.name, type: parentItem.data.type};
                data.isSupplied = true;
                data.categories = data.categories.filter(category => !category.includes('Bonus Feats')) //TODO anything else to filter?  is this the appropriate place?
            }

            if (payload !== "") {
                data.payload = payload;
            }
            notificationMessage = notificationMessage + `<li>${entry.name.titleCase() + (payload !== "" ? ` (${payload})` : "")}</li>`
            entities.push(entity);
        }
        additionalEntitiesToAdd.push(...entities);
        return {addedEntities: entities, notificationMessage: notificationMessage};
    }

    async _createItems(itemData) {
        if (!itemData) {
            return;
        }
        if (!Array.isArray(itemData)) {
            let temp = itemData;
            itemData = [];
            itemData.push(temp);
        }
        await this.createEmbeddedEntity("OwnedItem", itemData, {renderSheet: false});
    }

    _formatPrerequisites(failureList) {
        let format = "<ul>";
        for (let fail of failureList) {
            format = format + "<li>" + fail.message + "</li>";
        }
        return format + "</ul>";
    }

    getCompendium(type) {
        switch (type) {
            case 'item':
                return game.packs.get('world.swse-items');
            case 'ability':
                return game.packs.get('world.swse-abilities');
            case 'feat':
                return game.packs.get('world.swse-feats');
        }
    }

    cleanItemName(feat) {
        return feat.replace("*", "").trim();
    }

    _getMatchingAbilities(actorData, regExp) {
        let values = [];
        for (let ability of actorData.generalAbilities) {
            if (regExp.exec(ability.name)) {
                values.push(ability)
            }
        }
        return values;
    }

    meetsFeatPrerequisites(prereqs, notifyOnFailure = true) {
        let failureList = []; //TODO return this with text failures
        for (let prereq of prereqs) {
            prereq = prereq.toLowerCase().replace(" species trait", "").replace(" feat", "").trim();

            let result = /^\(([\w\s()]*)\) or \(([\w\s()]*)\)$/.exec(prereq);
            if (result !== null) {

                if (this.meetsFeatPrerequisites([result[1]], false).doesFail && this.meetsFeatPrerequisites([result[2]], false).doesFail) {

                    failureList.push({fail: true, message: prereq});
                }
                continue;
            }
            result = /trained in ([\s\w()]*)/.exec(prereq);
            if (result !== null || 'jump or swim' === prereq) {
                let trainedSkill = 'jump or swim' === prereq ? 'jump or swim' : result[1];
                let trainedSkills = this.data?.prerequisites?.trainedSkills;
                if (trainedSkill.includes(" or ")) {
                    let skills = trainedSkill.split(" or ");
                    if (!(trainedSkills.includes(skills[0]) || trainedSkills.includes(skills[1]))) {
                        failureList.push({fail: true, message: prereq});
                    }
                } else if (trainedSkill.includes(" and ")) {
                    let skills = trainedSkill.split(" and ");
                    if (!(trainedSkills.includes(skills[0]) && trainedSkills.includes(skills[1]))) {
                        failureList.push({fail: true, message: prereq});
                    }
                } else if (trainedSkill === 'at least one knowledge skill') {
                    let hasKnowledgeTrained = false;
                    for (let skill of trainedSkills) {
                        if (skill.startsWith("knowledge")) {
                            hasKnowledgeTrained = true;
                            break;
                        }
                    }
                    if (!(hasKnowledgeTrained)) {
                        failureList.push({fail: true, message: prereq});
                    }
                } else {
                    if (!(trainedSkills.includes(trainedSkill))) {
                        failureList.push({fail: true, message: prereq});
                    }
                }
                continue;
            }

            result = /(\d)?(?:\+ )?([\s\w,]* )?(?:appendage|locomotion)/.exec(prereq);
            if (result !== null) {
                let count = result[1] ? parseInt(result[1]) : 1;
                let itemNames = result[2] ? result[2].trim().replace(" or ", " ").replace(/, /g, " ").split(" ") : ["any"];

                for (let item of this.items) {
                    for (let req of itemNames) {
                        if ((req === 'any' && item.data.data.categories?.includes("appendages")) || item.name.toLowerCase() === req) {
                            count--;
                        }
                    }
                }

                if (!(count < 1)) {
                    failureList.push({fail: true, message: prereq});
                }
                continue;
            }

            result = /(\w*) (?:size )?or larger/.exec(prereq);
            if (result !== null) {
                let sizes = [];
                if (result[1] === 'small') {
                    sizes = ["colossal", "gargantuan", "huge", "large", "medium", "small"];
                } else if (result[1] === 'medium') {
                    sizes = ["colossal", "gargantuan", "huge", "large", "medium"];
                }
                let hasSize = false;
                for (let item of this.items) {
                    for (let size of sizes) {
                        if (size === item.name.toLowerCase()) {
                            hasSize = true;
                        }
                    }
                }
                if (!(hasSize)) {
                    failureList.push({fail: true, message: prereq});
                }
                continue;
            }


            if (prereq.includes(" or ")) {
                let toks = prereq.split(" or ");
                let isOr = false;
                for (let tok of toks) {
                    isOr = isOr || this.meetsFeatPrerequisites([tok], false).doesFail;
                }
                if (!(isOr)) {
                    failureList.push({fail: true, message: prereq});
                }
                continue;
            }


            result = /(intelligence|charisma|strength|dexterity|constitution|wisdom) (\d*)/.exec(prereq);
            if (result !== null) {
                let prerequisite = this.data.prerequisites.attributes[result[1]];
                if (prerequisite.value < parseInt(result[2])) {
                    failureList.push({fail: true, message: prereq});
                }
                continue;
            }
            result = /(?:base attack bonus) \+(\d*)/.exec(prereq);
            if (result !== null) {
                if (this.data.prerequisites.bab < parseInt(result[1])) {
                    failureList.push({fail: true, message: prereq});
                }
                continue;
            }
            result = /(\d*)(?:th|st|nd|rd) character level/.exec(prereq);
            if (result !== null) {
                if (this.data.prerequisites.charLevel > result[1]) {
                    failureList.push({fail: true, message: prereq});
                }
                continue;
            }

            if (prereq.includes("is member of the sith")) {

                failureList.push({fail: false, message: prereq});
                continue;
            }

            if (prereq.includes("have a destiny")) {

                failureList.push({fail: false, message: prereq});
                continue;
            }
            if (prereq === 'droid') {
                if (this.data.prerequisites.isDroid === false) {
                    failureList.push({fail: true, message: prereq});
                }
                continue;
            }
            if (prereq === 'cannot be a droid') {
                if (this.data.prerequisites.isDroid === true) {
                    failureList.push({fail: true, message: prereq});
                }
                continue;
            }
            if (prereq.includes("dark side score")) {

                failureList.push({fail: false, message: prereq});
                continue;
            }
            if (prereq.includes("receive the gamemaster's approval")) {

                failureList.push({fail: false, message: prereq});
                continue;
            }
            if (prereq.includes("at least 1 level in the shaper class")) {
                let hasItem = false;
                for (let item of this.items) {
                    if (item.name.toLowerCase() === 'shaper') {
                        hasItem = true;
                    }
                }
                if (!hasItem) {
                    failureList.push({fail: true, message: prereq});
                }
                continue;
            }
            if (prereq.includes("must possess an implant")) {

                failureList.push({fail: false, message: prereq});
                continue;
            }
            result = /([\w\s]*) \(chosen skill\)/.exec(prereq);
            if (result !== null) {
                let hasItem = false;
                for (let item of this.items) {
                    if (item.name.toLowerCase().startsWith(result[1])) {
                        hasItem = true;
                    }
                }
                if (!hasItem) {
                    failureList.push({fail: true, message: prereq});
                }
                continue;
            }
            if (prereq.includes("proficient with #payload#")) {

                continue;
            }
            result = /proficient with ([\w\s]*)/.exec(prereq)
            if(result!==null){
                if(!this.data.proficiency.weapon.includes(result[1]) && !this.data.proficiency.armor.includes(result[1])){
                    failureList.push({fail: true, message: prereq});
                }
                continue;
            }


            result = /([\w\s]*) \(chosen weapon\)/.exec(prereq);
            if (result !== null) {
                let hasItem = false;
                for (let item of this.items) {
                    if (item.name.toLowerCase().startsWith(result[1])) {
                        hasItem = true;
                    }
                }
                if (!hasItem) {
                    failureList.push({fail: true, message: prereq});
                }
                continue;
            }

            //do we have an item or species or feat or talent or ability TODO handle equipped
            let hasItem = false;
            for (let item of this.items) {
                if (item.name.toLowerCase() === prereq) {
                    hasItem = true;
                }
            }

            if (!(hasItem)) {
                failureList.push({fail: true, message: prereq});
            }
        }

        let doesFail = false;
        for (let fail of failureList) {
            if (fail.fail === true) {
                doesFail = true;
                break;
            }
        }

        let meetsPrereqs = {doesFail: doesFail, failureList: failureList};

        if (meetsPrereqs.doesFail && notifyOnFailure) {
            new Dialog({
                title: "You Don't Meet the Prerequisites!",
                content: "You do not meet the prerequisites for this feat:<br/>" + this._formatPrerequisites(meetsPrereqs.failureList),
                buttons: {
                    ok: {
                        icon: '<i class="fas fa-check"></i>',
                        label: 'Ok'
                    }
                }
            }).render(true);

        } else if (!meetsPrereqs.doesFail && meetsPrereqs.failureList.length > 0 && notifyOnFailure) {
            new Dialog({
                title: "You MAY Meet the Prerequisites!",
                content: "You MAY meet the prerequisites for this feat. Check the remaining reqs:<br/>" + this._formatPrerequisites(meetsPrereqs.failureList),
                buttons: {
                    ok: {
                        icon: '<i class="fas fa-check"></i>',
                        label: 'Ok'
                    }
                }
            }).render(true);
        }

        return meetsPrereqs;
    }

    resolveClassFeatures(actorData, classFeatures) {
        let pattern = /^([\D\s]*?)(?: )?(?:\+)?(?:\()?([\d,]*)?(?:\/Encounter)?(?:\))?$/;  ///needs a space whn no other grammer
        actorData.availableItems = {};
        actorData.activeFeatures = [];
        let tempFeatures = new Set();
        for (let feature of classFeatures) {
            let result = pattern.exec(feature.feature);
            if (feature.feature.startsWith("Talent")) {
                let result = /Talent \(([\w\s]*)\)/.exec(feature.feature);
                let type = `${result[1]} Talents`;
                actorData.availableItems[type] = actorData.availableItems[type] ? actorData.availableItems[type] + 1 : 1;

            } else if (feature.feature === 'Force Talent') {
                let type = 'Force Talents';
                actorData.availableItems[type] = actorData.availableItems[type] ? actorData.availableItems[type] + 1 : 1;
            } else if (feature.feature.startsWith("Bonus Feat ")) {
                let result = /Bonus Feat \(([\w\s]*)\)/.exec(feature.feature);
                let type = result[1] + " Bonus Feats";
                actorData.availableItems[type] = actorData.availableItems[type] ? actorData.availableItems[type] + 1 : 1;
            } else if (feature.feature === 'Force Technique') {
                let type = "Force Techniques";
                actorData.availableItems[type] = actorData.availableItems[type] ? actorData.availableItems[type] + 1 : 1;
            } else if (feature.feature === 'Force Secret') {
                let type = "Force Secrets";
                actorData.availableItems[type] = actorData.availableItems[type] ? actorData.availableItems[type] + 1 : 1;
            } else if (result) {
                feature.feature = result[1].trim();
                tempFeatures.add(feature);
            } else {
                console.log("UNUSED CLASS FEATURE: ", feature)
            }
        }
        let classLevel = actorData.classes.length;
        actorData.availableItems['General Feats'] = 1 + Math.floor(classLevel / 3) + ((actorData.species && actorData.species.data.categories.includes('Bonus Feat')) ? 1 : 0); //TODO find species that have this category that shouldn't
        actorData.activeFeatures.push(...tempFeatures)
    }

    async filterOutInvisibleAbilities(actorData) {
        let filtered = [];
        for (let ability of actorData.generalAbilities) {
            if (ability.name === 'Species' || ability.name === 'Homebrew Content' || ability.name === 'Web Enhancements' || ability.name === 'Natural Armor'
                || ability.name.startsWith('Bonus Class Skill') || ability.name.startsWith('Bonus Trained Skill') || ability.name.includes('Creations')) {

                continue;
            } else if (ability.name.startsWith("Bonus Feat") || ability.name.startsWith("Conditional Bonus Feat")) {
                let bonusFeat = await this.cleanItemName(ability.data.payload);
                let feats = await filterItemsByType("feat", actorData.items);
                let featDoesntExist = undefined === await feats.find(feat => feat.name === bonusFeat);
                if (!featDoesntExist) {
                    continue;
                }
                //TODO add prerequisites here?  or even better on ability creation
            }
            filtered.push(ability)
        }

        return filtered;
    }

    _reduceProvidedItemsByExistingItems(actorData) {
        for (let talent of actorData.talents) {
            let pattern = /([\w\s\d-]* Talents)/;
            let type = pattern.exec(talent.talentTrees[0])[1];
            this.reduceAvailableItem(actorData, type);
        }
        for (let feat of actorData.feats) {
            if (feat.data.isSupplied) {
                continue;
            }
            let type = 'General Feats';
            if (feat.bonusFeatCategories.length > 0) {
                type = feat.bonusFeatCategories[0]
            }
            this.reduceAvailableItem(actorData, type);
        }
        this.reduceAvailableItem(actorData, "Force Secrets", actorData.secrets.length);
        this.reduceAvailableItem(actorData, "Force Techniques", actorData.techniques.length);
        this.reduceAvailableItem(actorData, "Force Powers", actorData.powers.length);
    }

    reduceAvailableItem(actorData, type, reduceBy = 1) {
        if (actorData.availableItems[type]) {
            actorData.availableItems[type] = actorData.availableItems[type] - reduceBy;
        } else {
            actorData.availableItems[type] = -1 * reduceBy;
        }

        if (actorData.availableItems[type] === 0) {
            delete actorData.availableItems[type];
        }
    }

    //TODO this seems Force Training specific.  maybe move it.
    generateProvidedItemsFromItems(actorData) {
        for (let feat of actorData.feats) {
            if (feat.name === 'Force Training') {
                let type = 'Force Powers';
                if (actorData.availableItems[type]) {
                    actorData.availableItems[type] = actorData.availableItems[type] + Math.max(1, 1 + actorData.data.abilities.wis.mod);
                } else {
                    actorData.availableItems[type] = Math.max(1, 1 + actorData.data.abilities.wis.mod);
                }
            }
        }
    }

    cleanKey(key) {
        return this._uppercaseFirstLetters(key).replace("Knowledge ", "K").replace("(", "").replace(")", "").replace(" ", "").replace(" ", "")
    }


    rollVariable(variable) {
        let rollStr = this.resolvedVariables.get(variable);
        let label = this.resolvedLabels.get(variable);

        let roll = new Roll(rollStr);

        roll.toMessage({
            speaker: ChatMessage.getSpeaker({actor: this.actor}),
            flavor: label
        });
    }

    rollItem(itemId) {

        let item = this.getOwnedItem(itemId);

        let attacks = new AttackHandler().generateAttacksFromWeapon(item.data, this);

        let templateType = "attack";
        const template = `systems/swse/templates/chat/${templateType}-card.hbs`;

        let content = '';
        for (let attack of attacks) {
            content += `<p><button class="roll" data-roll="${attack.th}" data-name="${attack.name} Attack Roll">${attack.name} Roll Attack</button></p>
                       <p><button class="roll" data-roll="${attack.dam}" data-name="${attack.name} Damage Roll">${attack.name} Roll Damage</button></p>`
        }

        new Dialog({
            title: 'Attacks',
            content: content,
            buttons: {
                close: {
                    icon: '<i class="fas fa-check"></i>',
                    label: 'Close'
                }
            },
            render: html => {
                html.find("button.roll").on("click", (event) => {
                    let target = $(event.currentTarget);
                    let formula = target.data("roll");
                    let name = target.data("name");
                    let modifications = target.data("modifications");
                    let notes = target.data("notes");

                    this.sendRollToChat(template, formula, modifications, notes, name);
                });
            }
        }).render(true);
    }

    async rollAttack(variable) {
        let attack = this.resolvedAttacks.get(variable);

        let templateType = "attack";
        const template = `systems/swse/templates/chat/${templateType}-card.hbs`;

        let content = `<p><button class="roll" data-roll="${attack.th}" data-name="${attack.name} Attack Roll">Roll Attack</button></p>
                       <p><button class="roll" data-roll="${attack.dam}" data-name="${attack.name} Damage Roll">Roll Damage</button></p>`

        new Dialog({
            title: attack.name,
            content: content,
            buttons: {
                close: {
                    icon: '<i class="fas fa-check"></i>',
                    label: 'Close'
                }
            },
            render: html => {
                html.find("button.roll").on("click", (event) => {
                    let target = $(event.currentTarget);
                    let formula = target.data("roll");
                    let name = target.data("name");

                    this.sendRollToChat(template, formula, attack.modifications, attack.notes, name);
                });
            }
        }).render(true);
    }

    async sendRollToChat(template, formula, modifications, notes, name) {
        let roll = new Roll(formula).roll();
        roll.toMessage({
            speaker: ChatMessage.getSpeaker({actor: this.actor}),
            flavor: name
        });
    }

    async _onCreate(data, options, userId, context) {
        if (data.type === "character") await this.update({"token.actorLink": true}, {updateChanges: false});

        // if (userId === game.user._id) {
        //     await updateChanges.call(this);
        // }

        super._onCreate(data, options, userId, context);
    }


    getAttributeGenerationType() {
        return this.data.data.attributeGenerationType;
    }

    setAttributeGenerationType(attributeGenerationType) {
        this.update({'data.attributeGenerationType': attributeGenerationType})
    }

    getAttributeLevelBonus(level) {
        console.log(this.data)
        return this.data.data.levelAttributeBonus[level];
    }

    setAttributeLevelBonus(level, attributeLevelBonus) {
        let data = {};
        data[`data.levelAttributeBonus.${level}`] = attributeLevelBonus;
        this.update(data)
    }

    _getLongKey(key) {
        switch (key) {
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
