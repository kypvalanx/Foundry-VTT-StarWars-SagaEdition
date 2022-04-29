import {resolveHealth} from "./health.js";
import {generateAttacks, generateVehicleAttacks} from "./attack-handler.js";
import {resolveOffense} from "./offense.js";
import {generateSpeciesData} from "./species.js";
import {
    excludeItemsByType,
    filterItemsByType,
    getBonusString,
    getIndexAndPack,
    handleAttackSelect,
    resolveExpression,
    resolveValueArray,
    toShortAttribute,
    unique
} from "../util.js";
import {formatPrerequisites, meetsPrerequisites} from "../prerequisite.js";
import {resolveDefenses} from "./defense.js";
import {generateAttributes} from "./attribute-handler.js";
import {generateSkills, getAvailableTrainedSkillCount} from "./skill-handler.js";
import {SWSEItem} from "../item/item.js";
import {crewPositions, crewQuality, lightsaberForms, sizeArray, skills} from "../constants.js";
import {getActorFromId} from "../swse.js";
import {getInheritableAttribute} from "../attribute-helper.js";
import {appendNumericTerm, Attack} from "./attack.js";


function multiplyNumericTerms(roll, multiplier) {
    for(let term of roll.terms){
        if(term instanceof NumericTerm){
            term.number = term.number * multiplier;
        }
    }
}

// noinspection JSClosureCompilerSyntax
/**
 * Extend the base Actor entity by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class SWSEActor extends Actor {
    //resolvedVariables = new Map();

    //resolvedLabels = new Map();
    //inheritableItems = [];


    _onUpdate(data, options, userId) {
        super._onUpdate(data, options, userId);
        for (let crewMember of this.data.data.crew) {
            let linkedActor = getActorFromId(crewMember.id)
            if (!!linkedActor) {
                linkedActor.prepareData()
            }
        }
    }

    /**
     * Augment the basic actor data with additional dynamic data.
     */
    prepareData() {
        super.prepareData();
        const actorData = this.data;
        // Make separate methods for each Actor type (character, npc, etc.) to keep
        // things organized.

        this.data.prerequisites = {};
        this.inheritableItems = [];
        this.resolvedVariables = new Map();
        this.resolvedLabels = new Map();

        if (this.id && actorData.type === "npc") {
            this.update({"type": "character", "data.isNPC": true}, {updateChanges: false});
        } else if (this.id && actorData.type === "npc-vehicle") {
            this.update({
                "type": "vehicle",
                "data.isNPC": true
            }, {updateChanges: false});
        } else if (this.id && actorData.data.isNPC && actorData.token.actorLink) {
            this.update({"token.actorLink": false})
        } else if (this.id && !actorData.data.isNPC && !actorData.token.actorLink) {
            this.update({"token.actorLink": true})
        } else {
            this.data.data.condition = this.data.data.condition || 0;

            if (actorData.type === 'character') this._prepareCharacterData(actorData);
            if (actorData.type === 'npc') this._prepareCharacterData(actorData);
            if (actorData.type === 'computer') this._prepareComputerData(actorData);
            if (actorData.type === 'vehicle') this._prepareVehicleData(actorData);
            if (actorData.type === 'npc-vehicle') this._prepareVehicleData(actorData);


        }
        //console.warn(this.data.prerequisites)
    }

    /**
     * Prepare Vehicle type specific data
     * @param actorData
     * @private
     */
    _prepareVehicleData(actorData) {
        let vehicleBaseTypes = filterItemsByType(this.items.values(), "vehicleBaseType");
        this.vehicleTemplate = (vehicleBaseTypes.length > 0 ? vehicleBaseTypes[0] : null);

        if (this.vehicleTemplate) {
            this.inheritableItems.push(this.vehicleTemplate.data)
        }

        this.uninstalled = this.getUninstalledSystems();
        this.installed = this.getInstalledSystems('installed');
        this.inheritableItems.push(...this.installed.map(item => item.data))
        this.pilotInstalled = this.getInstalledSystems('pilotInstalled');
        this.gunnerPositions = this.getGunnerPositions()
        //this.inheritableItems.push(...this.systems)
        //this.uninstalled = this.getUnequippedItems().map(item => item.data);
        this.cargo = this.getNonequippableItems().map(item => item.data);
        this.traits = this.getTraits().map(trait => trait.data);

        this.inheritableItems.push(...this.traits)
        this.data.data.attributeGenerationType = "Manual"
        this.data.data.disableAttributeGenerationChange = true;

        this.data.crew = getInheritableAttribute({
            entity: this,
            attributeKey: "crew",
            reduce: "SUM"
        })

        let coverValues = getInheritableAttribute({
            entity: this,
            attributeKey: "cover",
            reduce: "VALUES"
        })

        let coverMap = {};
        for (let coverValue of coverValues) {
            if (coverValue.includes(":")) {
                let toks = coverValue.split(":");
                coverMap[toks[1]] = toks[0];
            } else {
                coverMap["default"] = coverValue;
            }
        }


        this.crewSlots = [];

        let crewSlotResolution = {};
        crewSlotResolution['Pilot'] = (crew) => (crew > 0) ? 1 : 0
        crewSlotResolution['Copilot'] = (crew) => (crew > 1) ? 1 : 0
        crewSlotResolution['Gunner'] = (crew) => (crew > 1) ? 1 : 0;
        crewSlotResolution['Commander'] = (crew) => (crew > 2) ? 1 : 0;
        crewSlotResolution['System Operator'] = (crew) => (crew > 2) ? 1 : 0;
        crewSlotResolution['Engineer'] = (crew) => (crew > 2) ? 1 : 0;


        crewPositions.forEach(position => {
            let crewMember = this.data.data.crew.filter(crewMember => crewMember.position === position);
            let positionCover;

            if (this.data.data.crewCover) {
                positionCover = this.data.data.crewCover[position]
            }

            if (!positionCover) {
                positionCover = coverMap[position];
            }
            if (!positionCover) {
                positionCover = coverMap["default"];
            }
            if (position === 'Gunner') {
                this.crewSlots.push(...this.resolveGunnerSlots(crewMember, position, positionCover));
            } else {
                let crewSlot = crewSlotResolution[position];
                if (crewSlot) {
                    this.crewSlots.push(...this.resolveSlots(crewSlot(this.data.crew), crewMember, position, positionCover));
                }
            }
        });

        this.data.hasAstromechSlot = false;
        let providedSlots = getInheritableAttribute({
            entity: this,
            attributeKey: "providesSlot",
            reduce: "VALUES"
        });
        for (let position of providedSlots.filter(unique)) {
            let count = providedSlots.filter(s => s === position).length
            let positionCover;

            if (this.data.data.crewCover) {
                positionCover = this.data.data.crewCover[position]
            }

            if (!positionCover) {
                positionCover = coverMap[position];
            }
            if (!positionCover) {
                positionCover = coverMap["default"];
            }
            if (position === "Astromech Droid") {
                this.data.hasAstromechSlot = true;
            }
            this.data.crew += ` plus ${count} ${position} slot${count > 1 ? "s" : ""}`
            this.crewSlots.push(...this.resolveSlots(count, this.data.data.crew.filter(crewMember => crewMember.position === position), position, positionCover));
        }


        if (!this.data.data.crewQuality || this.data.data.crewQuality.quality === "-" || this.data.data.crewQuality.quality === undefined) {
            let quality = getInheritableAttribute({
                entity: this,
                attributeKey: "crewQuality",
                reduce: "FIRST"
            });
            if (quality) {
                this.data.data.crewQuality = {quality: quality.titleCase()}
            }
        }

        this.data.passengers = getInheritableAttribute({
            entity: this,
            attributeKey: "passengers",
            reduce: "SUM"
        })
        this.data.subType = getInheritableAttribute({
            entity: this,
            attributeKey: "vehicleSubType",
            reduce: "FIRST"
        })
        this.data.maximumVelocity = getInheritableAttribute({
            entity: this,
            attributeKey: "maximumVelocity",
            reduce: "FIRST"
        })

        //TODO make the summation reduce function handle units?
        this.data.cargo =
            {
                value: getInheritableAttribute({
                    entity: this,
                    attributeKey: "weight",
                    reduce: "SUM"
                }),
                capacity: `${(getInheritableAttribute({
                    entity: this,
                    attributeKey: "cargoCapacity",
                    reduce: "FIRST"
                }))}`
            }

        this.data.consumables = getInheritableAttribute({
            entity: this,
            attributeKey: "consumables",
            reduce: "FIRST"
        })
        this.data.grapple = resolveValueArray([this.pilot.data.offense?.bab, this.data.data.attributes.str.mod, getInheritableAttribute({
            entity: this,
            attributeKey: "grappleSizeModifier",
            reduce: "SUM"
        })], this)

        let primary = `Class ${(getInheritableAttribute({
            entity: this,
            attributeKey: "hyperdrive",
            reduce: "MIN"
        }))}`;
        let backup = `Class ${(getInheritableAttribute({
            entity: this,
            attributeKey: "hyperdrive",
            reduce: "MAX"
        }))}`;
        if (primary === backup) {
            backup = undefined;
        }
        if (primary === `Class undefined`) {
            primary = undefined;
        }
        this.data.hyperdrive = {
            primary: primary,
            backup: backup
        }

        this.data.speed = {
            vehicle: getInheritableAttribute({
                entity: this,
                attributeKey: "speedStarshipScale",
                reduce: "SUM"
            }),
            character: getInheritableAttribute({
                entity: this,
                attributeKey: "speedCharacterScale",
                reduce: "SUM"
            })
        }

        let vehicleFightingSpace = getInheritableAttribute({
            entity: this,
            attributeKey: "vehicleFightingSpace",
            reduce: "MAX"
        });
        let characterFightingSpace = getInheritableAttribute({
            entity: this,
            attributeKey: "characterFightingSpace",
            reduce: "MAX"
        });
        this.data.fightingSpace = {
            vehicle: vehicleFightingSpace,
            character: characterFightingSpace
        }

        generateAttributes(this);
        generateSkills(this);

        actorData.data.health = resolveHealth(this);
        let {defense, armors} = resolveDefenses(this);
        actorData.data.defense = defense;
        actorData.data.armors = armors;

        actorData.data.attacks = generateVehicleAttacks(this);
    }

    /**
     * Prepare Computer type specific data
     */
    _prepareComputerData(actorData) {
        let div = document.createElement("DIV");
        div.innerHTML = actorData.data.content;
        let rough = div.textContent || div.innerText || "";
        let toks = rough.split("\n");
        for (let tok of toks) {

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
        let speciesList = filterItemsByType(this.items.values(), "species");
        this.species = (speciesList.length > 0 ? speciesList[0] : null);

        if (this.species) {
            this.inheritableItems.push(this.species.data)
        }
        generateSpeciesData(this);

        this.classes = filterItemsByType(this.items.values(), "class");

        this.inheritableItems.push(...this.classes.map(item => item.data));
        this.traits = this.getTraits().map(trait => trait.data);
        this.talents = this.getTalents().map(talent => talent.data);
        this.powers = filterItemsByType(this.items.values(), "forcePower").map(item => item.data);
        this.languages = filterItemsByType(this.items.values(), "language");
        this.secrets = filterItemsByType(this.items.values(), "forceSecret").map(item => item.data);
        this.techniques = filterItemsByType(this.items.values(), "forceTechnique").map(item => item.data);
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

        this.equipped = this.getEquippedItems()//.map(item => item.data);
        this.inheritableItems.push(...this.equipped)
        this.unequipped = this.getUnequippedItems()//.map(item => item.data);
        this.inventory = this.getNonequippableItems()//.map(item => item.data);

        generateAttributes(this);

        this.handleDarksideArray(actorData);

        resolveOffense(this);
        let feats = this.resolveFeats();
        this.feats = feats.activeFeats;
        this.inheritableItems.push(...this.feats)
        generateSkills(this);


        let remainingSkills = getAvailableTrainedSkillCount(this);
        remainingSkills = remainingSkills - this.trainedSkills.length;
        this.remainingSkills = remainingSkills < 0 ? false : remainingSkills;
        this.tooManySKills = remainingSkills < 0 ? Math.abs(remainingSkills) : false;

        this.isHeroic = getInheritableAttribute({
            entity: this,
            attributeKey: "isHeroic",
            reduce: "OR"
        });


        actorData.hideForce = 0 === this.feats.filter(feat => feat.name === 'Force Training').length

        actorData.inactiveProvidedFeats = feats.inactiveProvidedFeats

        this._reduceProvidedItemsByExistingItems(actorData);

        actorData.data.health = resolveHealth(this);
        let {defense, armors} = resolveDefenses(this);
        actorData.data.defense = defense;
        actorData.data.armors = armors;

        this._manageAutomaticItems(actorData, feats.removeFeats).then(() => this.handleLeveBasedAttributeBonuses(actorData));
        actorData.data.attacks = generateAttacks(this);
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

        let darkSideTaint = getInheritableAttribute({entity:actorData, attributeKey:"darksideTaint", reduce: "SUM"})

        actorData.data.finalDarksideScore = actorData.data.darkSideScore + darkSideTaint
    }

    get hasCrew() {
        if (!["vehicle", "npc-vehicle"].includes(this.data.type)) {
            return false;
        }
        return 0 < this.data.data.crew.length
    }


    getCrewByQuality() {
        let quality = this.data.data.crewQuality.quality;
        let attackBonus = 0;
        let checkModifier = 0;
        let cLModifier = 0;
        if (quality && quality !== "-") {
            attackBonus = crewQuality[quality.titleCase()]["Attack Bonus"];
            checkModifier = crewQuality[quality.titleCase()]["Check Modifier"];
            cLModifier = crewQuality[quality.titleCase()]["CL Modifier"];
        }
        let resolvedSkills = {}
        skills.forEach(s => resolvedSkills[s.toLowerCase()] = {value: checkModifier})
        return {
            data: {
                offense: {
                    bab: attackBonus
                },
                skills: resolvedSkills
            },
            items: [],
            name: quality
        }
    }

    getCrewByPosition(position, slot) {
        switch (position.titleCase()) {
            case "Pilot":
                return this.pilot;
            case "Copilot":
                return this.copilot;
            case "Commander":
                return this.commander;
            case "Engineer":
                return this.engineer
            case "Systems Operator":
            case "SystemsOperator":
                return this.systemsOperator
            case "Gunner":
                return this.gunner(slot)
        }
        return this.getCrewByQuality();
    }

    get pilot() {
        let pilot = this.getActor(this.data.data.crew.find(c => c.position === 'Pilot')?.id);
        if (!pilot) {
            pilot = this.astromech;
        }
        if (!pilot) {
            pilot = this.getCrewByQuality();
        }
        return pilot;
    }

    get copilot() {
        let copilot = this.getActor(this.data.data.crew.find(c => c.position === 'Copilot')?.id);
        if (!copilot) {
            copilot = this.astromech;
        }
        if (!copilot) {
            copilot = this.getCrewByQuality();
        }
        return copilot;
    }

    gunner(index) {
        let actor = this.getActor(this.data.data.crew.find(c => c.position === 'Gunner' && c.slot === (index || 0))?.id);

        if (!actor) {
            actor = this.getCrewByQuality();
        }

        return actor;
    }

    get commander() {
        let commander = this.getActor(this.data.data.crew.find(c => c.position === 'Commander')?.id);
        if (!commander) {
            commander = this.pilot;
        }
        if (!commander) {
            commander = this.getCrewByQuality();
        }
        return commander;
    }

    get systemsOperator() {
        let systemsOperator = this.getActor(this.data.data.crew.find(c => c.position === 'Systems Operator')?.id);
        if (!systemsOperator) {
            systemsOperator = this.astromech;
        }
        if (!systemsOperator) {
            systemsOperator = this.getCrewByQuality();
        }
        return systemsOperator;
    }

    get engineer() {
        let engineer = this.getActor(this.data.data.crew.find(c => c.position === 'Engineer')?.id);
        if (!engineer) {
            engineer = this.astromech;
        }
        if (!engineer) {
            engineer = this.getCrewByQuality();
        }
        return engineer;
    }

    get astromech() {
        let actor = this.getActor(this.data.data.crew.find(c => c.position === 'Astromech Droid')?.id);
        if (!actor && this.data.data.hasAstromech && this.data.hasAstromechSlot) {
            actor = this.getCrewByQuality();
            //TODO figure out if this is consistent on different ships with droid sockets

            actor.data.skills['mechanics'].value = 13;
            actor.data.skills['use computer'].value = 13;
        }
        return actor;
    }

    getActor(id) {
        return game.data.actors.find(actor => actor._id === id);
    }

    get age() {
        return this.data.data.age;
    }

    get sex() {
        return this.data.data.sex;
    }

    get speed() {
        if (!this.traits) {
            return;
        }

        let attributes = getInheritableAttribute({
            entity: this,
            attributeKey: 'speed', reduce:"VALUES"
        })

        if (attributes.length === 0) {
            attributes.push("Stationary 0");
        }

        let armorType = "";
        for (let armor of this.getEquippedItems().filter(item => item.type === "armor")) {
            if (armor.armorType === "Heavy" || (armor.armorType === "Medium" && armorType === "Light") || (armor.armorType === "Light" && !armorType)) {
                armorType = armor.armorType;
            }
        }
        return attributes.map(name => this.applyArmorSpeedPenalty(name, armorType)).map(name => this.applyConditionSpeedPenalty(name, armorType)).join("; ");
    }


    applyArmorSpeedPenalty(speed, armorType) {
        if (!armorType || "Light" === armorType) {
            return speed;
        }
        let result = /([\w\s]*)\s(\d*)/.exec(speed);

        return `${result[1]} ${Math.floor(parseInt(result[2]) * 3 / 4)}`
    }

    applyConditionSpeedPenalty(speed) {
        if (this.data.data.condition !== -10 && this.data.data.condition !== "OUT") {
            return speed;
        }

        let result = /([\w\s]*)\s(\d*)/.exec(speed);

        return `${result[1]} ${Math.floor(parseInt(result[2]) / 2)}`
    }

    getTraits() {
        let activeTraits = [];
        let possibleTraits = filterItemsByType(this.items.values(), "trait");


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
        let getEquippedItems = this._getEquippedItems(this._getEquipable(this.getInventoryItems(this.items.values())), "equipped");
        let prerequisites = this.data.prerequisites;
        prerequisites.equippedItems = [];
        for (let item of getEquippedItems) {
            prerequisites.equippedItems.push(item.name.toLowerCase());
        }
        return getEquippedItems;
    }

    getInstalledWeapons() {
        return this._getEquippedItems(this.getInventoryItems(this.items.values()), ["pilotInstalled", "copilotInstalled", "gunnerInstalled"])
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

    get conditionBonus() {
        return this.data.data.condition;
    }


    setAttributes(attributes) {
        let update = {};
        for (let [key, ability] of Object.entries(attributes)) {
            update[`data.attributes.${key}.base`] = ability;
        }
        this.update(update);
    }


    getAttributes() {
        return this.data.data.attributes;
    }


    getAttributeBases() {
        let response = {};
        for (let [key, attribute] of Object.entries(this.data.data.attributes)) {
            response[key] = attribute.base;
        }
        return response;
    }

    getAttributeBonuses() {
        let response = {};
        for (let [key, attribute] of Object.entries(this.data.data.attributes)) {
            response[key] = attribute.bonus;
        }
        return response;
    }

    /**
     *
     * @param actor {SWSEActor}
     * @param position {string}
     * @param slot {string}
     */
    async addCrew(actor, position, slot) {
        let update = {};
        update['data.crew'] = [{actor: actor.data, id: actor.id, position, slot}].concat(this.data.data.crew);

        await this.update(update);
    }

    async removeCrew(actorId, position) {
        let update = {};
        if (!!actorId && !!position) {
            update['data.crew'] = this.data.data.crew.filter(c => c.id !== actorId || c.position !== position)
        } else if (!!actorId) {

            update['data.crew'] = this.data.data.crew.filter(c => c.id !== actorId)
        } else if (!!position) {

            update['data.crew'] = this.data.data.crew.filter(c => c.position !== position)
        }

        await this.update(update);
    }

    /**
     *
     * @param {string} attributeName
     */
    getAttribute(attributeName) {
        let swseActor = this;
        return SWSEActor.getActorAttribute(swseActor, attributeName);
    }


    static getActorAttribute(swseActor, attributeName) {
        let attributes = swseActor.data?.attributes || swseActor.data?.data?.attributes;
        let attribute = attributes[toShortAttribute(attributeName).toLowerCase()];

        return attribute.total;
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

    get heroicLevel() {
        if (this.classes) {
            let heroicLevel = this.classes.filter(c => getInheritableAttribute({
                entity: c,
                attributeKey: "isHeroic",
                reduce: "OR"
            })).length;
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

    get hideForce() {
        return !getInheritableAttribute({
            entity: this,
            attributeKey: "forceSensitivity",
            reduce: "OR"
        });
    }

    get isDroid() {
        return getInheritableAttribute({
            entity: this,
            attributeKey: "isDroid",
            reduce: "OR"
        });
    }

    get trainedSkills() {
        return this.skills.filter(skill => skill && skill.trained);
    }

    get skills() {
        return Object.values(this.data.data.skills);
    }

    get focusSkills() {
        return getInheritableAttribute({
            entity: this,
            attributeKey: "skillFocus",
            reduce: "VALUES"
        })
    }

    get inactiveProvidedFeats() {
        return this.data.inactiveProvidedFeats;
    }

    get shield() {
        return getInheritableAttribute({
            entity: this,
            attributeKey: "shieldRating",
            reduce: "MAX"
        })
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

        let isHeroic = getInheritableAttribute({
            entity: this,
            attributeKey: "isHeroic",
            reduce: "OR"
        });
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

        if (hasUpdate && this.id) {
            return this.update({_id: this.id, 'data.levelAttributeBonus': actorData.data.levelAttributeBonus});
        }
        return undefined;
    }

    ignoreCon() {
        return this.data.data.attributes.con?.skip || true;
    }


    _getEquippedItems(items, equipTypes) {
        if (!Array.isArray(equipTypes)) {
            equipTypes = [equipTypes];
        }
        let equippedIds = (this.data.data.equippedIds || [])
        if (equipTypes.length > 0) {
            equippedIds = equippedIds.filter(id => equipTypes.includes(id.type))
        }
        equippedIds = equippedIds.map(id => id.id);

        return items.filter(item => equippedIds.includes(item.data._id))
    }

    getUnequippedItems() {
        let items = this._getEquipable(this.getInventoryItems(this.items.values()));

        let equippedIds = (this.data.data.equippedIds || []).map(id => id.id);

        return items.filter(item => !equippedIds.includes(item.data._id))
    }

    getUninstalledSystems() {
        let items = filterItemsByType(this.items.values(), "vehicleSystem");

        let equippedIds = (this.data.data.equippedIds || []).map(id => id.id);

        return items.filter(item => !equippedIds.includes(item.data._id)).filter(item => !item.data.data.hasItemOwner);
    }

    getInstalledSystems(installationType) {
        let items = filterItemsByType(this.items.values(), "vehicleSystem");
        let installed = [];
        for (let item of items) {
            let find = this.data.data.equippedIds?.find(e => e.id === item.data._id && e.type === installationType);
            if (find) {
                installed.push(item);
            }
        }
        return installed;
    }

    getGunnerPositions() {
        let items = filterItemsByType(this.items.values(), "vehicleSystem");
        let gunnerSlots = this.data.data.equippedIds.filter(id => !!id.type && id.type.startsWith("gunnerInstalled")).map(id => parseInt(id.slot)).filter(unique)

        let positions = [];

        for (let gunnerSlot of gunnerSlots) {
            let gunnerItemReferences = this.data.data.equippedIds.filter(id => id.type === `gunnerInstalled` && id.slot === gunnerSlot)
            let gunnerItems = []
            for (let item of items) {
                let find = gunnerItemReferences?.find(e => e.id === item.data._id);
                if (find) {
                    gunnerItems.push(item);
                }
            }


            positions.push({
                id: `gunnerInstalled${gunnerSlot}`,
                numericId: gunnerSlot,
                installed: gunnerItems.map(item => item.data)
            });
        }

        return positions;
    }


    getNonequippableItems() {
        return this._getUnequipableItems(this.getInventoryItems(this.items.values())).filter(i => !i.data.hasItemOwner);
    }

    getInventoryItems(items) {
        return excludeItemsByType(items, "language", "feat", "talent", "species", "class", "classFeature", "forcePower", "forceTechnique", "forceSecret", "ability", "trait", "affiliation")
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
        let skills = getInheritableAttribute({
            entity: this,
            attributeKey: "classSkill"
        }).map(attr => attr.value);

        for (let skill of skills) {
            if (["knowledge (all skills, taken individually)", "knowledge (all types, taken individually)"].includes(skill.toLowerCase())) {
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

    /**
     *
     * @param ability {string}
     * @returns {*}
     */
    getAttributeMod(ability) {
        return this.data.data.attributes[ability.toLowerCase()].mod;
    }

    /**
     *
     * @returns {SWSEItem|*}
     */
    getFirstClass() {
        let firstClasses = this.getItemContainingInheritableAttribute("isFirstLevel", true);

        if (firstClasses.length > 1) {
            console.warn("more than one class item has been marked as first class on actor the first one found will be used as the first class and all others will be ignored " + this.id)
        }
        if (firstClasses.length > 0) {
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
        return getInheritableAttribute({
            entity: this,
            attributeKey,

            itemFilter: (item => item.type === "trait")
        });
    }

    get fullAttackCount() {
        return 2
    }

    getActiveModes(itemId) {
        let item = this.items.get(itemId);
        return SWSEItem.getActiveModesFromItemData(item.data);
    }

    getAbilitySkillBonus(skill) {
        //TODO camelcase and simplify unless this could be more complex?
        if (skill.toLowerCase() === 'stealth') {
            return getInheritableAttribute({
                entity: this,
                attributeKey: 'sneakModifier',
                reduce: "SUM"
            });
        }
        if (skill.toLowerCase() === 'perception') {
            return getInheritableAttribute({
                entity: this,
                attributeKey: 'perceptionModifier',
                reduce: "SUM"
            });
        }
        return 0;
    }


//TODO evaluate this.  do we need it?
    hasItem(item) {
        return Array.from(this.items.values())
            .map(i => i.data.finalName)
            .includes(item.data.finalName);
    }

    resolveClassFeatures() {
        let provides = getInheritableAttribute({
            entity: this,
            attributeKey: "provides"
        });
        this.data.availableItems = {}; //TODO maybe allow for a link here that opens the correct compendium and searches for you
        this.data.bonuses = {};
        this.data.activeFeatures = [];
        for (let provided of provides) {
            let key = provided.value;
            let value = 1;
            if (key.includes(":")) {
                let toks = key.split(":");
                key = toks[0];
                value = resolveExpression(toks[1], this)
            }
            this.data.availableItems[key] = this.data.availableItems[key] ? this.data.availableItems[key] + value : value;
        }

        let classLevel = this.classes?.length;
        this.data.availableItems['General Feats'] = 1 + Math.floor(classLevel / 3) + (this.data.availableItems['General Feats'] ? this.data.availableItems['General Feats'] : 0);

    }

    _reduceProvidedItemsByExistingItems(actorData) {

        this.resolveClassFeatures([])


        for (let talent of this.talents || []) {
            if (!talent.data.supplier.id) {
                this.reduceAvailableItem(actorData, talent.data.talentTreeSource);
            }
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
        this.reduceAvailableItem(actorData, "Force Secret", this.secrets.length);
        this.reduceAvailableItem(actorData, "Force Technique", this.techniques.length);
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

        if (variable.startsWith('@Initiative')) {
            this.rollInitiative({createCombatants: true, rerollInitiative: true, initiativeOptions: {formula: rollStr}})
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
        let items = [];
        for (let itemId of itemIds) {
            let actor = this;
            if (itemId.provider) {
                actor = getActorFromId(itemId.provider);
            }
            items.push(actor.items.get(itemId.id));
        }

        items = items.filter(item => !!item && item.type !== "weapon" && item.data.data.subtype !== "weapon systems");

        //let items = itemIds.map(itemId => this.items.get(itemId)).filter(item => !!item && item.type !== "weapon");

        if (items.length === 0) {
            this.attack(null, {type: (itemIds.length === 1 ? "singleAttack" : "fullAttack"), items: itemIds})
        } else {
            for (let item of items) {
                item.rollItem(this).render(true);
            }
        }

    }

    async sendRollToChat(template, formula, modifications, notes, name, actor) {
        let roll = new Roll(formula).roll({async: false});
        roll.toMessage({
            speaker: ChatMessage.getSpeaker({actor}),
            flavor: name
        });
    }

    async _onCreate(data, options, userId) {
        if (data.type === "character") await this.update({"token.actorLink": true}, {updateChanges: false});
        if (data.type === "npc") await this.update({"type": "character", "data.isNPC": true}, {updateChanges: false});
        if (data.type === "vehicle") await this.update({"token.actorLink": true}, {updateChanges: false});
        if (data.type === "npc-vehicle") await this.update({
            "type": "vehicle",
            "data.isNPC": true
        }, {updateChanges: false});

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

    get credits() {
        return this.data.data.credits || 0;
    }

    set credits(credits) {
        this.update({'data.credits': credits})
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
        return !!this.traits?.find(trait => trait.name === 'Disable Attribute Modification');
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
        return this.data.data.finalDarksideScore;
    }

    set darkSideScore(score) {
        this.update({'data.darkSideScore': score})
    }

    /**
     *
     * @returns {undefined|SWSEItem}
     */
    get size() {
        for (let trait of this.traits || []) {
            if (sizeArray.includes(trait.name)) {
                return trait;
            }
        }
        return undefined;
    }

    getItemContainingInheritableAttribute(key, value) {
        let attributes = getInheritableAttribute({
            entity: this,
            attributeKey: key
        });
        if (value !== undefined) {
            attributes = attributes.filter(item => item.value === value);
        }
        let sourceIds = attributes.map(item => item.source).distinct()
        return sourceIds.map(sourceId => this.items.get(sourceId));
    }


    /**
     *
     * @param event
     * @param context
     * @returns {Promise<void>}
     */
    async attack(event, context) {
        let options = this.buildAttackDialog(context);
        await new Dialog(options).render(true);
    }

    /**
     *
     * @param context {object}
     * @param context.type {string}
     * @param context.items {Array.<Attack>}
     * @returns {{buttons: {attack: {callback: buttons.attack.callback, label: string}}, options: {height: number}, title: string, render: ((function(*): Promise<void>)|*), content: string}}
     */
    buildAttackDialog(context) {
        let availableAttacks = 1;
        let title = "Single Attack";
        let dualWeaponModifier = -10;
        let doubleAttack = [];
        let tripleAttack = [];
        //let hands = 2; //TODO resolve extra hands

        if (context.type === "fullAttack") {
            title = "Full Attack";
            doubleAttack = getInheritableAttribute({
                entity: this,
                attributeKey: "doubleAttack",
                reduce: "VALUES"
            });
            tripleAttack = getInheritableAttribute({
                entity: this,
                attributeKey: "tripleAttack",
                reduce: "VALUES"
            });

            //availableAttacks = this.fullAttackCount;
            let equippedItems = this.getEquippedItems()
            availableAttacks = 0;
            let doubleAttackBonus = 0;
            let tripleAttackBonus = 0;
            let availableWeapons = 0
            for (let item of equippedItems) {
                availableWeapons = Math.min(availableWeapons + (item.isDoubleWeapon ? 2 : 1), 2);
                //TODO support exotic weapons
                if (doubleAttack.includes(item.data.data.subtype)) {
                    doubleAttackBonus = 1;
                }
                if (tripleAttack.includes(item.data.data.subtype)) {
                    tripleAttackBonus = 1;
                }
            }
            availableAttacks = availableWeapons + doubleAttackBonus + tripleAttackBonus


            //how many attacks?
            //
            //how many provided attacks from weapons max 2
            //+1 if has double attack and equipped item
            //+1 if has triple attack and equipped item

            let dualWeaponModifiers = getInheritableAttribute({
                entity: this,
                attributeKey: "dualWeaponModifier",
                reduce: "NUMERIC_VALUES"
            });
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
            let attack = suppliedItems.length > i ? suppliedItems[i] : undefined;
            let select;
            if (!!attack) {
                select = `<span class="attack-id" data-value="${JSON.stringify(attack).replaceAll("\"", "&quot;")}">${attack.name}</span>`
            } else {
                select = `<select class="attack-id" id="attack-${i}"><option> -- </option>${resolvedAttacks.join("")}</select>`
            }


            let attackBlock = `<div class="attack panel attack-block">
<div class="attack-name">${select}</div>
<div class="attack-options"></div>
<div class="attack-total"></div>
</div>`
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
                        for (let attackBlock of attackBlocks) {
                            let attackFromBlock = this.getAttackFromBlock(attackBlock);
                            if (!!attackFromBlock) {
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
                    let context = {};
                    context.attackMods = this.getAttackMods(selects, dualWeaponModifier);
                    context.damageMods = this.getDamageMods(selects, dualWeaponModifier);
                    html.find(".attack-id").each((i, div) => this.populateItemStats(div, context));
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
        let isDoubleAttack = false;
        let isTripleAttack = false;
        let standardAttacks = 0;
        for (let select of selects) {
            if (select.value === "--") {
                continue;
            }
            let attack = JSON.parse(select.value);
            let options = attack.options
            if (options.doubleAttack) {
                isDoubleAttack = true;
            }
            if (options.tripleAttack) {
                isTripleAttack = true;
            }
            if (options.standardAttack) {
                standardAttacks++;
            }
            itemIds.push(attack.itemId)
        }


        if (isDoubleAttack) {
            attackMods.push({value: -5, source: "Double Attack"});
        }
        if (isTripleAttack) {
            attackMods.push({value: -5, source: "Triple Attack"});
        }

        if (standardAttacks > 1) {
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

        let parent = $(html).parents(".attack");
        let options = parent.children(".attack-options")
        let total = parent.children(".attack-total");
        total.empty();
        options.empty();

        if (value === "--") {
            return;
        }
        let attack = Attack.fromJSON(value);


        options.append(attack.attackOptionHTML)
        options.find(".attack-modifier").on("change", () => this.setAttackTotal(attack, total, options, context))
        options.find(".damage-modifier").on("change", () => this.setAttackTotal(attack, total, options, context))

        this.setAttackTotal(attack, total, options, context);
    }

    setAttackTotal(attack, total, options, context) {
        options.children()
        total.empty();
        let damageRoll = `${attack.damageRoll.renderFormulaHTML}` + this.getModifiersFromContextAndInputs(options, context.damageMods, ".damage-modifier");
        let attackRoll = `${attack.attackRoll.renderFormulaHTML}` + this.getModifiersFromContextAndInputs(options, context.attackMods, ".attack-modifier");
        total.append(`<div class="flex flex-row"><div>Attack Roll: <div class="attack-roll flex flex-row">${attackRoll}</div></div><div>Damage Roll: <div class="damage-roll flex flex-row">${damageRoll}</div></div>`)
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
        for (let bonus of bonuses) {
            roll += `<span title="${bonus.source}">${bonus.value}</span>`
        }
        return roll;
    }
    getModifiersFromInputs(options, selector) {
        let bonuses = [];
        options.find(selector).each((i, modifier) => {
                if (((modifier.type === "radio" || modifier.type === "checkbox") && modifier.checked) || !(modifier.type === "radio" || modifier.type === "checkbox")) {
                    bonuses.push({source: $(modifier).data("source"), value: getBonusString(modifier.value)});
                }
            }
        )
        return bonuses;
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
            let source = attack.item;
            if (!source) {
                continue;
            }

            let duplicateCount = existingWeaponNames.filter(name => name === attack.name).length;

            existingWeaponNames.push(attack.name)
            if (duplicateCount > 0) {
                attack.options.duplicateCount = duplicateCount;
            }

            let clonedAttack = attack.clone();
            clonedAttack.options.standardAttack = true;
            resolvedAttacks.push(this.createAttackOption(clonedAttack, id++))

            let additionalDamageDice = attack.additionalDamageDice

            for (let i = 0; i < additionalDamageDice.length; i++) {
                let clonedAttack = attack.clone();
                clonedAttack.options.additionalAttack = i+1;
                clonedAttack.options.standardAttack = true;
                resolvedAttacks.push(this.createAttackOption(clonedAttack, id++))
            }

            if (doubleAttack.includes(source.data.subtype)) {
                let clonedAttack = attack.clone();
                clonedAttack.options.doubleAttack = true;
                resolvedAttacks.push(this.createAttackOption(clonedAttack, id++))
            }
            if (tripleAttack.includes(source.data.subtype)) {
                let clonedAttack = attack.clone();
                clonedAttack.options.tripleAttack = true;
                resolvedAttacks.push(this.createAttackOption(clonedAttack, id++))
            }
        }
        return resolvedAttacks;
    }

    // methods revolving around attack blocks.  can make this more simplified with an attack object maybe.
    getAttackFromBlock(attackBlock) {
        let attackId = $(attackBlock).find(".attack-id")[0]
        let attackValue = attackId.value || $(attackId).data("value");

        if (attackValue === "--") {
            return undefined;
        }
        let attack = Attack.fromJSON(attackValue)

        // let attack = {};

        let attackModifiers = this.getModifiersFromInputs($(attackBlock), ".attack-modifier");
        attackModifiers.forEach(modifier => modifier.type = 'attack');
        let damageModifiers = this.getModifiersFromInputs($(attackBlock), ".damage-modifier");
        damageModifiers.forEach(modifier => modifier.type = 'damage');

        attack.withModifiers(attackModifiers);
        attack.withModifiers(damageModifiers);

        return attack;
    }

    rollAttacks(attacks, rollMode) {
        let cls = getDocumentClass("ChatMessage");
        //let csd = getDocumentClass("ChatSpeakerData");

        let attackRows = [];
        let roll;

        for (let attack of attacks) {
            let resolvedAttack = this.resolveAttack(attack);
            roll = resolvedAttack.attack;
            let resolvedAttacks = [resolvedAttack];

            attackRows.push(this.getAttackBlock(attack, resolvedAttacks))
        }

        let content = `${attackRows.join("<br>")}`;

        let speaker = ChatMessage.getSpeaker({actor: this});

        let flavor = attacks[0].name;
        if (attacks.length > 1) {
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
        if (rollMode) msg.applyRollMode(rollMode);

        return cls.create(msg.data, {rollMode});
    }

    /**
     *
     * @param attack {Attack}
     * @returns {{damage: (Roll|Promise<Roll>), fail: boolean, critical: boolean, attack: (Roll|Promise<Roll>)}}
     */
    resolveAttack(attack) {
        let attackRollResult = attack.attackRoll.roll.roll({async: false});

        let fail = attack.isFailure(attackRollResult.total);
        let critical = attack.isCritical(attackRollResult.total);

        let damageRoll = attack.damageRoll.roll;
        if(critical){
            let criticalHitPreMultiplierBonuses = getInheritableAttribute({
                entity: attack.item,
                attributeKey: "criticalHitPreMultiplierBonus"
            })

            for(let criticalHitPreMultiplierBonus of criticalHitPreMultiplierBonuses){

                let value = resolveValueArray(criticalHitPreMultiplierBonus, this)

                damageRoll.terms.push(...appendNumericTerm(value, criticalHitPreMultiplierBonus.sourceString))
            }

            damageRoll.alter(2, 0, true)
            multiplyNumericTerms(damageRoll, 2)


            let postMultBonusDie = getInheritableAttribute({
                entity: attack.item,
                attributeKey: "criticalHitPostMultiplierBonusDie",
                reduce: "SUM"
            })
            damageRoll.alter(1, postMultBonusDie)
        }

        let damageRollResult = damageRoll.roll({async: false});
        return {attack: attackRollResult, damage: damageRollResult, damageType: attack.type, notes:attack.notes, critical: critical, fail: fail};
    }

    getAttackBlock(attack, resolvedAttacks) {

        let attackRolls = '<th>Attack:</th>';
        let damageRolls = '<th>Damage:</th>';

        for(let resolvedAttack of resolvedAttacks){
            let classes = [];
            if(resolvedAttack.critical){
                classes.push("critical")
            }
            if(resolvedAttack.fail){
                classes.push("fail")
            }

            attackRolls += `<td class="${classes.join(" ")}" title="${resolvedAttack.attack.result}">${resolvedAttack.attack.total}</td>`
            damageRolls += `<td title="${resolvedAttack.damage.result}">${resolvedAttack.damage.total} (${resolvedAttack.damageType})</td>`
        }


        return `<table>
<thead>
<tr>
<th>${attack.name}</th>
</tr>
</thead>
<tbody>
<tr>
${attackRolls}
</tr>
<tr>
${damageRolls}
</tr>
</tbody>
</table><br/><div>${attack.notes}</div>`

        //return `<tr><td>${attack.name}</td><td><a class="inline-roll inline-result" title="${attackRollResult.result}">${attackRollResult.total}</a></td><td><a class="inline-roll inline-result" title="${damageRollResult.result}">${damageRollResult.total}</a></td></tr>`;
    }

    createAttackOption(attack, id) {
        let attackString = JSON.stringify(attack).replaceAll("\"", "&quot;");
        return `<option id="${id}" data-item-id="${attack.itemId}" value="${attackString}" data-attack="${attackString}">${attack.name}</option>`;
    }

    resolveSlots(availableSlots, crew, type, cover) {
        let slots = [];
        for (let i = 0; i < availableSlots; i++) {

            let crewMemberInSlot = crew.find(c => c.slot === `${i}`);
            let actor;
            if (crewMemberInSlot) {
                actor = game.data.actors.find(actor => actor._id === crewMemberInSlot.id);
            }
            if (!!actor) {
                slots.push({slotNumber: i, id: crewMemberInSlot.id, img: actor.img, name: actor.name, type, cover});
            } else {
                slots.push({slotNumber: i, type, cover});
            }
        }
        return slots;
    }

    resolveGunnerSlots(crew, type, cover) {
        let slots = [];
        for (let gunnerPosition of this.gunnerPositions) {

            let crewMemberInSlot = crew.find(c => c.slot === `${gunnerPosition.numericId}`);
            let actor;
            if (crewMemberInSlot) {
                actor = game.data.actors.find(actor => actor._id === crewMemberInSlot.id);
            }
            if (!!actor) {
                slots.push({
                    slotNumber: gunnerPosition.numericId,
                    id: crewMemberInSlot.id,
                    img: actor.img,
                    name: actor.name,
                    type,
                    cover
                });
            } else {
                slots.push({slotNumber: gunnerPosition.numericId, type, cover});
            }
        }
        return slots.sort((first, second) => first.slotNumber < second.slotNumber);
    }

    getAvailableItemsFromRelationships() {
        if (['vehicle', 'npc-vehicle'].includes(this.type)) {
            let availableItems = []
            let itemIds = this.data.data.equippedIds

            for (let itemId of itemIds) {
                let item = this.items.map(i => i.data).find(item => item._id === itemId.id);
                if (item) {
                    item.parentId = this.data._id
                    item.position = itemId.position;
                    availableItems.push(item)
                }
            }
            return availableItems;
        }
        if (['character', 'npc'].includes(this.type)) {
            let availableItems = []
            for (let crew of this.data.data.crew) {
                let vehicle = game.data.actors.find(actor => actor._id === crew.id);
                if (vehicle) {
                    let itemIds = vehicle.data.equippedIds.filter(id => id.position.toLowerCase() === crew.position.toLowerCase() && `${id.slot}` === `${crew.slot}`).map(id => id.id)

                    let items = itemIds.map(id => vehicle.items.find(item => item._id === id))
                    items.forEach(item => item.parentId = vehicle._id)
                    items.forEach(item => item.position = crew.position)
                    availableItems.push(...items)
                } else {
                    //Remove?
                }
            }
            return availableItems;
        }
    }


    //ADDING ITEMS


    /**
     * Checks prerequisites of an item and offers available options
     * @param item {SWSEItem}
     * @param type
     */
    async checkPrerequisitesAndResolveOptions(item, options) {
        let choices = await this.activateChoices(item, {});
        if (!choices.success) {
            return [];
        }

        if (options.type !== "provided") {
            let takeMultipleTimes = getInheritableAttribute({
                entity: item,
                attributeKey: "takeMultipleTimes",


            })
                .map(a => a.value === "true").reduce((a, b) => a || b, false);

            if (this.hasItem(item) && !takeMultipleTimes) {
                await Dialog.prompt({
                    title: `You already have this ${options.type}`,
                    content: `You have already taken the ${item.data.finalName} ${options.type}`,
                    callback: () => {
                    }
                })
                return [];
            }

            let meetsPrereqs = meetsPrerequisites(this, item.data.data.prerequisite);

            if (meetsPrereqs.failureList.length > 0) {
                if (meetsPrereqs.doesFail) {
                    new Dialog({
                        title: "You Don't Meet the Prerequisites!",
                        content: "You do not meet the prerequisites:<br/>" + formatPrerequisites(meetsPrereqs.failureList),
                        buttons: {
                            ok: {
                                icon: '<i class="fas fa-check"></i>',
                                label: 'Ok'
                            }
                        }
                    }).render(true);

                    return [];

                } else {
                    new Dialog({
                        title: "You MAY Meet the Prerequisites!",
                        content: "You MAY meet the prerequisites. Check the remaining reqs:<br/>" + formatPrerequisites(meetsPrereqs.failureList),
                        buttons: {
                            ok: {
                                icon: '<i class="fas fa-check"></i>',
                                label: 'Ok'
                            }
                        }
                    }).render(true);
                }
            }
        }

        let mainItem = await this.createEmbeddedDocuments("Item", [item.data.toObject(false)]);

        let providedItems = item.getProvidedItems() || [];
        providedItems.push(...choices.items);
        await this.addItems(providedItems, mainItem[0], options);
        return mainItem[0];
    }


    /**
     * if no choices exist > success empty item array
     * if no choices can be run > success empty array
     * if a choice is exited from > fail
     * if choices run, modify parent item and return future items
     *
     * @param item
     * @param context
     * @returns {Promise<{success: boolean, items: []}>}
     */
    async activateChoices(item, context) {
        let choices = item.data.data.choices;
        if (choices?.length === 0) {
            return {success: true, items: []};
        }
        let items = [];
        for (let choice of choices ? choices : []) {
            if (choice.isFirstLevel && !context.isFirstLevel) {
                continue;
            }

            let options = this.explodeOptions(choice.options);

            let greetingString;
            let optionString = "";
            let keys = Object.keys(options);
            if (keys.length === 0) {
                greetingString = choice.noOptions ? choice.noOptions : choice.description;
            } else if (keys.length === 1) {
                greetingString = choice.oneOption ? choice.oneOption : choice.description;
                let optionLabel = keys[0];
                optionString = `<div id="choice">${optionLabel}</div>`
            } else {
                greetingString = choice.description;

                for (let optionLabel of keys) {
                    optionString += `<option value="${optionLabel}">${optionLabel}</option>`
                }

                if (optionString !== "") {
                    optionString = `<div><select id='choice'>${optionString}</select></div>`
                }
            }


            let content = `<p>${greetingString}</p>${optionString}`;

            let response = await Dialog.prompt({
                title: greetingString,
                content: content,
                rejectClose: async (html) => {
                    return false
                },
                callback: async (html) => {
                    let choice = html.find("#choice")[0];
                    if (choice === undefined) {
                        return false;
                    }
                    let key = choice?.value;

                    if (!key) {
                        key = choice?.innerText;
                    }
                    let selectedChoice = options[key];
                    if (!selectedChoice) {
                        return false;
                    }
                    if (selectedChoice.payload && selectedChoice.payload !== "") {
                        item.setPayload(selectedChoice.payload);

                    }
                    if (selectedChoice.providedItems && selectedChoice.providedItems.length > 0) {
                        return {success: true, items: selectedChoice.providedItems}
                    }
                    return {success: true, items: []}
                }
            });

            if (response === false) {
                return {success: false, items: []};
            }
            items.push(...response.items)
        }
        return {success: true, items};
    }


    explodeOptions(options) {
        let resolvedOptions = {};
        for (let [key, value] of Object.entries(options)) {
            if (key === 'AVAILABLE_EXOTIC_WEAPON_PROFICIENCY') {
                let weaponProficiencies = getInheritableAttribute({
                    entity: this,
                    attributeKey: "weaponProficiency",
                    reduce: "VALUES"
                })
                for (let weapon of game.generated.exoticWeapons) {
                    if (!weaponProficiencies.includes(weapon)) {
                        resolvedOptions[weapon] = {abilities: [], items: [], payload: weapon};
                    }
                }
            } else if (key === 'AVAILABLE_WEAPON_FOCUS') {
                let focuses = getInheritableAttribute({
                    entity: this,
                    attributeKey: "weaponFocus",
                    reduce: "VALUES"
                })
                for (let weapon of getInheritableAttribute({
                    entity: this,
                    attributeKey: "weaponProficiency",
                    reduce: "VALUES"
                })) {
                    if (!focuses.includes(weapon)) {
                        resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                    }
                }
            } else if (key === 'AVAILABLE_WEAPON_SPECIALIZATION') {
                let weaponSpecializations = getInheritableAttribute({
                    entity: this,
                    attributeKey: "weaponSpecialization",
                    reduce: "VALUES"
                })
                for (let weapon of getInheritableAttribute({
                    entity: this,
                    attributeKey: "weaponFocus",
                    reduce: "VALUES"
                })) {
                    if (!weaponSpecializations.includes(weapon)) {
                        resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                    }
                }
            } else if (key === 'AVAILABLE_GREATER_WEAPON_SPECIALIZATION') {
                let greaterWeaponSpecialization = getInheritableAttribute({
                    entity: this,
                    attributeKey: "greaterWeaponSpecialization",
                    reduce: "VALUES"
                })
                let greaterWeaponFocus = getInheritableAttribute({
                    entity: this,
                    attributeKey: "greaterWeaponFocus",
                    reduce: "VALUES"
                })
                for (let weaponSpecialization of getInheritableAttribute({
                    entity: this,
                    attributeKey: "weaponSpecialization",
                    reduce: "VALUES"
                })) {
                    if (!greaterWeaponSpecialization.includes(weaponSpecialization) && greaterWeaponFocus.includes(weaponSpecialization)) {
                        resolvedOptions[weaponSpecialization.titleCase()] = {
                            abilities: [],
                            items: [],
                            payload: weaponSpecialization.titleCase()
                        };
                    }
                }
            } else if (key === 'AVAILABLE_GREATER_WEAPON_FOCUS') {
                let greaterWeaponFocus = getInheritableAttribute({
                    entity: this,
                    attributeKey: "greaterWeaponFocus",
                    reduce: "VALUES"
                })
                for (let weaponFocus of getInheritableAttribute({
                    entity: this,
                    attributeKey: "weaponFocus",
                    reduce: "VALUES"
                })) {
                    if (!greaterWeaponFocus.includes(weaponFocus)) {
                        resolvedOptions[weaponFocus.titleCase()] = {
                            abilities: [],
                            items: [],
                            payload: weaponFocus.titleCase()
                        };
                    }
                }
            } else if (key === 'AVAILABLE_WEAPON_PROFICIENCIES') {
                let weaponProficiencies = getInheritableAttribute({
                    entity: this,
                    attributeKey: "weaponProficiency",
                    reduce: "VALUES"
                });
                for (let weapon of ["Simple Weapons", "Pistols", "Rifles", "Lightsabers", "Heavy Weapons", "Advanced Melee Weapons"]) {
                    if (!weaponProficiencies.includes(weapon)) {
                        resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                    }
                }
            } else if (key === 'UNFOCUSED_SKILLS') {
                let skillFocuses = getInheritableAttribute({
                    entity: this,
                    attributeKey: "skillFocus",
                    reduce: "VALUES"
                });
                for (let skill of skills) {
                    if (!skillFocuses.includes(skill)) {
                        resolvedOptions[skill.titleCase()] = {abilities: [], items: [], payload: skill.titleCase()};
                    }
                }
            } else if (key === 'AVAILABLE_SKILL_FOCUS') {
                let skillFocuses = getInheritableAttribute({
                    entity: this,
                    attributeKey: "skillFocus",
                    reduce: "VALUES"
                });
                for (let skill of this.trainedSkills) {
                    if (!skillFocuses.includes(skill.key)) {
                        resolvedOptions[skill.key.titleCase()] = {
                            abilities: [],
                            items: [],
                            payload: skill.key.titleCase()
                        };
                    }
                }
            } else if (key === 'AVAILABLE_SKILL_MASTERY') {
                let masterSkills = getInheritableAttribute({
                    entity: this,
                    attributeKey: "skillMastery",
                    reduce: "VALUES"
                });
                masterSkills.push("Use The Force")
                for (let skill of getInheritableAttribute({
                    entity: this,
                    attributeKey: "skillFocus",
                    reduce: "VALUES"
                })) {
                    if (!masterSkills.includes(skill)) {
                        resolvedOptions[skill.titleCase()] = {abilities: [], items: [], payload: skill.titleCase()};
                    }
                }
            } else if (key === 'AVAILABLE_DOUBLE_ATTACK') {
                let doubleAttack = getInheritableAttribute({
                    entity: this,
                    attributeKey: "doubleAttack",
                    reduce: "VALUES"
                })
                for (let weapon of getInheritableAttribute({
                    entity: this,
                    attributeKey: "weaponProficiency",
                    reduce: "VALUES"
                })) {
                    if (!doubleAttack.includes(weapon)) {
                        resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                    }
                }
            } else if (key === 'AVAILABLE_TRIPLE_ATTACK') {
                let tripleAttack = getInheritableAttribute({
                    entity: this,
                    attributeKey: "tripleAttack",
                    reduce: "VALUES"
                })

                for (let weapon of getInheritableAttribute({
                    entity: this,
                    attributeKey: "doubleAttack",
                    reduce: "VALUES"
                })) {
                    if (!tripleAttack.includes(weapon.toLowerCase())) {
                        resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                    }
                }
            } else if (key === 'AVAILABLE_SAVAGE_ATTACK') {
                let savageAttack = getInheritableAttribute({
                    entity: this,
                    attributeKey: "savageAttack",
                    reduce: "VALUES"
                })

                for (let weapon of getInheritableAttribute({
                    entity: this,
                    attributeKey: "doubleAttack",
                    reduce: "VALUES"
                })) {
                    if (!savageAttack.includes(weapon)) {
                        resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                    }
                }
            } else if (key === 'AVAILABLE_RELENTLESS_ATTACK') {
                let relentlessAttack = getInheritableAttribute({
                    entity: this,
                    attributeKey: "relentlessAttack",
                    reduce: "VALUES"
                })

                for (let weapon of getInheritableAttribute({
                    entity: this,
                    attributeKey: "doubleAttack",
                    reduce: "VALUES"
                })) {
                    if (!relentlessAttack.includes(weapon)) {
                        resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                    }
                }
            } else if (key === 'AVAILABLE_AUTOFIRE_SWEEP') {
                let autofireSweep = getInheritableAttribute({
                    entity: this,
                    attributeKey: "autofireSweep",
                    reduce: "VALUES"
                })

                for (let weapon of getInheritableAttribute({
                    entity: this,
                    attributeKey: "weaponFocus",
                    reduce: "VALUES"
                })) {
                    if (!autofireSweep.includes(weapon)) {
                        resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                    }
                }
            } else if (key === 'AVAILABLE_AUTOFIRE_ASSAULT') {
                let autofireAssault = getInheritableAttribute({
                    entity: this,
                    attributeKey: "autofireAssault",
                    reduce: "VALUES"
                })

                for (let weapon of getInheritableAttribute({
                    entity: this,
                    attributeKey: "weaponFocus",
                    reduce: "VALUES"
                })) {
                    if (!autofireAssault.includes(weapon)) {
                        resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                    }
                }
            } else if (key === 'AVAILABLE_HALT') {
                let halt = getInheritableAttribute({
                    entity: this,
                    attributeKey: "halt",
                    reduce: "VALUES"
                })

                for (let weapon of getInheritableAttribute({
                    entity: this,
                    attributeKey: "weaponFocus",
                    reduce: "VALUES"
                })) {
                    if (!halt.includes(weapon)) {
                        resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                    }
                }
            } else if (key === 'AVAILABLE_RETURN_FIRE') {
                let returnFire = getInheritableAttribute({
                    entity: this,
                    attributeKey: "returnFire",
                    reduce: "VALUES"
                })

                for (let weapon of getInheritableAttribute({
                    entity: this,
                    attributeKey: "weaponFocus",
                    reduce: "VALUES"
                })) {
                    if (!returnFire.includes(weapon.toLowerCase())) {
                        resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                    }
                }
            } else if (key === 'AVAILABLE_CRITICAL_STRIKE') {
                let criticalStrike = getInheritableAttribute({
                    entity: this,
                    attributeKey: "criticalStrike",
                    reduce: "VALUES"
                })

                for (let weapon of getInheritableAttribute({
                    entity: this,
                    attributeKey: "weaponFocus",
                    reduce: "VALUES"
                })) {
                    if (!criticalStrike.includes(weapon.toLowerCase())) {
                        resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                    }
                }
            } else if (key === 'AVAILABLE_LIGHTSABER_FORMS') {
                for (let form of lightsaberForms) {
                    if (!this.talents.map(t => t.name).includes(form)) {
                        resolvedOptions[form] = {abilities: [], items: [], payload: form};
                    }
                }
            } else {
                resolvedOptions[key] = value;
            }
        }
        return resolvedOptions;
    }


    /**
     *
     * @param items {[{name: string,type: string}] | {name: string, type: string}}
     * @param parent {SWSEItem}
     * @returns {Promise<string>}
     */
    async addItems(items, parent, options = {}) {
        if (!Array.isArray(items)) {
            items = [items];
        }
        let indices = {};
        let notificationMessage = "";
        let addedItems = [];
        for (let provided of items.filter(item => !!item)) {
            let item = provided.name;
            let prerequisite;
            if (!options.skipPrerequisite) {
                prerequisite = provided.prerequisite;
            }
            let type = provided.type;
            let attributes = provided.attributes;
            let providedItems = provided.providedItems;
            let modifications = provided.modifications;
            let namedCrew = provided.namedCrew; //TODO Provides a list of named crew.  in the future this should check actor compendiums for an actor to add.
            let equip = provided.equip;
            let {index, pack} = await getIndexAndPack(indices, type);
            let {itemName, payload} = this.resolveItemParts(item);
            let entry = await this.getIndexEntryByName(itemName, index, payload);

            if (!entry) {
                console.warn(`attempted to add ${itemName}`, arguments)
                continue;
            }

            /**
             *
             * @type {SWSEItem}
             */
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

            if (!!attributes) {
                entity.addItemAttributes(attributes);
            }

            if (!!providedItems) {
                entity.addProvidedItems(providedItems);
            }

            let addedModifications = [];
            if (!!modifications) {
                addedModifications = await this.addItems(modifications, null, {returnAdded: true});
            }

            if (!!prerequisite) {
                entity.setPrerequisite(prerequisite);
            }

            if (!!payload) {
                entity.setPayload(payload);
            }
            if (!!parent) {
                entity.setParent(parent);
            }
            entity.setTextDescription();
            notificationMessage = notificationMessage + `<li>${entity.name.titleCase()}</li>`
            options.type = "provided";
            let addedItem = await this.checkPrerequisitesAndResolveOptions(entity, options);
            if (addedModifications.length > 0) {
                for (let addedModification of addedModifications) {
                    await addedItem.takeOwnership(addedModification)
                }
            }
            addedItems.push(addedItem);
            if (!!equip) {
                await this.equipItem(addedItem.data._id, equip, options)
            }
            //entities.push(entity.data.toObject(false));
        }
        if (options.returnAdded) {
            return addedItems;
        }
        return notificationMessage;
    }


    /**
     *
     * @param item {string}
     // * @param item.name {string}
     // * @param item.type {string}
     * @returns {{itemName, payload: string}}
     */
    resolveItemParts(item) {
        let itemName = item;
        let result = /^([\w\s]*) \(([()\-\w\s*:+]*)\)/.exec(itemName);
        let payload = "";
        if (result) {
            itemName = result[1];
            payload = result[2];
        }
        return {itemName, payload};
    }


    async getIndexEntryByName(itemName, index, payload) {
        let cleanItemName1 = this.cleanItemName(itemName);
        let entry = await index.find(f => f.name === cleanItemName1);
        if (!entry) {
            let cleanItemName2 = this.cleanItemName(itemName + " (" + payload + ")");
            entry = await index.find(f => f.name === cleanItemName2);
        }
        return entry;
    }

    cleanItemName(feat) {
        return feat.replace("*", "").trim();
    }


    async equipItem(itemId, equipType, options) {
        let item = this.items.get(itemId);

        let {slot, position} = this.parseSlotAndPosition(equipType);

        if (!options.skipPrerequisite) {
            let meetsPrereqs = meetsPrerequisites(this, item.data.data.prerequisite);
            if (meetsPrereqs.doesFail) {
                new Dialog({
                    title: "You Don't Meet the Prerequisites!",
                    content: `You do not meet the prerequisites for equipping ${item.data.finalName}:<br/> ${formatPrerequisites(meetsPrereqs.failureList)}`,
                    buttons: {
                        ok: {
                            icon: '<i class="fas fa-check"></i>',
                            label: 'Ok'
                        }
                    }
                }).render(true);
                return;
            }
        }
        let update = {};
        update['data.equippedIds'] = [{id: itemId, type: equipType, slot, position}]
            .concat(this.data.data.equippedIds.filter(value => !!value && value !== itemId && value?.id !== itemId));

        await this.update(update);

    }


    async unequipItem(itemId) {
        let update = {};
        update['data.equippedIds'] = this.data.data.equippedIds.filter(value => value !== itemId && value?.id !== itemId);

        await this.update(update);
    }

    parseSlotAndPosition(type) {
        let slot = 0;
        let toks = type.split('Installed');
        let position = toks[0];
        if (toks.length > 2) {
            slot = toks[2];
        }
        return {slot, position};
    }
}

/**
 *
 *
 * @param actorData {ActorData|Object}
 */
export function getEquippedItems(actorData) {
    actorData = actorData._source || actorData;
    let equippedIds = actorData.data.equippedIds.map(id => id.id)
    return actorData.items.filter(item => equippedIds.includes(item._id));
}