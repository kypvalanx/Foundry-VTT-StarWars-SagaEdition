import {resolveHealth, resolveShield} from "./health.mjs";
import {
    ALPHA_FINAL_NAME,
    COMMMA_LIST,
    convertOverrideToMode,
    excludeItemsByType,
    filterItemsByType,
    getDocumentByUuid,
    getIndexAndPack,
    getVariableFromActorData,
    inheritableItems,
    innerJoin,
    resolveExpression,
    resolveWeight,
    toNumber,
    toShortAttribute,
    unique,
    viewableEntityFromEntityType
} from "../common/util.mjs";
import {formatPrerequisites, meetsPrerequisites} from "../prerequisite.mjs";
import {resolveDefenses} from "./defense.mjs";
import {generateAttributes} from "./attribute-handler.mjs";
import {generateSkills, getAvailableTrainedSkillCount} from "./skill-handler.mjs";
import {SWSEItem} from "../item/item.mjs";
import {
    CLASSES_BY_STARTING_FEAT,
    crewPositions,
    crewQuality,
    crewSlotResolution,
    DROID_COST_FACTOR,
    equipableTypes,
    GRAVITY_CARRY_CAPACITY_MODIFIER,
    KNOWN_WEIRD_UNITS,
    LIMITED_TO_ONE_TYPES,
    SIZE_CARRY_CAPACITY_MODIFIER,
    sizeArray,
    skills,
    vehicleActorTypes
} from "../common/constants.mjs";
import {getActorFromId} from "../swse.mjs";
import {getInheritableAttribute, getResolvedSize} from "../attribute-helper.mjs";
import {activateChoices} from "../choice/choice.mjs";
import {errorsFromActor, warningsFromActor} from "./warnings.mjs";
import {SimpleCache} from "../common/simple-cache.mjs";
import {SWSE} from "../common/config.mjs";
import {AttackDelegate, makeAttack} from "./attack/attackDelegate.mjs";


/**
 * Extend the base Actor entity
 * @extends {Actor}
 */
export class SWSEActor extends Actor {
    useAmmunition(type){
        let item = this.items.find(i => i.name === type);
        if(item && item.system.quantity > 0){
           item.decreaseQuantity();
           return {fail:false}
        }
        return {fail: true};
    }
    getCached(key, fn) {
        if (!this.cache) {
            return fn();
        }
        return this.cache.getCached(key, fn)
    }

    setResolvedVariable(key, variable, label, notes) {
        this.resolvedVariables.set(key, variable);
        this.resolvedLabels.set(key, label);
        this.resolvedNotes.set(key, Array.isArray(notes) ? notes : [notes]);
    }

    async safeUpdate(data = {}, context = {}) {
        if (this.canUserModify(game.user, 'update') && !this.pack && !!game.actors.get(this.id)) {
            try{
                await this.update(data, context);
            } catch (e) {

            }
        }
    }

    async setActorLinkOnActorAndTokens(documents, val) {
        if (this.canUserModify(game.user, 'update')) {
            for (let document of documents) {
                await document.update({'actorLink': val});
            }
        }
        await this.safeUpdate({"token.actorLink": val})
    }

    applyActiveEffects() {
        //disable default effect resolution
    }

    /**
     * Augment the basic actor data with additional dynamic data.
     */
    prepareData() {
        if (this.skipPrepare) {
            return;
        }
        this.resolvedVariables = new Map();
        this.resolvedNotes = new Map();
        this.resolvedLabels = new Map();
        this.cache = new SimpleCache()
        super.prepareData();

        if (this.updateLegacyActor()) {
            return;
        }
        const system = this.system;
        system.description = system.description || ""
        system.gravity = system.gravity || "Normal"


        if (this.id) {
            if (this.type === "npc") {
                this.safeUpdate({"type": "character", "system.isNPC": true}, {updateChanges: false});
                return;
            } else if (this.type === "npc-vehicle") {
                this.safeUpdate({
                    "type": "vehicle",
                    "data.isNPC": true
                }, {updateChanges: false});
                return;
            } else if (system.isNPC && this.prototypeToken.actorLink) {
                let children = canvas.tokens?.objects?.children || [];
                let documents = children.filter(token => token.document.actorId === this.id).map(token => token.document)
                this.setActorLinkOnActorAndTokens(documents, false);
                return;
            } else if (!system.isNPC && !this.prototypeToken.actorLink) {
                let children = canvas.tokens?.objects?.children || [];
                let documents = children.filter(token => token.document.actorId === this.id).map(token => token.document)
                this.setActorLinkOnActorAndTokens(documents, true);
                return;
            }
        }

        system.condition = 0;
        let conditionEffect = this.effects.find(effect => !!effect && !!effect.statuses?.find(status => status.startsWith("condition")))

        if (conditionEffect) {
            system.condition = conditionEffect.changes.find(change => change.key === "condition").value
        }

        this.system.finalAttributeGenerationType = this.system.attributeGenerationType;

        if (Array.isArray(this.system.attributeGenerationType)) {
            this.safeUpdate({"system.attributeGenerationType": this.system.attributeGenerationType[0]})
            return;
        }
        this.system.sheetType = "Auto"
        if (this.flags.core?.sheetClass === "swse.SWSEManualActorSheet") {
            this.system.finalAttributeGenerationType = "Manual";
            this.system.sheetType = "Manual"
        } else if (!this.system.attributeGenerationType || this.system.attributeGenerationType.toLowerCase() === "default") {
            this.system.finalAttributeGenerationType = game.settings.get("swse", "defaultAttributeGenerationType") || "Manual";

        }

        this.attack = new AttackDelegate(this);

        if (this.type === 'character') this._prepareCharacterData(system);
        if (this.type === 'npc') this._prepareCharacterData(system);
        if (this.type === 'computer') this._prepareComputerData(system);
        if (this.type === 'vehicle') this._prepareVehicleData(system);
        if (this.type === 'npc-vehicle') this._prepareVehicleData(system);

        for (let link of this.actorLinks) {
            let linkedActor = getDocumentByUuid(link.uuid);
            let reciLink = linkedActor.actorLinks.find(link => link.uuid === this.uuid)

            const oldLink = JSON.stringify(reciLink);
            let system = this.getCachedLinkData(this.type, link.position, this, reciLink)

            if (oldLink !== JSON.stringify(system)) {
                let actorLinks = linkedActor.actorLinks;
                linkedActor.safeUpdate({"system.actorLinks": actorLinks});
            }
        }
    }

    get crewSlots() {
        return this.getCached("crewSlots", () => {
            let crewSlots = []

            let coverValues = getInheritableAttribute({
                entity: this,
                attributeKey: "cover",
                reduce: "VALUES"
            })

            let coverMap = {};
            for (let coverValue of coverValues) {
                if (coverValue.includes(":")) {
                    let toks = coverValue.split(":");
                    coverMap[toks[1] || "default"] = toks[0];
                } else {
                    coverMap["default"] = coverValue;
                }
            }

            let slots = getInheritableAttribute({
                entity: this,
                attributeKey: "providesSlot",
                reduce: "VALUES"
            });

            crewPositions.forEach(position => {

                let count = "Gunner" === position ? this.gunnerPositions.length : crewSlotResolution[position](this.crew);
                for (let i = 0; i < count; i++) {
                    slots.push(position)
                }
            });

            let slotCount = {};

            slots.forEach(position => {
                const numericSlot = slotCount[position] || 0;
                slotCount[position] = numericSlot + 1;
                let slotId = `${position}${numericSlot}`


                let crewMember = this.actorLinks.find(crewMember => crewMember.position === position && crewMember.slot === numericSlot);


                this.system.crewCover = this.system.crewCover || {}

                let positionCover = this.system.crewCover[slotId] || this.system.crewCover[position] || coverMap[position] || coverMap["default"];

                crewSlots.push(this.resolveSlot(crewMember, position, positionCover, numericSlot));
            })

            return crewSlots;
        })

    }


    get crewQuality() {
        return this.getCached("crewQuality", () => {
            let crewQuality;
            if (!this.system.crewQuality || this.system.crewQuality.quality === undefined) {
                let quality = getInheritableAttribute({
                    entity: this,
                    attributeKey: "crewQuality",
                    reduce: "FIRST"
                });
                if (quality) {
                    crewQuality = {quality: quality.titleCase()}
                }
            }
            return crewQuality;
        })
    }


    get passengers() {
        return this.getCached("passengers", () => {
            //TODO this has () in it and breaks things.  switched to FIRST reduce for now
            return getInheritableAttribute({
                entity: this,
                attributeKey: "passengers",
                reduce: "FIRST"
            })
        })
    }


    get subType() {
        return this.getCached("subType", () => {
            return getInheritableAttribute({
                entity: this,
                attributeKey: "vehicleSubType",
                reduce: "FIRST"
            })
        })
    }

    get maximumVelocity() {
        return this.getCached("maximumVelocity", () => {
            this.system.maximumVelocity = getInheritableAttribute({
                entity: this,
                attributeKey: "maximumVelocity",
                reduce: "FIRST"
            })
        })
    }


    get cargoCapacity() {
//TODO make the summation reduce function handle units?
        return this.getCached("cargoCapacity", () => {
            const cargoCapacity = getInheritableAttribute({
                entity: this,
                attributeKey: "cargoCapacity",
                reduce: "FIRST"
            }) || 0;
            return {
                value: getInheritableAttribute({
                    entity: this,
                    attributeKey: "weight",
                    reduce: "SUM"
                }),
                capacity: `${cargoCapacity}`
            }
        })
    }


    get consumables() {
        return this.getCached("consumables", () => {
            return getInheritableAttribute({
                entity: this,
                attributeKey: "consumables",
                reduce: "FIRST"
            })
        })
    }

    get grapple() {
        return this.getCached("grapple", () => {
            return this.baseAttackBonus + Math.max(this.system.attributes.str.mod, this.system.attributes.dex.mod) + getInheritableAttribute({
                entity: this,
                attributeKey: "grappleBonus",
                reduce: "SUM"
            }) + getInheritableAttribute({
                entity: this,
                attributeKey: "grappleSizeModifier",
                reduce: "SUM"
            });
        })
    }

    get fightingSpace() {
        return this.getCached("fightingSpace", () => {
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
            return {
                vehicle: vehicleFightingSpace,
                character: characterFightingSpace
            }
        })
    }

    get health() {
        //return this.getCached("health", () => {
        return resolveHealth(this);
        //});
    }


    /**
     * Prepare Vehicle type specific data
     * @param system
     * @private
     */
    _prepareVehicleData(system) {
        generateAttributes(this);
        generateSkills(this);

        system.shields = resolveShield(this);
        let {defense, armors} = resolveDefenses(this);
        system.defense = defense;
        system.armors = armors;

        this.initializeCharacterSettings();
    }

    /**
     * Prepare Character type specific data
     */
    _prepareCharacterData(system) {
        let {level, classSummary, classLevels} = this._generateClassData(system);
        system.levelSummary = level;
        system.classSummary = classSummary;
        system.classLevels = classLevels;

        //this.system.weight = this.weight

        generateAttributes(this);

        this.handleDarksideArray(this);

        let feats = this.resolveFeats();
        this.feats = feats.activeFeats || [];
        this.system.feats = feats.activeFeats;
        generateSkills(this);


        let remainingSkills = getAvailableTrainedSkillCount(this);
        remainingSkills = remainingSkills - this.trainedSkills.length;
        this.remainingSkills = remainingSkills < 0 ? false : remainingSkills;
        this.tooManySKills = remainingSkills < 0 ? Math.abs(remainingSkills) : false;

        this.system.secondWind = this.system.secondWind || {}
        const bonusSecondWind = getInheritableAttribute({
            entity: this,
            attributeKey: "bonusSecondWind",
            reduce: "SUM"
        });
        this.system.secondWind.perDay = bonusSecondWind + (this.isHeroic ? 1 : 0)


        system.hideForce = 0 === this.feats.filter(feat => feat.name === 'Force Training').length

        system.inactiveProvidedFeats = feats.inactiveProvidedFeats

        this._reduceProvidedItemsByExistingItems(system);

        system.shields = resolveShield(this);
        let {defense, armors} = resolveDefenses(this);
        system.defense = defense;
        system.armors = armors;

        this._manageAutomaticItems(this, feats.removeFeats).then(() => {});
        this.initializeCharacterSettings();
    }

    get hyperdrive() {
        return this.getCached("hyperdrive", () => {

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
            return {
                primary: primary,
                backup: backup
            }
        })
    }


    get isHeroic() {
        return this.getCached("crew", () => {
            return getInheritableAttribute({
                entity: this,
                attributeKey: "isHeroic",
                reduce: "OR"
            });
        })
    }

    get crew() {
        return this.getCached("crew", () => {
            return getInheritableAttribute({
                entity: this,
                attributeKey: "crew",
                reduce: "SUM"
            })
        })
    }

    get actorLinks() {
        return this.getCached("actorLinks", () => {
            return Array.isArray(this.system.actorLinks) ? this.system.actorLinks || [] : [];
        })
    }

    /**
     *
     * @param actor {SWSEActor}
     * @param context {Object}
     */
    async removeActorLink(actor, context = {}) {
        if (!context.skipReciprocal) {
            await actor.removeActorLink(this, {skipReciprocal: true});
        }
        let update = {};
        update['system.actorLinks'] = this.actorLinks.filter(c => c.uuid !== actor.uuid)
        if (!context.skipUpdate) {
            await this.safeUpdate(update);
        }
        return update;
    }

    /**
     *
     * @param actor {SWSEActor}
     * @param position {String}
     * @param slot {Number}
     * @param context {Object}
     */
    async addActorLink(actor, position, slot, context = {}) {
        if (actor.id === this.id) {
            return;
        }
        if (!context.skipReciprocal) {
            await actor.addActorLink(this, position, slot, {skipReciprocal: true});
        }
        const link = this.getCachedLinkData(actor.type, position, actor, {
            id: actor.id,
            uuid: actor.uuid,
            position,
            slot
        })
        let update = {};
        if (Array.isArray(this.actorLinks)) {
            const links = this.actorLinks.filter(link => link.uuid !== actor.uuid);
            links.push(link)
            update['system.actorLinks'] = links;
        } else {
            update['system.actorLinks'] = [link];
        }

        await this.safeUpdate(update);
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

    get vehicleTemplate() {
        return this.getCached("vehicleTemplate", () => {
            let vehicleBaseTypes = filterItemsByType(this.items.values(), "vehicleBaseType");
            return (vehicleBaseTypes.length > 0 ? vehicleBaseTypes[0] : null);
        })
    }

    get uninstalled() {
        return this.getCached("uninstalled", () => {
            return this.getUninstalledSystems();
        })
    }

    get installed() {
        return this.getCached("installed", () => {
            return filterItemsByType(this.items.values(), "vehicleSystem").filter(item => item.system.equipped === 'installed');
        })
    }

    get pilotInstalled() {
        return this.getCached("pilotInstalled", () => {
            return filterItemsByType(this.items.values(), "vehicleSystem").filter(item => item.system.equipped === 'pilotInstalled');
        })
    }

    get gunnerPositions() {
        return this.getCached("gunnerPositions", () => {
            let items = filterItemsByType(this.items.values(), "vehicleSystem");
            let positions = items.filter(item => !!item.system.equipped)
                .map(item => item.system.equipped)
                .filter(unique)
                .filter(e => e.startsWith("gunnerInstalled"))
                .map(e => {
                    return {
                        id: e,
                        numericId: toNumber(e.substring(15)),
                        installed: items.filter(item => item.system.equipped === e)
                    };
                });
            return positions.sort((a, b) => a.numericId > b.numericId ? 1 : -1);
        })
    }

    get cargo() {
        return this.getCached("cargo", () => {
            return filterItemsByType(this.items.values(), ["weapon", "armor", "equipment"]).filter(item => !item.system.hasItemOwner);
        })
    }

    get species() {
        return this.getCached("species", () => {
            const speciesList = filterItemsByType(this.items.values(), "species");
            return (speciesList.length > 0 ? speciesList[0] : null);
        })
    }

    get classes() {
        // return this.getCached("classes", () => {
        const classObjects = filterItemsByType(this.items.values(), "class");
        let classes = [];
        for (let co of classObjects) {
            // const levelUpHitPoints = getInheritableAttribute({
            //     entity: co,
            //     attributeKey: "levelUpHitPoints",
            //     reduce: "FIRST"
            // });
            // const firstLevelHitPoints = getInheritableAttribute({
            //     entity: co,
            //     attributeKey: "firstLevelHitPoints",
            //     reduce: "FIRST"
            // });
            for (let [i, characterLevel] of co.levelsTaken.entries()) {
                const levelOfClass = i + 1;
                let leveledClass = {}
                leveledClass.id = co.id;
                leveledClass.img = co.img;
                leveledClass.name = co.name;
                leveledClass.levelUpHitPoints = co.levelUpHitPoints;
                leveledClass.canRerollHealth = co.canRerollHealth(characterLevel);
                leveledClass.classLevelHealth = co.classLevelHealth(levelOfClass, characterLevel);
                leveledClass.isLatest = false;
                leveledClass.classLevel = levelOfClass;
                leveledClass.characterLevel = characterLevel;

                classes.push(leveledClass);
            }
        }

        if (classes.length > 0) {
            classes[classes.length - 1].isLatest = true;
        }
        return classes;
        //})
    }


    get poorlyFormattedClasses() {
        return filterItemsByType(this.items.values(), "class").filter(c => c.levelsTaken.length === 0);
    }

    get weapons() {
        return this.getCached("weapons", () => {
            return filterItemsByType(this.items.values(), "weapon");
        })
    }

    get armors() {
        return this.getCached("armors", () => {
            return filterItemsByType(this.items.values(), "armor");
        })
    }

    get equipment() {
        return this.getCached("equipment", () => {
            return filterItemsByType(this.items.values(), "equipment");
        })
    }

    get traits() {
        return this.getCached("traits", () => {
            return this.getTraits();
        })
    }

    get talents() {
        return this.getCached("talents", () => {
            return filterItemsByType(inheritableItems(this), "talent");
        })
    }

    get powers() {
        return this.getCached("powers", () => {
            return filterItemsByType(this.items.values(), "forcePower");
        })
    }

    get languages() {
        return this.getCached("languages", () => {
            return filterItemsByType(this.items.values(), "language");
        })
    }

    get background() {
        return this.getCached("background", () => {
            let backgrounds = filterItemsByType(this.items.values(), "background");
            return (backgrounds.length > 0 ? backgrounds[0] : null);
        })
    }

    get destiny() {
        return this.getCached("destiny", () => {
            let destinies = filterItemsByType(this.items.values(), "destiny");
            return (destinies.length > 0 ? destinies[0] : null);
        })
    }

    get secrets() {
        return this.getCached("secrets", () => {
            return filterItemsByType(this.items.values(), "forceSecret");
        })
    }

    get techniques() {
        return this.getCached("techniques", () => {
            return filterItemsByType(this.items.values(), "forceTechnique");
        })
    }

    get affiliations() {
        return this.getCached("affiliations", () => {
            return filterItemsByType(this.items.values(), "affiliation");
        })
    }

    get regimens() {
        return this.getCached("regimens", () => {
            return filterItemsByType(this.items.values(), "forceRegimen");
        })
    }

    get naturalWeapons() {
        return this.getCached("naturalWeapons", () => {
            return filterItemsByType(this.items.values(), "beastAttack");
        })
    }

    get specialSenses() {
        return this.getCached("specialSenses", () => {
            return filterItemsByType(this.items.values(), "beastSense");
        })
    }

    get speciesTypes() {
        return this.getCached("speciesTypes", () => {
            return filterItemsByType(this.items.values(), "beastType");
        })
    }

    get specialQualities() {
        return this.getCached("specialQualities", () => {
            return filterItemsByType(this.items.values(), "beastQuality");
        })
    }

    get isBeast() {
        return this.getCached("isBeast", () => {
            return !!this.classes.find(c => c.name === "Beast") || this.naturalWeapons.length > 0
                || this.specialSenses.length > 0
                || this.speciesTypes.length > 0
                || this.specialQualities.length > 0;
        })
    }

    get equipped() {
        return this.getCached("equipped", () => {
            return this.getEquippedItems();
        })
    }

    get unequipped() {
        return this.getCached("unequipped", () => {
            return this.getUnequippedItems();
        })
    }

    get inventory() {
        return this.getCached("inventory", () => {
            return this.getNonequippableItems();
        })
    }

    get hasAstromechSlot() {
        let providedSlots = getInheritableAttribute({
            entity: this,
            attributeKey: "providesSlot",
            reduce: "VALUES"
        });
        return providedSlots.includes("Astromech Droid");
    }

    get hasCrewQuality() {
        return true;
    }


    initializeCharacterSettings() {
        this.system.settings = this.system.settings || [];
        this.system.settings.push({type: "boolean", path: "system.isNPC", label: "Is NPC", value: this.system.isNPC})
        this.system.settings.push({
            type: "boolean",
            path: "system.ignorePrerequisites",
            label: "Ignore Prerequisites",
            value: this.system.ignorePrerequisites
        })
        this.system.settings.push({
            type: "select",
            path: "system.attributeGenerationType",
            label: "Attribute Generation Type",
            value: this.system.attributeGenerationType || "Default",
            options: {
                Default: "Default",
                Manual: "Manual",
                Roll: "Roll",
                "Point Buy": "Point Buy",
                "Standard Array": "Standard Array"
            }
        })
    }

    async removeItems(itemIds) {
        let ids = [];
        ids.push(...itemIds)
        for (let itemId of itemIds) {
            await this.removeChildItems(itemId);
            ids.push(...await this.removeSuppliedItems(itemId));
        }
        await this.deleteEmbeddedDocuments("Item", ids);
    }

    async removeItem(itemId) {
        await this.removeChildItems(itemId);
        let ids = await this.removeSuppliedItems(itemId);
        ids.push(itemId);
        await this.deleteEmbeddedDocuments("Item", ids);
    }

    async removeClassLevel(itemId) {
        let classItem = this.items.get(itemId)
        const levelsTaken = classItem.levelsTaken;
        if (levelsTaken.length > 1) {
            await classItem.safeUpdate({"system.levelsTaken": levelsTaken.slice(0, levelsTaken.length - 1)});
        } else {
            await this.removeItem(itemId);
        }
    }

    async removeChildItems(itemId) {
        let itemToDelete = this.items.get(itemId);
        if (!itemToDelete) {
            return;
        }
        for (let childItem of itemToDelete.system?.items || []) {
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
            baseAttackBonus: attackBonus,
            system: {
                skills: resolvedSkills
            },
            items: [],
            name: quality,
            id: quality
        }
    }

    crewman(position, slot) {

        if (position.startsWith("Gunner") && position !== "Gunner") {
            slot = toNumber(position.slice(6, position.length))
            position = "Gunner"
        }
        switch (position.titleCase()) {
            case "Pilot":
                return this._crewman("Pilot", "Astromech Droid");
            case "Copilot":
                return this._crewman("Copilot", "Astromech Droid");
            case "Commander":
                return this._crewman("Commander", "Copilot", "Astromech Droid");
            case "Engineer":
                return this._crewman("Engineer", "Astromech Droid");
            case "Astromech Droid":
                return this._crewman("Astromech Droid");
            case "Systems Operator":
            case "SystemsOperator":
                return this._crewman("Systems Operator", "Astromech Droid");
            case "Gunner":
                return this.gunner(slot)
        }
        return SWSEActor.getCrewByQuality(this.system.crewQuality.quality);
    }

    _crewman(position, backup, third) {
        let crewman = this.actorLinks.find(l => l.position === position)
        if (!crewman && (!!backup || !!third)) {
            crewman = this._crewman(backup, third);
        }
        if (!crewman) {
            crewman = SWSEActor.getCrewByQuality(this.system.crewQuality.quality);
            if (position === "Astromech Droid" && this.system.hasAstromech && this.hasAstromechSlot) {
                crewman.system.skills['mechanics'].value = 13;
                crewman.system.skills['use computer'].value = 13;
            }
        }
        return crewman;
    }

    gunner(index) {
        let actor = this.actorLinks.find(c => c.position === 'Gunner' && c.slot === (index || 0))

        if (!actor) {
            actor = SWSEActor.getCrewByQuality(this.system.crewQuality.quality);
        }

        return actor;
    }

    get age() {
        return this.system.age;
    }

    get changes() {
        return this.system.changes;
    }

    get toggles() {
        return this.system.toggles;
    }

    get inheritedChanges() {
        return getInheritableAttribute({entity: this, attributeFilter: "ACTOR_INHERITABLE", skipLocal: true})
    }

    get sex() {
        return this.system.sex;
    }

    get speed() {
        return this.getCached("speed", () => {
            if (this.type === 'vehicle') {
                return {
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
            } else {
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
                return attributes.map(name => this.applyArmorSpeedPenalty(name, armorType))
                    .map(name => this.applyConditionSpeedPenalty(name, armorType))
                    .map(name => this.applyWeightSpeedPenalty(name))
                    .join("; ");
            }

        })
    }

    // getter for further speed calculations
    get resolvedSpeed() {
        return parseInt(/([\w\s]*)\s(\d*)/.exec(this.speed)[2]);
    }

    //TODO extract this, it's not dependent on this class
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

    applyWeightSpeedPenalty(speed) {
        let result = /([\w\s]*)\s(\d*)/.exec(speed);

        let number = parseInt(result[2]);
        let speedType = result[1];
        if (game.settings.get("swse", "enableEncumbranceByWeight")) {
            if (this.carriedWeight >= this.maximumCapacity) {
                number = 0;
            } else if (this.carriedWeight >= this.strainCapacity) {
                number = 1;
            } else if (this.carriedWeight >= this.heavyLoad) {
                number = number * 3 / 4
            }
        }

        return `${speedType} ${Math.floor(number)}`
    }

    getTraits() {
        let activeTraits = filterItemsByType(inheritableItems(this), "trait");
        return activeTraits.sort(ALPHA_FINAL_NAME);
    }

    getEquippedItems() {
        let items = this.items;
        return SWSEActor._getEquippedItems(this.system, SWSEActor.getInventoryItems(items.values()), "equipped");
    }

    get equippedWeapons(){
        return this.getEquippedItems()
            .filter(item => 'weapon' === item.type)
    }

    getInstalledWeapons() {
        let items = this.items;
        return SWSEActor._getEquippedItems(this.system, SWSEActor.getInventoryItems(items.values()))
    }

    resolveFeats() {
        let feats = filterItemsByType(this.items.values(), "feat");
        let activeFeats = filterItemsByType(inheritableItems(this), "feat");
        let removeFeats = [];
        let inactiveProvidedFeats = [];
        for (let feat of feats) {
            let active = activeFeats.includes(feat)
            if (!active) {
                if (!feat.system.supplier) {
                    removeFeats.push(feat);
                } else {
                    inactiveProvidedFeats.push(feat);
                }
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

    async clearCondition() {
        let ids = this.effects
            .filter(effect => effect.icon?.includes("condition")).map(effect => effect.id)

        await this.deleteEmbeddedDocuments("ActiveEffect", ids);
    }

    reduceShields(number) {
        this.shields = Math.max(this.shields - number, 0);
    }

    reduceCondition() {
        let i = SWSE.conditionTrack.indexOf(`${this.system.condition}`)
        let newCondition = SWSE.conditionTrack[i + 1]
        this.setCondition(newCondition);
    }


    async setCondition(conditionValue) {
        let statusEffect = CONFIG.statusEffects.find(e => {
            return e.changes && e.changes.find(c => c.key === 'condition' && c.value === conditionValue);
        })
        await this.activateStatusEffect(statusEffect);
    }

    async activateStatusEffect(statusEffect) {
        if (!statusEffect) {
            return;
        }
        const createData = foundry.utils.deepClone(statusEffect);
        createData.label = game.i18n.localize(statusEffect.label);
        createData["statuses"] = [statusEffect.id]
        delete createData.id;
        const cls = getDocumentClass("ActiveEffect");
        await cls.create(createData, {parent: this});
    }

    applyDamage(options) {
        let update = {};
        let totalDamage = toNumber(options.damage);

        if (!options.skipShields) {
            let shields = this.system.shields;
            let shieldValue = shields.value;
            if (shields.active && shieldValue > 0) {
                if (totalDamage > shieldValue) {
                    this.reduceShields(5)
                }
                totalDamage -= shieldValue;
            }
        }

        if (!options.skipDamageReduction) {
            let damageReductions = getInheritableAttribute({entity: this, attributeKey: "damageReduction"})
            let lightsaberResistance = getInheritableAttribute({
                entity: this,
                attributeKey: "blocksLightsaber",
                reduce: "OR"
            })
            let damageTypes = options.damageType.split(COMMMA_LIST);

            if (!damageTypes.includes("Lightsabers") || lightsaberResistance) {
                for (let damageReduction of damageReductions) {
                    let modifier = damageReduction.modifier || "";

                    let modifiers = modifier.split(COMMMA_LIST);
                    let innerJoin1 = innerJoin(damageTypes, modifiers);
                    if (!modifier || innerJoin1.length === 0) {
                        totalDamage -= toNumber(damageReduction.value)
                    }
                }
            }
        }


        if (options.affectDamageThreshold) {
            if (totalDamage > this.system.defense.damageThreshold.total) {
                this.reduceCondition()
            }
        }

        //TODO Floating numbers tie in

        if (totalDamage > 0) {
            update[`system.health.value`] = this.system.health.value - totalDamage;
        }
        this.safeUpdate(update);
    }

    applyHealing(options) {
        let update = {};
        update[`system.health.value`] = this.system.health.value + toNumber(options.heal);
        this.safeUpdate(update);
    }

    async setAttributes(attributes) {
        let update = {};
        for (let [key, ability] of Object.entries(attributes)) {
            update[`data.attributes.${key}.base`] = ability;
        }
        await this.safeUpdate(update);
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
        return this.getCached("characterLevel", () => {
            const classes = this.classes;
            if (classes) {
                let charLevel = classes.length;
                this.resolvedVariables.set("@charLevel", charLevel);
                return charLevel;
            }
            return 0;
        })
    }

    get heroicLevel() {
        return this.getCached("heroicLevel", () => {
            if (this.classes) {
                const classObjects = filterItemsByType(this.items.values(), "class");
                let heroicLevel = 0;
                for (let co of classObjects) {
                    if (getInheritableAttribute({
                            entity: co,
                            attributeKey: "isHeroic",
                            reduce: "OR"
                        })) {
                        heroicLevel += co.system.levelsTaken.length;
                    }
                }
                this.resolvedVariables.set("@heroicLevel", heroicLevel);
                return heroicLevel;
            }
            return 0;
        })
    }


    _getEquipable(items) {
        return this.getCached("getEquipableItems", () => {
            return items.filter(item => this.isEquipable(item))
        })
    }

    _getUnequipableItems(items) {
        return this.getCached("getUnequipableItems", () => {
            return items.filter(item => !this.isEquipable(item))
        })
    }

    get hideForce() {
        return this.getCached("hideForce", () => {
            return !getInheritableAttribute({
                entity: this,
                attributeKey: "forceSensitivity",
                reduce: "OR"
            });
        })
    }

    get isDroid() {
        if (this.type === 'vehicle' || this.type === 'npc-vehicle') {
            return false;
        } else {
            return getInheritableAttribute({
                entity: this,
                attributeKey: "isDroid",
                reduce: "OR"
            });
        }
    }

    get trainedSkills() {
        return this.getCached("trainedSkills", () => {
            return this.skills.filter(skill => skill && skill.trained);
        })
    }

    get untrainedSkills() {
        return this.getCached("untrainedSkills", () => {
            return this.skills.filter(skill => skill && !skill.trained);
        })
    }

    get skills() {
        return this.getCached("skills", () => {
            return Object.entries(this.system.skills).map(entry => {
                let value = entry[1];
                value.label = entry[0].titleCase();
                return value;
            });
        })
    }

    get focusSkills() {
        return this.getCached("focusSkills", () => {
            return getInheritableAttribute({
                entity: this,
                attributeKey: "skillFocus",
                reduce: "VALUES"
            })
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
        let isDroid = this.isDroid;
        return item.isEquipable
            || (isDroid && item.isDroidPart)
            || (!isDroid && item.isBioPart);
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

    handleLevelBasedAttributeBonuses(system) {

        if(system.attributeGenerationType === "Manual"){
            return 0;
        }

        let isHeroic = getInheritableAttribute({
            entity: this,
            attributeKey: "isHeroic",
            reduce: "OR"
        });
        let characterLevel = this.classes.length;

        return (characterLevel - (characterLevel % 4)) /4

        // let hasUpdate = false;
        // if (!system.levelAttributeBonus) {
        //     system.levelAttributeBonus = {};
        //     hasUpdate = true;
        // }
        //
        // for (let bonusAttributeLevel = 4; bonusAttributeLevel < 21; bonusAttributeLevel += 4) {
        //     if (bonusAttributeLevel > characterLevel) {
        //         if (system.levelAttributeBonus[bonusAttributeLevel]) {
        //             system.levelAttributeBonus[bonusAttributeLevel] = null;
        //             hasUpdate = true;
        //         }
        //     } else {
        //         if (!system.levelAttributeBonus[bonusAttributeLevel]) {
        //             system.levelAttributeBonus[bonusAttributeLevel] = {};
        //             hasUpdate = true;
        //         } else {
        //             let total = (system.levelAttributeBonus[bonusAttributeLevel].str || 0)
        //                 + (system.levelAttributeBonus[bonusAttributeLevel].dex || 0)
        //                 + (system.levelAttributeBonus[bonusAttributeLevel].con || 0)
        //                 + (system.levelAttributeBonus[bonusAttributeLevel].int || 0)
        //                 + (system.levelAttributeBonus[bonusAttributeLevel].wis || 0)
        //                 + (system.levelAttributeBonus[bonusAttributeLevel].cha || 0)
        //             system.levelAttributeBonus[bonusAttributeLevel].warn = total !== (isHeroic ? 2 : 1);
        //         }
        //     }
        // }
        //
        // if (hasUpdate && this.id) {
        //     return this.safeUpdate({'data.levelAttributeBonus': system.levelAttributeBonus});
        // }
        // return undefined;
    }

    ignoreCon() {
        let skip = this.system.attributes.con?.skip;
        return skip === undefined ? true : skip;
    }


    static _getEquippedItems(system, items, equipTypes) {
        if (!equipTypes) {
            return items.filter(item => !item.system.equipped);
        }
        equipTypes = Array.isArray(equipTypes) ? equipTypes : [equipTypes];

        return items.filter(item => equipTypes.includes(item.system.equipped));
    }

    getUnequippedItems() {
        let items = this._getEquipable(SWSEActor.getInventoryItems(this.items.values()));

        return items.filter(item => !item.system.equipped);
    }

    getUninstalledSystems() {
        let items = filterItemsByType(this.items.values(), "vehicleSystem");

        return items.filter(item => !item.system.equipped);
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
        if (!ability) return;
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
            .map(i => `${i.finalName}:${i.type}`)
            .includes(`${item.finalName}:${item.type}`);
    }



    /**
     *
     * @param item {SWSEItem}
     * @returns {number}
     */
    countItem(item) {
        const searchString = `${item.finalName}:${item.type}`;
        return Array.from(this.items.values())
            .map(i => `${i.finalName}:${i.type}`)
            .filter(i => i === searchString).length;
    }

    _reduceProvidedItemsByExistingItems(actorData) {

        this.system.availableItems = {}; //TODO maybe allow for a link here that opens the correct compendium and searches for you
        this.system.availableItems['Ability Score Level Bonus'] = this.handleLevelBasedAttributeBonuses(actorData);

        this.system.bonuses = {};
        this.system.activeFeatures = [];
        let dynamicGroups = {};
        let specificProvided = {};

        for (let provided of getInheritableAttribute({
            entity: this,
            attributeKey: "provides"
        })) {
            let key = provided.value;
            let value = 1;
            if (key.includes(":")) {
                let toks = key.split(":");
                key = toks[0];
                if (toks.length === 2) {
                    value = resolveExpression(toks[1], this)
                } else if (toks.length === 3) {
                    key = toks[0]
                    value = 1;
                    specificProvided[toks[1] + ":" + toks[2]] = toks[0];
                }
            }

            if (key.endsWith("Starting Feats")) {
                //this means we need to check the source of the provision to figure out what feats are included
                let providingItem = this.items.get(provided.source);

                dynamicGroups[key] = this._explodeFeatNames(getInheritableAttribute({
                    entity: providingItem,
                    attributeKey: "classFeat",
                    reduce: "VALUES"
                }));
            }
            this.system.availableItems[key] = this.system.availableItems[key] ? this.system.availableItems[key] + value : value;
        }

        for (let consumed of getInheritableAttribute({
            entity: this,
            attributeKey: "consumes",
            reduce: "VALUES"
        })) {
            let key = consumed;
            let value = 1;
            if (key.includes(":")) {
                let toks = key.split(":");
                key = toks[0];
                if (toks.length === 2) {
                    value = resolveExpression(toks[1], this)
                }
            }
            this.system.availableItems[key] = this.system.availableItems[key] ? this.system.availableItems[key] - value : 0 - value;
        }

        let classLevel = this.classes?.length;
        this.system.availableItems['General Feats'] = 1 + Math.floor(classLevel / 3) + (this.system.availableItems['General Feats'] ? this.system.availableItems['General Feats'] : 0);

        let bonusTalentTrees = getInheritableAttribute({
            entity: this,
            attributeKey: "bonusTalentTree",
            reduce: "VALUES"
        });

        let bonusTreeTalents = [];

        for (let talent of this.talents || []) {
            if (talent.system.supplier?.id) {
                continue;
            }
            let type = talent.system.activeCategory || talent.system.talentTreeSource;
            let providers = talent.system.possibleProviders || [];
            providers.push(talent.system.bonusTalentTree)


            if (!type) {
                type = specificProvided[`TALENT:${talent.finalName}`] || type;
            }

            if (!type) {
                let types = innerJoin(providers, Object.keys(this.system.availableItems))
                if (types && types.length > 0) {
                    type = types[0]
                }
            }

            if(!type && innerJoin(bonusTalentTrees, providers).length > 0){
                bonusTreeTalents.push(talent);
                continue;
            }

            this.reduceAvailableItem(type);  //talentTreeSource is the old one

        }

        for (let talent of bonusTreeTalents) {
            let type = Object.keys(this.system.availableItems).find(item => item.includes("Talent"))
            this.reduceAvailableItem(type);
        }

        for (let feat of this.feats) {
            if (feat.system.supplier.id) {
                continue;
            }
            let type = 'General Feats';

            type = feat.system.activeCategory || feat.system.bonusFeatCategory || type;  //bonusFeatCategory is the old one

            if (!type || type === 'General Feats') {
                type = specificProvided[`FEAT:${feat.finalName}`] || type;
            }

            if (!type || type === 'General Feats') {
                let bonusFeatCategories = feat.system.possibleProviders.filter(category => category !== "General Feats");
                if (bonusFeatCategories && bonusFeatCategories.length === 1) {
                    type = bonusFeatCategories[0]
                } else if (bonusFeatCategories && bonusFeatCategories.length > 1) {
                    let selection = innerJoin(bonusFeatCategories, Object.keys(this.system.availableItems))
                    type = selection[0] || type;
                }
            }

            if (!type || type === 'General Feats') {
                for (let entry of Object.entries(dynamicGroups)) {
                    if (entry[1].includes(feat.finalName)) {
                        type = entry[0];
                        break;
                    }
                }
            }

            this.reduceAvailableItem(type, 1, "General Feats");
        }
        this.reduceAvailableItem("Force Secret", this.secrets.length);
        this.reduceAvailableItem("Force Technique", this.techniques.length);
        for (let forcePower of this.powers) {
            this.reduceAvailableItem(forcePower.system.activeCategory || "Force Powers", forcePower.system.quantity, "Force Powers");
        }

        this.system.remainingLevelUpBonuses = this.system.availableItems['Ability Score Level Bonus'];
    }

    reduceAvailableItem(type, reduceBy = 1, backupType) {
        let actorData = this.system;
        if (!type && !backupType) {
            if (!KNOWN_WEIRD_UNITS.includes(this.name)) {
                console.warn("tried to reduce undefined on: " + this.name, this)
            }
            return;
        }

        const availableItem = actorData.availableItems[type] || 0;
        actorData.availableItems[type] = availableItem - reduceBy;

        if(backupType && actorData.availableItems[type] < 0){
            let availableBackup = actorData.availableItems[backupType] || 0;
            actorData.availableItems[type] = availableBackup + actorData.availableItems[type];
            actorData.availableItems[type] = 0;
        }

        if (actorData.availableItems[type] === 0) {
            delete actorData.availableItems[type];
        }
        if (actorData.availableItems[backupType] === 0) {
            delete actorData.availableItems[backupType];
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

        return cls.create(msg, {rollMode});

        // roll.toMessage({
        //     speaker: ChatMessage.getSpeaker({actor: this}),
        //     flavor: label
        // });
    }

    getTooltipSections(roll) {
        let sections = [];

        for (let term of roll.terms) {
            if (term instanceof Die) {
                let partFormula = `<span class="part-formula">${term.number}d${term.faces}</span>`
                let partTotal = `<span class="part-total">${term.total}</span>`
                let partHeader = `<header class="part-header flexrow">${partFormula}${partTotal}</header>`
                let diceRolls = [];
                for (let result of term.results) {
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
            this.attack.makeAttack(null, {type: (itemIds.length === 1 ? "singleAttack" : "fullAttack"), items: itemIds})
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
        if (item.type === "npc") await this.safeUpdate({
            "type": "character",
            "data.isNPC": true
        }, {updateChanges: false});
        if (item.type === "vehicle") await this.safeUpdate({"token.actorLink": true}, {updateChanges: false});
        if (item.type === "npc-vehicle") await this.safeUpdate({
            "type": "vehicle",
            "data.isNPC": true
        }, {updateChanges: false});


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
        this.safeUpdate({'system.shields.value': shields < 0 ? 0 : shields})
    }

    get shields() {
        return this.system.shields.value;
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
        const find = this.items.find(trait => trait.type === "trait" && trait.name === 'Disable Attribute Modification');
        if(find?.system.prerequisite){
            console.error(find);
        }
        return find;
    }

    get isForceSensitive() {
        const forceSensitivity = this.items.find(i => i.name === "Force Sensitivity")
        return !!forceSensitivity && !this.isDroid;
    }

    get baseAttackBonus() {
        const baseAttackBonus = this._baseAttackBonus();
        return baseAttackBonus;
    }

    _baseAttackBonus(override) {
        if (override) {
            return getInheritableAttribute({
                entity: this,
                attributeKey: "baseAttackBonus",
                embeddedItemOverride: override,
                reduce: "SUM"
            });
        }
        return this.getCached("baseAttackBonus", () => {
            return getInheritableAttribute({
                entity: this,
                attributeKey: "baseAttackBonus",
                reduce: "SUM"
            });
        })
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




    resolveSlot(crew, type, cover, numericSlot) {
        let slot = {
            slotNumber: numericSlot,
            type: type,
            cover: cover,
            slotName: type === "Gunner" ? `Gunner ${numericSlot} Slot` : `${type} Slot`
        };
        if (crew) {
            let actor = game.data.actors.find(actor => actor._id === crew.id);
            slot.id = crew.id;
            slot.uuid = crew.uuid;
            slot.img = actor?.img;
            slot.name = actor?.name;
        }
        return slot
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
                    let itemIds = vehicle.system.equippedIds.filter(id => id.position.toLowerCase() === crew.position.toLowerCase() && `${id.slot}` === `${crew.slot}`).map(id => id.id)

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

        //Check that the item being added can be added to this actor type and that it hasn't been added too many times
        if (context.newFromCompendium) {
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

            if (LIMITED_TO_ONE_TYPES.includes(entity.type)) {
                const isAtMaximumQuantity = this.countItem(entity) === getInheritableAttribute({
                    entity: entity,
                    attributeKey: "takeMultipleTimesMax",
                    reduce: "MAX"
                });

                const takenOnceAndCannotBeTakenMultipleTimes = this.hasItem(entity) && !getInheritableAttribute({
                    entity: entity,
                    attributeKey: "takeMultipleTimes"
                }).map(a => a.value === "true").reduce((a, b) => a || b, false);

                if (takenOnceAndCannotBeTakenMultipleTimes || isAtMaximumQuantity) {
                    if (!context.skipPrerequisite && !context.isUpload) {
                        await Dialog.prompt({
                            title: `You already have this ${entity.type}`,
                            content: `You have already taken the ${entity.finalName} ${entity.type}`,
                            callback: () => {
                            }
                        })
                    }
                    return [];
                }
            }
        }


        if (context.newFromCompendium) {
            if (!context.skipPrerequisite && !context.isUpload) {
                //TODO upfront prereq checks should be on classes, feats, talents, and force stuff?  equipable stuff can always be added to a sheet, we check on equip.  verify this in the future
                if (!equipableTypes.includes(entity.type)) {
                    let meetsPrereqs = meetsPrerequisites(this, entity.system.prerequisite);
                    if (meetsPrereqs.doesFail) {
                        if (context.offerOverride) {
                            let override = await Dialog.wait({
                                title: "You Don't Meet the Prerequisites!",
                                content: `You do not meet the prerequisites:<br/> ${formatPrerequisites(meetsPrereqs.failureList)}`,
                                buttons: {
                                    ok: {
                                        icon: '<i class="fas fa-check"></i>',
                                        label: 'Ok',
                                        callback: () => {
                                            return false
                                        }
                                    },
                                    override: {
                                        icon: '<i class="fas fa-check"></i>',
                                        label: 'Override',
                                        callback: () => {
                                            return true
                                        }
                                    }
                                }
                            });
                            if (!override) {
                                return [];
                            }
                        } else {

                            if(this.suppressDialog){
                                throw new Error(`You do not meet the prerequisites:<br/> ${formatPrerequisites(meetsPrereqs.failureList, "plain")}`);
                            }

                            await Dialog.prompt({
                                title: "You Don't Meet the Prerequisites!",
                                content: `You do not meet the prerequisites:<br/> ${formatPrerequisites(meetsPrereqs.failureList)}`,
                                callback: () => {
                                }
                            });

                            return [];
                        }

                    } else if (meetsPrereqs.failureList.length > 0) {
                        await Dialog.prompt({
                                title: "You MAY Meet the Prerequisites!",
                                content: "You MAY meet the prerequisites. Check the remaining reqs:<br/>" + formatPrerequisites(meetsPrereqs.failureList),
                                callback: () => {
                                }
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
                entity.system.activeCategory = Array.from(possibleTalentTrees)[0];

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
                            possibleFeatTypes = JSON.parse(key.replace(/&quot;/g, '"'));
                        }
                    });
                }

                entity.system.activeCategory = possibleFeatTypes;
            }

            if (entity.type === 'forcePower' || entity.type === 'forceTechnique' || entity.type === 'forceSecret') {
                let viewable = viewableEntityFromEntityType(entity.type);

                let foundCategory = false
                for (let category of entity.system.categories || []) {
                    if (!!this.system.availableItems[category.value]) {
                        foundCategory = true;
                        entity.system.activeCategory = category.value;
                        break;
                    }
                }

                if (!foundCategory && !this.system.availableItems[viewable]) {
                    await Dialog.prompt({
                        title: `You can't take any more ${viewable.titleCase()}`,
                        content: `You can't take any more ${viewable.titleCase()}`,
                        callback: () => {
                        }
                    });
                    return [];
                }
                entity.system.activeCategory = entity.system.activeCategory || viewable;
            }

            if (entity.type === "background" || entity.type === "destiny") {
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
                    return []
                }
            }

            if (entity.type === "vehicleBaseType" || entity.type === "species") {
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
                    return []
                }
            }

        }
        if (entity.type === "class") {
            context.isFirstLevel = this.classes.length === 0;
            if (!context.skipPrerequisite && !context.isUpload) {

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

            SWSEActor.updateOrAddChange(entity, "isFirstLevel", context.isFirstLevel);

            if (context.isFirstLevel) {
                let firstLevelHP = getInheritableAttribute({
                    entity,
                    attributeKey: "firstLevelHitPoints",
                    reduce: "VALUES"
                })[0]
                SWSEActor.updateOrAddChange(entity, "rolledHP", `${firstLevelHP}`.includes('d') ? 1 : firstLevelHP);

            } else {
                SWSEActor.updateOrAddChange(entity, "rolledHP", 1);
            }
        }


        return await this.resolveAddItem(entity, choices, context);
    }


    static updateOrAddChange(entity, key, value, forceAdd = false) {
        let find = (entity.system.changes || Object.values(entity.system.attributes)).find(v => v.key === key);

        if (find && !forceAdd) {
            find.value = value;
        } else {
            entity.system.changes = entity.system.changes || [];
            entity.system.changes.push({value, key})
        }
    }

    static removeChange(entity, key, forceAdd = false) {
        let find = (entity.system.changes || Object.values(entity.system.attributes)).filter(v => v.key !== key);

        entity.system.changes = find;
    }

    async resolveAddItem(item, choices, context) {
        context.skipPrerequisite = true;

        //on uploads add "provide" changes for classFeats
        if (item.type === "class") {
            let isFirstLevelOfClass = this._isFirstLevelOfClass(item.name);
            let availableClassFeats = getInheritableAttribute({
                entity: item,
                attributeKey: "availableClassFeats",
                reduce: "SUM"
            });
            let classFeats = getInheritableAttribute({
                entity: item,
                attributeKey: "classFeat",
                reduce: "VALUES"
            });
            if (context.isUpload) {
                if (!availableClassFeats) {
                    availableClassFeats = classFeats.length
                }
                if (context.isFirstLevel && availableClassFeats) {
                    SWSEActor.updateOrAddChange(item, "provides", `${item.name} Starting Feats:${availableClassFeats}`, true)
                    // item.system.changes.push({key: "provides", value: `${item.name} Starting Feats:${availableClassFeats}`})
                } else if (isFirstLevelOfClass) {
                    item.system.changes.push({key: "provides", value: `${item.name} Starting Feats`})
                }
            }
        }


        let providedItems = item.getProvidedItems() || [];

        if (context.isUpload) {
            let addProviders = providedItems.filter(i => i.type !== "trait")
            for (let addProvider of addProviders) {
                SWSEActor.updateOrAddChange(item, "provides", `${item.name} ${item.type} ${addProvider.type}:${addProvider.type.toUpperCase()}:${addProvider.name}`, true)
            }
            providedItems = providedItems.filter(i => i.type === "trait")
        }
        let mainItem = await this.createEmbeddedDocuments("Item", [item.toObject(false)]);

        providedItems.push(...choices.items);

        let providedItemContext = Object.assign({}, context);
        providedItemContext.newFromCompendium = false;
        providedItemContext.provided = true;
        await this.addItems(providedItems, mainItem[0], providedItemContext);

        if (item.type === "class") {
            await this.addClassFeats(mainItem[0], providedItemContext);
        }
        return mainItem[0];
    }


    /**
     * Adds Feats provided by a class and provides choices to the player when one is available
     * @param item {SWSEItem}
     * @param context
     */
    async addClassFeats(item, context) {
        if (context.isUpload) {
            return;
        }

        let feats = getInheritableAttribute({
            entity: item,
            attributeKey: "classFeat",
            reduce: "VALUES"
        }).map(feat => this.cleanItemName(feat));

        if (feats.length === 0) {
            return;
        }

        let isFirstLevelOfClass = this._isFirstLevelOfClass(item.name);
        let availableClassFeats = getInheritableAttribute({
            entity: item,
            attributeKey: "availableClassFeats",
            reduce: "SUM"
        });
        // if (context.isUpload) {
        //     if (context.isFirstLevel) {
        //         SWSEActor.updateOrAddChange(item, "provides", `${item.name} Starting Feats:${availableClassFeats}`, true)
        //        // item.system.changes.push({key: "provides", value: `${item.name} Starting Feats:${availableClassFeats}`})
        //     } else if (isFirstLevelOfClass) {
        //         item.system.changes.push({key: "provides", value: `${item.name} Starting Feats`})
        //     }
        //     return;
        // }


        const currentFeats = this.feats || [];
        if (context.isFirstLevel) {
            if (!(availableClassFeats > 0 && availableClassFeats < feats.length)) {
                await this.addItems(feats.map(feat => {
                    return {type: 'TRAIT', name: `Bonus Feat (${feat})`}
                }), item, context);
                let featString = await this.addItems(feats.map(feat => {
                    return {type: 'FEAT', name: feat}
                }), item, context);



                if(!this.suppressDialog) {
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
            } else {
                let ownedFeats = currentFeats.map(f => f.finalName);
                for (let i = 0; i < availableClassFeats; i++) {
                    const availableFeats = this._explodeFeatNames(feats);
                    ownedFeats.push(await this.selectFeat(availableFeats, ownedFeats, item, context))
                }
            }
        } else if (isFirstLevelOfClass) {
            const availableFeats = this._explodeFeatNames(feats);
            availableFeats.push(...(getInheritableAttribute({
                entity: item,
                attributeKey: "multiclassFeat",
                reduce: "VALUES"
            }).map(feat => this.cleanItemName(feat))))

            let ownedFeats = currentFeats.map(f => f.finalName);
            await this.selectFeat(availableFeats, ownedFeats, item, context);
        }
    }

    async selectFeat(availableFeats, ownedFeats, parentItem, context) {
        if(context.itemAnswers){
            for(const answer of context.itemAnswers){
                if(availableFeats.includes(answer)){
                    return answer;
                }
            }
        }

        let options = "";
        for (let feat of availableFeats) {
            let owned = "";
            let overlappingFeats = ownedFeats.filter(f => f === feat);
            if (overlappingFeats.length > 0) {
                owned = "<i>(you already have this feat)</i>"
            }
            options += `<option value="${feat}">${feat}${owned}</option>`
        }

        return await Dialog.prompt({
            title: `Select a Starting feat from this class`,
            content: `<p>Select a Starting feat from this class</p>
                        <div><select id='feat'>${options}</select> 
                        </div>`,
            callback: async (html) => {
                let feat = html.find("#feat")[0].value;
                await this.addItems([{
                    type: 'TRAIT',
                    name: `Bonus Feat (${feat})`
                }, {
                    type: 'FEAT',
                    name: feat
                }], parentItem, context);
                return feat;
            }
        });
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
        let notificationMessages = "";
        let addedItems = [];
        for (let providedItem of items.filter(item => item && ((item.name && item.type) || (item.uuid && item.type) || (item.id && item.pack) || item.duplicate))) {
            let response = await this.addItem(providedItem, options, parent);
            let notificationMessage = response.notificationMessage
            let addedItem = response.addedItem
            notificationMessages += notificationMessage;
            if (addedItem) {
                addedItems.push(addedItem);
            }
        }
        if (options.returnAdded) {
            return addedItems;
        }
        return notificationMessages;
    }


    async addItem(providedItem, options, parent) {
        //TODO FUTURE WORK let namedCrew = providedItem.namedCrew; //TODO Provides a list of named crew.  in the future this should check actor compendiums for an actor to add.
        let {payload, itemName, entity, createdItem} = await this.resolveEntity(providedItem);

        if (!entity) {
            if (options.suppressWarnings) {
                console.debug(`attempted to add ${providedItem}`)
            } else {
                console.warn(`attempted to add ${providedItem}`)
            }
            return {};
        }
        entity.prepareData();

        if (entity.type === "class") {
            let levels = [0];
            for (let clazz of this.itemTypes.class) {
                levels.push(...(clazz.levelsTaken || []))
            }

            let nextLevel = providedItem.firstLevel ? 1 : Math.max(...levels) + 1

            let existing = this.itemTypes.class.find(item => item.name === entity.name)
            if (existing) {
                let levels = existing.levelsTaken || [];
                levels.push(nextLevel);
                await existing.safeUpdate({"system.levelsTaken": levels});
                let notificationMessage = `<li>Took level of ${existing.name}</li>`
                let addedItem = undefined;
                return {notificationMessage, addedItem}
            }

            //await entity.safeUpdate({"system.levelsTaken": [nextLevel]});
            entity.system.levelsTaken = [nextLevel];
        }

        if (entity.type === "feat") {
            const classes = CLASSES_BY_STARTING_FEAT[itemName];
            if (classes) {
                for (let charClass of classes) {
                    entity.system.possibleProviders.push(`${charClass} Starting Feats`)
                }
            }
            if(entity.name === 'Skill Training' && payload === undefined && options.isUpload){
                SWSEActor.updateOrAddChange(entity, "trainedSkills", "1");
                SWSEActor.removeChange(entity, "automaticTrainedSkill");
            }
        }

        if (entity.type === "trait"){
            if(entity.name === 'Bonus Trained Skill' && payload === undefined && options.isUpload){
                SWSEActor.updateOrAddChange(entity, "trainedSkills", "1");
                SWSEActor.removeChange(entity, "automaticTrainedSkill");
            }
            if(entity.name === 'Bonus Feat' && !payload){
                SWSEActor.updateOrAddChange(entity, "provides", "General Feats");
            }
        }



        entity.addItemAttributes(providedItem.changes);
        entity.addProvidedItems(providedItem.providedItems);
        entity.setParent(parent, providedItem.unlocked);
        entity.setPrerequisite(providedItem.prerequisite);

        //TODO payload should be deprecated in favor of payloads
        if (!!payload) {
            entity.setChoice(payload)
            entity.setPayload(payload);
        }
        for (let payload of Object.entries(providedItem.payloads || {})) {
            entity.setChoice(payload[1]);
            entity.setPayload(payload[1], payload[0]);
        }

        let equip = providedItem.equip;
        if (equip) {
            entity.system.equipped = equip
        }


        entity.setTextDescription();
        let childOptions = JSON.parse(JSON.stringify(options))
        childOptions.itemAnswers = providedItem.answers;
        let addedItem = await this.checkPrerequisitesAndResolveOptions(entity, childOptions);

        let notificationMessage = `<li>${addedItem.finalName}</li>`
        //do stuff based on type of item
        let modifications = providedItem.modifications;
        if (!!modifications) {
            for (let modification of modifications) {
                let {payload, itemName, entity} = await this.resolveEntity(modification)
                if (entity) {
                    await addedItem.addItemModificationEffectFromItem(entity)
                }
            }
        }


        if (createdItem) {
            // entity.delete();
        }
        return {notificationMessage, addedItem};
    }

    async resolveEntity(item) {
        let entity = undefined
        let itemName = undefined
        let payload = undefined
        if (item.duplicate) {
            entity = item.item.clone();
        } else {

            if (item.uuid) {
                entity = await Item.implementation.fromDropData(item);
                itemName = entity.name;
            } else {
                game.indicesByType = game.indicesByType || {};

                let indices = await getIndexAndPack(game.indicesByType, item);
                let response = await this.getIndexEntryByName(item.name, indices);

                let entry = response.entry;
                itemName = response.itemName;
                payload = response.payload;
                let lookup = response.lookup;
                /**
                 *
                 * @type {SWSEItem}
                 */

                if (entry && entry._id) {
                    entity = await Item.implementation.fromDropData({
                        type: 'Item',
                        uuid: `Compendium.${lookup.pack.metadata.id}.${entry._id}`
                    });
                }
            }
        }
        let createdItem = false;
        if (!entity && item.type === "language") {
            entity = game.items.find(i => i.name === item.name)
            if (!entity) {
                let entities = await SWSEItem.create([item]);
                entity = entities[0];
                createdItem = true;
            }
        }

        return {payload, itemName: itemName || entity?.name, entity: entity ? entity.clone() : null, createdItem};
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


    async getIndexEntryByName(item, lookups) {
        if (!lookups || lookups.length === 0) {
            return
        }

        let {itemName, payload} = this.resolveItemNameAndPayload(item);
        let cleanItemName1 = this.cleanItemName(itemName);

        let entry;
        let currentLookup;

        for (let lookup of lookups) {
            let index = lookup.index;
            entry = await index.find(f => f.name === cleanItemName1);
            if (!entry) {
                let cleanItemName2 = this.cleanItemName(itemName + " (" + payload + ")");
                entry = await index.find(f => f.name === cleanItemName2);
                if (entry) {
                    payload = undefined;
                }
            }
            currentLookup = lookup
            if (entry) break;
        }
        return {entry, payload, itemName, lookup: currentLookup};
    }

    cleanItemName(feat) {
        return feat.replace("*", "").trim();
    }

    async equipItem(item, equipType, options) {
        if (typeof item !== "object") {
            item = this.items.get(item);
        }

        let {slot, position, newEquipType} = this.parseSlotAndPosition(equipType);

        if (newEquipType === "gunnerInstalled") {
            equipType = newEquipType;
        }
        if (!!options.offerOverride) {
            let meetsPrereqs = meetsPrerequisites(this, item.system.prerequisite);
            if (meetsPrereqs.doesFail) {
                await new Dialog({
                    title: "You Don't Meet the Prerequisites!",
                    content: `You do not meet the prerequisites for equipping ${item.finalName}:<br/> ${formatPrerequisites(meetsPrereqs.failureList)}`,
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
        await this.resolveUpdate(item, equipType, slot, position);

    }


    async resolveUpdate(item, equipType, slot, position) {
        if (typeof item !== "object") {
            item = this.items.get(item);
        }
        item.equip(equipType);
        // let update = {};
        // update['system.equippedIds'] = [{id: itemId, type: equipType, slot, position}]
        //     .concat(this.system.equippedIds.filter(value => !!value && value !== itemId && value?.id !== itemId));
        //
        // await this.safeUpdate(update);
    }

    async unequipItem(itemId) {
        let item = this.items.get(itemId);
        item.unequip();
        // let update = {};
        // update['system.equippedIds'] = this.system.equippedIds.filter(value => value !== itemId && value?.id !== itemId);
        //
        // await this.safeUpdate(update);
    }

    getEquipTypes() {
        return this.items.map(item => item.system.equipped).filter(unique)
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
                "implant",
                "feat",
                "talent",
                "species",
                "droid system",
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

    get weight() {
        let fn = () => {
            const resolvedSize = sizeArray[getResolvedSize(this)];
            let costFactor = DROID_COST_FACTOR[resolvedSize]
            let sum = 0;
            for (let item of this.items.values()) {
                if (!!item.system.weight) {
                    sum += resolveWeight(item.system.weight, item.system.quantity, costFactor, this)
                }
            }
            return sum;
        }

        return this.getCached("weight", fn)
    }
    get carriedWeight(){
        // let fn = () => {
            const resolvedSize = sizeArray[getResolvedSize(this)];
            let costFactor = DROID_COST_FACTOR[resolvedSize]
            let sum = 0;
            for (let item of this.items.values()) {
                let weight = getInheritableAttribute({entity:item, attributeKey:"weight", reduce:"SUM"})
                if(isNaN(weight)){
                    weight = 0;
                }
                    sum += resolveWeight(weight, item.system.quantity, costFactor, this)
            }
            return sum;
        // }
        //
        // return this.getCached("weight", fn)
    }

    get heavyLoad() {
        const resolvedSize = sizeArray[getResolvedSize(this)];
        return Math.pow(this.system.attributes.str.total * 0.5, 2)
            * SIZE_CARRY_CAPACITY_MODIFIER[resolvedSize]
            * GRAVITY_CARRY_CAPACITY_MODIFIER[this.system.gravity]
    }

    get strainCapacity() {
        const resolvedSize = sizeArray[getResolvedSize(this)];
        return Math.pow(this.system.attributes.str.total, 2) * 0.5
            * SIZE_CARRY_CAPACITY_MODIFIER[resolvedSize]
            * GRAVITY_CARRY_CAPACITY_MODIFIER[this.system.gravity]
    }

    get maximumCapacity() {
        const resolvedSize = sizeArray[getResolvedSize(this)];
        return Math.pow(this.system.attributes.str.total, 2)
            * SIZE_CARRY_CAPACITY_MODIFIER[resolvedSize]
            * GRAVITY_CARRY_CAPACITY_MODIFIER[this.system.gravity]
    }

    updateLegacyActor() {
        let update = {};

        // what class items do we have

        let classes = this.itemTypes.class
        // do any of these class items not have a list of levels taken at?
        if (classes.find(c => !c.system.levelsTaken || (c.system.levelsTaken.length === 1 && c.system.levelsTaken[0] === 0) || c.system.levelsTaken.length === 0)) {
            // if so lets figure out what levels each class was taken
            let orderedClasses = [];
            let unsortedClasses = [];
            for (let c of classes) {
                let levels = c.system.levelsTaken;
                if (!levels) {
                    unsortedClasses.push(c.name);
                    continue;
                }
                for (let level of levels) {
                    orderedClasses[level] = c.name;
                }
            }

            for (let uc of unsortedClasses) {
                let found = false;
                let i = 0;
                for (let orderedClass of orderedClasses) {
                    if (!orderedClass) {
                        orderedClasses[i] = uc;
                        found = true;
                        break;
                    }
                    i++;
                }
                if (!found) {
                    orderedClasses.push(uc);
                }
            }

            this.skipPrepare = true;
            let preppedForRemoval = [];
            for (let distinct of unsortedClasses.distinct()) {
                let classesOfType = classes.filter(c => c.name === distinct)
                let indicies = [];
                let index = 0;
                while (true) {
                    index = orderedClasses.indexOf(distinct, index);
                    if (index === -1) {
                        break;
                    }
                    indicies.push(++index)
                }
                preppedForRemoval.push(...classesOfType.slice(1).map(c => c.id))
                classesOfType[0].safeUpdate({"system.levelsTaken": indicies});
            }
            //preppedForRemoval.push(...classes.filter(c => (!c.system.levelsTaken || c.system.levelsTaken.length === 1 && c.system.levelsTaken[0] === 0) || c.system.levelsTaken.length === 0).map(c => c.id))

            console.log("PREPPED FOR REMOVAL", preppedForRemoval)
            this.skipPrepare = false;
            this.removeItems(preppedForRemoval)
            return true;
        }


        if (!Array.isArray(this.system.changes)) {
            let changes = !this.system?.changes ? undefined : Object.values(this.system.changes);
            convertOverrideToMode(changes);
            if (changes) {
                update['system.changes'] = changes;
            }
        }
        let response = false;
        if (Object.keys(update).length > 0) {
            this.safeUpdate(update)
            response = true
        }
        return response;
    }

    getCachedLinkData(type, position, actor, existingLink = {}) {
        if (["character", "npc"].includes(type)) {
            let skills = {};
            for (let [key, value] of Object.entries(actor.system.skills)) {
                skills[key] = {value: value.value}
            }
            existingLink.name = actor.name;
            existingLink.system = existingLink.system || {}
            existingLink.system.skills = skills;
        }
        return existingLink;
    }
}

