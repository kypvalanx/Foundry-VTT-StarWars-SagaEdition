import {resolveHealth} from "./health.js";
import {generateAttackFromWeapon, generateAttacks, generateUnarmedAttack} from "./attack-handler.js";
import {resolveOffense} from "./offense.js";
import {generateSpeciesData} from "./species.js";
import {
    excludeItemsByType,
    filterItemsByType,
    getBonusString,
    getOrdinal,
    getRangedAttackMod,
    handleAttackSelect,
    reduceArray,
    resolveExpression,
    toShortAttribute
} from "../util.js";
import {meetsPrerequisites} from "../prerequisite.js";
import {resolveDefenses} from "./defense.js";
import {generateAttributes} from "./attribute-handler.js";
import {generateSkills, getAvailableTrainedSkillCount} from "./skill-handler.js";
import {generateArmorCheckPenalties} from "./armor-check-penalty.js";
import {SWSEItem} from "../item/item.js";
import {sizeArray} from "../constants.js";


// noinspection JSClosureCompilerSyntax
/**
 * Extend the base Actor entity by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class SWSEActor extends Actor {
    resolvedVariables = new Map();

    resolvedLabels = new Map();
    inheritableItems = [];


    /**
     * Augment the basic actor data with additional dynamic data.
     */
    prepareData() {
        super.prepareData();
        const actorData = this.data;
        // Make separate methods for each Actor type (character, npc, etc.) to keep
        // things organized.
        if (actorData.type === 'character') this._prepareCharacterData(actorData);
        if (actorData.type === 'npc') this._prepareCharacterData(actorData);
        if (actorData.type === 'computer') this._prepareComputerData(actorData);
    }
    /**
     * Prepare Computer type specific data
     */
    _prepareComputerData(actorData) {
        let div = document.createElement("DIV");
        div.innerHTML = actorData.data.content;
        let rough = div.textContent || div.innerText || "";
        let toks = rough.split("\n");
        for(let tok of toks){

        }
        rough = toks.join("");
        actorData.pages = JSON.parse(rough, (key, value) => {
            console.log(key); // log the current property name, the last is "".
            return value;     // return the unchanged property value.
        });
    }

    /**
     * Prepare Character type specific data
     */
    _prepareCharacterData(actorData) {
        this.data.prerequisites = {};
        this.inheritableItems = [];
        this.resolvedVariables = new Map();
        this.resolvedLabels = new Map();

        this.data.data.condition = this.data.data.condition || 0;

        let speciesList = filterItemsByType(this.items.values(), "species");
        this.species = (speciesList.length > 0 ? speciesList[0] : null);

        if(this.species){
            this.inheritableItems.push(this.species.data)
        }
        generateSpeciesData(this);

        this.classes = filterItemsByType(this.items.values(), "class");
        let uniqueClassNames = [];
        for(let classObject of this.classes.map(item => item.data)) {
            if(!uniqueClassNames.includes(classObject.name)) {
                uniqueClassNames.push(classObject.name);
                this.inheritableItems.push(classObject);
            }
        }
        this.traits = this.getTraits().map(trait => trait.data);
        this.talents = this.getTalents().map(talent => talent.data);
        this.powers = this.getPowers().map(item => item.data);
        this.secrets = this.getSecrets().map(item => item.data);
        this.techniques = this.getTechniques().map(item => item.data);
        this.affiliations = filterItemsByType(this.items.values(), "affiliation").map(item => item.data);
        this.regimens = filterItemsByType(this.items.values(), "forceRegimen").map(item => item.data);

        let {level, classSummary} = this._generateClassData(actorData);
        actorData.levelSummary = level;
        actorData.classSummary = classSummary;

        this.inheritableItems.push(...this.traits)
        this.inheritableItems.push(...this.talents)
        this.inheritableItems.push(...this.powers)
        this.inheritableItems.push(...this.secrets)
        this.inheritableItems.push(...this.techniques)
        this.inheritableItems.push(...this.affiliations)
        this.inheritableItems.push(...this.regimens)

        this.equipped = this.getEquippedItems().map(item => item.data);
        this.inheritableItems.push(...this.equipped)
        this.unequipped = this.getUnequippedItems().map(item => item.data);
        this.inventory = this.getNonequippableItems().map(item => item.data);

        generateAttributes(this);

        this.handleDarksideArray(actorData);

        actorData.data.offense = resolveOffense(this);
        let feats = this.resolveFeats();
        this.feats = feats.activeFeats;
        this.inheritableItems.push(...this.feats)
        generateSkills(this);

        actorData.hideForce = 0 === this.feats.filter(feat => feat.name === 'Force Training').length

        actorData.inactiveProvidedFeats = feats.inactiveProvidedFeats

        this._reduceProvidedItemsByExistingItems(actorData);

        actorData.data.health = resolveHealth(this);
        let {defense, armors} = resolveDefenses(this);
        actorData.data.defense = defense;
        actorData.data.armors = armors;

        actorData.data.attacks = generateAttacks(this);
        this._manageAutomaticItems(actorData, feats.removeFeats).then(() => this.handleLeveBasedAttributeBonuses(actorData));
        // if (await this.handleLeveBasedAttributeBonuses(actorData)) {
        //     return; //do not continue to process.  this just set a class to the first class and will rerun the prepare method
        // }

        // try {
        //     if (this.sheet?.rendered) {
        //         this.sheet.render(true);
        //     } else {
        //         this.sheet.render(false)
        //     }
        // } catch (e) {
        //     console.log("couldn't find charactersheet.  probably fine")
        // }
    }

    handleDarksideArray(actorData) {
        for (let i = 0; i <= actorData.data.attributes.wis.total; i++) {
            actorData.data.darkSideArray = actorData.data.darkSideArray || [];

            if (actorData.data.darkSideScore < i) {
                actorData.data.darkSideArray.push({value: i, active: false})
            } else {
                actorData.data.darkSideArray.push({value: i, active: true})
            }
        }
    }

    get age() {
        return this.data.data.age;
    }

    get sex() {
        return this.data.data.sex;
    }

    get speed(){
        if(!this.traits){
            return;
        }
        let attributeTraits = this.traits.filter(trait => {
            let result = /\w* Speed \d*/.exec(trait.name);
            return !!result;
        })

        if(attributeTraits.length === 0){
            attributeTraits.push({name:"Stationary 0"});
        }

        let armorType = "";
        for(let armor of this.getEquippedItems().filter(item => item.type === "armor")){
            if(armor.armorType === "Heavy" || (armor.armorType === "Medium" && armorType === "Light") || (armor.armorType === "Light" && !armorType)){
                armorType = armor.armorType;
            }
        }
        return attributeTraits.map(trait => trait.name).map(name => this.applyArmorSpeedPenalty(name,armorType)).join("; ");
    }

    get remainingSkills(){
        let remainingSkills = getAvailableTrainedSkillCount(this);
        remainingSkills = remainingSkills - this.trainedSkills.length;
        return remainingSkills < 0 ? false : remainingSkills;
    }
    get tooManySkills(){
        let remainingSkills = getAvailableTrainedSkillCount(this);
        remainingSkills = remainingSkills - this.trainedSkills.length;
        return remainingSkills<0 ? Math.abs(remainingSkills) : false;
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
        let activeTraits = [];
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
                if (!meetsPrerequisites(this, possible.data.data.prerequisite).doesFail) {
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
        let getEquippedItems = this._getEquippedItems(this._getEquipable(this.getInventoryItems()));
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
        //TODO remove unneeded proficiencies and prereqs
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
            } else if (doesFail && !feat.data.data.supplier) {
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
        if (value === undefined) {
            console.warn("could not find " + variableName, this.resolvedVariables);
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
            if (toShortAttribute(attributeName).toLowerCase() === key.toLowerCase()) {
                return attribute.total;
            }
        }
    }

    /**
     *
     * @param {string} attributeName
     */
    getCharacterAttribute(attributeName) {
        return this.data.data.attributes[toShortAttribute(attributeName).toLowerCase()];
    }

    getHalfCharacterLevel() {
        return Math.floor(this.characterLevel / 2);
    }

    get halfHeroicLevel() {
        let heroicLevel = this.heroicLevel;
        return Math.floor(heroicLevel / 2);
    }

    get characterLevel() {
        if (this.classes) {
            let charLevel = this.classes.length;
            this.resolvedVariables.set("@charLevel", charLevel);
            return charLevel;
        }
        return 0;
    }

    get heroicLevel(){
        if (this.classes) {
            let heroicLevel = this.classes.filter(c=>c.getInheritableAttributesByKey("isHeroic", "OR")).length;
            this.resolvedVariables.set("@heroicLevel", heroicLevel);
            return heroicLevel;
        }
        return 0;
    }


    _getEquipable(items) {
        return items.filter(item => this.isEquipable(item))
    }

    _getUnequipableItems(items) {
        return items.filter(item => !this.isEquipable(item))
    }

    get hideForce(){
        return !this.getInheritableAttributesByKey("forceSensitivity", "OR");
    }

    get isDroid() {
        return this.getInheritableAttributesByKey("isDroid", "OR");
    }

    get trainedSkills(){
        return this.skills.filter(skill => skill && skill.trained);
    }

    get skills() {
        return Object.values(this.data.data.skills);
    }

    get focusSkills(){
        return this.data.prerequisites.focusSkills || []
    }
    get inactiveProvidedFeats(){
        return this.data.inactiveProvidedFeats;
    }

    get shield(){
        return this.getInheritableAttributesByKey("srRating", "MAX")
    }

    /**
     *
     * @param item {SWSEItem}
     * @returns {(function(*))|*|false}
     */
    isEquipable(item) {
        return item.isEquipable
            || (this.isDroid && item.isDroidPart)
            || (!this.isDroid && item.isBioPart);
    }

    /**
     * Extracts important stats from the class
     */
    _generateClassData() {
        let classLevels = {};

        for (let characterClass of this.classes) {
            if (!classLevels[characterClass.name]) {
                classLevels[characterClass.name] = 0;
            }
            ++classLevels[characterClass.name]
        }

        let classSummary = Object.entries(classLevels).map((entity) => `${entity[0]} ${entity[1]}`).join(' / ');

        return {level: this.classes.length, classSummary};
    }

    handleLeveBasedAttributeBonuses(actorData) {

        let isHeroic = this.getInheritableAttributesByKey("isHeroic", "OR");
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
                    let total = (actorData.data.levelAttributeBonus[bonusAttributeLevel].str || 0)
                    + (actorData.data.levelAttributeBonus[bonusAttributeLevel].dex || 0)
                        + (actorData.data.levelAttributeBonus[bonusAttributeLevel].con || 0)
                        + (actorData.data.levelAttributeBonus[bonusAttributeLevel].int || 0)
                        + (actorData.data.levelAttributeBonus[bonusAttributeLevel].wis || 0)
                        + (actorData.data.levelAttributeBonus[bonusAttributeLevel].cha || 0)
                    actorData.data.levelAttributeBonus[bonusAttributeLevel].warn = total !== (isHeroic ? 2 : 1);
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
        let filterItemsByType = this._getEquipable(this.getInventoryItems());
        let unequipped = [];
        for (let item of filterItemsByType) {
            if (!this.data.data.equippedIds.includes(item.data._id)) {
                unequipped.push(item);
            }
        }
        return unequipped;
    }


    getNonequippableItems() {
        return this._getUnequipableItems(this.getInventoryItems()).filter(i => !i.data.hasItemOwner);
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
        let skills = this.getInheritableAttributesByKey("classSkill").map(attr => attr.value);

        for (let skill of skills) {
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

        return classSkills;
    }

    getAttributeMod(ability) {
        return this.data.data.attributes[ability].mod;
    }

    /**
     *
     * @returns {SWSEItem|*}
     */
    getFirstClass() {
        let firstClasses = this.getItemContainingInheritableAttribute("isFirstLevel", true);

        if(firstClasses.length > 1){
            console.warn("more than one class item has been marked as first class on actor the first one found will be used as the first class and all others will be ignored "+this.id)
        }
        if(firstClasses.length > 0){
            return firstClasses[0];
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
        // let values = [];
        // for (let trait of this.traits) {
        //     values.push(...this.getAttributesFromItem(trait._id, attributeKey));
        // }
        return this.getInheritableAttributesByKey(attributeKey, undefined, (item => item.type === "trait"));
    }

    /**
     * Collects all attribute values from equipped items, class levels, regimes, affiliations, feats and talents.
     * It also checks active modes.
     * @param attributeKey {string|[string]}
     * @param reduce
     * @param itemFilter
     * @param attributeFilter
     * @returns {[]}
     */
    getInheritableAttributesByKey(attributeKey, reduce, itemFilter = (() => true), attributeFilter = (() => true)){
        if(!itemFilter){
            itemFilter = () =>true;
        }
        if(!attributeFilter){
            attributeFilter = () =>true;
        }
        let values = [];
        if(Array.isArray(attributeKey)){
            for (let tok of attributeKey){
                values.push(...this.getInheritableAttributesByKey(tok, undefined, itemFilter, attributeFilter))
            }
        } else {
            for (let item of this.inheritableItems.filter(itemFilter)) {
                values.push(...this.getAttributesFromItem(item._id, attributeKey).filter(attributeFilter));
            }
        }
        return reduceArray(reduce, values);
    }

    get acPenalty(){
        return generateArmorCheckPenalties(this)
    }

    get fullAttackCount(){
        return 2
    }

    /**
     * Checks a given item for any attributes matching the provided attributeKey.  this includes active modes.
     * @param itemId {String}
     * @param attributeKey {String}
     * @returns {Array.<{source: String, value: *}>}
     */
    getAttributesFromItem(itemId, attributeKey) {
        /**
         * @type {SWSEItem}
         */
        let item = this.items.get(itemId);
        if(item) {
            return item.getInheritableAttributesByKey(attributeKey);
        }
        return [];
    }


    getActiveModes(itemId) {
        let item = this.items.get(itemId);
        return item.getActiveModes();
    }

    getAbilitySkillBonus(skill) {
        //TODO camelcase and simplify unless this could be more complex?
        if (skill.toLowerCase() === 'stealth') {
            return this.getInheritableAttributesByKey('sneakModifier', "SUM");
        }
        if (skill.toLowerCase() === 'perception') {
            return this.getInheritableAttributesByKey('perceptionModifier', "SUM");
        }
        return 0;
    }

    /**
     *
     * @param compendium
     * @param additionalEntitiesToAdd
     * @param items
     * @param parentName
     * @returns {Promise<{addedEntities: [], notificationMessage: string}>}
     */
    async addItemsFromCompendium(compendium, additionalEntitiesToAdd, items, parentName) {
        if (!Array.isArray(items)) {
            items = [items];
        }

        let entities = [];
        let notificationMessage = "";
        let pack = SWSEActor.getCompendium(compendium);
        let index = await pack.getIndex();
        for (let item of items.filter(item => item).map(item => item.value ? item.value : item)) {
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

            entity.prepareData();

            if (itemName === "Bonus Feat" && payload) {
                for (let attr of Object.values(entity.data.data.attributes)) {
                    if (attr.key === "provides") {
                        attr.key = "bonusFeat";
                        attr.value = payload;
                    }
                }

            }

            if (prerequisite) {
                entity.setPrerequisite(prerequisite);
            }

            if (payload !== "") {
                entity.setPayload(payload);
            }
            if (!!parentName)
            {
                entity.setParent(parentName);
            }
            entity.setSourceString();
            entity.setTextDescription();
            notificationMessage = notificationMessage + `<li>${entity.name.titleCase()}</li>`
            entities.push(entity.data.toObject(false));
        }
        if(additionalEntitiesToAdd) {
            additionalEntitiesToAdd.push(...entities);
        }
        return {addedEntities: entities, notificationMessage: notificationMessage};
    }

    resolveItemParts(item) {
        let itemName = item;
        if(item.name){
            itemName = item.name;
        }
        let prerequisite = item.prerequisite;
        if (item.category) {
            console.error("deprecated", item);
            itemName = item.category;
        }
        if (item.trait) {
            itemName = item.trait;
        }
        let result = /^([\w\s]*) \(([()\-\w\s*:+]*)\)/.exec(itemName);
        let payload = "";
        if (result) {
            itemName = result[1];
            payload = result[2];
        }

        return {itemName, prerequisite, payload};
    }

    /**
     *
     * @param type
     * @returns {CompendiumCollection}
     */
    static getCompendium(type) {
        switch (type) {
            case 'item':
                return game.packs.find(pack => pack.collection.startsWith("swse.items"));
            case 'trait':
                return game.packs.find(pack => pack.collection.startsWith("swse.traits"));
            case 'feat':
                return game.packs.find(pack => pack.collection.startsWith("swse.feats"));
        }
    }

    cleanItemName(feat) {
        return feat.replace("*", "").trim();
    }
    resolveClassFeatures(classFeatures) {
        let provides = this.getInheritableAttributesByKey("provides");
        this.data.availableItems = {}; //TODO maybe allow for a link here that opens the correct compendium and searches for you
        this.data.bonuses = {};
        this.data.activeFeatures = [];
        for(let provided of provides){
            let key = provided.value;
            let value = 1;
            if(key.includes(":")){
                let toks = key.split(":");
                key = toks[0];
                value = resolveExpression(toks[1],this)
            }
            this.data.availableItems[key] = this.data.availableItems[key] ? this.data.availableItems[key] + value : value;
        }

        for (let feature of classFeatures) {
            let type = feature.key;
            let value = feature.value;
            if (type === 'PROVIDES') {
                this.data.availableItems[value] = this.data.availableItems[value] ? this.data.availableItems[value] + 1 : 1;
            } else if (type === 'BONUS') {
                this.data.bonuses[value] = this.data.bonuses[value] ? this.data.bonuses[value] + 1 : 1;
            } else if (type === 'TRAIT') {

            }
        }
        let classLevel = this.classes.length;
        this.data.availableItems['General Feats'] = 1 + Math.floor(classLevel / 3) + (this.data.availableItems['General Feats'] ? this.data.availableItems['General Feats'] : 0);

    }

    _reduceProvidedItemsByExistingItems(actorData) {

        this.resolveClassFeatures([])


        for (let talent of this.talents) {
            this.reduceAvailableItem(actorData, talent.data.talentTreeSource);
        }
        for (let feat of this.feats) {
            if (feat.data.supplier.id) {
                continue;
            }
            let type = 'General Feats';
            if (feat.data.bonusFeatCategories && feat.data.bonusFeatCategories.length > 0) {
                type = feat.data.bonusFeatCategories[0].value
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

    cleanSkillName(key) {
        return this._uppercaseFirstLetters(key).replace("Knowledge ", "K").replace("(", "").replace(")", "").replace(" ", "").replace(" ", "")
    }


    rollVariable(variable) {
        let rollStr = this.resolvedVariables.get(variable);
        let label = this.resolvedLabels.get(variable);
        label = label ? `${this.name} rolls for ${label}!` : '';

        if(variable === '@Initiative'){
            this.rollInitiative({createCombatants: true, rerollInitiative: true})
            return;
        }

        let roll = new Roll(rollStr);

        roll.toMessage({
            speaker: ChatMessage.getSpeaker({actor: this}),
            flavor: label
        });
    }

    /**
     *
     * @param itemIds
     */
    rollOwnedItem(itemIds) {


        // if(itemId === "Unarmed Attack"){
        //     let attacks = generateUnarmedAttack(this)
        //     SWSEItem.getItemDialogue(attacks, this).render(true);
        //     return;
        // }


        let items = itemIds.map(itemId => this.items.get(itemId)).filter(item => !!item && item.type !== "weapon");

        if(items.length === 0){
            this.attack(null, {type:(itemIds.length === 1 ? "singleAttack" : "fullAttack"),items:itemIds})
        } else {
            for(let item of items) {
                item.rollItem(this).render(true);
            }
        }

    }

    async sendRollToChat(template, formula, modifications, notes, name, actor) {
        let roll = new Roll(formula).roll();
        roll.toMessage({
            speaker: ChatMessage.getSpeaker({actor}),
            flavor: name
        });
    }

    async _onCreate(data, options, userId) {
        if (data.type === "character") await this.update({"token.actorLink": true}, {updateChanges: false});

        // if (userId === game.user._id) {
        //     await updateChanges.call(this);
        // }

        super._onCreate(data, options, userId);
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
        return !!this.traits.find(trait => trait.name === 'Disable Attribute Modification');
    }

    get isForceSensitive() {
        let hasForceSensativity = false;
        for (let item of this.items.values()) {
            if (item.data.finalName === 'Force Sensitivity') {
                hasForceSensativity = true;
            }
        }
        return hasForceSensativity && !this.isDroid;
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

    /**
     *
     * @returns {undefined|SWSEItem}
     */
    get size(){
        for (let trait of this.traits || []) {
            if (sizeArray.includes(trait.name)) {
                return trait;
            }
        }
        return undefined;
    }

    getItemContainingInheritableAttribute(key, value) {
        let attributes = this.getInheritableAttributesByKey(key);
        if(value !== undefined){
            attributes = attributes.filter(item => item.value === value);
        }
        let sourceIds = attributes.map(item => item.source).distinct()
        return sourceIds.map(sourceId => this.items.get(sourceId));
    }



    async attack(event, context) {
        let options = this.buildAttackDialog(context);
        await new Dialog(options).render(true);
    }

    buildAttackDialog(context) {
        let availableAttacks = 1;
        let title = "Single Attack";
        let dualWeaponModifier = -10;
        let doubleAttack = [];
        let tripleAttack = [];
        //let hands = 2; //TODO resolve extra hands

        if (context.type === "fullAttack") {
            title = "Full Attack";
            doubleAttack = this.getInheritableAttributesByKey("doubleAttack", "VALUES");
            tripleAttack = this.getInheritableAttributesByKey("tripleAttack", "VALUES");

            //availableAttacks = this.fullAttackCount;
            let equippedItems = this.getEquippedItems()
            availableAttacks = 0;
            let doubleAttackBonus = 0;
            let tripleAttackBonus = 0;
            let availableWeapons = 0
            for(let item of equippedItems){
                availableWeapons = Math.min(availableWeapons + (item.isDoubleWeapon ? 2 : 1), 2);
                if(doubleAttack.includes(item.data.data.subtype)){
                    doubleAttackBonus = 1;
                }if(tripleAttack.includes(item.data.data.subtype)){
                    tripleAttackBonus = 1;
                }
            }
            availableAttacks = availableWeapons + doubleAttackBonus + tripleAttackBonus


            //how many attacks?
            //
            //how many provided attacks from weapons max 2
            //+1 if has double attack and equipped item
            //+1 if has triple attack and equipped item

            let dualWeaponModifiers = this.getInheritableAttributesByKey("dualWeaponModifier", "NUMERIC_VALUES");
            dualWeaponModifier = dualWeaponModifiers.reduce((a, b) => Math.max(a, b), -10)
        }

        let suppliedItems = context.items || [];

        // if (suppliedItems.length > 0) {
        //     availableAttacks = suppliedItems.length;
        // }

        let content = `<p>Select Attacks:</p>`;
        let resolvedAttacks = [];
        if (suppliedItems.length < availableAttacks) {
            //CREATE OPTIONS
            resolvedAttacks = this.getAttackOptions(doubleAttack, tripleAttack);
        }


        let blockHeight = 225;


        for (let i = 0; i < availableAttacks; i++) {
            let item = suppliedItems.length > i ? suppliedItems[i] : undefined;
            let select;
            if (!!item) {
                let attack = this.data.data.attacks.find(o => o.itemId === item || o.name === item)
                select = `<span class="attack-id" data-value="${JSON.stringify(attack).replaceAll("\"", "&quot;")}">${attack.name}</span>`
            } else {
                select = `<select class="attack-id" id="attack-${i}"><option> -- </option>${resolvedAttacks.join("")}</select>`
            }


            let attackBlock = `<div class="attack panel attack-block"><div class="attack-name">${select}</div><div class="attack-options"></div><div class="attack-total"></div></div>`


            content += attackBlock;

        }

        let height = availableAttacks * blockHeight + 85


        return {
            title,
            content,
            buttons: {
                attack: {
                    label: "Attack",
                    callback: (html) => {
                        let attacks = [];
                        let attackBlocks = html.find(".attack-block");
                        for(let attackBlock of attackBlocks){
                            let attackFromBlock = this.getAttackFromBlock(attackBlock);
                            if(!!attackFromBlock) {
                                attacks.push(attackFromBlock);
                            }
                        }

                        this.rollAttacks(attacks);
                    }
                }
            },
            render: async (html) => {
                let selects = html.find("select");
                selects.on("change", () => handleAttackSelect(selects));
                handleAttackSelect(selects)

                let attackIds = html.find(".attack-id");
                attackIds.each((i, div) => this.populateItemStats(div, context));

                attackIds.on("change", () => {
                    let attackIds = html.find(".attack-id");
                    context.attackMods = this.getAttackMods(selects, dualWeaponModifier);
                    context.damageMods = this.getDamageMods(selects, dualWeaponModifier);
                    attackIds.each((i, div) => this.populateItemStats(div, context));
                })
            },
            options: {
                height
            }
        };
    }

    getDamageMods() {
        return [];
    }

    getAttackMods(selects, dualWeaponModifier) {
        let attackMods = []
        let itemIds = [];
        for (let select of selects) {
            if (select.value === "--") {
                continue;
            }
            let attack = JSON.parse(select.value);
            let mods = attack.mods
            if (mods === "doubleAttack") {
                attackMods.push({value: -5, source: "Double Attack"});
            }
            if (mods === "tripleAttack") {
                attackMods.push({value: -5, source: "Triple Attack"});
            }
            itemIds.push(attack.itemId)
        }
        itemIds = itemIds.filter((value, index, self) => self.indexOf(value) === index)

        if (itemIds.length > 1) {
            attackMods.push({value: dualWeaponModifier, source: "Dual Weapon"});
        }
        return attackMods;
    }


    /**
     *
     * @param html
     * @param context
     */
    populateItemStats(html, context) {
        let value = html.value || $(html).data("value");
        if (value === "--") {
            return;
        }
        let attack;
        if(typeof value === "string"){
            attack = JSON.parse(value);
        } else {
            attack = value;
        }
        //let attack = JSON.parse(value);


        let parent = $(html).parents(".attack");
        let options = parent.children(".attack-options")
        options.empty();
        if (attack.name === "Unarmed Attack") {
            let attack = generateUnarmedAttack(this);
            options.append(SWSEItem.getModifierHTML(0))

            options.find(".attack-modifier").on("change", ()=> this.setAttackTotal(attack, total, options, context))
            options.find(".damage-modifier").on("change", ()=> this.setAttackTotal(attack, total, options, context))

            let total = parent.children(".attack-total");
            this.setAttackTotal(attack, total, options, context);
        } else {
            let itemId = attack.itemId;
            let iterative = 0;
            if(itemId.includes("#")){
                let toks = itemId.split("#");
                iterative = parseInt(toks[1]);
                itemId = toks[0];
            }

            let item = this.items.get(itemId)

            if (item) {
                let rangedAttackModifier = getRangedAttackMod(item.effectiveRange, item.accurate, item.inaccurate, this);

                let attack = generateAttackFromWeapon(item, this, iterative);
                options.append(SWSEItem.getModifierHTML(rangedAttackModifier, item))

                options.find(".attack-modifier").on("change", ()=> this.setAttackTotal(attack, total, options, context))
                options.find(".damage-modifier").on("change", ()=> this.setAttackTotal(attack, total, options, context))

                let total = parent.children(".attack-total");
                this.setAttackTotal(attack, total, options, context);
            }
        }

    }

    setAttackTotal(attack, total, options, context) {
        options.children()
        total.empty();
        let damageRoll = `<div>${attack.dam}</div>` + this.getModifiersFromContextAndInputs(options, context.damageMods, ".damage-modifier");
        let attackRoll = `<div>${attack.th}</div>` + this.getModifiersFromContextAndInputs(options, context.attackMods, ".attack-modifier");
        total.append(`<div class="flex flex-row"><div>Attack Roll: <div class="attack-roll">${attackRoll}</div></div> <div class="flex"><div>Damage Roll: <div class="damage-roll">${damageRoll}</div></div></div>`)
    }

    getModifiersFromContextAndInputs(options, modifiers, inputCriteria) {
        let bonuses = [];
        options.find(inputCriteria).each((i, modifier) => {
                if (((modifier.type === "radio" || modifier.type === "checkbox") && modifier.checked) || !(modifier.type === "radio" || modifier.type === "checkbox")) {
                    bonuses.push({source: $(modifier).data("source"), value: getBonusString(modifier.value)});
                }
            }
        )
        for (let attackMod of modifiers || []) {
            bonuses.push({source: attackMod.source, value: getBonusString(attackMod.value)});
        }

        let roll = ""
        for(let bonus of bonuses){
            roll += `<div title="${bonus.source}">${bonus.value}</div>`
        }
        return roll;
    }

    getAttackOptions(doubleAttack, tripleAttack) {
        let attacks = this.data.data.attacks;

        let resolvedAttacks = [];

        //only 2 different weapons can be used
        //double attacks can only be used once first attack is used
        //triple attacks can only be used once doubel attack is used
        let existingWeaponNames = [];
        let id = 1;
        for (let attack of attacks) {
            let source = attack.source;
            if (!source) {
                continue;
            }

            let duplicateCount = existingWeaponNames.filter(name => name === attack.name).length;

            existingWeaponNames.push(attack.name)
            if (duplicateCount > 0) {
                attack.name = attack.name + ` #${duplicateCount + 1}`;
            }

            resolvedAttacks.push(this.createAttackOption(attack, id++))
            let additionalDamageDice = source.additionalDamageDice
            // if (additionalDamageDice.length === 0) {
            //     continue;
            // }
            for (let i = 0; i < additionalDamageDice.length; i++) {
                let additionalDamageDie = additionalDamageDice[i];
                let clonedAttack = JSON.parse(JSON.stringify(attack));
                clonedAttack.dam = additionalDamageDie;
                clonedAttack.name = clonedAttack.name + ` (${getOrdinal(i + 2)} attack)`
                clonedAttack.itemId = clonedAttack.itemId + `#${i + 1}`
                resolvedAttacks.push(this.createAttackOption(clonedAttack, id++))
            }

            if (doubleAttack.includes(source.data.data.subtype)) {
                let clonedAttack = JSON.parse(JSON.stringify(attack));
                clonedAttack.name = clonedAttack.name + ` (Double attack)`
                clonedAttack.mods = "doubleAttack";
                resolvedAttacks.push(this.createAttackOption(clonedAttack, id++))
            }
            if (tripleAttack.includes(source.data.data.subtype)) {
                let clonedAttack = JSON.parse(JSON.stringify(attack));
                clonedAttack.name = clonedAttack.name + ` (Triple attack)`
                clonedAttack.mods = "tripleAttack";
                resolvedAttacks.push(this.createAttackOption(clonedAttack, id++))
            }
        }
        return resolvedAttacks;
    }
    // methods revolving around attack blocks.  can make this more simplified with an attack object maybe.
    getAttackFromBlock(attackBlock) {
        let attackId = $(attackBlock).find(".attack-id")[0]
        let attackValue = attackId.value || $(attackId).data("value");

        if(attackValue !== "--"){
            let attackJSON = attackValue;
            if(typeof attackJSON === "string"){
                attackJSON = JSON.parse(attackJSON);
            }

            let attack = {};
            let attackRoll = $(attackBlock).find(".attack-roll")[0].innerText.replace(/\n/g, "");
            let damageRoll = $(attackBlock).find(".damage-roll")[0].innerText.replace(/\n/g, "");
            attack.name = attackJSON.name;
            attack.toHit = attackRoll;
            attack.damage = damageRoll;
            return attack;
        }
        return undefined;
    }

    rollAttacks(attacks, rollMode) {
        let cls = getDocumentClass("ChatMessage");
        //let csd = getDocumentClass("ChatSpeakerData");

        let attackRows = "";
        let roll;

        for(let attack of attacks){
            let attackRoll = new Roll(attack.toHit).roll();
            roll = attackRoll;
            let damageRoll = new Roll(attack.damage).roll();
            attackRows += `<tr><td>${attack.name}</td><td><a class="inline-roll inline-result" title="${attackRoll.result}">${attackRoll.total}</a></td><td><a class="inline-roll inline-result" title="${damageRoll.result}">${damageRoll.total}</a></td></tr>`
        }

        let content = `<table>
<thead><th>Attack</th><th>To Hit</th><th>Damage</th></thead>
<tbody>${attackRows}</tbody>
</table>`;

        let speaker = cls.getSpeaker();

        delete speaker.alias

        let flavor = attacks[0].name;
        if(attacks.length > 1){
            flavor = "Full Attack " + flavor;
        }


        let messageData = {
            user: game.user.id,
            speaker: speaker,
            flavor: flavor,
            type: CONST.CHAT_MESSAGE_TYPES.ROLL,
            content,
            sound: CONFIG.sounds.dice,
            roll
        }

        let msg = new cls(messageData);
        if ( rollMode ) msg.applyRollMode(rollMode);

        return cls.create(msg.data, { rollMode });
    }

    createAttackOption(attack, id) {
        let attackString = JSON.stringify(attack).replaceAll("\"", "&quot;");
        return `<option id="${id}" data-item-id="${attack.itemId}" value="${attackString}" data-attack="${attackString}">${attack.name}</option>`;
    }
}