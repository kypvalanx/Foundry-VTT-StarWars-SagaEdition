import {resolveHealth} from "./health.js";
import {AttackHandler} from "./attacks.js";
import {OffenseHandler} from "./offense.js";
import {SpeciesHandler} from "./species.js";
import {filterItemsByType, resolveValueArray} from "../util.js";
import {resolveDefenses} from "./defense.js";


// noinspection JSClosureCompilerSyntax
/**
 * Extend the base Actor entity by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class SWSEActor extends Actor {
    resolvedVariables = new Map();
    resolvedLabels = new Map();

    get classes(){
        return this.data.classes;
    }

    get age(){
        return this.data.data.age;
    }

    get species(){
        return this.data.species;
    }

    /**
     * Augment the basic actor data with additional dynamic data.
     */
    async prepareData() {
        super.prepareData();
        const actorData = this.data;
        // Make separate methods for each Actor type (character, npc, etc.) to keep
        // things organized.
        if (actorData.type === 'character') await this._prepareCharacterData(actorData);
        if (actorData.type === 'npc') await this._prepareCharacterData(actorData);
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

        actorData.traits = await this.getTraits();
        actorData.talents = this.getTalents(actorData);
        actorData.powers = this.getPowers(actorData);
        actorData.secrets = this.getSecrets(actorData);
        actorData.techniques = this.getTechniques(actorData);
        actorData.traditions = filterItemsByType("forceTradition", actorData.items);
        actorData.regimens = filterItemsByType("forceRegimen", actorData.items);
        actorData.equipped = this.getEquippedItems(actorData);
        actorData.unequipped = this.getUnequippedItems(actorData);
        actorData.inventory = this.getInventory(actorData);

        this._generateAttributes(this);
        await this._generateSkillData(this);

        let feats = await this._getActiveFeats(actorData);
        actorData.feats = feats.activeFeats;

        this.generateProvidedItemsFromItems(actorData);
        this._reduceProvidedItemsByExistingItems(actorData);

        actorData.data.health = await resolveHealth(this);
        actorData.data.defense = await resolveDefenses(this);
        actorData.data.offense = await new OffenseHandler().resolveOffense(this);


        await new AttackHandler().generateAttacks(this);
        await this._manageAutomaticItems(actorData, feats.removeFeats);

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

    async getTraits() {
        let traits = filterItemsByType("trait", this.items.values());
        this.data.traits = [];
        let activeTraits = this.data.traits;
        let possibleTraits = []
        for(let trait of traits){
            if(!trait.data.data.prerequisites || trait.data.data.prerequisites.length === 0){
                activeTraits.push(trait);
            } else {
                possibleTraits.push(trait);
            }
        }

        let shouldRetry = possibleTraits.length > 0;
        while(shouldRetry){
            shouldRetry = false;
            for(let possible of possibleTraits){
                if(this._meetsPrereqs(possible.data.data.prerequisites)){
                    activeTraits.push(possible);
                    shouldRetry = true;
                }
            }
            possibleTraits = possibleTraits.filter(possible => !activeTraits.includes(possible));
        }

        return activeTraits.sort((a,b) => {
            let x = a.data.data.finalName.toLowerCase();
            let y = b.data.data.finalName.toLowerCase();
            if (x < y) {return -1;}
            if (x > y) {return 1;}
            return 0;
        }).map(trait => trait.toJSON());
    }

    getEquippedItems(actorData) {
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
        return filterItemsByType1.map(power => power.toJSON());
    }

    getSecrets(actorData) {
        let filterItemsByType1 = filterItemsByType("forceSecret", actorData.items);
        let prerequisites = actorData.prerequisites;
        prerequisites.secrets = [];
        for (let secret of filterItemsByType1) {
            prerequisites.secrets.push(secret.name.toLowerCase());
        }
        return filterItemsByType1.map(secret => secret.toJSON());
    }

    getTechniques(actorData) {
        let filterItemsByType1 = filterItemsByType("forceTechnique", actorData.items);
        let prerequisites = actorData.prerequisites;
        prerequisites.techniques = [];
        for (let technique of filterItemsByType1) {
            prerequisites.techniques.push(technique.name.toLowerCase());
        }

        return filterItemsByType1.map(technique => technique.toJSON());
    }

    getTalents(actorData) {
        let filterItemsByType1 = filterItemsByType("talent", actorData.items);
        let prerequisites = actorData.prerequisites;

        prerequisites.talentTrees = {}
        prerequisites.talents = [];
        prerequisites.forceTalentTreesCount = 0;
        for (let talent of filterItemsByType1) {
            prerequisites.talents.push(talent.name.toLowerCase());
            if (prerequisites.talentTrees[talent.data.talentTree.toLowerCase()]) {
                prerequisites.talentTrees[talent.data.talentTree.toLowerCase()] = prerequisites.talentTrees[talent.data.talentTree.toLowerCase()] + 1;
            } else {
                prerequisites.talentTrees[talent.data.talentTree.toLowerCase()] = 1;
            }

            if (talent.talentTrees?.includes("Force Talent Trees")) {
                prerequisites.forceTalentTreesCount++;
            }
            if(!talent.data.talentTree){
                console.log(talent)
            }
        }

        return filterItemsByType1.map(talent => talent.toJSON());
    }

    async _getActiveFeats(actorData) {

        actorData.proficiency = {};
        actorData.proficiency.weapon = [];
        actorData.proficiency.armor = [];
        actorData.proficiency.focus = [];
        let prerequisites = actorData.prerequisites;
        prerequisites.feats = [];
        prerequisites.focusSkills = [];
        prerequisites.masterSkills = [];
        prerequisites.isForceTrained = false;
        let feats = await filterItemsByType("feat", this.items.values());
        let activeFeats = [];
        let removeFeats = [];
        for (let feat of feats) {
            let doesFail = this.meetsPrerequisites(feat.data.data.prerequisites, false).doesFail;
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
        let result = /(Weapon Proficiency|Armor Proficiency|Weapon Focus) \(([\w\s]*)\)/g.exec(feat.data.data.finalName);
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

        actorData.data.lockAttributes = this.shouldLockAttributes()
        let attributeTraits = actorData.traits.filter(trait => {
            let result = /([+-])\d* (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)/.exec(trait.name);
            return !!result;
        })
        let prerequisites = actorData.prerequisites;
        prerequisites.attributes = {};
        for (let [key, attribute] of Object.entries(actorData.data.attributes)) {
            let longKey = this._getLongKey(key);
            if(actorData.data.lockAttributes){
                attribute.base = 10;
            }
            let bonuses = [];
            let classLevelBonuses = []; //TODO WIRE ME UP
            let speciesBonuses = [];
            let ageBonuses = [];
            let equipmentBonuses = []; //TODO WIRE ME UP
            let buffBonuses = []; //TODO WIRE ME UP
            let customBonuses = []; //TODO WIRE ME UP
            for(let trait of attributeTraits){
                let result = /([+-\\d]*) (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)/.exec(trait.name)
                if(result[2].toLowerCase() === longKey){
                    //TODO add them to correct variables for tooltip
                    if(trait.data.prerequisites && trait.data.prerequisites.length > 0){
                        let prerequisite = trait.data.prerequisites[0];
                        if(/ABILITY:(?:Child|Young adult|Adult|Middle age|Old|Venerable)/.exec(prerequisite)){
                            ageBonuses.push(result[1]);
                            continue;
                        }
                    }
                    if(trait.data.supplier?.type === 'species'){
                        speciesBonuses.push(result[1]);
                        continue;
                    }
                    bonuses.push(result[1])
                }
            }
            attribute.classLevelBonus = resolveValueArray(classLevelBonuses, this);
            attribute.speciesBonus = resolveValueArray(speciesBonuses, this);
            attribute.ageBonus = resolveValueArray(ageBonuses, this);
            attribute.equipmentBonus = resolveValueArray(equipmentBonuses, this);
            attribute.buffBonus = resolveValueArray(buffBonuses, this);
            attribute.customBonus = resolveValueArray(customBonuses, this);

            bonuses.push(attribute.classLevelBonus);
            bonuses.push(attribute.speciesBonus);
            bonuses.push(attribute.ageBonus);
            bonuses.push(attribute.equipmentBonus);
            bonuses.push(attribute.buffBonus);
            bonuses.push(attribute.customBonus);

            for (let levelAttributeBonus of Object.values(actorData.data.levelAttributeBonus).filter(b => b != null)) {
                bonuses.push(levelAttributeBonus[key])
            }

            // Calculate the modifier using d20 rules.
            attribute.bonus = resolveValueArray(bonuses, this)
            attribute.total = attribute.base + attribute.bonus;
            attribute.mod = Math.floor((attribute.total - 10) / 2);
            attribute.roll = attribute.mod + actor.getConditionBonus()
            attribute.label = key.toUpperCase();
            this.resolvedVariables.set("@" + attribute.label, "1d20 + " + attribute.roll);
            this.resolvedLabels.set("@" + attribute.label, attribute.label);

            prerequisites.attributes[key] = {};
            prerequisites.attributes[key].value = attribute.total;
            prerequisites.attributes[longKey] = {};
            prerequisites.attributes[longKey].value = attribute.total;
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
        for (let [key, attribute] of Object.entries(this.data.data.attributes)) {
            response[key] = attribute.base;
        }
        return response;
    }

    async _generateSkillData(actor) {
        let actorData = actor.data;
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
            skill.value = this.getHalfCharacterLevel(actorData) + this.getAttributeMod(skill.attribute) + (skill.trained === true ? 5 : 0) + actor.getConditionBonus() + this._getAbilitySkillBonus(key, actorData);
            skill.key = `@${this.cleanKey(key)}`;
            this.resolvedVariables.set(skill.key, "1d20 + " + skill.value);
            skill.title = `Half character level: ${this.getHalfCharacterLevel(actorData)}
            Attribute Mod: ${this.getAttributeMod(skill.attribute)}
            Trained Skill Bonus: ${(skill.trained === true ? 5 : 0)}
            Condition Bonus: ${actor.getConditionBonus()}
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
        return this.classes.filter(charClass => {
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
        return actorData.data.attributes.con.skip;
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

    getUnequippedItems(actorData) {
        let filterItemsByType = this._getEquipable(actorData.items, actorData.data.isDroid);
        let unequipped = [];
        for (let item of filterItemsByType) {
            if (!actorData.data.equippedIds.includes(item._id)) {
                unequipped.push(item);
            }
        }
        return unequipped;
    }

    getInventory(actorData) {
        return this._getUnequipableItems(this._excludeItemsByType(actorData.items, "feat", "talent", "species", "class", "classFeature", "forcePower", "forceTechnique", "forceSecret", "ability", "trait"), actorData.data.isDroid).filter(i => !i.data.hasItemOwner);
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
        return this.data.data.attributes[ability].mod;
    }

    _getFirstClass(actorData) {
        for (let charClass of actorData?.classes ? actorData.classes : []) {
            if (charClass.data.attributes.first === true) {
                return charClass;
            }
        }
        return undefined;
    }

    getConditionBonus() {
        let condition = this.data.condition;
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
            try {
                await this.deleteEmbeddedEntity("OwnedItem", removal, {});
            } catch (e) {
                console.log(e);
                //this will be run in to if multiple sessions try to delete teh same item
            }
        } else {
            //await this._addItemsFromItems(actorData);
        }
    }


    getAbilityAttribute(actorData, attribute) {
        let values = [];
        for (let ability of actorData.traits) {
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

    async addItemsFromCompendium(compendium, parentItem, additionalEntitiesToAdd, items, ) {
        if (!Array.isArray(items)) {
            items = [items];
        }

        let entities = [];
        let notificationMessage = "";
        let pack = this.getCompendium(compendium);
        let index = await pack.getIndex();
        for (let item of items.filter(item => item)) {
            let {itemName, prerequisite, prerequisites, payload} = this.resolveItemParts(item);

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

            if(!data.prerequisites){
                data.prerequisites = [];
            }

            if(prerequisite){
                data.prerequisites.push(prerequisite);
            }
            if(prerequisites){
                data.prerequisites.push(...prerequisites);
            }

            if (parentItem) {
                data.supplier = {id: parentItem.id, name: parentItem.name, type: parentItem.data.type};
                data.isSupplied = true;
                data.categories = data.categories.filter(category => !category.includes('Bonus Feats')) //TODO anything else to filter?  is this the appropriate place?
            }

            if (payload !== "") {
                entity.setPayload(payload);
            }
            entity.setSourceString();
            entity.setTextDescription();
            notificationMessage = notificationMessage + `<li>${entry.name.titleCase() + (payload !== "" ? ` (${payload})` : "")}</li>`
            entities.push(entity);
        }
        additionalEntitiesToAdd.push(...entities);
        return {addedEntities: entities, notificationMessage: notificationMessage};
    }

    resolveItemParts(item) {
        let itemName = item;
        let prerequisites = item.prerequisites;
        let prerequisite = item.prerequisite;
        if (item.category) {
            itemName = item.category;
        }
        let result = /^([\w\s]*) \(([()\w\s*+]*)\)/.exec(itemName);
        let payload = "";
        if (result) {
            itemName = result[1];
            payload = result[2];
        }

        return {itemName, prerequisite, prerequisites, payload};
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
            case 'trait':
                return game.packs.get('world.swse-traits');
            case 'feat':
                return game.packs.get('world.swse-feats');
        }
    }

    cleanItemName(feat) {
        return feat.replace("*", "").trim();
    }


    meetsPrerequisites(prereqs, notifyOnFailure = true) {
        let failureList = []; //TODO return this with text failures
        for (let prereq of prereqs) {
            prereq = prereq.toLowerCase().replace(" species trait", "").replace(" feat", "").trim();

            let result = /^\(([\w\s()]*)\) or \(([\w\s()]*)\)$/.exec(prereq);
            if (result !== null) {

                if (this.meetsPrerequisites([result[1]], false).doesFail && this.meetsPrerequisites([result[2]], false).doesFail) {

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
                    isOr = isOr || this.meetsPrerequisites([tok], false).doesFail;
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
            result = /base attack bonus \+(\d*)/.exec(prereq);
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

    _fromOrdinal(numberWord) {
        let num = numberWord.toLowerCase();
        if (num === 'zero') {
            return 0;
        } else if (num === 'one') {
            return 1;
        } else if (num === 'two') {
            return 2;
        } else if (num === 'three') {
            return 3;
        } else if (num === 'four') {
            return 4;
        } else {
            console.error(`${numberWord} is unrecognized`);
        }
        return undefined;
    }

    //TODO clean this shit up move to actor and merge
    meetsClassPrereqs(prerequisites) {
        let failureList = [];
        for (let [key, value] of Object.entries(prerequisites.prerequisites)) {
            value = value.trim();
            key = key.trim();
            if (key.toLowerCase() === 'trained skills') {
                this.checkTrainedSkills(value, failureList, key);
            } else if (key.toLowerCase() === 'minimum level') {
                if (this.data.prerequisites.charLevel < parseInt(value)) {
                    failureList.push({fail: true, message: `<b>${key}:</b> ${value}`});
                }
            } else if (key.toLowerCase() === 'base attack bonus') {
                if (this.data.prerequisites.bab < parseInt(value)) {
                    failureList.push({fail: true, message: `<b>${key}:</b> ${value}`});
                }
            } else if (key.toLowerCase() === 'species') {
                if (this.data.prerequisites.species === value.toLowerCase) {
                    failureList.push({fail: true, message: `<b>${key}:</b> ${value}`});
                }
            } else if (key.toLowerCase() === 'force techniques') {
                let result = /at least (\w*)/.exec(value.toLowerCase());
                if (result != null) {
                    if (this.data.prerequisites.techniques.length < this._fromOrdinal(result[1])) {
                        failureList.push({fail: true, message: `<b>${key}:</b> ${value}`});
                    }
                }
            } else if (key.toLowerCase() === 'force powers') {
                if (!this.data.prerequisites.powers.includes(value.trim().toLowerCase())) {
                    failureList.push({fail: true, message: `<b>${key}:</b> ${value}`});
                }
            } else if (key.toLowerCase() === 'droid systems') {
                if (!this.data.prerequisites.equippedItems.includes(value.trim().toLowerCase())) {
                    failureList.push({fail: true, message: `<b>${key}:</b> ${value}`});
                }
            } else if (key.toLowerCase() === 'feats') {
                this.checkFeats(value, failureList, key);
            } else if (key.toLowerCase() === 'talents' || key.toLowerCase() === 'talent') {
                this.checkTalents(value, failureList, key);
            } else if (key.toLowerCase() === 'special') {
                if (value.toLowerCase() === 'must be a droid.' || value.toLowerCase() === 'must be a droid') {
                    if (!this.data.prerequisites.isDroid) {
                        failureList.push({fail: true, message: `<b>${key}:</b> ${value}`});
                    }
                } else {
                    failureList.push({fail: false, message: `<b>${key}:</b> ${value}`});
                }

            } else {
                console.error("UNIDENTIFIED PREREQ", "[" + key + "]", value);
                failureList.push({fail: true, message: `<b>${key}:</b> ${value} [UNIDENTIFIED]`});
            }
        }
        let doesFail = false;
        for (let fail of failureList) {
            if (fail.fail === true) {
                doesFail = true;
                break;
            }
        }

        return {doesFail: doesFail, failureList: failureList};
    }

    checkTrainedSkills(value, failureList, key) {
        let toks = [];
        if (value.includes(', ')) {
            toks = value.split(", ");
        } else if (value.includes(" and ")) {
            toks = value.split(" and ");
        } else {
            toks[0] = value;
        }

        for (let tok of toks) {
            tok = /([\w\s()]*)/.exec(tok)[1].trim();
            if (!this.data.prerequisites.trainedSkills.includes(tok.toLowerCase())) {
                failureList.push({fail: true, message: `<b>${key}:</b> ${tok}`});
            }
        }
    }


    checkTalents(value, failureList, key) {
        let result = /(?:at least|any) (\w*) talents? from ([\s\w,]*)\.?/.exec(value.toLowerCase());
        if (result != null) {
            let talentReq = false;
            let toks = [];
            if (result[2].includes(',')) {
                if (result[2].includes(' or ')) {
                    toks = result[2].split(",");
                } else {
                    console.log(toks);
                }
            } else if (result[2].includes(' or ')) {
                toks = result[2].split(" or ");
            } else {
                toks[0] = result[2];
            }

            for (let tok of toks) {
                tok = / ?(?:or )?(?:either )?(?:the )?([\s\w]*)/.exec(tok)[1];
                if (this.data.prerequisites.talentTrees[tok] >= this._fromOrdinal(result[1])) {
                    talentReq = true;
                }
            }
            if (!talentReq) {
                failureList.push({fail: true, message: `<b>${key}:</b> ${value}`});
            }

        } else {
            let result = /at least (\w*) force talents/.exec(value.toLowerCase());

            if (result != null) {
                if (this.data.prerequisites.forceTalentTreesCount < this._fromOrdinal(result[1])) {
                    failureList.push({fail: true, message: `<b>${key}:</b> ${value}`});
                }
            } else if (!this.data.prerequisites.talents.includes(value.toLowerCase())) {
                failureList.push({fail: true, message: `<b>${key}:</b> ${value}`});
            }
        }
    }

    checkFeats(value, failureList, key) {
        if (value.includes(',')) {
            let toks = value.split(",");
            for (let tok of toks) {
                if (!this._hasFeat(tok)) {
                    failureList.push({fail: true, message: `<b>${key}:</b> ${tok}`});
                }
            }

        } else if (!this.data.prerequisites.feats.includes(value.toLowerCase())) {
            failureList.push({fail: true, message: `<b>${key}:</b> ${value}`});
        }
    }

    _hasFeat(value) {
        if (value.includes(" or ")) {
            let toks = value.split(" or ");
            let hasFeat = false;
            for (let tok of toks) {
                hasFeat = hasFeat || this.data.prerequisites.feats.includes(tok.trim().toLowerCase());
            }
            return hasFeat;
        } else {
            return this.data.prerequisites.feats.includes(value.trim().toLowerCase());
        }
    }

    resolveClassFeatures(actorData, classFeatures) {
        let pattern = /^([\D\s]*?) ?\+?\(?([\d,]*)?(?:\/Encounter)?\)?$/;  ///needs a space whn no other grammer
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
        actorData.availableItems['General Feats'] = 1 + Math.floor(classLevel / 3);
        actorData.activeFeatures.push(...tempFeatures)
    }

    async filterOutInvisibleAbilities(actorData) {
        let filtered = [];
        for (let trait of actorData.traits) {
            // if (trait.name === 'Species' || trait.name === 'Homebrew Content' || trait.name === 'Web Enhancements' || trait.name === 'Natural Armor'
            //     || trait.name.startsWith('Bonus Class Skill') || trait.name.startsWith('Bonus Trained Skill') || trait.name.includes('Creations')) {
            //
            //     continue;
            // } else if (trait.name.startsWith("Bonus Feat") || trait.name.startsWith("Conditional Bonus Feat")) {
            //     let bonusFeat = await this.cleanItemName(trait.data.data.payload);
            //     let feats = await filterItemsByType("feat", actorData.items);
            //     let featDoesntExist = undefined === await feats.find(feat => feat.name === bonusFeat);
            //     if (!featDoesntExist) {
            //         continue;
            //     }
            //     //TODO add prerequisites here?  or even better on trait creation
            // }
            filtered.push(trait)
        }
        return filtered;
    }

    _reduceProvidedItemsByExistingItems(actorData) {
        for (let talent of actorData.talents) {
            this.reduceAvailableItem(actorData, talent.data.talentTreeSource);
        }
        for (let feat of actorData.feats) {
            if (feat.data.data.isSupplied) {
                continue;
            }
            let type = 'General Feats';
            if (feat.bonusFeatCategories && feat.bonusFeatCategories.length > 0) {
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
                    actorData.availableItems[type] += Math.max(1, 1 + actorData.data.abilities.wis.mod);
                } else {
                    actorData.availableItems[type] = Math.max(1, 1 + actorData.data.abilities.wis.mod);
                }
            }
        }
        for (let trait of actorData.traits) {
            if (trait.name === 'Bonus Feat') {
                //TODO find species that have this category that shouldn't
                let type = 'General Feats'
                if (actorData.availableItems[type]) {
                    actorData.availableItems[type] += 1;
                } else {
                    actorData.availableItems[type] = 1;
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
    setAge(age) {
        this.update({'data.age': age})
    }

    setGender(sex, gender) {
        this.update({'data.sex': sex, 'data.gender': gender})
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

    shouldLockAttributes() {
        return !!this.data.traits.find(trait => trait.name === 'Disable Attribute Modification');
    }

    _meetsPrereqs(prerequisites) {
        let meetsPrereqs = true;
        for(let prerequisite of prerequisites){
            meetsPrereqs = meetsPrereqs && this._meetsPrereq(prerequisite);
        }

        return meetsPrereqs;
    }

    _meetsPrereq(prerequisite) {
        if(prerequisite.startsWith("ABILITY") || prerequisite.startsWith("TRAIT")){
            let abilityName = prerequisite.split(":")[1];
            let ts = this.data.traits.filter(trait => trait.data.data.finalName === abilityName);
            return ts && ts.length > 0;
        } else if (prerequisite.startsWith("AGE")){
            let ageRange = prerequisite.split(":")[1];
            return this._isAgeInRange(this.data.data.age, ageRange);
        }
        return false;
    }

    _isAgeInRange(age, ageRange) {
        if(!age){
            return false;
        }
        if(ageRange.includes("-")){
            let tok = ageRange.split("-");
            return parseInt(tok[0]) <= age && parseInt(tok[1]) >= age;
        }else if(ageRange.includes("+")){
            let tok = ageRange.split("+");
            return parseInt(tok[0])<= age;
        }
        return false;
    }
}
