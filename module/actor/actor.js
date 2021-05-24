import {resolveHealth} from "./health.js";
import {generateAttacks} from "./attack-handler.js";
import {OffenseHandler} from "./offense.js";
import {SpeciesHandler} from "./species.js";
import {filterItemsByType, excludeItemsByType} from "../util.js";
import {resolveDefenses} from "./defense.js";
import {generateAttributes} from "./attribute-handler.js";
import {generateSkills} from "./skill-handler.js";
import {generateArmorCheckPenalties} from "./armor-check-penalty.js";


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
        await super.prepareData();
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

        actorData.equipped = this.getEquippedItems().map(item => item.data);
        actorData.unequipped = this.getUnequippedItems().map(item => item.data);
        actorData.inventory = this.getNonequippableItems().map(item => item.data);
        actorData.traits = await this.getTraits();
        actorData.talents = this.getTalents();
        actorData.powers = this.getPowers(actorData);
        actorData.secrets = this.getSecrets(actorData);
        actorData.techniques = this.getTechniques(actorData);
        actorData.traditions = filterItemsByType(actorData.items, "forceTradition");
        actorData.regimens = filterItemsByType(actorData.items, "forceRegimen");
        actorData.speed = this.getSpeed();

        generateAttributes(this);

        actorData.acPenalty=await generateArmorCheckPenalties(this);

        await generateSkills(this);

        let feats = await this._getFeats(actorData);
        actorData.feats = feats.activeFeats;
        actorData.inactiveProvidedFeats = feats.inactiveProvidedFeats;

        this.generateProvidedItemsFromItems(actorData);
        this._reduceProvidedItemsByExistingItems(actorData);

        actorData.data.health = await resolveHealth(this);
        actorData.data.defense = await resolveDefenses(this);
        actorData.data.offense = await new OffenseHandler().resolveOffense(this);


        await generateAttacks(this);
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
        let traits = filterItemsByType(this.items.values(), "trait");
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
        }).map(trait => trait.data);
    }

    getEquippedItems() {
        let getEquippedItems = this._getEquippedItems(this._getEquipable(this.getInventoryItems(), this.data.data.isDroid));
        let prerequisites = this.data.prerequisites;
        prerequisites.equippedItems = [];
        for (let item of getEquippedItems) {
            prerequisites.equippedItems.push(item.name.toLowerCase());
        }
        return getEquippedItems;
    }

    getPowers(actorData) {
        let filterItemsByType1 = filterItemsByType(actorData.items, "forcePower");
        let prerequisites = actorData.prerequisites;
        prerequisites.powers = [];
        for (let power of filterItemsByType1) {
            prerequisites.powers.push(power.name.toLowerCase());
        }
        return filterItemsByType1.map(power => power.data);
    }

    getSecrets(actorData) {
        let filterItemsByType1 = filterItemsByType(actorData.items, "forceSecret");
        let prerequisites = actorData.prerequisites;
        prerequisites.secrets = [];
        for (let secret of filterItemsByType1) {
            prerequisites.secrets.push(secret.name.toLowerCase());
        }
        return filterItemsByType1.map(secret => secret.data);
    }

    getTechniques(actorData) {
        let filterItemsByType1 = filterItemsByType(actorData.items, "forceTechnique");
        let prerequisites = actorData.prerequisites;
        prerequisites.techniques = [];
        for (let technique of filterItemsByType1) {
            prerequisites.techniques.push(technique.name.toLowerCase());
        }

        return filterItemsByType1.map(technique => technique.data);
    }

    getTalents() {
        let filterItemsByType1 = filterItemsByType(this.items.values(), "talent");
        let prerequisites = this.data.prerequisites;

        prerequisites.talentTrees = {}
        prerequisites.talents = [];
        prerequisites.forceTalentTreesCount = 0;
        for (let talent of filterItemsByType1) {
            prerequisites.talents.push(talent.name.toLowerCase());
            let talentTree = talent.data.data.talentTree.toLowerCase();
            if (prerequisites.talentTrees[talentTree]) {
                prerequisites.talentTrees[talentTree]++;
            } else {
                prerequisites.talentTrees[talentTree] = 1;
            }

            if (talent.talentTrees?.includes("Force Talent Trees")) {
                prerequisites.forceTalentTreesCount++;
            }
            if(!talent.data.talentTree){
                console.log(talent)
            }
        }

        return filterItemsByType1.map(talent => talent.data);
    }

    async _getFeats(actorData) {

        actorData.proficiency = {};
        actorData.proficiency.weapon = [];
        actorData.proficiency.armor = [];
        actorData.proficiency.focus = [];
        let prerequisites = actorData.prerequisites;
        prerequisites.feats = [];
        prerequisites.focusSkills = [];
        prerequisites.masterSkills = [];
        prerequisites.isForceTrained = false;
        let feats = await filterItemsByType(this.items.values(), "feat");
        let activeFeats = [];
        let removeFeats = [];
        let inactiveProvidedFeats = [];
        for (let feat of feats) {
            let prereqResponse = this.meetsPrerequisites(feat.data.data.prerequisites, false);
            let doesFail = prereqResponse.doesFail;
            if (!doesFail) {
                activeFeats.push(feat.data)
                prerequisites.feats.push(feat.name.toLowerCase());
                this.checkForForceTraining(feat, prerequisites);
                this.checkIsSkillFocus(feat, prerequisites);
                this.checkIsSkillMastery(feat, prerequisites);
                this.checkForProficiencies(feat, actorData);
            } else if(doesFail && !feat.data.data.isSupplied){
                removeFeats.push(feat.data);
            } else if(prereqResponse.failureList.length > 0){

                inactiveProvidedFeats.push(feat.data);
            }
        }

        return {activeFeats, removeFeats, inactiveProvidedFeats};
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

    _handleCondition() {
        if (this.data.data.condition === null) {
            this.data.data.condition = 0;
        }
    }



    getConditionBonus() {
        let condition = this.data.data.condition;
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

    setAttributes(attributes) {
        let update = {};
        for (let [key, ability] of Object.entries(attributes)) {
            update[`data.attributes.${key}.base`] = ability;
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

    getHalfCharacterLevel() {
        return Math.floor(this.getCharacterLevel() / 2);
    }

    getCharacterLevel() {
        if (this.data.classes) {
            this.resolvedVariables.set("@charLevel", this.data.classes.length);
            return this.data.classes.length;
        }
        return 0;
    }



    _getEquipable(items, isDroid) {
        let filtered = [];
        for (let item of items) {
            if (item.data.data.equipable
                && ((isDroid && item.data.data.droidPart) || (!item.data.data.droidPart))
                && ((!isDroid && item.data.data.bioPart) || (!item.data.data.bioPart))) {
                filtered.push(item);
            }
        }
        return filtered;
    }


    _getUnequipableItems(items, isDroid) {
        let filtered = [];
        for (let item of items) {
            if (!item.data.data.equipable || (!isDroid && item.data.data.droidPart) || (isDroid && item.data.data.bioPart)) {
                filtered.push(item);
            }
        }
        return filtered;
    }

    getNonPrestigeClasses() {
        return this.classes.filter(charClass => {
            return !charClass.data.prerequisites.isPrestige;
        });
    }

    isProficientWith(item){

        if(item.type === 'armor'){
            return this.data.proficiency.armor.includes(item.armorType.toLowerCase());
        }

        return false;
    }

    /**
     * Extracts important stats from the class
     */
    async _generateClassData(actorData) {
        actorData.classes = await filterItemsByType( actorData.items,"class");
        let classLevels = await new Map();
        let classFeatures = [];

        let prerequisites = actorData.prerequisites;

        prerequisites.charLevel = this.getCharacterLevel();
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

    ignoreCon() {
        return this.data.data.attributes.con.skip;
    }


    _getEquippedItems(items) {
        let equipped = [];
        for (let item of items) {
            if (this.data.data.equippedIds === undefined) {
                this.data.data.equippedIds = [];
            }

            if (this.data.data.equippedIds.includes(item.data._id)) {
                equipped.push(item);
            }
        }
        return equipped;
    }

    getUnequippedItems() {
        let filterItemsByType = this._getEquipable(this.getInventoryItems(), this.data.data.isDroid);
        let unequipped = [];
        for (let item of filterItemsByType) {
            if (!this.data.data.equippedIds.includes(item.data._id)) {
                unequipped.push(item);
            }
        }
        return unequipped;
    }

    getNonequippableItems() {
        return this._getUnequipableItems(this.getInventoryItems(), this.data.data.isDroid).filter(i => !i.data.hasItemOwner);
    }

    getInventoryItems() {
        return excludeItemsByType(this.items.values(), "feat", "talent", "species", "class", "classFeature", "forcePower", "forceTechnique", "forceSecret", "ability", "trait");
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
        let abilityClassSkills = this.getTraitAttributesByKey('classSkill');
        for (let classSkill of abilityClassSkills) {
            classSkills.add(classSkill.toLowerCase());
        }

        return classSkills;
    }

    getAttributeMod(ability) {
        return this.data.data.attributes[ability].mod;
    }

    getFirstClass() {
        let actorData = this.data;
        for (let charClass of actorData?.classes ? actorData.classes : []) {
            if (charClass.data.attributes.first === true) {
                return charClass;
            }
        }
        return undefined;
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


    getTraitAttributesByKey(attributeKey) {
        let values = [];
        for (let ability of this.data.traits) {
            let attribute = ability.data.attributes[attributeKey];
            if (attribute) {
                if(Array.isArray(attribute)) {
                    values.push(...attribute)
                } else {
                    values.push(attribute)
                }
            }
        }
        return values;
    }

    _getAbilitySkillBonus(skill) {
        if (skill.toLowerCase() === 'stealth') {
            let stealthBonuses = this.getTraitAttributesByKey('sneakModifier');
            let total = 0;
            for (let stealthBonus of stealthBonuses) {
                total = total + stealthBonus;
            }
            return total;
        }
        return 0;
    }

    async addItemsFromCompendium(compendium, parentItem, additionalEntitiesToAdd, items) {
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
        let silentFailList = [];
        for (let prereq of prereqs) {
            let prereqStandardCase = prereq
            prereq = prereqStandardCase.toLowerCase().replace(/ species trait/, "").replace(/ feat/, "").trim();


            //NEW CHECKS
            if(prereqStandardCase.startsWith('SETTING')){
                let settingName = prereqStandardCase.split(":")[1]
                if(!game.settings.get('swse', settingName)){
                    silentFailList.push({fail: true, message: `The ${settingName} setting is not active`})
                }
                continue;
            }

            if(prereq === 'trained in #payload#'){
                continue;
            }

            //OLD CHECKS to be verified

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

        for (let fail of silentFailList) {
            if (fail.fail === true) {
                doesFail = true;
                break;
            }
        }

        let meetsPrereqs = {doesFail, failureList, silentFail: silentFailList};

        if(notifyOnFailure && meetsPrereqs.failureList.length > 0) {
            if (meetsPrereqs.doesFail) {
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

            } else {
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

    /**
     *
     * @param value
     * @returns {boolean}
     * @private
     */
    _hasFeat(value) {
        if (value.includes(" or ")) {
            let toks = value.split(" or ");
            let hasFeat = false;
            for (let tok of toks) {
                hasFeat = hasFeat || this._hasFeat(tok);
            }
            return hasFeat;
        } else {
            return this.data.prerequisites.feats.includes(value.trim().toLowerCase())
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
            this.reduceAvailableItem(actorData, talent.talentTreeSource);
        }
        for (let feat of actorData.feats) {
            if (feat.data.isSupplied) {
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
                let forcePowers = Math.max(1, 1 + actorData.data.abilities.wis.mod);
                if (actorData.availableItems[type]) {
                    actorData.availableItems[type] += forcePowers;
                } else {
                    actorData.availableItems[type] = forcePowers;
                }
            }
        }
        for (let trait of actorData.traits) {
            if (trait.data.finalName === 'Bonus Feat') {
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
        }else if (prerequisite.startsWith("GENDER")){
            let sex = prerequisite.split(":")[1];
            return this.data.data.sex.toLowerCase() === sex.toLowerCase();
        }else if (prerequisite.startsWith("EQUIPPED")){
            let item = prerequisite.split(":")[1];
            let es = this.data.equipped.filter(trait => trait.data.finalName === item);
            return es && es.length>0
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

    getSpeed() {
        let actorData = this.data;
        let attributeTraits = actorData.traits.filter(trait => {
            let result = /\w* Speed \d*/.exec(trait.name);
            return !!result;
        })
        return attributeTraits.map(trait => trait.name).join("; ");
    }

    isForceSensitive() {
        let hasForceSensativity = false;
        for(let item of this.items.values()){
            if(item.data.data.finalName === 'Force Sensitivity') {
                hasForceSensativity = true;
            }
        }
        return hasForceSensativity && !this.data.data.isDroid;
    }
}
