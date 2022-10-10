import {resolveHealth, resolveShield} from "./health.js";
import {generateAttacks, generateVehicleAttacks} from "./attack-handler.js";
import {resolveGrapple, resolveOffense} from "./offense.js";
import {generateSpeciesData} from "./species.js";
import {
    excludeItemsByType,
    filterItemsByType,
    getIndexAndPack, getVariableFromActorData,
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
import {
    crewPositions,
    crewQuality,
    equipableTypes,
    LIMITED_TO_ONE_TYPES,
    sizeArray,
    skills,
    vehicleActorTypes
} from "../constants.js";
import {getActorFromId} from "../swse.js";
import {getInheritableAttribute} from "../attribute-helper.js";
import {makeAttack} from "./attack.js";
import {activateChoices} from "../choice/choice.js";
import {errorsFromActor, warningsFromActor} from "./warnings.js";


// noinspection JSClosureCompilerSyntax
/**
 * Extend the base Actor entity by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class SWSEActor extends Actor {
    _onUpdate(data, options, userId) {
        super._onUpdate(data, options, userId);
        for (let crewMember of this.system.crew) {
            let linkedActor = getActorFromId(crewMember.id)
            if (!!linkedActor) {
                linkedActor.prepareData()
            }
        }
    }

    _onCreateEmbeddedDocuments(embeddedName, ...args) {
        super._onCreateEmbeddedDocuments(embeddedName, ...args);

        if ("ActiveEffect" === embeddedName) {
            let activeEffect = args[0][0];
            if (activeEffect.flags?.core?.statusId?.startsWith("condition")) {
                this.effects
                    .filter(effect => effect !== activeEffect && effect.flags?.core?.statusId?.startsWith("condition"))
                    .map(effect => effect.delete())
            }
        }
    }

    /**
     * Augment the basic actor data with additional dynamic data.
     */
    prepareData() {
        if(this.skipPrepare){
            return;
        }
        super.prepareData();
		
		//check if user has permission to modify selected actor
		//if not jump out of the function, all the hard lifting
		//has already been done. 
		// if(!this.canUserModify(game.user, 'update')){
		//
		// 	return false;
		// }

        const system = this.system;
        system.description = system.description || ""
        // Make separate methods for each Actor type (character, npc, etc.) to keep
        // things organized.
        this.system.inheritableItems = null;
        this.resolvedVariables = new Map();
        this.resolvedNotes = new Map();
        this.resolvedLabels = new Map();

        if (this.id && this.type === "npc") {
            this.safeUpdate({"type": "character", "data.isNPC": true}, {updateChanges: false});
        } else if (this.id && this.type === "npc-vehicle") {
            this.safeUpdate({
                "type": "vehicle",
                "data.isNPC": true
            }, {updateChanges: false});
        } else if (this.id && system.isNPC && this.prototypeToken.actorLink) {
            let children = canvas.tokens?.objects?.children || [];
            let documents = children.filter(token => token.document.actorId === this.id).map(token => token.document)
            this.setActorLinkOnActorAndTokens(documents, false);
        } else if (this.id && !system.isNPC && !this.prototypeToken.actorLink) {
            let children = canvas.tokens?.objects?.children || [];
            let documents = children.filter(token => token.document.actorId === this.id).map(token => token.document)
            this.setActorLinkOnActorAndTokens(documents, true);
        } else {
            system.condition = 0;
            let conditionEffect = this.effects.find(effect => effect.flags?.core?.statusId?.startsWith("condition"))

            if (conditionEffect) {
                system.condition = conditionEffect.changes.find(change => change.key === "condition").value
            }

            if (this.type === 'character') this._prepareCharacterData(system);
            if (this.type === 'npc') this._prepareCharacterData(system);
            if (this.type === 'computer') this._prepareComputerData(system);
            if (this.type === 'vehicle') this._prepareVehicleData(system);
            if (this.type === 'npc-vehicle') this._prepareVehicleData(system);


        }
    }

    setResolvedVariable(key, variable, label, notes) {
        this.resolvedVariables.set(key, variable);
        this.resolvedLabels.set(key, label);
        this.resolvedNotes.set(key, Array.isArray(notes) ? notes : [notes]);
    }

    async safeUpdate(data={}, context={}) {
        if(this.canUserModify(game.user, 'update')){
            this.update(data, context);
        }
    }

    async setActorLinkOnActorAndTokens(documents, val) {
        if(this.canUserModify(game.user, 'update')){
            for (let document of documents) {
                await document.update({'actorLink': val});
            }
        }
        await this.safeUpdate({"token.actorLink": val})
    }

    /**
     * Prepare Vehicle type specific data
     * @param system
     * @private
     */
    _prepareVehicleData(system) {
        let vehicleBaseTypes = filterItemsByType(this.items.values(), "vehicleBaseType");
        this.vehicleTemplate = (vehicleBaseTypes.length > 0 ? vehicleBaseTypes[0] : null);

        this.uninstalled = this.getUninstalledSystems();
        this.installed = this.getInstalledSystems('installed');
        this.pilotInstalled = this.getInstalledSystems('pilotInstalled');
        this.gunnerPositions = this.getGunnerPositions()
        this.cargo = filterItemsByType(this.items.values(), ["weapon", "armor", "equipment"])
            .filter(item => !item.system.hasItemOwner);
        this.traits = this.getTraits();

        this.system.attributeGenerationType = "Manual"
        this.system.disableAttributeGenerationChange = true;

        this.system.crewCount = getInheritableAttribute({
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
            let crewMember = this.system.crew.filter(crewMember => crewMember.position === position);
            let positionCover;

            if (this.system.crewCover) {
                positionCover = this.system.crewCover[position]
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
                    this.crewSlots.push(...this.resolveSlots(crewSlot(this.system.crew), crewMember, position, positionCover));
                }
            }
        });

        this.system.hasAstromechSlot = false;
        let providedSlots = getInheritableAttribute({
            entity: this,
            attributeKey: "providesSlot",
            reduce: "VALUES"
        });
        for (let position of providedSlots.filter(unique)) {
            let count = providedSlots.filter(s => s === position).length
            let positionCover;

            if (this.system.crewCover) {
                positionCover = this.system.crewCover[position]
            }

            if (!positionCover) {
                positionCover = coverMap[position];
            }
            if (!positionCover) {
                positionCover = coverMap["default"];
            }
            if (position === "Astromech Droid") {
                this.hasAstromechSlot = true;
            }
            this.system.crewCount += ` plus ${count} ${position} slot${count > 1 ? "s" : ""}`
            this.crewSlots.push(...this.resolveSlots(count, this.system.crew.filter(crewMember => crewMember.position === position), position, positionCover));
        }


        if (!this.system.crewQuality || this.system.crewQuality.quality === undefined) {
            let quality = getInheritableAttribute({
                entity: this,
                attributeKey: "crewQuality",
                reduce: "FIRST"
            });
            if (quality) {
                this.system.crewQuality = {quality: quality.titleCase()}
            }
        }

        //TODO this has () in it and breaks things.  switched to FIRST reduce for now
        this.system.passengers = getInheritableAttribute({
            entity: this,
            attributeKey: "passengers",
            reduce: "FIRST"
        })
        this.system.subType = getInheritableAttribute({
            entity: this,
            attributeKey: "vehicleSubType",
            reduce: "FIRST"
        })
        this.system.maximumVelocity = getInheritableAttribute({
            entity: this,
            attributeKey: "maximumVelocity",
            reduce: "FIRST"
        })

        //TODO make the summation reduce function handle units?
        this.system.cargo =
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

        this.system.consumables = getInheritableAttribute({
            entity: this,
            attributeKey: "consumables",
            reduce: "FIRST"
        })
        this.system.grapple = resolveValueArray([this.pilot.system.offense?.bab, this.system.attributes.str.mod, getInheritableAttribute({
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
        this.system.hyperdrive = {
            primary: primary,
            backup: backup
        }

        this.system.speed = {
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
        this.system.fightingSpace = {
            vehicle: vehicleFightingSpace,
            character: characterFightingSpace
        }

        generateAttributes(this);
        generateSkills(this);

        system.health = resolveHealth(this);
        system.shields = resolveShield(this);
        let {defense, armors} = resolveDefenses(this);
        system.defense = defense;
        system.armors = armors;

        system.attacks = generateVehicleAttacks(this);
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
    _prepareCharacterData(system) {
        let speciesList = filterItemsByType(this.items.values(), "species");
        this.species = (speciesList.length > 0 ? speciesList[0] : null);

        generateSpeciesData(this);

        this.classes = filterItemsByType(this.items.values(), "class");

        this.traits = this.getTraits();
        this.talents = this.getTalents();
        this.powers = filterItemsByType(this.items.values(), "forcePower");
        this.languages = filterItemsByType(this.items.values(), "language");
        let backgrounds = filterItemsByType(this.items.values(), "background");
        this.background = (backgrounds.length > 0 ? backgrounds[0] : null);
        let destinies = filterItemsByType(this.items.values(), "destiny");
        this.destiny = (destinies.length > 0 ? destinies[0] : null);
        this.secrets = filterItemsByType(this.items.values(), "forceSecret");
        this.techniques = filterItemsByType(this.items.values(), "forceTechnique");
        this.affiliations = filterItemsByType(this.items.values(), "affiliation");
        this.regimens = filterItemsByType(this.items.values(), "forceRegimen");
        this.naturalWeapons = filterItemsByType(this.items.values(), "beastAttack");
        this.specialSenses = filterItemsByType(this.items.values(), "beastSense");
        this.speciesTypes = filterItemsByType(this.items.values(), "beastType");
        this.specialQualities = filterItemsByType(this.items.values(), "beastQuality");

        this.isBeast = !!this.classes.find(c => c.name === "Beast") || this.naturalWeapons.length > 0
            || this.specialSenses.length > 0
            || this.speciesTypes.length > 0
            || this.specialQualities.length > 0;

        let {level, classSummary, classLevels} = this._generateClassData(system);
        system.levelSummary = level;
        system.classSummary = classSummary;
        system.classLevels = classLevels;


        this.equipped = this.getEquippedItems();
        this.unequipped = this.getUnequippedItems();
        this.inventory = this.getNonequippableItems();

        generateAttributes(this);

        this.handleDarksideArray(this);

        resolveOffense(this);
        let feats = this.resolveFeats();
        this.feats = feats.activeFeats;
        this.system.feats = feats.activeFeats;
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


        system.hideForce = 0 === this.feats.filter(feat => feat.name === 'Force Training').length

        system.inactiveProvidedFeats = feats.inactiveProvidedFeats

        this._reduceProvidedItemsByExistingItems(system);

        system.health = resolveHealth(this);
        system.shields = resolveShield(this);
        let {defense, armors} = resolveDefenses(this);
        system.defense = defense;
        system.armors = armors;
        system.grapple = resolveGrapple(this);

        this._manageAutomaticItems(this, feats.removeFeats).then(() => this.handleLeveBasedAttributeBonuses(system));
        system.attacks = generateAttacks(this);
    }

    async removeItem(itemId) {
        await this.removeChildItems(itemId);
        let ids = await this.removeSuppliedItems(itemId);
        ids.push(itemId);
        await this.deleteEmbeddedDocuments("Item", ids);
    }

    async removeChildItems(itemId) {
        let itemToDelete = this.items.get(itemId);
        for (let childItem of itemToDelete.system.items || []) {
            let ownedItem = this.items.get(childItem._id);
            await itemToDelete.revokeOwnership(ownedItem);
        }
    }

    async removeSuppliedItems(id) {
        return this.items.filter(item => item.system.supplier?.id === id).map(item => item.id) || []
    }

    handleDarksideArray(item) {
        let system = item.system;
        for (let i = 0; i <= system.attributes.wis.total; i++) {
            system.darkSideArray = system.darkSideArray || [];

            if (system.darkSideScore < i) {
                system.darkSideArray.push({value: i, active: false})
            } else {
                system.darkSideArray.push({value: i, active: true})
            }
        }

        let darkSideTaint = getInheritableAttribute({entity: item, attributeKey: "darksideTaint", reduce: "SUM"})

        system.finalDarksideScore = system.darkSideScore + darkSideTaint
    }

    get hasCrew() {
        if (!["vehicle", "npc-vehicle"].includes(this.type)) {
            return false;
        }
        return 0 < this.system.crew.length
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
            system: {
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
        return SWSEActor.getCrewByQuality(this.system.crewQuality.quality);
    }

    get pilot() {
        let pilot = this.getActor(this.system.crew.find(c => c.position === 'Pilot')?.id);
        if (!pilot) {
            pilot = this.astromech;
        }
        if (!pilot) {
            pilot = SWSEActor.getCrewByQuality(this.system.crewQuality.quality);
        }
        return pilot;
    }

    get copilot() {
        let copilot = this.getActor(this.system.crew.find(c => c.position === 'Copilot')?.id);
        if (!copilot) {
            copilot = this.astromech;
        }
        if (!copilot) {
            copilot = SWSEActor.getCrewByQuality(this.system.crewQuality.quality);
        }
        return copilot;
    }

    gunner(index) {
        let actor = this.getActor(this.system.crew.find(c => c.position === 'Gunner' && c.slot === (index || 0))?.id);

        if (!actor) {
            actor = SWSEActor.getCrewByQuality(this.system.crewQuality.quality);
        }

        return actor;
    }

    get commander() {
        let commander = this.getActor(this.system.crew.find(c => c.position === 'Commander')?.id);
        if (!commander) {
            commander = this.pilot;
        }
        if (!commander) {
            commander = SWSEActor.getCrewByQuality(this.system.crewQuality.quality);
        }
        return commander;
    }

    get systemsOperator() {
        let systemsOperator = this.getActor(this.system.crew.find(c => c.position === 'Systems Operator')?.id);
        if (!systemsOperator) {
            systemsOperator = this.astromech;
        }
        if (!systemsOperator) {
            systemsOperator = SWSEActor.getCrewByQuality(this.system.crewQuality.quality);
        }
        return systemsOperator;
    }

    get engineer() {
        let engineer = this.getActor(this.system.crew.find(c => c.position === 'Engineer')?.id);
        if (!engineer) {
            engineer = this.astromech;
        }
        if (!engineer) {
            engineer = SWSEActor.getCrewByQuality(this.system.crewQuality.quality);
        }
        return engineer;
    }

    get astromech() {
        let actor = this.getActor(this.system.crew.find(c => c.position === 'Astromech Droid')?.id);
        if (!actor && this.system.hasAstromech && this.system.hasAstromechSlot) {
            actor = SWSEActor.getCrewByQuality(this.system.crewQuality.quality);
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
        return this.system.age;
    }

    get sex() {
        return this.system.sex;
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
            entity: this,
            attributeKey: "speedMultiplier",
            reduce: "VALUES"
        })

        let result = /([\w\s]*)\s(\d*)/.exec(speed);

        let number = parseInt(result[2]);

        multipliers.forEach(m => number = parseFloat(m) * number)
        return `${result[1]} ${Math.floor(number)}`
    }

    getTraits() {
        let activeTraits = [];
        let possibleTraits = filterItemsByType(this.items.values(), "trait");


        let shouldRetry = possibleTraits.length > 0;
        while (shouldRetry) {
            shouldRetry = false;
            for (let possible of possibleTraits) {
                if (!meetsPrerequisites(this, possible.system.prerequisite).doesFail) {
                    activeTraits.push(possible);
                    shouldRetry = true;
                }
            }
            possibleTraits = possibleTraits.filter(possible => !activeTraits.includes(possible));
        }

        return activeTraits.sort((a, b) => {
            let x = a.finalName?.toLowerCase();
            let y = b.finalName?.toLowerCase();
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
        return SWSEActor._getEquippedItems(this.system, SWSEActor.getInventoryItems(items.values()), "equipped");
    }

    getInstalledWeapons() {
        let items = this.items;
        return SWSEActor._getEquippedItems(this.system, SWSEActor.getInventoryItems(items.values()), ["pilotInstalled", "copilotInstalled", "gunnerInstalled"])
    }

    getTalents() {
        return filterItemsByType(this.items.values(), "talent");
    }

    resolveFeats() {
        let feats = filterItemsByType(this.items.values(), "feat");
        let activeFeats = [];
        let removeFeats = [];
        let inactiveProvidedFeats = [];
        for (let feat of feats) {
            let prereqResponse = meetsPrerequisites(this, feat.system.prerequisite);
            let doesFail = prereqResponse.doesFail;
            if (!doesFail) {
                activeFeats.push(feat)
            } else if (doesFail && !feat.system.supplier) {
                removeFeats.push(feat);
            } else if (prereqResponse.failureList.length > 0) {
                inactiveProvidedFeats.push(feat);
            }
        }

        return {activeFeats, removeFeats, inactiveProvidedFeats};
    }

    getVariable(variableName) {
        let swseActor = this;
        return getVariableFromActorData(swseActor, variableName);
    }

    get conditionBonus() {
        return this.system.condition;
    }


    setAttributes(attributes) {
        let update = {};
        for (let [key, ability] of Object.entries(attributes)) {
            update[`data.attributes.${key}.base`] = ability;
        }
        this.safeUpdate(update);
    }


    getAttributes() {
        return this.system.attributes;
    }


    getAttributeBases() {
        let response = {};
        for (let [key, attribute] of Object.entries(this.system.attributes)) {
            response[key] = attribute.base;
        }
        return response;
    }

    getAttributeBonuses() {
        let response = {};
        for (let [key, attribute] of Object.entries(this.system.attributes)) {
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
        update['data.crew'] = [{actor: actor.data, id: actor.id, position, slot}].concat(this.system.crew);

        await this.safeUpdate(update);
    }

    async removeCrew(actorId, position) {
        let update = {};
        if (!!actorId && !!position) {
            update['data.crew'] = this.system.crew.filter(c => c.id !== actorId || c.position !== position)
        } else if (!!actorId) {

            update['data.crew'] = this.system.crew.filter(c => c.id !== actorId)
        } else if (!!position) {

            update['data.crew'] = this.system.crew.filter(c => c.position !== position)
        }

        await this.safeUpdate(update);
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
        let attributes = swseActor.system.attributes;
        let attribute = attributes[toShortAttribute(attributeName).toLowerCase()];

        return attribute.total;
    }

    getHalfCharacterLevel(round = "down") {
        if (round === "down") {
            return Math.floor(this.characterLevel / 2);
        } else if (round === "up") {
            return Math.ceil(this.characterLevel / 2);
        }
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
        return Object.values(this.system.skills);
    }

    get focusSkills() {
        return getInheritableAttribute({
            entity: this,
            attributeKey: "skillFocus",
            reduce: "VALUES"
        })
    }

    get inactiveProvidedFeats() {
        return this.system.inactiveProvidedFeats;
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

        return {level: this.classes.length, classSummary, classLevels};
    }

    handleLeveBasedAttributeBonuses(system) {

        let isHeroic = getInheritableAttribute({
            entity: this,
            attributeKey: "isHeroic",
            reduce: "OR"
        });
        let characterLevel = this.classes.length;
        if (characterLevel > 0) {
            this.classes[characterLevel - 1].system.isLatest = true;
        }

        let hasUpdate = false;
        if (!system.levelAttributeBonus) {
            system.levelAttributeBonus = {};
            hasUpdate = true;
        }

        for (let bonusAttributeLevel = 4; bonusAttributeLevel < 21; bonusAttributeLevel += 4) {
            if (bonusAttributeLevel > characterLevel) {
                if (system.levelAttributeBonus[bonusAttributeLevel]) {
                    system.levelAttributeBonus[bonusAttributeLevel] = null;
                    hasUpdate = true;
                }
            } else {
                if (!system.levelAttributeBonus[bonusAttributeLevel]) {
                    system.levelAttributeBonus[bonusAttributeLevel] = {};
                    hasUpdate = true;
                } else {
                    let total = (system.levelAttributeBonus[bonusAttributeLevel].str || 0)
                        + (system.levelAttributeBonus[bonusAttributeLevel].dex || 0)
                        + (system.levelAttributeBonus[bonusAttributeLevel].con || 0)
                        + (system.levelAttributeBonus[bonusAttributeLevel].int || 0)
                        + (system.levelAttributeBonus[bonusAttributeLevel].wis || 0)
                        + (system.levelAttributeBonus[bonusAttributeLevel].cha || 0)
                    system.levelAttributeBonus[bonusAttributeLevel].warn = total !== (isHeroic ? 2 : 1);
                }
            }
        }

        if (hasUpdate && this.id) {
            return this.safeUpdate({_id: this.id, 'data.levelAttributeBonus': system.levelAttributeBonus});
        }
        return undefined;
    }

    ignoreCon() {
        let skip = this.system.attributes.con?.skip;
        return skip === undefined ? true : skip;
    }


    static _getEquippedItems(system, items, equipTypes) {
        equipTypes = Array.isArray(equipTypes) ? equipTypes : [equipTypes];

        let equippedIds = system.equippedIds || [];
        if (equipTypes.length > 0) {
            equippedIds = equippedIds.filter(id => equipTypes.includes(id.type))
        }
        equippedIds = equippedIds.map(id => id.id);

        return items.filter(item => equippedIds.includes(item._id))
    }

    getUnequippedItems() {
        let items = this._getEquipable(SWSEActor.getInventoryItems(this.items.values()));

        let equippedIds = (this.system.equippedIds || []).map(id => id.id);

        return items.filter(item => !equippedIds.includes(item._id))
    }

    getUninstalledSystems() {
        let items = filterItemsByType(this.items.values(), "vehicleSystem");

        let equippedIds = (this.system.equippedIds || []).map(id => id.id);

        return items.filter(item => !equippedIds.includes(item.system._id)).filter(item => !item.system.hasItemOwner);
    }

    getInstalledSystems(installationType) {
        let items = filterItemsByType(this.items.values(), "vehicleSystem");
        let installed = [];
        for (let item of items) {
            let find = this.system.equippedIds?.find(e => e.id === item.system._id && e.type === installationType);
            if (find) {
                installed.push(item);
            }
        }
        return installed;
    }

    getGunnerPositions() {
        let items = filterItemsByType(this.items.values(), "vehicleSystem");
        let gunnerSlots = this.system.equippedIds.filter(id => !!id.type && id.type.startsWith("gunnerInstalled")).map(id => parseInt(id.slot)).filter(unique)

        let positions = [];

        for (let gunnerSlot of gunnerSlots) {
            let gunnerItemReferences = this.system.equippedIds.filter(id => id.type.startsWith(`gunnerInstalled`) && parseInt(id.slot) === gunnerSlot)
            let gunnerItems = []
            for (let item of items) {
                let find = gunnerItemReferences?.find(e => e.id === item.system._id);
                if (find) {
                    gunnerItems.push(item);
                }
            }


            positions.push({
                id: `gunnerInstalled${gunnerSlot}`,
                numericId: gunnerSlot,
                installed: gunnerItems.map(item => {return {name: item.system.name, id:item.system._id, img: item.system.img}})
            });
        }

        return positions.sort((a,b) => a.numericId > b.numericId ? 1 : -1);
    }


    getNonequippableItems() {
        return this._getUnequipableItems(SWSEActor.getInventoryItems(this.items.values())).filter(i => !i.system.hasItemOwner);
    }

    static getInventoryItems(items) {
        return excludeItemsByType(items, "language", "feat", "talent", "species", "class", "classFeature", "forcePower", "forceTechnique", "forceSecret", "ability", "trait", "affiliation", "beastAttack", "beastSense", "beastType", "beastQuality")
            .filter(item => !item.system.hasItemOwner);
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
        return this.system.attributes[ability.toLowerCase()].mod;
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

    async _manageAutomaticItems(actor, removeFeats) {
        let itemIds = Array.from(actor.items.values()).flatMap(i => [i.id, i.flags.core?.sourceId?.split(".")[3]]).filter(i => i !== undefined);

        let removal = [];
        removeFeats.forEach(f => removal.push(f._id))
        for (let item of actor.items) {
            let itemSystem = item.system;
            if (itemSystem.isSupplied) {
                //console.log(itemIds, itemData.supplier)
                if (!itemIds.includes(itemSystem.supplier.id) || !itemSystem.supplier) {
                    removal.push(item._id)
                }

                if (item.name === 'Precise Shot' && itemSystem.supplier.name === 'Point-Blank Shot' && !game.settings.get('swse', 'mergePointBlankShotAndPreciseShot')) {
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
        return SWSEItem.getActiveModesFromItemData(item);
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


    /**
     *
     * @param item {SWSEItem}
     * @returns {boolean}
     */
    hasItem(item) {
        return Array.from(this.items.values())
            .map(i => i.finalName)
            .includes(item.finalName);
    }
    _reduceProvidedItemsByExistingItems(actorData) {

        let provides = getInheritableAttribute({
            entity: this,
            attributeKey: "provides"
        });
        this.system.availableItems = {}; //TODO maybe allow for a link here that opens the correct compendium and searches for you
        this.system.bonuses = {};
        this.system.activeFeatures = [];
        let dynamicGroups = {};

        for (let provided of provides) {
            let key = provided.value;
            let value = 1;
            if (key.includes(":")) {
                let toks = key.split(":");
                key = toks[0];
                value = resolveExpression(toks[1], this)
            }

            if(key.endsWith("Starting Feats")){
                //this means we need to check the source of the provision to figure out what feats are included
                let providingItem = this.items.get(provided.source);

                dynamicGroups[key] = getInheritableAttribute({
                    entity: providingItem,
                    attributeKey: "classFeat",
                    reduce: "VALUES"
                });
            }
            this.system.availableItems[key] = this.system.availableItems[key] ? this.system.availableItems[key] + value : value;
        }

        let classLevel = this.classes?.length;
        this.system.availableItems['General Feats'] = 1 + Math.floor(classLevel / 3) + (this.system.availableItems['General Feats'] ? this.system.availableItems['General Feats'] : 0);


        for (let talent of this.talents || []) {
            if (!talent.system.supplier?.id) {
                this.reduceAvailableItem(actorData, talent.system.talentTreeSource);
            }
        }
        for (let feat of this.feats) {
            if (feat.system.supplier.id) {
                continue;
            }
            let type = 'General Feats';
            let bonusFeatCategories = feat.system.bonusFeatCategories;
            if (bonusFeatCategories && bonusFeatCategories.length === 1) {
                type = bonusFeatCategories[0].value
            } else{
                for(let entry of Object.entries(dynamicGroups)){
                    if(entry[1].includes(feat.finalName)){
                        type = entry[0];
                    }
                }
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
        let notes = this.resolvedNotes.get(variable) || [];
        let flavor = label ? `${this.name} rolls for ${label}!` : '';

        if (variable.startsWith('@Initiative')) {
            this.rollInitiative({createCombatants: true, rerollInitiative: true, initiativeOptions: {formula: rollStr}})
            return;
        }

        let roll = new Roll(rollStr);
        roll.roll({async: false})

        let tooltipSections = this.getTooltipSections(roll)


        let content = `<div class="message-content">
        <div class="dice-roll">
            <div class="dice-result">
                <div class="dice-formula">${rollStr}</div>
                <div class="dice-tooltip">${tooltipSections}</div>
                <h4 class="dice-total">${roll.total}</h4>
            </div>
        </div>
        <div>${notes.map(note => `<div>${note}</div>`).join("")}</div>
    </div>`


        let speaker = ChatMessage.getSpeaker({actor: this.actor});
        let messageData = {
            user: game.user.id,
            speaker,
            flavor,
            type: CONST.CHAT_MESSAGE_TYPES.ROLL,
            content,
            sound: CONFIG.sounds.dice,
            roll
        }

        let cls = getDocumentClass("ChatMessage");
        let msg = new cls(messageData);
        let rollMode = false;
        // if (rollMode) msg.applyRollMode(rollMode);

        return cls.create(msg.data, {rollMode});

        // roll.toMessage({
        //     speaker: ChatMessage.getSpeaker({actor: this}),
        //     flavor: label
        // });
    }

    getTooltipSections(roll) {
        let sections = [];

        for(let term of roll.terms){
            if(term instanceof Die){
                let partFormula = `<span class="part-formula">${term.number}d${term.faces}</span>`
                let partTotal = `<span class="part-total">${term.total}</span>`
                let partHeader = `<header class="part-header flexrow">${partFormula}${partTotal}</header>`
                let diceRolls = [];
                for(let result of term.results){
                    diceRolls.push(`<li class="roll die d20">${result.result}</li>`)
                }

                sections.push(`<section class="tooltip-part"><div class="dice">${partHeader}<ol class="dice-rolls">${diceRolls.join("")}</ol></div></section>`)
            }
        }

        return sections.join("");
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

        items = items.filter(item => !!item && item.type !== "weapon" && item.system.subtype !== "weapon systems");

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

    async _onCreate(item, options, userId) {
        if (item.type === "character") await this.safeUpdate({"token.actorLink": true}, {updateChanges: false});
        if (item.type === "npc") await this.safeUpdate({"type": "character", "data.isNPC": true}, {updateChanges: false});
        if (item.type === "vehicle") await this.safeUpdate({"token.actorLink": true}, {updateChanges: false});
        if (item.type === "npc-vehicle") await this.safeUpdate({
            "type": "vehicle",
            "data.isNPC": true
        }, {updateChanges: false});

        item.system.attributeGenerationType = game.settings.get("swse", "defaultAttributeGenerationType");

        // if (userId === game.user._id) {
        //     await updateChanges.call(this);
        // }

        super._onCreate(item, options, userId);
    }


    getAttributeGenerationType() {
        return this.system.attributeGenerationType;
    }

    setAttributeGenerationType(attributeGenerationType) {
        this.safeUpdate({'data.attributeGenerationType': attributeGenerationType})
    }

    get credits() {
        return this.system.credits || 0;
    }

    set credits(credits) {
        this.safeUpdate({'data.credits': credits})
    }

    set shields(shields) {
        this.safeUpdate({'data.shields.value': shields < 0 ? 0 : shields})
    }

    setAge(age) {
        this.safeUpdate({'data.age': age})
    }

    setGender(sex, gender) {
        this.safeUpdate({'data.sex': sex, 'data.gender': gender})
    }


    getAttributeLevelBonus(level) {
        console.log(this.system)
        return this.system.levelAttributeBonus[level];
    }

    setAttributeLevelBonus(level, attributeLevelBonus) {
        let data = {};
        data[`data.levelAttributeBonus.${level}`] = attributeLevelBonus;
        this.safeUpdate(data)
    }

    get shouldLockAttributes() {
        return !!this.traits?.find(trait => trait.name === 'Disable Attribute Modification');
    }

    get isForceSensitive() {
        let hasForceSensativity = getInheritableAttribute({
            entity: this,
            attributeKey: "forceSensitivity",
            reduce: "OR"
        });
        return hasForceSensativity && !this.isDroid;
    }

    get baseAttackBonus() {
        return this.system.offense?.bab;
    }

    get darkSideScore() {
        return this.system.finalDarksideScore;
    }

    set darkSideScore(score) {
        this.safeUpdate({'data.darkSideScore': score})
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
        context.actor = this;
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
            let itemIds = this.system.equippedIds

            for (let itemId of itemIds) {
                let item = this.items.find(item => item._id === itemId.id);
                if (item) {
                    item.parentId = this._id
                    item.position = itemId.position;
                    availableItems.push(item)
                }
            }
            return availableItems;
        }
        if (['character', 'npc'].includes(this.type)) {
            let availableItems = []
            for (let crew of this.system.crew) {
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
     * Checks prerequisites of an entity and offers available context
     * @param entity {SWSEItem}
     * @param context {Object}
     */
    async checkPrerequisitesAndResolveOptions(entity, context) {
        context.actor = this;
        let choices = await activateChoices(entity, context);
        if (!choices.success) {
            return [];
        }

        if(context.newFromCompendium){
            if (!this.isPermittedForActorType(entity.type)) {
                new Dialog({
                    title: "Inappropriate Item",
                    content: `You can't add a ${entity.type} to a ${this.type}.`,
                    buttons: {
                        ok: {
                            icon: '<i class="fas fa-check"></i>',
                            label: 'Ok'
                        }
                    }
                }).render(true);
                return;
            }

            if(LIMITED_TO_ONE_TYPES.includes(entity.type)){
                let takeMultipleTimes = getInheritableAttribute({
                    entity: entity,
                    attributeKey: "takeMultipleTimes"
                }).map(a => a.value === "true").reduce((a, b) => a || b, false);

                if (this.hasItem(entity) && !takeMultipleTimes) {
                    if(!context.skipPrerequisite && !context.isUpload){
                        await Dialog.prompt({
                            title: `You already have this ${context.type}`,
                            content: `You have already taken the ${entity.finalName} ${context.type}`,
                            callback: () => {
                            }
                        })
                    }
                    return [];
                }
            }

            if(!context.skipPrerequisite && !context.isUpload){
                let meetsPrereqs = meetsPrerequisites(this, entity.system.prerequisite);

                //TODO upfront prereq checks should be on classes, feats, talents, and force stuff?  equipable stuff can always be added to a sheet, we check on equip.  verify this in the future
                if (!equipableTypes.includes(entity.type)) {
                    if (meetsPrereqs.doesFail) {
                        if(context.offerOverride){
                            let override = await Dialog.wait({
                                title: "You Don't Meet the Prerequisites!",
                                content: `You do not meet the prerequisites:<br/> ${formatPrerequisites(meetsPrereqs.failureList)}`,
                                buttons: {
                                    ok: {
                                        icon: '<i class="fas fa-check"></i>',
                                        label: 'Ok',
                                        callback: () => {return false}
                                    },
                                    override: {
                                        icon: '<i class="fas fa-check"></i>',
                                        label: 'Override',
                                        callback: () => {return true}
                                    }
                                }
                            });
                            if(!override){
                                return [];
                            }
                        } else {
                            await Dialog.prompt({
                                title: "You Don't Meet the Prerequisites!",
                                content: "You do not meet the prerequisites:<br/>" + formatPrerequisites(meetsPrereqs.failureList),
                                callback:()=>{}
                            });

                            return [];
                        }

                    } else if(meetsPrereqs.failureList.length > 0){
                        await Dialog.prompt({
                            title: "You MAY Meet the Prerequisites!",
                            content: "You MAY meet the prerequisites. Check the remaining reqs:<br/>" + formatPrerequisites(meetsPrereqs.failureList),
                            callback:()=>{}
                        }
                        );
                    }
                }
            }

            if (entity.type === 'talent') {
                let possibleTalentTrees = new Set();
                let allTreesOnTalent = new Set();
                let optionString = "";

                let actorsBonusTrees = getInheritableAttribute({
                    entity: this,
                    attributeKey: 'bonusTalentTree',
                    reduce: "VALUES"
                });
                if (actorsBonusTrees.includes(entity.system.bonusTalentTree)) {
                    for (let [id, item] of Object.entries(this.system.availableItems)) {
                        if (id.includes("Talent") && item > 0) {
                            optionString += `<option value="${id}">${id}</option>`
                            possibleTalentTrees.add(id);
                        }
                    }
                } else {
                    for (let talentTree of entity.system.possibleProviders.filter(unique)) {
                        allTreesOnTalent.add(talentTree);
                        let count = this.system.availableItems[talentTree];
                        if (count && count > 0) {
                            optionString += `<option value="${talentTree}">${talentTree}</option>`
                            possibleTalentTrees.add(talentTree);
                        }
                    }
                }


                if (possibleTalentTrees.size === 0) {
                    await Dialog.prompt({
                        title: "You don't have more talents available of these types",
                        content: "You don't have more talents available of these types: <br/><ul><li>" + Array.from(allTreesOnTalent).join("</li><li>") + "</li></ul>",
                        callback: () => {
                        }
                    });
                    return [];
                } else if (possibleTalentTrees.size > 1) {
                    let content = `<p>Select an unused talent source.</p>
                        <div><select id='choice'>${optionString}</select> 
                        </div>`;

                    await Dialog.prompt({
                        title: "Select an unused talent source.",
                        content: content,
                        callback: async (html) => {
                            let key = html.find("#choice")[0].value;
                            possibleTalentTrees = new Set();
                            possibleTalentTrees.add(key);
                        }
                    });
                }
                entity.system.talentTreeSource = Array.from(possibleTalentTrees)[0];

            }

            if (entity.type === 'feat' && !context.provided) {
                let possibleFeatTypes = [];

                let optionString = "";
                let possibleProviders = entity.system.possibleProviders;
                for (let provider of possibleProviders) {
                    if (this.system.availableItems[provider] > 0) {
                        possibleFeatTypes.push(provider);
                        optionString += `<option value="${JSON.stringify(provider).replace(/"/g, '&quot;')}">${provider}</option>`;
                    }
                }

                if (possibleFeatTypes.length === 0) {
                    await Dialog.prompt({
                        title: "You don't have more feats available of these types",
                        content: "You don't have more feat available of these types: <br/><ul><li>" + Array.from(possibleProviders).join("</li><li>") + "</li></ul>",
                        callback: () => {
                        }
                    });
                    return [];
                } else if (possibleFeatTypes.length > 1) {
                    let content = `<p>Select an unused feat type.</p>
                        <div><select id='choice'>${optionString}</select> 
                        </div>`;

                    await Dialog.prompt({
                        title: "Select an unused feat source.",
                        content: content,
                        callback: async (html) => {
                            let key = html.find("#choice")[0].value;
                            possibleFeatTypes = [JSON.parse(key.replace(/&quot;/g, '"'))];
                        }
                    });
                }

                entity.system.categories = possibleFeatTypes;
            }

            if (entity.type === 'forcePower' || entity.type === 'forceTechnique' || entity.type === 'forceSecret'){
                let viewable
                if (entity.type === 'forcePower') {
                    viewable = 'Force Powers'
                }
                if (entity.type === 'forceTechnique') {
                    viewable = 'Force Technique'
                }
                if (entity.type === 'forceSecret') {
                    viewable = 'Force Secret'
                }
                if (!this.system.availableItems[viewable] && entity.type !== 'affiliation') {
                    await Dialog.prompt({
                        title: `You can't take any more ${viewable.titleCase()}`,
                        content: `You can't take any more ${viewable.titleCase()}`,
                        callback: () => {
                        }
                    });
                }
            }

            if(entity.type === "background" || entity.type === "destiny"){
                if (filterItemsByType(this.items.values(), ["background", "destiny"]).length > 0) {
                    new Dialog({
                        title: `${entity.type.titleCase()} Selection`,
                        content: `Only one background or destiny allowed at a time.  Please remove the existing one before adding a new one.`,
                        buttons: {
                            ok: {
                                icon: '<i class="fas fa-check"></i>',
                                label: 'Ok'
                            }
                        }
                    }).render(true);
                    response.fail = true;
                }
            }

            if(entity.type === "vehicleBaseType" || entity.type === "species"){
                let type = entity.type;
                let viewable = type.replace(/([A-Z])/g, " $1");
                if (filterItemsByType(this.items.values(), type).length > 0) {
                    new Dialog({
                        title: `${viewable.titleCase()} Selection`,
                        content: `Only one ${viewable.titleCase()} allowed at a time.  Please remove the existing one before adding a new one.`,
                        buttons: {
                            ok: {
                                icon: '<i class="fas fa-check"></i>',
                                label: 'Ok'
                            }
                        }
                    }).render(true);
                    response.fail = true;
                }
            }

            if(entity.type === "class"){
                context.isFirstLevel = this.classes.length === 0;
                if(!context.skipPrerequisite && !context.isUpload){

                    if (entity.name === "Beast" && !context.isFirstLevel && this.classes.filter(clazz => clazz.name === "Beast").length === 0) {
                        new Dialog({
                            title: "The Beast class is not allowed at this time",
                            content: `The Beast class is only allowed to be taken at first level or if it has been taken in a previous level`,
                            buttons: {
                                ok: {
                                    icon: '<i class="fas fa-check"></i>',
                                    label: 'Ok'
                                }
                            }
                        }).render(true);
                        return [];
                    }
                    if (entity.name !== "Beast" && this.classes.filter(clazz => clazz.name === "Beast").length > 0 && this.getAttribute("INT") < 3) {
                        new Dialog({
                            title: "The Beast class is not allowed to multiclass at this time",
                            content: `Beasts can only multiclass when they have an Intelligence higher than 2.`,
                            buttons: {
                                ok: {
                                    icon: '<i class="fas fa-check"></i>',
                                    label: 'Ok'
                                }
                            }
                        }).render(true);
                        return [];
                    }
                }

                let firstLevelAttribute = Object.values(entity.system.attributes).find(v => v.key === "isFirstLevel");

                if(firstLevelAttribute){
                    firstLevelAttribute.value = context.isFirstLevel;
                } else {
                    entity.system.attributes[Object.keys(entity.system.attributes).length] = {
                        type: "Boolean",
                        value: context.isFirstLevel,
                        key: "isFirstLevel"
                    };
                }

                if(context.isFirstLevel){
                    let firstLevelHP = getInheritableAttribute({entity, attributeKey: "firstLevelHitPoints", reduce: "VALUES"})[0]
                    entity.system.attributes[Object.keys(entity.system.attributes).length] = {
                        value: firstLevelHP.includes('d') ? 1 : firstLevelHP,
                        key: "rolledHP"
                    };
                } else {
                    entity.system.attributes[Object.keys(entity.system.attributes).length] = {
                        value: 1,
                        key: "rolledHP"
                    };
                }
            }
        }


        return await this.resolveAddItem(entity, choices, context);
    }


    async resolveAddItem(item, choices, context) {
        context.skipPrerequisite = true;
        let mainItem = await this.createEmbeddedDocuments("Item", [item.toObject(false)]);

        let providedItems = item.getProvidedItems() || [];

        providedItems.push(...choices.items);

        let providedItemContext = Object.assign({}, context);
        providedItemContext.newFromCompendium = false;
        providedItemContext.provided = true;
        await this.addItems(providedItems, mainItem[0], providedItemContext);

        let modifications = item.getModifications()

        modifications.forEach(mod => mod.equipToParent = true)

        await this.addItems(modifications, mainItem[0], context);

        if(item.type === "class"){
            await this.addClassFeats(mainItem[0], context);
        }

        return mainItem[0];
    }


    /**
     * Adds Feats provided by a class and provides choices to the player when one is available
     * @param item {SWSEItem}
     * @param context
     * @returns {Promise<[]>}
     */
    async addClassFeats(item, context) {
        let feats = getInheritableAttribute({
            entity: item,
            attributeKey: "classFeat",
            reduce: "VALUES"
        }).map(feat => this.cleanItemName(feat));
        let availableClassFeats = getInheritableAttribute({
            entity: item,
            attributeKey: "availableClassFeats",
            reduce: "SUM"
        });

        if (feats.length === 0) {
            return [];
        }

        let feats1 = this.feats
        let isFirstLevelOfClass = this._isFirstLevelOfClass(item.name);
        if(!context.isUpload){
            if (context.isFirstLevel) {
                if (availableClassFeats > 0 && availableClassFeats < feats.length) {
                    let selectedFeats = [];
                    for (let i = 0; i < availableClassFeats; i++) {
                        let options = "";

                        for (let feat of this._explodeFeatNames(feats)) {
                            let owned = "";
                            let ownedFeats = feats1.filter(f => f.finalName === feat);
                            ownedFeats.push(...selectedFeats.filter(f => f === feat))
                            if (ownedFeats.length > 0) {
                                owned = "<i>(you already have this feat)</i>"
                            }

                            options += `<option value="${feat}">${feat}${owned}</option>`
                        }

                        await Dialog.prompt({
                            title: `Select a Starting feat from this class`,
                            content: `<p>Select a Starting feat from this class</p>
                        <div><select id='feat'>${options}</select> 
                        </div>`,
                            callback: async (html) => {
                                let feat = html.find("#feat")[0].value;
                                selectedFeats.push(feat);
                                await this.addItems([{
                                    type: 'TRAIT',
                                    name: `Bonus Feat (${feat})`
                                }, {
                                    type: 'FEAT',
                                    name: feat
                                }], item);
                            }
                        });
                    }
                } else {
                    await this.addItems(feats.map(feat => {
                        return {type: 'TRAIT', name: `Bonus Feat (${feat})`}
                    }), item, context);
                    let featString = await this.addItems(feats.map(feat => {
                        return {type: 'FEAT', name: feat}
                    }), item, context);


                    new Dialog({
                        title: "Adding Class Starting Feats",
                        content: `Adding class starting feats: <ul>${featString}</ul>`,
                        buttons: {
                            ok: {
                                icon: '<i class="fas fa-check"></i>',
                                label: 'Ok'
                            }
                        }
                    }).render(true);
                }
            } else if (isFirstLevelOfClass) {
                let options = "";

                let allFeats = [];
                allFeats.push(...feats)
                let multiclassFeats = getInheritableAttribute({
                    entity: item,
                    attributeKey: "multiclassFeat",
                    reduce: "VALUES"
                }).map(feat => this.cleanItemName(feat));
                allFeats.push(...multiclassFeats)

                for (let feat of allFeats) {
                    let owned = "";
                    let ownedFeats = feats1.filter(f => f.finalName === feat);
                    if (ownedFeats.length > 0) {
                        owned = "<i>(you already have this feat)</i>"
                    }

                    options += `<option value="${feat}">${feat}${owned}</option>`
                }

                await Dialog.prompt({
                    title: "Select a Starting feat from this class",
                    content: `<p>Select a Starting feat from this class</p>
                        <div><select id='feat'>${options}</select> 
                        </div>`,
                    callback: async (html) => {
                        let feat = html.find("#feat")[0].value;
                        await this.addItems({
                            type: 'TRAIT',
                            name: `Bonus Feat (${feat})`
                        }, item, context);
                        await this.addItems({type: 'FEAT', name: feat}, item, context);
                    }
                });
            }
        } else {
            if(context.isFirstLevel){
                item.addAttribute({key: "provides", value: `${item.name} Starting Feats:${availableClassFeats}`})
            } else if(isFirstLevelOfClass){
                item.addAttribute({key: "provides", value: `${item.name} Starting Feats`})
            }
        }

    }

    _isFirstLevelOfClass(name) {
        let items = this.items.filter(i => i.name === name);
        return items.length === 1;
    }


    _explodeFeatNames(feats) {
        let explode = [];
        for (let feat of feats) {
            if ("Skill Focus" === feat) {
                skills.forEach(skill => {
                    if (skill && !this.focusSkills.includes(skill.toLowerCase())) {
                        explode.push(`${feat} (${skill})`);
                    }
                })
            } else {
                explode.push(feat)
            }
        }
        return explode;
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
        let notificationMessage = "";
        let addedItems = [];
        for (let providedItem of items.filter(item => item && ((item.name && item.type) || (item.uuid && item.type) || (item.id && item.pack) || item.duplicate))) {
            //TODO FUTURE WORK let namedCrew = providedItem.namedCrew; //TODO Provides a list of named crew.  in the future this should check actor compendiums for an actor to add.
            let {payload, itemName, entity} = await this.resolveEntity(providedItem);

            if (!entity) {
                if(options.suppressWarnings){
                    console.debug(`attempted to add ${itemName}`, arguments)
                } else {
                    console.warn(`attempted to add ${itemName}`, arguments)
                }
                continue;
            }

            entity.prepareData();



            //TODO weird spot for this.  maybe this can leverage the newer payload system
            if (itemName === "Bonus Feat" && payload) {
                for (let attr of Object.values(entity.system.attributes)) {
                    if (attr.key === "provides") {
                        attr.key = "bonusFeat";
                        attr.value = payload;
                    }
                }
            }

            entity.addItemAttributes(providedItem.attributes);
            entity.addProvidedItems(providedItem.providedItems);
            entity.setParent(parent, providedItem.unlocked);

                entity.setPrerequisite(providedItem.prerequisite);

            //TODO payload should be deprecated in favor of payloads
            if (!!payload) {
                entity.setChoice(payload)
                entity.setPayload(payload);
            }
            for(let payload of Object.entries(providedItem.payloads || {})){
                entity.setChoice(payload[1]);
                entity.setPayload(payload[1], payload[0]);
            }


            entity.setTextDescription();
            notificationMessage = notificationMessage + `<li>${entity.finalName}</li>`
            let childOptions = JSON.parse(JSON.stringify(options))
            //childOptions.type = "provided";
            //childOptions.skipPrerequisite = false;
            childOptions.itemAnswers = providedItem.answers;
            //childOptions.newFromCompendium = false;
            let addedItem = await this.checkPrerequisitesAndResolveOptions(entity, childOptions);

            //do stuff based on type of item
            let modifications = providedItem.modifications;
            if (!!modifications) {
                let addedModifications = [];
                addedModifications = await this.addItems(modifications, null, {returnAdded: true, actor: options.actor, suppressWarnings: options.suppressWarnings});
                for (let addedModification of addedModifications) {
                    await addedItem.takeOwnership(addedModification)
                }
            }
            addedItems.push(addedItem);

            let equip = providedItem.equip;
            if (equip) {
                await this.equipItem(addedItem._id, equip, options)
            }
            if(providedItem.equipToParent){
                await parent.takeOwnership(addedItem);
            }
        }
        if (options.returnAdded) {
            return addedItems;
        }
        return notificationMessage;
    }


    async resolveEntity(item) {
        let entity = undefined
        let itemName = undefined
        let payload = undefined
        if(item.duplicate){
            entity = item.item.clone();
        } else {

            if (item.uuid) {
                entity = await Item.implementation.fromDropData(item);
                itemName = entity.name;
            } else {
                game.indices = game.indices || {};

                let {index, pack} = await getIndexAndPack(game.indices, item);
                let response = await this.getIndexEntryByName(item.name, index);

                let entry = response.entry;
                itemName = response.itemName;
                payload = response.payload;
                /**
                 *
                 * @type {SWSEItem}
                 */

                if (entry && entry._id) {
                    entity = await Item.implementation.fromDropData({type: 'Item', uuid: `Compendium.${pack.metadata.id}.${entry._id}`});
                }
            }
        }


        return {payload, itemName: itemName || entity?.name, entity: entity ? entity.clone() : null};
    }

    get warnings() {
        return warningsFromActor(this);
    }

    get errors() {
        return errorsFromActor(this);
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

        let {slot, position, newEquipType} = this.parseSlotAndPosition(equipType);

        if(newEquipType === "gunnerInstalled"){
            equipType = newEquipType;
        }
        if (!!options.offerOverride) {
            let meetsPrereqs = meetsPrerequisites(this, item.system.prerequisite);
            if (meetsPrereqs.doesFail) {
                await new Dialog({
                    title: "You Don't Meet the Prerequisites!",
                    content: `You do not meet the prerequisites for equipping ${v.finalName}:<br/> ${formatPrerequisites(meetsPrereqs.failureList)}`,
                    buttons: {
                        ok: {
                            icon: '<i class="fas fa-check"></i>',
                            label: 'Ok'
                        },
                        override: {
                            icon: '<i class="fas fa-check"></i>',
                            label: 'Override',
                            callback: () => this.resolveUpdate(itemId, equipType, slot, position)
                        }
                    }
                }).render(true);
                return;
            }
        } else if (!options.skipPrerequisite) {
            let meetsPrereqs = meetsPrerequisites(this, item.system.prerequisite);
            if (meetsPrereqs.doesFail) {
                new Dialog({
                    title: "You Don't Meet the Prerequisites!",
                    content: `You do not meet the prerequisites for equipping ${item.system.finalName}:<br/> ${formatPrerequisites(meetsPrereqs.failureList)}`,
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
        await this.resolveUpdate(itemId, equipType, slot, position);

    }


    async resolveUpdate(itemId, equipType, slot, position) {
        let update = {};
        update['system.equippedIds'] = [{id: itemId, type: equipType, slot, position}]
            .concat(this.system.equippedIds.filter(value => !!value && value !== itemId && value?.id !== itemId));

        await this.safeUpdate(update);
    }

    async unequipItem(itemId) {
        let update = {};
        update['system.equippedIds'] = this.system.equippedIds.filter(value => value !== itemId && value?.id !== itemId);

        await this.safeUpdate(update);
    }

    parseSlotAndPosition(type) {
        let slot = 0;
        let toks = type.split('Installed');
        let position = toks[0];
        if (toks.length > 1) {
            slot = toks[1];
        }
        return {slot, position, equipType: position + "Installed"};
    }





    isPermittedForActorType(type) {
        if (["character", "npc"].includes(this.type)) {
            return ["weapon",
                "armor",
                "equipment",
                "feat",
                "talent",
                "species",
                "class",
                "upgrade",
                "forcePower",
                "affiliation",
                "forceTechnique",
                "forceSecret",
                "forceRegimen",
                "trait",
                "template",
                "background",
                "destiny",
                "beastAttack",
                "beastSense",
                "beastType",
                "beastQuality"].includes(type)
        } else if (vehicleActorTypes.includes(this.type)) {
            return ["weapon",
                "armor",
                "equipment",
                "upgrade",
                "vehicleBaseType",
                "vehicleSystem",
                "template"].includes(type)
        }

        return false;
    }



}

/**
 *
 *
 * @param actor {SWSEActor}
 */
export function getEquippedItems(actor) {
    if (!actor) {
        return [];
    }

    let equippedIds = actor.system?.equippedIds || actor._source?.system?.equippedIds || [];
    equippedIds = equippedIds.map(id => id.id)
    let items = actor.items.values() || []
    let filtered = [];
    for(let item of items){
        if(equippedIds.includes(item._id)){
            filtered.push(item)
        }
    }

    return filtered;
}
