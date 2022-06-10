import {resolveHealth, resolveShield} from "./health.js";
import {generateAttacks, generateVehicleAttacks} from "./attack-handler.js";
import {resolveOffense} from "./offense.js";
import {generateSpeciesData} from "./species.js";
import {
    excludeItemsByType,
    filterItemsByType,
    getIndexAndPack, resolveExpression,
    resolveValueArray,
    toShortAttribute,
    unique
} from "../util.js";
import {formatPrerequisites, meetsPrerequisites} from "../prerequisite.js";
import {resolveDefenses} from "./defense.js";
import {generateAttributes} from "./attribute-handler.js";
import {generateSkills, getAvailableTrainedSkillCount} from "./skill-handler.js";
import {SWSEItem} from "../item/item.js";
import {crewPositions, crewQuality, sizeArray, skills} from "../constants.js";
import {getActorFromId} from "../swse.js";
import {getInheritableAttribute} from "../attribute-helper.js";
import {makeAttack} from "./attack.js";
import {activateChoices} from "../choice/choice.js";


// noinspection JSClosureCompilerSyntax
/**
 * Extend the base Actor entity by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class SWSEActor extends Actor {
    _onUpdate(data, options, userId) {
        super._onUpdate(data, options, userId);
        for (let crewMember of this.data.data.crew) {
            let linkedActor = getActorFromId(crewMember.id)
            if (!!linkedActor) {
                linkedActor.prepareData()
            }
        }
    }

    _onCreateEmbeddedDocuments(embeddedName, ...args) {
        super._onCreateEmbeddedDocuments(embeddedName, ...args);

        if("ActiveEffect" === embeddedName){
            let activeEffect = args[0][0];
            if(activeEffect.data?.flags?.core?.statusId?.startsWith("condition")) {
                this.effects
                    .filter(effect => effect !== activeEffect && effect.data?.flags?.core?.statusId?.startsWith("condition"))
                    .map(effect => effect.delete())
            }
        }
    }

    /**
     * Augment the basic actor data with additional dynamic data.
     */
    prepareData() {
        super.prepareData();
        const actorData = this.data;
        actorData.data.description = actorData.data.description || ""
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
            this.data.data.condition = 0;
            let conditionEffect = this.effects.find(effect => effect.data?.flags?.core?.statusId?.startsWith("condition"))

            if(conditionEffect){
                this.data.data.condition = conditionEffect.data.changes.find(change => change.key === "condition").value
            }

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
        actorData.data.shields = resolveShield(this);
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
        this.traits = this.getTraits()//.map(trait => trait.data);
        this.talents = this.getTalents().map(talent => talent.data);
        this.powers = filterItemsByType(this.items.values(), "forcePower").map(item => item.data);
        this.languages = filterItemsByType(this.items.values(), "language");
        let backgrounds = filterItemsByType(this.items.values(), "background");
        this.background = (backgrounds.length > 0 ? backgrounds[0] : null);
        let destinies = filterItemsByType(this.items.values(), "destiny");
        this.destiny = (destinies.length > 0 ? destinies[0] : null);
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
        if (this.background) {
            this.inheritableItems.push(this.background)
        }
        if (this.destiny) {
            this.inheritableItems.push(this.destiny)
        }

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
        actorData.data.shields = resolveShield(this);
        let {defense, armors} = resolveDefenses(this);
        actorData.data.defense = defense;
        actorData.data.armors = armors;

        this._manageAutomaticItems(actorData, feats.removeFeats).then(() => this.handleLeveBasedAttributeBonuses(actorData));
        actorData.data.attacks = generateAttacks(this);
    }

    async removeItem(itemId) {
        await this.removeChildItems(itemId);
        let ids = await this.removeSuppliedItems(itemId);
        ids.push(itemId);
        await this.deleteEmbeddedDocuments("Item", ids);
    }

    async removeChildItems(itemId) {
        let itemToDelete = this.items.get(itemId);
        for (let childItem of itemToDelete.data?.data?.items || []) {
            let ownedItem = this.items.get(childItem._id);
            await itemToDelete.revokeOwnership(ownedItem);
        }
    }

    async removeSuppliedItems(id) {
        return this.items.filter(item => item.data.data.supplier?.id === id).map(item => item.id) || []
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

        let darkSideTaint = getInheritableAttribute({entity: actorData, attributeKey: "darksideTaint", reduce: "SUM"})

        actorData.data.finalDarksideScore = actorData.data.darkSideScore + darkSideTaint
    }

    get hasCrew() {
        if (!["vehicle", "npc-vehicle"].includes(this.data.type)) {
            return false;
        }
        return 0 < this.data.data.crew.length
    }


    static getCrewByQuality(quality) {
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
        return SWSEActor.getCrewByQuality(this.data.data.crewQuality.quality);
    }

    get pilot() {
        let pilot = this.getActor(this.data.data.crew.find(c => c.position === 'Pilot')?.id);
        if (!pilot) {
            pilot = this.astromech;
        }
        if (!pilot) {
            pilot = SWSEActor.getCrewByQuality(this.data.data.crewQuality.quality);
        }
        return pilot;
    }

    get copilot() {
        let copilot = this.getActor(this.data.data.crew.find(c => c.position === 'Copilot')?.id);
        if (!copilot) {
            copilot = this.astromech;
        }
        if (!copilot) {
            copilot = SWSEActor.getCrewByQuality(this.data.data.crewQuality.quality);
        }
        return copilot;
    }

    gunner(index) {
        let actor = this.getActor(this.data.data.crew.find(c => c.position === 'Gunner' && c.slot === (index || 0))?.id);

        if (!actor) {
            actor = SWSEActor.getCrewByQuality(this.data.data.crewQuality.quality);
        }

        return actor;
    }

    get commander() {
        let commander = this.getActor(this.data.data.crew.find(c => c.position === 'Commander')?.id);
        if (!commander) {
            commander = this.pilot;
        }
        if (!commander) {
            commander = SWSEActor.getCrewByQuality(this.data.data.crewQuality.quality);
        }
        return commander;
    }

    get systemsOperator() {
        let systemsOperator = this.getActor(this.data.data.crew.find(c => c.position === 'Systems Operator')?.id);
        if (!systemsOperator) {
            systemsOperator = this.astromech;
        }
        if (!systemsOperator) {
            systemsOperator = SWSEActor.getCrewByQuality(this.data.data.crewQuality.quality);
        }
        return systemsOperator;
    }

    get engineer() {
        let engineer = this.getActor(this.data.data.crew.find(c => c.position === 'Engineer')?.id);
        if (!engineer) {
            engineer = this.astromech;
        }
        if (!engineer) {
            engineer = SWSEActor.getCrewByQuality(this.data.data.crewQuality.quality);
        }
        return engineer;
    }

    get astromech() {
        let actor = this.getActor(this.data.data.crew.find(c => c.position === 'Astromech Droid')?.id);
        if (!actor && this.data.data.hasAstromech && this.data.hasAstromechSlot) {
            actor = SWSEActor.getCrewByQuality(this.data.data.crewQuality.quality);
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
            attributeKey: 'speed', reduce: "VALUES"
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
        let multipliers = getInheritableAttribute({
            entity : this,
            attributeKey: "speedMultiplier",
            reduce:"VALUES"
        })

        let result = /([\w\s]*)\s(\d*)/.exec(speed);

        let number = parseInt(result[2]);

        multipliers.forEach(m=> number = parseFloat(m) * number)
        return `${result[1]} ${Math.floor(number)}`
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
        let items = this.items;
        return SWSEActor._getEquippedItems(this.data, SWSEActor.getInventoryItems(items.values()), "equipped");
    }

    getInstalledWeapons() {
        let items = this.items;
        return SWSEActor._getEquippedItems(this.data, SWSEActor.getInventoryItems(items.values()), ["pilotInstalled", "copilotInstalled", "gunnerInstalled"])
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
        let swseActor = this;
        return SWSEActor.getVariableFromActorData(swseActor, variableName);
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
        if (this.type === 'vehicle' || this.type === 'npc-vehicle') {
            return false;
        }

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

    // get shield() {
    //     return getInheritableAttribute({
    //         entity: this,
    //         attributeKey: "shieldRating",
    //         reduce: "MAX"
    //     })
    // }

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
        let skip = this.data.data.attributes.con?.skip;
        return skip === undefined ? true : skip;
    }


    static _getEquippedItems(actorData, items, equipTypes) {
        equipTypes = Array.isArray(equipTypes) ? equipTypes : [equipTypes];

        let equippedIds = actorData.data.equippedIds || [];
        if (equipTypes.length > 0) {
            equippedIds = equippedIds.filter(id => equipTypes.includes(id.type))
        }
        equippedIds = equippedIds.map(id => id.id);

        return items.filter(item => equippedIds.includes(item.data._id))
    }

    getUnequippedItems() {
        let items = this._getEquipable(SWSEActor.getInventoryItems(this.items.values()));

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
        return this._getUnequipableItems(SWSEActor.getInventoryItems(this.items.values())).filter(i => !i.data.hasItemOwner);
    }

    static getInventoryItems(items) {
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
        let skills = getInheritableAttribute({
            entity: this,
            attributeKey: "classSkill", reduce: "VALUES"
        });

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

    set shields(shields) {
        this.update({'data.shields.value': shields < 0 ? 0 : shields})
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
        context.actor = this.data;
        await makeAttack(context);
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
        let choices = await activateChoices(item, {actor: this});
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

        let providedItems = item.getProvidedItems() || {};
        let providedItemCursor = 0;
        (choices.items || []).forEach(item => {
            while(providedItems[providedItemCursor]){
                providedItemCursor++;
            }
            providedItems[providedItemCursor] = item;
        })


        await this.addItems(providedItems, mainItem[0], options);
        return mainItem[0];
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
        for (let provided of items.filter(item => !!item && !!item.name && !!item.type)) {
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
            let unlocked = provided.unlocked;
            let {index, pack} = await getIndexAndPack(indices, type);
            let {entry, payload, itemName} = await this.getIndexEntryByName(item, index);

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
                entity.setChoice(payload)
                entity.setPayload(payload);
            }
            if (!!parent) {
                entity.setParent(parent, unlocked);
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
    resolveItemNameAndPayload(item) {
        let itemName = item;
        let result = /^([\w\s]*) \(([()\-\w\s*:+]*)\)/.exec(itemName);
        let payload = "";
        if (result) {
            itemName = result[1];
            payload = result[2];
        }
        return {itemName, payload};
    }


    async getIndexEntryByName(item, index) {
        if (!index) {
            return
        }

        let {itemName, payload} = this.resolveItemNameAndPayload(item);
        let cleanItemName1 = this.cleanItemName(itemName);
        let entry = await index.find(f => f.name === cleanItemName1);
        if (!entry) {
            let cleanItemName2 = this.cleanItemName(itemName + " (" + payload + ")");
            entry = await index.find(f => f.name === cleanItemName2);
            payload = undefined;
        }
        return {entry, payload, itemName};
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


    static getVariableFromActorData(swseActor, variableName) {
        if (!swseActor.resolvedVariables) {
            swseActor = swseActor.document;
        }

        let value = swseActor.resolvedVariables?.get(variableName);
        if (value === undefined) {
            console.warn("could not find " + variableName, swseActor.resolvedVariables);
        }
        return value;
    }

}

/**
 *
 *
 * @param actorData {ActorData}
 */
export function getEquippedItems(actorData) {
    if (!actorData) {
        return [];
    }
    if (actorData instanceof SWSEActor) {
        actorData = actorData.data;
    }

    let equippedIds = actorData?.data?.data?.equippedIds || actorData?.data?.equippedIds || actorData?._source?.data?.equippedIds || [];
    equippedIds = equippedIds.map(id => id.id)
    let items = actorData?.items?._source || actorData.items || []

    return items.filter(item => equippedIds.includes(item._id));
}
