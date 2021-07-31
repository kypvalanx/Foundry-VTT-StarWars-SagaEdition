import {resolveHealth} from "./health.js";
import {generateAttacks, generateUnarmedAttacks} from "./attack-handler.js";
import {OffenseHandler} from "./offense.js";
import {SpeciesHandler} from "./species.js";
import {filterItemsByType, excludeItemsByType, resolveValueArray} from "../util.js";
import {resolveDefenses} from "./defense.js";
import {generateAttributes} from "./attribute-handler.js";
import {generateSkills} from "./skill-handler.js";
import {generateArmorCheckPenalties} from "./armor-check-penalty.js";
import {SWSEItem} from "../item/item.js";


// noinspection JSClosureCompilerSyntax
/**
 * Extend the base Actor entity by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class SWSEActor extends Actor {
    resolvedVariables = new Map();

    resolvedLabels = new Map();

    get classes() {
        return this.data.classes;
    }

    get age() {
        return this.data.data.age;
    }

    get species() {
        return this.data.species;
    }

    get speed(){
        return this.data.speed;
    }

    resolveSpeed() {
        let actorData = this.data;
        let attributeTraits = actorData.traits.filter(trait => {
            let result = /\w* Speed \d*/.exec(trait.name);
            return !!result;
        })
        let armorType = "";
        for(let armor of this.getEquippedItems().filter(item => item.type === "armor")){
            if(armor.armorType === "Heavy"){
                armorType = "Heavy";
                break;
            }
            if(armor.armorType === "Medium"){
                armorType = "Medium";
            }
            if(armor.armorType === "Light" && !armorType){
                armorType = "Light";
            }
        }
        return attributeTraits.map(trait => trait.name).map(name => this.reduceSpeedForArmorType(name,armorType)).join("; ");
    }

    reduceSpeedForArmorType(speed, armorType) {
        if (!armorType || "Light" === armorType) {
            return speed;
        }
        return speed.replace("4", "3").replace("6", "4");
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

        for (let item of this.items.values()) {
            //item.prepareData();
        }
        new SpeciesHandler().generateSpeciesData(this);
        let {bab, will, reflex, fortitude, level, classSummary} = this._generateClassData(actorData);
        await this._handleCondition(actorData);

        actorData.levelSummary = level;
        actorData.classSummary = classSummary;

        actorData.equipped = this.getEquippedItems().map(item => item.data);
        actorData.unequipped = this.getUnequippedItems().map(item => item.data);
        actorData.inventory = this.getNonequippableItems().map(item => item.data);
        actorData.traits = await this.getTraits().map(trait => trait.data);
        actorData.talents = this.getTalents().map(talent => talent.data);
        actorData.powers = this.getPowers().map(item => item.data);
        actorData.secrets = this.getSecrets().map(item => item.data);
        actorData.techniques = this.getTechniques().map(item => item.data);
        actorData.affiliations = filterItemsByType(this.items.values(), "affiliation").map(item => item.data);
        actorData.regimens = filterItemsByType(this.items.values(), "forceRegimen").map(item => item.data);

        generateAttributes(this);
        for(let i = 1; i <= actorData.data.attributes.wis.total; i++){
            if(actorData.data.darkSideScore < i){
                actorData.data.darkSideArray.push({value: i, active: false})
            } else{

                actorData.data.darkSideArray.push({value: i, active: true})
            }
        }

        actorData.acPenalty = await generateArmorCheckPenalties(this);

        await generateSkills(this);

        actorData.data.offense = await new OffenseHandler().resolveOffense(this, bab);
        let feats = this.getFeats();
        actorData.feats = feats.activeFeats;

        actorData.hideForce = 0 === actorData.feats.filter(feat => {
            return feat.name === 'Force Training'
        }).length

        actorData.inactiveProvidedFeats = feats.inactiveProvidedFeats

        this.generateProvidedItemsFromItems(actorData);
        this._reduceProvidedItemsByExistingItems(actorData);

        actorData.data.health = await resolveHealth(this);
        let {defense, armors} = await resolveDefenses(this);
        actorData.data.defense = defense;
        actorData.data.armors = armors;
        actorData.speed = this.resolveSpeed();

        await generateAttacks(this);
        await this._manageAutomaticItems(actorData, feats.removeFeats);
        if (await this.handleLeveBasedAttributeBonuses(actorData)) {
            return; //do not continue to process.  this just set a class to the first class and will rerun the prepare method
        }

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

    getTraits() {
        let traits = filterItemsByType(this.items.values(), "trait");
        this.data.traits = [];
        let activeTraits = this.data.traits;
        let possibleTraits = []
        for (let trait of traits) {
            if (!trait.data.data.prerequisite || trait.data.data.prerequisite.length === 0) {
                activeTraits.push(trait);
            } else {
                possibleTraits.push(trait);
            }
        }

        let shouldRetry = possibleTraits.length > 0;
        while (shouldRetry) {
            shouldRetry = false;
            for (let possible of possibleTraits) {
                let meetsPrerequisites1 = this.meetsPrerequisites(possible.data.data.prerequisite, false);
                if (!meetsPrerequisites1.doesFail) {
                    activeTraits.push(possible);
                    shouldRetry = true;
                }
            }
            possibleTraits = possibleTraits.filter(possible => !activeTraits.includes(possible));
        }

        return activeTraits.sort((a, b) => {
            let x = a.data.finalName.toLowerCase();
            let y = b.data.finalName.toLowerCase();
            if (x < y) {
                return -1;
            }
            if (x > y) {
                return 1;
            }
            return 0;
        });
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

    getPowers() {
        let filterItemsByType1 = filterItemsByType(this.items.values(), "forcePower");
        let prerequisites = this.data.prerequisites;
        prerequisites.powers = [];
        for (let power of filterItemsByType1) {
            prerequisites.powers.push(power.name.toLowerCase());
        }
        return filterItemsByType1;
    }

    getSecrets() {
        let filterItemsByType1 = filterItemsByType(this.items.values(), "forceSecret");
        let prerequisites = this.data.prerequisites;
        prerequisites.secrets = [];
        for (let secret of filterItemsByType1) {
            prerequisites.secrets.push(secret.name.toLowerCase());
        }
        return filterItemsByType1;
    }

    getTechniques() {
        let filterItemsByType1 = filterItemsByType(this.items.values(), "forceTechnique");
        let prerequisites = this.data.prerequisites;
        prerequisites.techniques = [];
        for (let technique of filterItemsByType1) {
            prerequisites.techniques.push(technique.name.toLowerCase());
        }

        return filterItemsByType1;
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
            if (!talentTree) {
                console.log(talent)
            }
        }

        return filterItemsByType1;
    }

    getFeats() {
        let actorData = this.data;
        actorData.proficiency = {};
        actorData.proficiency.weapon = [];
        actorData.proficiency.armor = [];
        actorData.proficiency.focus = [];
        actorData.proficiency.doubleAttack = [];
        actorData.proficiency.tripleAttack = [];
        actorData.proficiency.savageAttack = [];
        actorData.proficiency.relentlessAttack = [];
        actorData.proficiency.autofireSweep = [];
        actorData.proficiency.autofireAssault = [];
        actorData.proficiency.halt = [];
        actorData.proficiency.returnFire = [];
        actorData.proficiency.criticalStrike = [];
        let prerequisites = actorData.prerequisites;
        prerequisites.feats = [];
        prerequisites.focusSkills = [];
        prerequisites.masterSkills = [];
        prerequisites.isForceTrained = false;
        let feats = filterItemsByType(this.items.values(), "feat");
        let activeFeats = [];
        let removeFeats = [];
        let inactiveProvidedFeats = [];
        for (let feat of feats) {
            let prereqResponse = this.meetsPrerequisites(feat.data.data.prerequisite, false);
            let doesFail = prereqResponse.doesFail;
            if (!doesFail) {
                activeFeats.push(feat.data)
                prerequisites.feats.push(feat.name.toLowerCase());
                this.checkForForceTraining(feat, prerequisites);
                this.checkIsSkillFocus(feat, prerequisites);
                this.checkIsSkillMastery(feat, prerequisites);
                this.checkForProficiencies(feat, actorData);
                if (feat.data.finalName === 'Force Sensitivity') {
                    actorData.data.bonusTalentTree = "Force Talent";
                }
            } else if (doesFail && !feat.data.data.isSupplied) {
                removeFeats.push(feat.data);
            } else if (prereqResponse.failureList.length > 0) {

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
        let result = /(Weapon Proficiency|Armor Proficiency|Weapon Focus|Double Attack|Triple Attack|Savage Attack|Relentless Attack|Autofire Sweep|Autofire Assault|Halt|Return Fire|Critical Strike) \(([\w\s]*)\)/g.exec(feat.data.finalName);
        if (result === null) {
            return;
        }
        if (result[1] === 'Weapon Proficiency') {
            actorData.proficiency.weapon.push(result[2].toLowerCase());
        } else if (result[1] === 'Armor Proficiency') {
            actorData.proficiency.armor.push(result[2].toLowerCase());
        } else if (result[1] === 'Weapon Focus') {
            actorData.proficiency.focus.push(result[2].toLowerCase());
        } else if (result[1] === 'Double Attack') {
            actorData.proficiency.doubleAttack.push(result[2].toLowerCase());
        } else if (result[1] === 'Triple Attack') {
            actorData.proficiency.tripleAttack.push(result[2].toLowerCase());
        } else if (result[1] === 'Savage Attack') {
            actorData.proficiency.savageAttack.push(result[2].toLowerCase());
        } else if (result[1] === 'Relentless Attack') {
            actorData.proficiency.relentlessAttack.push(result[2].toLowerCase());
        } else if (result[1] === 'Autofire Sweep') {
            actorData.proficiency.autofireSweep.push(result[2].toLowerCase());
        } else if (result[1] === 'Autofire Assault') {
            actorData.proficiency.autofireAssault.push(result[2].toLowerCase());
        } else if (result[1] === 'Halt') {
            actorData.proficiency.halt.push(result[2].toLowerCase());
        } else if (result[1] === 'Return Fire') {
            actorData.proficiency.returnFire.push(result[2].toLowerCase());
        } else if (result[1] === 'Critical Strike') {
            actorData.proficiency.criticalStrike.push(result[2].toLowerCase());
        }
    }

    checkIsSkillMastery(feat, prerequisites) {
        let proficiency2 = /Skill Mastery \(([\w\s]*)\)/g.exec(feat.data.finalName);
        if (proficiency2) {
            prerequisites.masterSkills.push(proficiency2[1].toLowerCase());
        }
    }

    checkIsSkillFocus(feat, prerequisites) {
        let proficiency = /Skill Focus \(([\w\s]*)\)/g.exec(feat.data.finalName);
        if (proficiency) {
            prerequisites.focusSkills.push(proficiency[1].toLowerCase());
        }
    }

    getVariable(variableName) {
        let value = this.resolvedVariables.get(variableName);
        if (!value) {
            console.error("could not find " + variableName, this.resolvedVariables);
        }
        return value;
    }

    _handleCondition() {
        if (!this.data.data.condition) {
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


    getAttributeBases() {
        let response = {};
        for (let [key, attribute] of Object.entries(this.data.data.attributes)) {
            response[key] = attribute.base;
        }
        return response;
    }

    getAttributeBonuses(){
        let response = {};
        for (let [key, attribute] of Object.entries(this.data.data.attributes)) {
            response[key] = attribute.bonus;
        }
        return response;
    }

    /**
     *
     * @param {string} attributeName
     */
    getAttribute(attributeName) {
        for (let [key, attribute] of Object.entries(this.data.data.attributes)) {
            if (attributeName.toLowerCase() === key || this.toShortAttribute(attributeName).toLowerCase() === key) {
                return attribute.total;
            }
        }
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

    getHeroicLevel(){
        return this.getCharacterLevel();
    }


    _getEquipable(items, isDroid) {
        let filtered = [];
        for (let item of items) {
            if (item.data.data.isEquipable
                && ((isDroid && item.data.data.isDroidPart) || (!item.data.data.isDroidPart))
                && ((!isDroid && item.data.data.isBioPart) || (!item.data.data.isBioPart))) {
                filtered.push(item);
            }
        }
        return filtered;
    }


    _getUnequipableItems(items, isDroid) {
        let filtered = [];
        for (let item of items) {
            if (!item.data.data.isEquipable || (!isDroid && item.data.data.isDroidPart) || (isDroid && item.data.data.isBioPart)) {
                filtered.push(item);
            }
        }
        return filtered;
    }

    getNonPrestigeClasses() {
        return this.classes.filter(charClass => {
            return !charClass.data.prerequisite?.isPrestige;
        });
    }

    isProficientWith(item) {

        if (item.type === 'armor') {
            return this.data.proficiency.armor.includes(item.armorType.toLowerCase());
        }

        return false;
    }

    /**
     * Extracts important stats from the class
     */
    _generateClassData(actorData) {
        actorData.classes = filterItemsByType(actorData.items, "class");

        let classLevels = {};
        let classFeatures = [];
        let bab = 0;
        let will = 0;
        let reflex = 0;
        let fortitude = 0;
        let level = 0;
        //skills here?

        for (let characterClass of actorData.classes) {
            level++;
            if (!classLevels[characterClass.name]) {
                classLevels[characterClass.name] = 0;
                will = Math.max(will, characterClass.data.defense.will);
                reflex = Math.max(reflex, characterClass.data.defense.reflex);
                fortitude = Math.max(fortitude, characterClass.data.defense.fortitude);
            }
            let levelOfClass = ++classLevels[characterClass.name]

            let levelData = characterClass.data.levels[levelOfClass]
            bab += levelData.bab;
            classFeatures.push(...levelData.features)
        }



        let classSummary = Object.entries(classLevels).map((entity) => `${entity[0]} ${entity[1]}`).join(' / ');


        this.resolveClassFeatures(actorData, classFeatures);
        return {bab, will, reflex, fortitude, level, classSummary};
    }

    handleLeveBasedAttributeBonuses(actorData) {
        let characterLevel = actorData.classes.length;
        if (characterLevel > 0) {
            actorData.classes[characterLevel - 1].isLatest = true;
        }

        let hasUpdate = false;
        if (!actorData.data.levelAttributeBonus) {
            actorData.data.levelAttributeBonus = {};
            hasUpdate = true;
        }

        for (let bonusAttributeLevel = 4; bonusAttributeLevel < 21; bonusAttributeLevel += 4) {
            if (bonusAttributeLevel > characterLevel) {
                if (actorData.data.levelAttributeBonus[bonusAttributeLevel]) {
                    actorData.data.levelAttributeBonus[bonusAttributeLevel] = null;
                    hasUpdate = true;
                }
            } else {
                if (!actorData.data.levelAttributeBonus[bonusAttributeLevel]) {
                    actorData.data.levelAttributeBonus[bonusAttributeLevel] = {};
                    hasUpdate = true;
                } else {
                    let total = actorData.data.levelAttributeBonus[bonusAttributeLevel].str
                    + actorData.data.levelAttributeBonus[bonusAttributeLevel].dex
                        + actorData.data.levelAttributeBonus[bonusAttributeLevel].con
                        + actorData.data.levelAttributeBonus[bonusAttributeLevel].int
                        + actorData.data.levelAttributeBonus[bonusAttributeLevel].wis
                        + actorData.data.levelAttributeBonus[bonusAttributeLevel].cha
                    actorData.data.levelAttributeBonus[bonusAttributeLevel].warn = total !== 2;
                }
            }
        }

        // let numOfAttributeBonuses = Math.floor(characterLevel / 4);
        //
        // // for (let [level, value] of Object.entries(actorData.data.levelAttributeBonuses)) {
        // //     if (level > numOfAttributeBonuses * 4 && value !== null) {
        // //         actorData.data.levelAttributeBonuses[level] = null;
        // //         hasUpdate = true;
        // //     }
        // // }
        // for (let i = 1; i <= numOfAttributeBonuses; i++) {
        //     let level = i * 4;
        //     if (!actorData.data.levelAttributeBonuses[level]) {
        //         actorData.data.levelAttributeBonuses[level] = {};
        //         hasUpdate = true;
        //     }
        // }

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
        return excludeItemsByType(this.items.values(), "feat", "talent", "species", "class", "classFeature", "forcePower", "forceTechnique", "forceSecret", "ability", "trait", "affiliation")
            .filter(item => !item.data.data.hasItemOwner);
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
        removeFeats.forEach(f => removal.push(f._id))
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
        }
    }


    getTraitAttributesByKey(attributeKey) {
        let values = [];
        for (let ability of this.data.traits) {
            let attribute = ability.data.attributes[attributeKey];
            if (attribute) {
                if (Array.isArray(attribute)) {
                    values.push(...attribute)
                } else {
                    values.push(attribute)
                }
            }
        }
        return values;
    }

    getTraitByKey(attributeKey) {
        let values = [];
        for (let trait of this.data.traits) {
            let attribute = trait.data.attributes[attributeKey];
            if (attribute) {
                values.push(trait)
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
            let {itemName, prerequisite, payload} = this.resolveItemParts(item);

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

            // for (let prerequisite of data.prerequisites) {
            //     if(prerequisite.requirement){
            //         prerequisite.requirement = prerequisite.requirement.replace("#payload#", payload);
            //     }
            // }


            if (prerequisite) {
                data.prerequisite = prerequisite;
            }

            if (parentItem) {
                entity.setParentItem(parentItem)
            }

            if (payload !== "") {
                entity.setPayload(payload);
            }
            entity.setSourceString();
            entity.setTextDescription();
            notificationMessage = notificationMessage + `<li>${entity.name.titleCase()}</li>`
            entities.push(entity);
        }
        additionalEntitiesToAdd.push(...entities);
        return {addedEntities: entities, notificationMessage: notificationMessage};
    }

    resolveItemParts(item) {
        let itemName = item;
        let prerequisite = item.prerequisite;
        if (item.category) {
            console.error("deprecated", item);
            itemName = item.category;
        }
        if (item.trait) {
            itemName = item.trait;
        }
        let result = /^([\w\s]*) \(([()\-\w\s*+]*)\)/.exec(itemName);
        let payload = "";
        if (result) {
            itemName = result[1];
            payload = result[2];
        }

        return {itemName, prerequisite, payload};
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

    /**
     *
     * @param {Object[]} prereqs
     * @param {string} prereqs[].text always available
     * @param {string} prereqs[].type always available
     * @param {string} prereqs[].requirement available on all types except AND, OR, and NULL
     * @param {number} prereqs[].count available on OR
     * @param {Object[]} prereqs[].children available on AND and OR
     * @param notifyOnFailure
     * @returns {{failureList: [], doesFail: boolean, silentFail: []}}
     */
    meetsPrerequisites(prereqs, notifyOnFailure = true) {
        //TODO add links to failures to upen up the fancy compendium to show the missing thing.  when you make a fancy compendium

        let failureList = [];
        let silentFailList = [];
        let successList = [];
        if (!prereqs) {
            return {doesFail: false, failureList, silentFail: silentFailList, successList};
        }

        if (!Array.isArray(prereqs)) {
            prereqs = [prereqs];
        }

        for (let prereq of prereqs) {
            switch (prereq.type) {
                case undefined:
                    continue;
                case 'AGE':
                    let age = this.age;
                    if (parseInt(prereq.low) > age || (prereq.high && parseInt(prereq.high) < age)) {
                        failureList.push({fail: true, message: `${prereq.type}: ${prereq.text}`});
                        continue;
                    }
                    successList.push({prereq, count: 1});
                    continue;
                case 'CHARACTER LEVEL':
                    if (!(this.getCharacterLevel() < parseInt(prereq.requirement))) {
                        successList.push({prereq, count: 1});
                        continue;
                    }
                    break;
                case 'BASE ATTACK BONUS':
                    if (!(this.getBaseAttackBonus() < parseInt(prereq.requirement))) {
                        successList.push({prereq, count: 1});
                        continue;
                    }
                    break;
                case 'DARK SIDE SCORE':
                    if (!this.getDarkSideScore() < resolveValueArray([prereq.requirement], this)) {
                        successList.push({prereq, count: 1});
                        continue;
                    }
                    break;
                case 'ITEM':
                    let ownedItem = this.getInventoryItems();
                    let filteredItem = ownedItem.filter(feat => feat.data.finalName === prereq.requirement);
                    if (filteredItem.length > 0) {
                        successList.push({prereq, count: 1});
                        continue;
                    }
                    break;
                case 'SPECIES':
                    let species = filterItemsByType(this.items.values(), "species");
                    let filteredSpecies = species.filter(feat => feat.data.finalName === prereq.requirement);
                    if (filteredSpecies.length > 0) {
                        successList.push({prereq, count: 1});
                        continue;
                    }
                    break;
                case 'TRAINED SKILL':
                    if (this.data.prerequisites.trainedSkills.filter(trainedSkill => trainedSkill.toLowerCase() === prereq.requirement.toLowerCase()).length === 1) {
                        successList.push({prereq, count: 1});
                        continue;
                    }
                    break;
                case 'FEAT':
                    let ownedFeats = filterItemsByType(this.items.values(), "feat");
                    let filteredFeats = ownedFeats.filter(feat => feat.data.finalName === prereq.requirement);
                    if (filteredFeats.length > 0) {
                        if (!this.meetsPrerequisites(filteredFeats[0].data.data.prerequisite, false).doesFail) {
                            successList.push({prereq, count: 1});
                            continue;
                        }
                    }
                    break;
                case 'CLASS':
                    let ownedClasses = filterItemsByType(this.items.values(), "class");
                    let filteredClasses = ownedClasses.filter(feat => feat.data.finalName === prereq.requirement);
                    if (filteredClasses.length > 0) {
                        if (!this.meetsPrerequisites(filteredClasses[0].data.data.prerequisite, false).doesFail) {
                            successList.push({prereq, count: 1});
                            continue;
                        }
                    }
                    break;
                case 'TRAIT':
                    let ownedTraits = filterItemsByType(this.items.values(), "trait");
                    let filteredTraits = ownedTraits.filter(feat => feat.data.finalName === prereq.requirement);
                    if (filteredTraits.length > 0) {
                        let parentsMeetPrequisites = false;
                        for (let filteredTrait of filteredTraits) {
                            if (!this.meetsPrerequisites(filteredTrait.data.data.prerequisite, false).doesFail) {
                                successList.push({prereq, count: 1});
                                parentsMeetPrequisites = true;
                            }
                        }
                        if (parentsMeetPrequisites) {
                            continue;
                        }
                    }
                    break;
                case 'PROFICIENCY':
                    if (this.data.proficiency.weapon.includes(prereq.requirement.toLowerCase())
                        || this.data.proficiency.armor.includes(prereq.requirement.toLowerCase())) {
                        successList.push({prereq, count: 1});
                        continue;
                    }
                    break;
                case 'TALENT':
                    let ownedTalents = filterItemsByType(this.items.values(), "talent");
                    let filteredTalents = ownedTalents.filter(feat => feat.data.finalName === prereq.requirement);
                    if (filteredTalents.length > 0) {
                        if (!this.meetsPrerequisites(filteredTalents[0].data.data.prerequisite, false).doesFail) {
                            successList.push({prereq, count: 1});
                            continue;
                        }
                    }

                    let talentsByTreeFilter = ownedTalents.filter(talent => talent.data.data.talentTree === prereq.requirement || talent.data.data.bonusTalentTree === prereq.requirement);
                    if (talentsByTreeFilter.length > 0) {
                        let count = 0;
                        for (let talent of talentsByTreeFilter) {
                            if (!this.meetsPrerequisites(talent.data.data.prerequisite, false).doesFail) {
                                count++;
                            }
                        }
                        if (count > 0) {
                            successList.push({prereq, count})
                            continue;
                        }
                    }

                    break;
                case 'TRADITION':
                    let ownedTraditions = filterItemsByType(this.items.values(), "forceTradition");
                    let filteredTraditions = ownedTraditions.filter(feat => feat.data.finalName === prereq.requirement);
                    if (filteredTraditions.length > 0) {
                        if (!this.meetsPrerequisites(filteredTraditions[0].data.data.prerequisite, false).doesFail) {
                            successList.push({prereq, count: 1});
                            continue;
                        }
                    }
                    break;
                case 'FORCE TECHNIQUE':
                    let ownedForceTechniques = filterItemsByType(this.items.values(), "forceTechnique");
                    if (!isNaN(prereq.requirement)) {
                        if (!(ownedForceTechniques.length < parseInt(prereq.requirement))) {
                            successList.push({prereq, count: 1});
                            continue;
                        }
                    }

                    let filteredForceTechniques = ownedForceTechniques.filter(feat => feat.data.finalName === prereq.requirement);
                    if (filteredForceTechniques.length > 0) {
                        if (!this.meetsPrerequisites(filteredForceTechniques[0].data.data.prerequisite, false).doesFail) {
                            successList.push({prereq, count: 1});
                            continue;
                        }
                    }
                    break;
                case 'ATTRIBUTE':
                    let toks = prereq.requirement.split(" ");
                    if (!(this.getAttribute(toks[0]) < parseInt(toks[1]))) {
                        successList.push({prereq, count: 1});
                        continue;
                    }
                    break;
                case 'AND': {
                    let meetsChildPrereqs = this.meetsPrerequisites(prereq.children, false);
                    if (!(meetsChildPrereqs.doesFail)) {
                        successList.push({prereq, count: 1});
                        continue;
                    }
                    failureList.push(...meetsChildPrereqs.failureList)
                    continue;
                }
                case 'OR': {
                    let meetsChildPrereqs = this.meetsPrerequisites(prereq.children, false)
                    let count = 0;
                    for (let success of meetsChildPrereqs.successList) {
                        count += success.count;
                    }

                    if (!(count < prereq.count)) {
                        successList.push({prereq, count: 1});
                        continue;
                    }
                    failureList.push(...meetsChildPrereqs.failureList)
                    continue;
                }
                case 'SPECIAL':
                    if (prereq.requirement.toLowerCase() === 'not a droid') {
                        if (!this.data.data.isDroid) {
                            successList.push({prereq, count: 1});
                            continue;
                        }
                        break;
                    } else if (prereq.requirement.toLowerCase() === 'is a droid') {
                        if (this.data.data.isDroid) {
                            successList.push({prereq, count: 1});
                            continue;
                        }
                        break;
                    } else if (prereq.requirement === 'Has Built Lightsaber') {
                        failureList.push({fail: false, message: `${prereq.type}: ${prereq.text}`});
                        continue;
                    }
                    console.log("this prereq is not supported", prereq)
                    failureList.push({fail: true, message: `${prereq.type}: ${prereq.text}`});
                    break;
                case 'GENDER':
                    if (this.data.data.sex.toLowerCase() === prereq.requirement.toLowerCase()) {
                        successList.push({prereq, count: 1});
                        continue;
                    }
                    break;
                case 'EQUIPPED':
                    let equippedItems = this.getEquippedItems();
                    let filteredEquippedItems = equippedItems.filter(item => item.data.finalName === prereq.requirement);
                    if (filteredEquippedItems.length > 0) {
                        successList.push({prereq, count: 1});
                        continue;
                    }
                    break;
                default:
                    console.log("this prereq is not supported", prereq)
            }

            failureList.push({fail: true, message: `${prereq.text}`});
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

        let meetsPrereqs = {doesFail, failureList, silentFail: silentFailList, successList};

        if (notifyOnFailure && meetsPrereqs.failureList.length > 0) {
            if (meetsPrereqs.doesFail) {
                new Dialog({
                    title: "You Don't Meet the Prerequisites!",
                    content: "You do not meet the prerequisites:<br/>" + this._formatPrerequisites(meetsPrereqs.failureList),
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
                    content: "You MAY meet the prerequisites. Check the remaining reqs:<br/>" + this._formatPrerequisites(meetsPrereqs.failureList),
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
        actorData.availableItems = {}; //TODO maybe allow for a link here that opens the correct compendium and searches for you
        actorData.bonuses = {};
        actorData.activeFeatures = [];
        let tempFeatures = new Set();
        for (let feature of classFeatures) {
            let type = feature.key;
            let value = feature.value;
            if (type === 'PROVIDES') {
                actorData.availableItems[value] = actorData.availableItems[value] ? actorData.availableItems[value] + 1 : 1;
            } else if (type === 'BONUS') {
                actorData.bonuses[value] = actorData.bonuses[value] ? actorData.bonuses[value] + 1 : 1;
            } else if (type === 'TRAIT') {

            }

            // let result = pattern.exec(feature.feature);
            // if (feature.feature.startsWith("Talent")) {
            //     let result = /Talent \(([\w\s]*)\)/.exec(feature.feature);
            //     let type = `${result[1]} Talents`;
            //     actorData.availableItems[type] = actorData.availableItems[type] ? actorData.availableItems[type] + 1 : 1;
            //
            // } else if (feature.feature === 'Force Talent') {
            //     let type = 'Force Talents';
            //     actorData.availableItems[type] = actorData.availableItems[type] ? actorData.availableItems[type] + 1 : 1;
            // } else if (feature.feature.startsWith("Bonus Feat ")) {
            //     let result = /Bonus Feat \(([\w\s]*)\)/.exec(feature.feature);
            //     let type = result[1] + " Bonus Feats";
            //     actorData.availableItems[type] = actorData.availableItems[type] ? actorData.availableItems[type] + 1 : 1;
            // } else if (feature.feature === 'Force Technique') {
            //     let type = "Force Techniques";
            //     actorData.availableItems[type] = actorData.availableItems[type] ? actorData.availableItems[type] + 1 : 1;
            // } else if (feature.feature === 'Force Secret') {
            //     let type = "Force Secrets";
            //     actorData.availableItems[type] = actorData.availableItems[type] ? actorData.availableItems[type] + 1 : 1;
            // } else if (result) {
            //     feature.feature = result[1].trim();
            //     tempFeatures.add(feature);
            // } else {
            //     console.log("UNUSED CLASS FEATURE: ", feature)
            // }
        }
        let classLevel = actorData.classes.length;
        actorData.availableItems['General Feats'] = 1 + Math.floor(classLevel / 3) + (actorData.availableItems['General Feats'] ? actorData.availableItems['General Feats'] : 0);
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
            if (feat.data.isSupplied) {
                continue;
            }
            let type = 'General Feats';
            if (feat.data.bonusFeatCategories && feat.data.bonusFeatCategories.length > 0) {
                type = feat.data.bonusFeatCategories[0].category
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
                let forcePowers = Math.max(1, 1 + actorData.data.attributes.wis.mod);
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

    rollOwnedItem(itemId) {
        if(itemId === "unarmed"){
            let attacks = generateUnarmedAttacks(this)
            SWSEItem.getItemDialogue(attacks, this).render(true);
            return;
        }
        let item = this.getOwnedItem(itemId);


        item.rollItem(this).render(true);

    }

    async sendRollToChat(template, formula, modifications, notes, name, actor) {
        let roll = new Roll(formula).roll();
        roll.toMessage({
            speaker: ChatMessage.getSpeaker({actor}),
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

    //TODO can this be combined?
    _meetsPrereqs(prerequisites) {
        let meetsPrereqs = true;
        for (let prerequisite of prerequisites) {
            meetsPrereqs = meetsPrereqs && this._meetsPrereq(prerequisite);
        }

        return meetsPrereqs;
    }

    _meetsPrereq(prerequisite) {
        if (prerequisite.startsWith("ABILITY") || prerequisite.startsWith("TRAIT")) {
            let abilityName = prerequisite.split(":")[1];
            let ts = this.data.traits.filter(trait => trait.data.finalName === abilityName);
            return ts && ts.length > 0;
        } else if (prerequisite.startsWith("AGE")) {
            let ageRange = prerequisite.split(":")[1];
            return this._isAgeInRange(this.data.data.age, ageRange);
        } else if (prerequisite.startsWith("GENDER")) {
            let sex = prerequisite.split(":")[1];
            return this.data.data.sex.toLowerCase() === sex.toLowerCase();
        } else if (prerequisite.startsWith("EQUIPPED")) {
            let item = prerequisite.split(":")[1];
            let es = this.data.equipped.filter(trait => trait.data.finalName === item);
            return es && es.length > 0
        }
        return false;
    }

    _isAgeInRange(age, ageRange) {
        if (!age) {
            return false;
        }
        if (ageRange.includes("-")) {
            let tok = ageRange.split("-");
            return parseInt(tok[0]) <= age && parseInt(tok[1]) >= age;
        } else if (ageRange.includes("+")) {
            let tok = ageRange.split("+");
            return parseInt(tok[0]) <= age;
        }
        return false;
    }


    isForceSensitive() {
        let hasForceSensativity = false;
        for (let item of this.items.values()) {
            if (item.data.finalName === 'Force Sensitivity') {
                hasForceSensativity = true;
            }
        }
        return hasForceSensativity && !this.data.data.isDroid;
    }

    getBaseAttackBonus() {
        return this.data.data.offense.bab;
    }

    getDarkSideScore() {
        return this.data.data.darkSideScore;
    }

    setDarkSideScore(score){

        this.update({'data.darkSideScore': score})
    }

    /**
     *
     * @param {string} attributeName
     */
    toShortAttribute(attributeName) {
        switch (attributeName.toLowerCase()) {
            case 'strength':
                return 'STR';
            case 'dexterity':
                return 'DEX';
            case 'constitution':
                return 'CON';
            case 'wisdom':
                return 'WIS';
            case 'intelligence':
                return 'INT';
            case 'charisma':
                return 'CHA';
        }
    }

}
