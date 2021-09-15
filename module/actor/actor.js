import {resolveHealth} from "./health.js";
import {generateAttacks, generateUnarmedAttacks} from "./attack-handler.js";
import {OffenseHandler} from "./offense.js";
import {SpeciesHandler} from "./species.js";
import {excludeItemsByType, filterItemsByType, toShortAttribute} from "../util.js";
import {meetsPrerequisites} from "../prerequisite.js";
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
        this.data.prerequisites = {};

        new SpeciesHandler().generateSpeciesData(this);
        let {bab, level, classSummary} = this._generateClassData(actorData);
        this.data.data.condition = this.data.data.condition || 0;

        actorData.levelSummary = level;
        actorData.classSummary = classSummary;

        this.equipped = this.getEquippedItems().map(item => item.data);
        this.unequipped = this.getUnequippedItems().map(item => item.data);
        this.inventory = this.getNonequippableItems().map(item => item.data);
        this.traits = await this.getTraits().map(trait => trait.data);
        this.talents = this.getTalents().map(talent => talent.data);
        this.powers = this.getPowers().map(item => item.data);
        this.secrets = this.getSecrets().map(item => item.data);
        this.techniques = this.getTechniques().map(item => item.data);
        this.affiliations = filterItemsByType(this.items.values(), "affiliation").map(item => item.data);
        this.regimens = filterItemsByType(this.items.values(), "forceRegimen").map(item => item.data);

        actorData.speed = this.speed;

        generateAttributes(this);

        //separated for now.  this part handles the darkside score widget.  it's clever i swear
        {
            for (let i = 0; i <= actorData.data.attributes.wis.total; i++) {
                actorData.data.darkSideArray = actorData.data.darkSideArray || [];

                if (actorData.data.darkSideScore < i) {
                    actorData.data.darkSideArray.push({value: i, active: false})
                } else {
                    actorData.data.darkSideArray.push({value: i, active: true})
                }
            }
        }

        actorData.acPenalty = generateArmorCheckPenalties(this);

        await generateSkills(this);

        actorData.data.offense = await new OffenseHandler().resolveOffense(this, bab);
        let feats = this.resolveFeats();
        this.feats = feats.activeFeats;

        actorData.hideForce = 0 === this.feats.filter(feat => {
            return feat.name === 'Force Training'
        }).length

        actorData.inactiveProvidedFeats = feats.inactiveProvidedFeats

        this.generateProvidedItemsFromItems(actorData);
        this._reduceProvidedItemsByExistingItems(actorData);

        actorData.data.health = resolveHealth(this);
        let {defense, armors} = resolveDefenses(this);
        actorData.data.defense = defense;
        actorData.data.armors = armors;

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

    get classes() {
        return this.data.classes;
    }

    get age() {
        return this.data.data.age;
    }

    get sex() {
        return this.data.data.sex;
    }

    get species() {
        return this.data.species;
    }

    get speed(){
        let attributeTraits = this.data.traits.filter(trait => {
            let result = /\w* Speed \d*/.exec(trait.name);
            return !!result;
        })
        let armorType = "";
        for(let armor of this.getEquippedItems().filter(item => item.type === "armor")){
            if(armor.armorType === "Heavy" || (armor.armorType === "Medium" && armorType === "Light") || (armor.armorType === "Light" && !armorType)){
                armorType = armor.armorType;
            }
        }
        return attributeTraits.map(trait => trait.name).map(name => this.applyArmorSpeedPenalty(name,armorType)).join("; ");
    }

    applyArmorSpeedPenalty(speed, armorType) {
        if (!armorType || "Light" === armorType) {
            return speed;
        }
        let result = /([\w\s]*)\s(\d*)/.exec(speed);

        return `${result[1]} ${Math.floor(parseInt(result[2])*3/4)}`
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
                let meetsPrerequisites1 = meetsPrerequisites(this, possible.data.data.prerequisite);
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

    resolveFeats() {
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
        let prerequisites = this.data.prerequisites;
        prerequisites.feats = [];
        prerequisites.focusSkills = [];
        prerequisites.masterSkills = [];
        prerequisites.isForceTrained = false;
        let feats = filterItemsByType(this.items.values(), "feat");
        let activeFeats = [];
        let removeFeats = [];
        let inactiveProvidedFeats = [];
        for (let feat of feats) {
            let prereqResponse = meetsPrerequisites(this, feat.data.data.prerequisite);
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
        let proficiency = /Skill Mastery \(([\w\s]*)\)/g.exec(feat.data.finalName);
        if (proficiency) {
            prerequisites.masterSkills.push(proficiency[1].toLowerCase());
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
    get conditionBonus(){
        switch (this.data.data.condition) {
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
            if (attributeName.toLowerCase() === key || toShortAttribute(attributeName).toLowerCase() === key) {
                return attribute.total;
            }
        }
    }

    getHalfCharacterLevel() {
        return Math.floor(this.characterLevel / 2);
    }

    get characterLevel() {
        if (this.classes) {
            this.resolvedVariables.set("@charLevel", this.classes.length);
            return this.classes.length;
        }
        return 0;
    }

    getHeroicLevel(){
        return this.characterLevel;
    }


    _getEquipable(items, isDroid) {
        return items.filter(item => this.isEquipable(item, isDroid))
    }

    _getUnequipableItems(items, isDroid) {
        return items.filter(item => !this.isEquipable(item, isDroid))
        // let filtered = [];
        // for (let item of items) {
        //     if (!this.isEquipable(item, isDroid)) {
        //         filtered.push(item);
        //     }
        // }
        // return filtered;
    }

    isEquipable(item, isDroid) {
        return item.data.data.isEquipable
            || ((isDroid && item.data.data.isDroidPart) || (!item.data.data.isDroidPart))
            || ((!isDroid && item.data.data.isBioPart) || (!item.data.data.isBioPart));
    }

    getNonPrestigeClasses() {
        return this.classes.filter(charClass => {
            return !charClass.data.prerequisite?.isPrestige;
        });
    }
    /**
     * Extracts important stats from the class
     */
    _generateClassData(actorData) {
        actorData.classes = filterItemsByType(this.items, "class");

        let classLevels = {};
        let classFeatures = [];
        let bab = 0;

        for (let characterClass of this.classes) {
            if (!classLevels[characterClass.name]) {
                classLevels[characterClass.name] = 0;
            }
            let levelOfClass = ++classLevels[characterClass.name]
            let levelData = characterClass.data.data.levels[levelOfClass]
            bab += levelData.bab;
            classFeatures.push(...levelData.features)
        }

        let classSummary = Object.entries(classLevels).map((entity) => `${entity[0]} ${entity[1]}`).join(' / ');

        this.resolveClassFeatures(actorData, classFeatures);
        let level = this.classes.length;
        return {bab, level, classSummary};
    }

    handleLeveBasedAttributeBonuses(actorData) {
        let characterLevel = this.classes.length;
        if (characterLevel > 0) {
            this.classes[characterLevel - 1].data.isLatest = true;
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

        if (hasUpdate && this.id) {
            return this.update({_id:this.id,'data.levelAttributeBonus': actorData.data.levelAttributeBonus});
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

    _getClassSkills() {
        let classSkills = new Set()
        if (!this.classes) {
            return classSkills;
        }
        for (let charClass of this.classes) {
            let skills = charClass.data.data.skills;
            if (skills) {
                for (let skill of skills.skills) {
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
        for (let charClass of this.classes || []) {
            if (charClass.data.data.attributes.first === true) {
                return charClass;
            }
        }
        return undefined;
    }

    async _manageAutomaticItems(actorData, removeFeats) {
        let itemIds = Array.from(actorData.items.values()).flatMap(i => [i.id, i.data.flags.core?.sourceId?.split(".")[3]]).filter(i => i !== undefined);

        let removal = [];
        removeFeats.forEach(f => removal.push(f._id))
        for (let item of actorData.items) {
            let itemData = item.data.data;
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
                await this.deleteEmbeddedDocuments("Item", removal);
            } catch (e) {
                console.log(e);
                //this will be run in to if multiple sessions try to delete teh same item
            }
        }
    }


    getTraitAttributesByKey(attributeKey) {
        let values = [];
        for (let ability of this.traits) {
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
        for (let trait of this.traits) {
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
        let pack = SWSEActor.getCompendium(compendium);
        let index = await pack.getIndex();
        for (let item of items.filter(item => item)) {
            let {itemName, prerequisite, payload} = this.resolveItemParts(item);

            let cleanItemName1 = this.cleanItemName(itemName);
            let entry = await index.find(f => f.name === cleanItemName1);
            if (!entry) {
                let cleanItemName2 = this.cleanItemName(itemName + " (" + payload + ")");
                entry = await index.find(f => f.name === cleanItemName2);
            }

            if (!entry) {
                console.warn(`attempted to add ${itemName}`, arguments)
                continue;
            }

            let entity = await pack.getDocument(entry._id);
            //entity.data.data = entity.data.data || {};

            entity.prepareData();

            // for (let prerequisite of data.prerequisites) {
            //     if(prerequisite.requirement){
            //         prerequisite.requirement = prerequisite.requirement.replace("#payload#", payload);
            //     }
            // }


            if (prerequisite) {
                entity.setPrerequisite(prerequisite);
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
            entities.push(entity.data.toObject(false));
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


    static getCompendium(type) {
        switch (type) {
            case 'item':
                return game.packs.find(p => p.metadata.label === "SWSE Items");
            case 'trait':
                return game.packs.find(p => p.metadata.label === "SWSE Traits");
            case 'feat':
                return game.packs.find(p => p.metadata.label === "SWSE Feats");
        }
    }

    cleanItemName(feat) {
        return feat.replace("*", "").trim();
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
        }
        let classLevel = this.classes.length;
        actorData.availableItems['General Feats'] = 1 + Math.floor(classLevel / 3) + (actorData.availableItems['General Feats'] ? actorData.availableItems['General Feats'] : 0);
        actorData.activeFeatures.push(...tempFeatures)
    }

    async filterOutInvisibleAbilities(actorData) {
        let filtered = [];
        for (let trait of this.traits) {
            if (trait.name === 'Species' || trait.name === 'Homebrew Content' || trait.name === 'Web Enhancements' || trait.name.includes('Creations')) {

                continue;
            }
            filtered.push(trait)
        }
        return filtered;
    }

    _reduceProvidedItemsByExistingItems(actorData) {
        for (let talent of this.talents) {
            this.reduceAvailableItem(actorData, talent.data.talentTreeSource);
        }
        for (let feat of this.feats) {
            if (feat.data.isSupplied) {
                continue;
            }
            let type = 'General Feats';
            if (feat.data.bonusFeatCategories && feat.data.bonusFeatCategories.length > 0) {
                type = feat.data.bonusFeatCategories[0].category
            }
            this.reduceAvailableItem(actorData, type);
        }
        this.reduceAvailableItem(actorData, "Force Secrets", this.secrets.length);
        this.reduceAvailableItem(actorData, "Force Techniques", this.techniques.length);
        this.reduceAvailableItem(actorData, "Force Powers", this.powers.length);
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
        for (let feat of this.feats) {
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
        for (let trait of this.traits) {
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

    cleanSkillName(key) {
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

    get shouldLockAttributes() {
        return !!this.data.traits.find(trait => trait.name === 'Disable Attribute Modification');
    }

    get isForceSensitive() {
        let hasForceSensativity = false;
        for (let item of this.items.values()) {
            if (item.data.finalName === 'Force Sensitivity') {
                hasForceSensativity = true;
            }
        }
        return hasForceSensativity && !this.data.data.isDroid;
    }

    get baseAttackBonus() {
        return this.data.data.offense.bab;
    }

    get darkSideScore() {
        return this.data.data.darkSideScore;
    }

    set darkSideScore(score){
        this.update({'data.darkSideScore': score})
    }
}
