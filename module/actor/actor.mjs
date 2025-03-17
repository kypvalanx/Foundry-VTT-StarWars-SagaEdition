import {resolveHealth, resolveShield} from "./health.mjs";
import {
    ALPHA_FINAL_NAME,
    COMMMA_LIST,
    convertOverrideToMode,
    filterItemsByTypes,
    getDocumentByUuid,
    getVariableFromActorData,
    inheritableItems,
    innerJoin,
    resolveExpression,
    resolveWeight,
    toChat,
    toNumber,
    toShortAttribute,
    unique
} from "../common/util.mjs";
import {formatPrerequisites, meetsPrerequisites} from "../prerequisite.mjs";
import {generateArmorBlock, resolveDefenses} from "./defense.mjs";
import {generateAttributes} from "./attribute-handler.mjs";
import {SkillDelegate} from "./skill-handler.mjs";
import {SWSEItem} from "../item/item.mjs";
import {
    CLASSES_BY_STARTING_FEAT,
    COLORS,
    crewPositions,
    crewQuality,
    crewSlotResolution,
    DROID_COST_FACTOR,
    KNOWN_WEIRD_UNITS,
    SIZE_CARRY_CAPACITY_MODIFIER,
    sizeArray,
    skills
} from "../common/constants.mjs";
import {getActorFromId} from "../swse.mjs";
import {getInheritableAttribute, getResolvedSize} from "../attribute-helper.mjs";
import {activateChoices} from "../choice/choice.mjs";
import {errorsFromActor, warningsFromActor} from "./warnings.mjs";
import {SimpleCache} from "../common/simple-cache.mjs";
import {SWSE} from "../common/config.mjs";
import {AttackDelegate} from "./attack/attackDelegate.mjs";
import {cleanItemName, resolveEntity} from "../compendium/compendium-util.mjs";
import {DarksideDelegate} from "./darkside-delegate.js";
import {VALIDATORS} from "./actor-item-validation.js";
import {generateAction} from "../action/generate-action.mjs";
import {isAppropriateAmmo} from "../item/ammunition/ammunitionDelegate.mjs";
import {WeightDelegate} from "./weightDelegate.mjs";

function mergeColor(colors) {
    if(colors.length === 0){
        return "#000000"
    }

    let reds = 0;
    let blues = 0;
    let greens = 0;
    if(colors.length > 0){
        for (const color of colors) {
            reds += parseInt(color.substring(1,3), 16)
            blues += parseInt(color.substring(3,5), 16)
            greens += parseInt(color.substring(5), 16)
        }
        reds = Math.round(reds/colors.length);
        blues = Math.round(blues/colors.length);
        greens = Math.round(greens/colors.length);
    }

    return `#${reds.toString(16).padStart(2,'0')}${blues.toString(16).padStart(2,'0')}${greens.toString(16).padStart(2,'0')}`;
}

export function buildRollContent(formula, roll, notes = [], itemFlavor) {
    const tooltip = getTooltipSections(roll)
    return `<div class="message-content">
${itemFlavor}
        <div class="dice-roll">
            <div class="dice-result">
                <div class="dice-formula">${formula}</div>
                <div class="dice-tooltip">${tooltip}</div>
                <h4 class="dice-total">${roll.total}</h4>
            </div>
        </div>
        <div>${notes.map(note => `<div>${note}</div>`).join("")}</div>
    </div>`
}
function getTooltipSections(roll) {
    let sections = [];

    for (let term of roll.terms) {
        if (term instanceof foundry.dice.terms.Die) {
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

function registerFormulaFunctions(actor) {
    actor.formulaFunctions = new Map();
    actor.formulaFunctions['@charLevel'] = (actor)=>actor.characterLevel;
}

function getGridSizeFromSize(size) {
    switch(size) {
        case "Medium":
            return 1;
        case "Large":
            return 2;
        case "Huge":
            return 3;
        case "Gargantuan":
            return 4;
        case "Colossal":
            return 6;
    }
}

function bypassShields(damageTypes) {
    // if(damageTypes.includes("Lightsabers")){
    //     return false;
    // }
    if(!damageTypes.includes("Energy") && !damageTypes.includes("Energy (Ion)")){
        return true;
    }
    return false;
}


/**
 * Extend the base Actor entity
 * @extends {Actor}
 */
export class SWSEActor extends Actor {

    async _onDelete(options, userId) {
        const links = [];
        for (const actorLink of this.actorLinks) {
            const actor = game.actors.get(actorLink.id);
            links.push(this.removeActorLink(actor))
        }
        await Promise.all(links)
        return super._onDelete(options, userId);
    }

    _onCreateDescendantDocuments(parent, collection, documents, data, options, userId) {
        super._onCreateDescendantDocuments(parent, collection, documents, data, options, userId);

        //remove other condition ActiveEffects.  should identifying a condition ActiveEffect be done differently?
        if ("effects" === collection) {
            let activeEffect = documents[0];
            if (activeEffect.statuses.filter(status => status.startsWith('condition')).size > 0) {
                this.effects
                    .filter(effect => effect !== activeEffect && effect.statuses.filter(status => status.startsWith('condition')).size > 0)
                    .map(effect => effect.delete())
            }
        }
    }




    _onUpdate(changed, options, userId) {
        this.depthMerge(changed, this._pendingUpdates)
        return super._onUpdate(changed, options, userId);
    }

    depthMerge(changed, toBeAdded) {
        for (const entry of Object.entries(toBeAdded)) {
            let cursor = changed;
            let lastCursor = cursor;
            const paths = entry[0].split("\. ")
            for (const path of paths) {
                if (!cursor[path]) {
                    cursor[path] = {};
                }
                lastCursor = cursor;
                cursor = cursor[path];
            }
            lastCursor = entry[1];

        }
    }

    get actions(){
        let actions = [];
        actions.push(...generateAction(this, this.changes));
        for(let item of this.items){
            actions.push(...item.actions);
        }

        return actions;
    }


    _onUpdateDescendantDocuments(parent, collection, documents, changes, options, userId) {
        super._onUpdateDescendantDocuments(parent, collection, documents, changes, options, userId);
        //if(!this.parent) this.reset()
        this.reset()

    }
    getAvailableAmmunition(type) {
        return this.items.filter(item => {
            return isAppropriateAmmo(item, type) && !item.system?.hide ;
        });
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

    

    startOfTurn(updateData){
        const update = {"system.deflectCount": 0}
        this.safeUpdate(update).then(()=> this.sheet.render())
    }

    async safeUpdate(data = {}, context = {}) {
        let user = game.user;

        if(context.owner && context.bypass){
            user = game.users.get(context.owner);
        }
        if ((this.canUserModify(user, 'update') && !this.pack && !!game.actors.get(this.id))) {
            try {
                await this.update(data, context);
            } catch (e) {
                console.warn("failed update", e)
            }
        }
    }

    static async updateDocuments(updates=[], operation={}) {
        if ( operation.parent?.pack ) operation.pack = operation.parent.pack;
        operation.updates = updates;
        let user;
        if(operation.bypass){
            user = game.users.get(operation.owner);
        }
        return await this.database.update(this.implementation, operation, user);
    }

    async setActorLinkOnActorAndTokens(documents, val) {
        if (this.canUserModify(game.user, 'update')) {
            for (let document of documents) {
                await document.update({'actorLink': val});
            }
        }
        await this.safeUpdate({"token.actorLink": val})
    }

    get additionalStatusEffectChoices() {
        const effects = this.applicableEffects();


        let filter = effects
            .filter(e => !!e.flags.swse?.tokenAccessible);
        return filter
            .map(effect => {
                return {
                    _id: effect.id,
                    id: effect.id,
                    title: effect.name,
                    src: effect.img,
                    isActive: !effect.disabled,
                    isOverlay: false
                }
            });
}

    applicableEffects() {
        const effects = []
        effects.push(...this.effects);
        this.items.forEach(item => {
            effects.push(...item.effects);
        })
        return effects;
    }

    async toggleStatusEffect(statusId, {active, overlay = false} = {}) {
        const effects = this.applicableEffects();
        const found = effects.find(effect => effect.id === statusId)

        if(found){
            found.disable(!found.disabled)
            return;
        }

        return super.toggleStatusEffect(statusId, {active, overlay});
    }

    applyActiveEffects() {
        //disable default effect resolution
    }

    /**
     * Augment the basic actor data with additional dynamic data.
     */
    async prepareData() {
        this._pendingUpdates = {};
        if (this.skipPrepare) {
            return;
        }
        registerFormulaFunctions(this)

        if (this.system.externalEditorLink) {

            //this.scrapeExternal(this.system.externalEditorLink)


            // let my_variable = new XMLHttpRequest(); // object
            // my_variable.onload = function() {
            //
            //     console.log("data")
            //     // Here, we can use the response Data
            //
            // }
            // my_variable.open("GET", this.system.externalEditorLink);
            //
            // my_variable.send();

            // fetch(this.system.externalEditorLink, {
            //     headers: {
            //     }
            // })
            //     //.then(r => r.json())
            //     .then(data => {
            //
            //     console.log(data)
            //
            // });
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
        system.gravity = "Normal"
        let gravityEffect = this.effects.find(effect => !!effect && !!effect.statuses?.find(status => status.startsWith("gravity")))

        if (gravityEffect) {
            system.gravity = gravityEffect.changes.find(change => change.key === "gravity").value
        }


        system.condition = 0;
        let conditionEffect = this.effects.find(effect => !!effect && !!effect.statuses?.find(status => status.startsWith("condition")))

        if (conditionEffect) {
            system.condition = conditionEffect.changes.find(change => change.key === "condition").value
        }

        this.system.finalAttributeGenerationType = this.system.attributeGenerationType;

        if (Array.isArray(this.system.attributeGenerationType)) {
            console.error("this should not happen.  multiple attribute generation types found, using first.")
            this.system.attributeGenerationType = this.system.attributeGenerationType[0];
        }
        this.system.sheetType = "Auto"
        if (this.flags.core?.sheetClass === "swse.SWSEManualActorSheet" || this.type === "vehicle") {
            this.system.finalAttributeGenerationType = "Manual";
            this.system.sheetType = "Manual"
        } else if (!this.system.attributeGenerationType || this.system.attributeGenerationType.toLowerCase() === "default") {
            this.system.finalAttributeGenerationType = game.settings.get("swse", "defaultAttributeGenerationType") || "Manual";

        }
        //generateAttributes(this);//TODO, make this lazy
        this.attack = new AttackDelegate(this);
        this.skill = new SkillDelegate(this);
        this.weight = new WeightDelegate(this);


        if (this.type === 'character') this._prepareCharacterData(system);
        //if (this.type === 'npc') this._prepareCharacterData(system);
        if (this.type === 'computer') this._prepareComputerData(system);
        if (this.type === 'vehicle') this._prepareVehicleData(system);
        //if (this.type === 'npc-vehicle') this._prepareVehicleData(system);

        this.initializeCharacterSettings();

        for (let link of this.actorLinks) {
            let linkedActor = getDocumentByUuid(link.uuid);
            if (!linkedActor) continue;
            let reciLink = linkedActor.actorLinks?.find(link => link.uuid === this.uuid)

            if (!reciLink) continue;
            const oldLink = JSON.stringify(reciLink);
            let system = this.getCachedLinkData(this.type, link.position, this, reciLink)

            if (oldLink !== JSON.stringify(system)) {
                let actorLinks = linkedActor.actorLinks;
                linkedActor.safeUpdate({"system.actorLinks": actorLinks});
            }
        }

        if (this.id) {
            if (this.type === "npc") {
                this.safeUpdate({"type": "character", "system.isNPC": true}, {updateChanges: false});
            } else if (this.type === "npc-vehicle") {
                this.safeUpdate({
                    "type": "vehicle",
                    "system.isNPC": true
                }, {updateChanges: false});

            } else if (system.isNPC && this.prototypeToken.actorLink) {
                let children = canvas.tokens?.objects?.children || [];
                let documents = children.filter(token => token.document.actorId === this.id).map(token => token.document)
                this.setActorLinkOnActorAndTokens(documents, false);
            } else if (!system.isNPC && !this.prototypeToken.actorLink) {
                let children = canvas.tokens?.objects?.children || [];
                let documents = children.filter(token => token.document.actorId === this.id).map(token => token.document)
                this.setActorLinkOnActorAndTokens(documents, true);
            }
        }


        if (this.type === "character") {
            const tokenUpdates = {};

            if (!!this.system.autoSizeToken) {

                //adjust tokens to size
                const newSize = sizeArray[getResolvedSize(this)]
                this.system.size = newSize;
                this._pendingUpdates["system.size"] = newSize;
                const gridSize = getGridSizeFromSize(newSize);
                tokenUpdates["width"] = gridSize;
                tokenUpdates["height"] = gridSize;
            }

            if (!!this.system.allowSheetLighting) {
                let auraColors = getInheritableAttribute({attributeKey: "auraColor", entity: this, reduce: "VALUES"})

                auraColors = auraColors.filter(color => !!color).map(color => {
                    if (color.startsWith("#")) {
                        return color;
                    }
                    return COLORS[color];
                }).filter(color => !!color)

                const auraLuminosity = getInheritableAttribute({
                    attributeKey: "auraLuminosity",
                    entity: this,
                    reduce: "SUM"
                })
                tokenUpdates['light.luminosity'] = auraLuminosity || 0.30 + auraColors.length * 0.10

                const auraBright = getInheritableAttribute({attributeKey: "auraBright", entity: this, reduce: "SUM"})
                tokenUpdates['light.bright'] = auraBright || 0.20 + auraColors.length * 0.10

                const auraDim = getInheritableAttribute({attributeKey: "auraDim", entity: this, reduce: "SUM"})
                tokenUpdates['light.dim'] = auraDim || 0.50 + auraColors.length * 0.20

                tokenUpdates['light.color'] = mergeColor(auraColors);

                const auraAnimationType = getInheritableAttribute({
                    attributeKey: "auraAnimationType",
                    entity: this,
                    reduce: "FIRST"
                })
                if (auraAnimationType) {
                    const auraAnimationSpeed = getInheritableAttribute({
                        attributeKey: "auraAnimationSpeed",
                        entity: this,
                        reduce: "FIRST"
                    })
                    const auraAnimationIntensity = getInheritableAttribute({
                        attributeKey: "auraAnimationIntensity",
                        entity: this,
                        reduce: "FIRST"
                    })
                    tokenUpdates['animation'] = {
                        type: auraAnimationType,
                        speed: auraAnimationSpeed,
                        intensity: auraAnimationIntensity,
                        reverse: false
                    };
                }
            }


            if (Object.keys(tokenUpdates).length > 0) {
                const dependentTokens = this.getDependentTokens({linked: true});
                for (const tokenDocument of dependentTokens) {
                    if (tokenDocument._id && game) {
                        try {
                            await tokenDocument.update(tokenUpdates);
                        } catch (e) {
                            console.log(e)
                        }
                    }
                }
            }
        }


        // if(Object.values(this._pendingUpdates).length > 0){
        //     this.safeUpdate(this._pendingUpdates);
        // }
    }

    get condition() {
        return this.system.condition;
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


            // crewPositions.forEach(position => {
            //     let crewMember = this.system.crew.filter(crewMember => crewMember.position === position);
            //     let positionCover;
            //
            //     if (this.system.crewCover) {
            //         positionCover = this.system.crewCover[position]
            //     }
            //     positionCover = positionCover || coverMap[position] || coverMap["default"];
            //
            //     if (position === 'Gunner') {
            //         crewSlots.push(...this.resolveSlots(crewMember, position, positionCover, this.gunnerPositions.map(gp => gp.numericId)));
            //     } else {
            //         let crewSlot = crewSlotResolution[position];
            //         if (crewSlot) {
            //             crewSlots.push(...this.resolveSlots( crewMember, position, positionCover, range(0, crewSlot(this.crew) - 1)));
            //         }
            //     }
            // });
            //
            // for (let position of providedSlots.filter(notEmpty).filter(unique)) {
            //     let count = providedSlots.filter(s => s === position).length
            //     let positionCover;
            //
            //     if (this.system.crewCover) {
            //         positionCover = this.system.crewCover[position]
            //     }
            //
            //     if (!positionCover) {
            //         positionCover = coverMap[position];
            //     }
            //     if (!positionCover) {
            //         positionCover = coverMap["default"];
            //     }
            //     //this.system.crewCount += ` plus ${count} ${position} slot${count > 1 ? "s" : ""}`
            //     crewSlots.push(...this.resolveSlots(this.system.crew.filter(crewMember => crewMember.position === position), position, positionCover, count -1));
            // }
            return crewSlots;
        })

    }

    getRollData() {
        this.system.initiative = this.skill.skills.find(skill => skill.key === 'initiative')?.value || 0;
        let health = this.health
        return super.getRollData();
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
             return getInheritableAttribute({
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
            let condition = getInheritableAttribute({
                entity: this,
                attributeKey: "condition",
                reduce: "SUM"
            });

            if(condition === "OUT"){
                condition = 0;
            }
            return this.baseAttackBonus + Math.max(this.attributes.str.mod, this.attributes.dex.mod) + getInheritableAttribute({
                entity: this,
                attributeKey: "grappleBonus",
                reduce: "SUM"
            }) + getInheritableAttribute({
                entity: this,
                attributeKey: "grappleSizeModifier",
                reduce: "SUM"
            }) + condition;
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
        return resolveHealth(this);
    }


    /**
     * Prepare Vehicle type specific data
     * @param system
     * @private
     */
    _prepareVehicleData(system) {

    }

    /**
     * Prepare Character type specific data
     */
    _prepareCharacterData(system) {
        this.darkside = new DarksideDelegate(this);

    }

    get levelSummary(){
        return this.classes.length;
    }
    get classSummary(){
        return this._generateClassData(this.system).classSummary;
    }
    get classLevels(){
        return this._generateClassData(this.system).classLevels;
    }

    get defense(){
        return resolveDefenses(this);
    }

    get armors(){
        let armors = []

        for (const armor of this.equipped.filter(item => item.type === 'armor')) {
            armors.push(generateArmorBlock(this, armor));
        }
        return armors;
    }

    get armorItems() {
        return this.getCached("armors", () => {
            return filterItemsByTypes(this.items.values(), ["armor"]);
        })
    }

    get shields(){
        return this.getCached("shields", () => {
            return resolveShield(this)
        })
    }

    get secondWind(){
        let secondWind = this.system.secondWind || {}
        const bonusSecondWind = getInheritableAttribute({
            entity: this,
            attributeKey: "bonusSecondWind",
            reduce: "SUM"
        });
        secondWind.perDay = bonusSecondWind + (this.isHeroic ? 1 : 0)
        return secondWind;
    }

    get firstAid(){
        let firstAid = this.system.firstAid || {}
        firstAid.perDay = 1
        return firstAid;
    }

    get forcePoints(){
        const forcePoints = Number.isInteger(this.system.forcePoints) ? this.system.forcePoints : (this.system.forcePoints?.quantity || 0);
        this.system.forcePoints = (typeof this.system.forcePoints === 'object') ? this.system.forcePoints || {} : {};
        this.system.forcePoints.quantity = forcePoints;

        const forceDieSize = getInheritableAttribute({
            entity: this,
            attributeKey: "forceDieSize",
            reduce: "FIRST"
        });
        const forceDie = !!forceDieSize ? forceDieSize : 6

        const forceDieCount = this.levelSummary > 14 ? 3 : (this.levelSummary > 7 ? 2 : 1);
        this.system.forcePoints.roll = `${forceDieCount}d${forceDie}kh`

        return this.system.forcePoints;
    }

    // get remainingSkills(){
    //     let remainingSkills = getAvailableTrainedSkillCount(this);
    //     remainingSkills = remainingSkills - this.trainedSkills.length;
    //     return remainingSkills < 0 ? false : remainingSkills;
    // }
    // get tooManySkills(){
    //
    //     let remainingSkills = getAvailableTrainedSkillCount(this);
    //     remainingSkills = remainingSkills - this.trainedSkills.length;
    //     return remainingSkills < 0 ? Math.abs(remainingSkills) : false;
    // }

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
            return this.system.vehicle?.crew || 0;
    }

    /**
     * @return [SWSEActor]
     */
    get linkedActors(){
        return this.getCached("linkedActors", () => {
            return new Map(this.actorLinks.map(actorLink => [actorLink.position, getDocumentByUuid(actorLink.uuid)]).filter(actorLink => !!(actorLink[1])));
        })
    }

    get actorLinks() {
        return this.getCached("actorLinks", () => {
            return Array.isArray(this.system.actorLinks) ? this.system.actorLinks || [] : [];
        })
    }

    get feats(){
        return this.resolveFeats().activeFeats
    }

    get inactiveFeats(){
        return this.resolveFeats().inactiveProvidedFeats
    }

    /**
     *
     * @param actor {SWSEActor}
     * @param context {Object}
     */
    async removeActorLink(actor, context = {}) {
        if (!context.skipReciprocal && actor) {
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
            let vehicleBaseTypes = filterItemsByTypes(this.items.values(), ["vehicleBaseType"]);
            return (vehicleBaseTypes.length > 0 ? vehicleBaseTypes[0] : null);
        })
    }


    get ammunition() {
        return this.getCached("ammunition", () => {
            return this.itemTypes['equipment'].filter(item => item.system.subtype === "Ammunition");
        })
    }

    get uninstalled() {
        return this.getCached("uninstalled", () => {
            return this.itemTypes['vehicleSystem'].filter(item => !item.system.equipped);
        })
    }

    get installed() {
        return this.getCached("installed", () => {
            return this.itemTypes['vehicleSystem'].filter(item => item.system.equipped === 'installed');
        })
    }

    get pilotInstalled() {
        return this.getCached("pilotInstalled", () => {
            return this.itemTypes['vehicleSystem'].filter(item => item.system.equipped === 'pilotInstalled');
        })
    }

    get gunnerPositions() {
        return this.getCached("gunnerPositions", () => {
            let items = this.itemTypes['vehicleSystem'];
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
        return this.inventoryItems
    }

    get species() {
        return this.getCached("species", () => {
            const speciesList = filterItemsByTypes(this.items.values(), ["species"]);
            return (speciesList.length > 0 ? speciesList[0] : null);
        })
    }

    /**
     *
     * @return {[]}
     */
    get classes() {
        // return this.getCached("classes", () => {

        let classes = [];
        for (let co of this.itemTypes.class) for (let [i, characterLevel] of co.levelsTaken.entries()) {
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
            leveledClass.isFollowerTemplate = co.isFollowerTemplate

            classes.push(leveledClass);
        }

        classes = classes.sort((a, b) => a.characterLevel > b.characterLevel ? 1 : -1);
        if (classes.length > 0) {
            classes[classes.length - 1].isLatest = true;
        }
        return classes;
        //})
    }


    get poorlyFormattedClasses() {
        return filterItemsByTypes(this.items.values(), ["class"]).filter(c => c.levelsTaken.length === 0);
    }

    get weapons() {
        return this.itemTypes["weapons"]
    }

    get equipment() {
        return this.itemTypes["equipment"]
    }

    get traits() {
        return filterItemsByTypes(inheritableItems(this), ["trait"]).sort(ALPHA_FINAL_NAME);
    }

    get talents() {
        return this.itemTypes["talent"]
    }

    get powers() {
        return this.itemTypes["forcePower"]
    }

    get languages() {
        return this.itemTypes["language"]
    }

    get background() {
        let backgrounds = this.itemTypes["background"];
        return (backgrounds.length > 0 ? backgrounds[0] : null);
    }

    get destiny() {
        let destinies = this.itemTypes["destiny"];
        return (destinies.length > 0 ? destinies[0] : null);
    }

    get secrets() {
        return this.itemTypes["forceSecret"]
    }

    get techniques() {
        return this.itemTypes["forceTechnique"]
    }

    get affiliations() {
        return this.itemTypes["affiliation"]
    }

    get regimens() {
        return this.itemTypes["forceRegimen"]
    }

    get naturalWeapons() {
        return this.itemTypes["beastAttack"]
    }

    get specialSenses() {
        return this.itemTypes["beastSense"]
    }

    get speciesTypes() {
        return this.itemTypes["beastType"]
    }

    get specialQualities() {
        return this.itemTypes["beastQuality"]
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
            return SWSEActor._getEquippedItems(this.system, this.inventoryItems, "equipped").filter(item => this.isEquipable(item));
        })
    }

    get unequipped() {
        return this.getCached("unequipped", () => {
            return this.inventoryItems.filter(item => this.isEquipable(item) && !item.system.equipped);
        })
    }

    get inventory() {
        return this.getCached("inventory", () => {
            return this.inventoryItems.filter(item => !this.isEquipable(item));
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
        this.system.settings.push({type: "boolean", path: "system.autoSizeToken", label: "Autosize Token based on actor size?", value: this.system.autoSizeToken})
        this.system.settings.push({type: "boolean", path: "system.allowSheetLighting", label: "Allow Sheet to modify token lighting", value: this.system.allowSheetLighting})
        this.system.settings.push({
            type: "boolean",
            path: "system.ignorePrerequisites",
            label: "Ignore Prerequisites",
            value: this.system.ignorePrerequisites
        });
        this.system.settings.push({
            type: "boolean",
            path: "system.ignorePrerequisitesOnDrop",
            label: "Ignore Prerequisites when adding new Items",
            value: this.system.ignorePrerequisites
        })
        if(this.type === "character"){
            this.system.settings.push({
                type: "select",
                path: "system.attributeGenerationType",
                label: "Attribute Generation Type",
                value: this.system.attributeGenerationType || "Default",
                options: [
                    {value: "Default", display: "Default", tooltip: "Uses System Preference"},
                    {value: "Manual", display: "Manual", tooltip: "Your Attributes are exactly as you enter them"},
                    {value: "Semi-Manual", display: "Semi-Manual", tooltip: "Enter Base Stat and bonuses will be applied from species, class, etc"},
                    {value: "Roll", display: "Roll", tooltip: "Roll and assign stats"},
                    {value: "Point Buy", display: "Point Buy", tooltip: "Point buy rules. droids should be expected to have a lower point buy value because they have one fewer stats"},
                    {value: "Standard Array", display: "Standard Array", tooltip: "Assign the Standard Array"}
                ]
            })
        }

        //this.system.settings.push({type: "text", path: "system.externalEditorLink", label: "External Editor Link (Saga Workshop)", value: this.system.externalEditorLink})
    }

    async removeItems(itemIds) {
        let ids = [];
        ids.push(...itemIds)

        for (let itemId of itemIds) {
            await this.removeChildItems(itemId);
            ids.push(...await this.getSuppliedItems(itemId));

            for (const linkedActor of this.linkedActors.values()) {
                const removedIds = await linkedActor.getSuppliedItems(itemId);
                linkedActor.deleteEmbeddedDocuments("Item", removedIds);
            }
        }
        await this.deleteEmbeddedDocuments("Item", ids);
    }

    async removeItem(itemId) {
        await this.removeChildItems(itemId);
        let ids = await this.getSuppliedItems(itemId);
        ids.push(itemId);

        for (const linkedActor of this.linkedActors.values()) {
            const removedIds = await linkedActor.getSuppliedItems(itemId);
            await linkedActor.deleteEmbeddedDocuments("Item", removedIds);
        }

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

    async getSuppliedItems(id) {
        return this.items.filter(item => item.system.supplier?.id === id).map(item => item.id) || []
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
        //let cLModifier = 0;
        if (quality && quality !== "-") {
            attackBonus = crewQuality[quality.titleCase()]["Attack Bonus"];
            checkModifier = crewQuality[quality.titleCase()]["Check Modifier"];
            //cLModifier = crewQuality[quality.titleCase()]["CL Modifier"];
        }
        let resolvedSkills = {}
        skills().forEach(s => resolvedSkills[s.toLowerCase()] = {value: checkModifier})
        return {
            baseAttackBonus: attackBonus,
            system: {
                skills: resolvedSkills
            },
            items: [],
            name: quality
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

    get gridSpeeds() {
        return this.getCached("gridSpeed", () => {
            if (this.type === 'vehicle') {
                const vehicleSpeed = getInheritableAttribute({
                    entity: this,
                    attributeKey: "speedStarshipScale",
                    reduce: "SUM"
                });
                const characterSpeed = getInheritableAttribute({
                    entity: this,
                    attributeKey: "speedCharacterScale",
                    reduce: "SUM"
                })
                return [
                    {type: "Vehicle Scale", value: vehicleSpeed},
                    {type: "Character Scale", value: characterSpeed}
                ]
            } else {
                let attributes = getInheritableAttribute({
                    entity: this,
                    attributeKey: 'speed', reduce: "VALUES"
                })

                attributes = attributes.map(speed => {
                    let result = /([\w\s->]*)\s(\d*)/.exec(speed)
                    return {type: result[1], value: parseInt(result[2])}
                })

                if (attributes.length === 0) {
                    attributes.push({type: "Stationary", value: 0});
                }
                let armorType = this.heaviestArmorType;

                const conversions = attributes.filter(attribute=> attribute.type.includes("->")).map(attribute => attribute.type)

                attributes = attributes.filter(attribute=> !attribute.type.includes("->"))

                return attributes.map(speed => this.applyArmorSpeedPenalty(speed, armorType))
                    .map(speed => this.applyConditionSpeedPenalty(speed, armorType))
                    .map(speed => this.applyWeightSpeedPenalty(speed))
                    .map(speed => this.applyConversions(speed, conversions))
            }

        })
    }

    get heaviestArmorType() {
        let armorType = "";
        for (let armor of this.equipped.filter(item => item.type === "armor")) {
            if (armor.armorType === "Heavy" || (armor.armorType === "Medium" && armorType === "Light") || (armor.armorType === "Light" && !armorType)) {
                armorType = armor.armorType;
            }
        }
        return armorType;
    }

    get speed() {
        return this.gridSpeeds.map(speed => `${speed.type} ${speed.value}`).join(" / ");
    }

    // getter for further speed calculations
    get resolvedSpeed() {
        return parseInt(/([\w\s]*)\s(\d*)/.exec(this.speed)[2]);
    }

    /**
     * applies the speed penalty from wearing armor
     * @param speed {object}
     * @param speed.type {string}
     * @param speed.value {number}
     * @param armorType {string}
     * @return
     */
    applyArmorSpeedPenalty(speed, armorType) {
        if (!armorType || "Light" === armorType) {
            return speed;
        }
        speed.value = Math.floor(speed.value * 3 / 4)
        return speed;
    }

    /**
     * applies the speed penalty from your condition
     * @param speed {object}
     * @param speed.type {string}
     * @param speed.value {number}
     * @return
     */
    applyConditionSpeedPenalty(speed) {
        let multipliers = getInheritableAttribute({
            entity: this,
            attributeKey: "speedMultiplier",
            reduce: "VALUES"
        })

        multipliers.forEach(m => speed.value = parseFloat(m) * speed.value)
        return speed
    }

    /**
     * applies the speed penalty from your carry weight
     * @param speed {object}
     * @param speed.type {string}
     * @param speed.value {number}
     * @return
     */
    applyWeightSpeedPenalty(speed) {
        if (game.settings.get("swse", "enableEncumbranceByWeight")) {
            if (this.carriedWeight >= this.maximumCapacity) {
                speed.value = 0;
            } else if (this.carriedWeight >= this.strainCapacity) {
                speed.value = 1;
            } else if (this.carriedWeight >= this.heavyLoad) {
                if("Fly Speed" === speed.type){
                    speed.value = 0;
                }else {
                    speed.value = Math.floor(speed.value * 3 / 4)
                }
            }
        }

        return speed
    }


    get equippedWeapons() {
        return this.equipped
            .filter(item => 'weapon' === item.type)
    }

    getInstalledWeapons() {
        return SWSEActor._getEquippedItems(this.system, this.inventoryItems)
    }

    resolveFeats() {
        return this.getCached("feats", () => {
            let feats = filterItemsByTypes(this.items.values(), ["feat"]);
            let activeFeats = filterItemsByTypes(inheritableItems(this), ["feat"]);
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
        })
    }

    getVariable(variableName) {
        let swseActor = this;
        return getVariableFromActorData(swseActor, variableName);
    }

    get conditionBonus() {
        return this.system.condition;
    }
    /**
     * @param {string} effectGrouper
     * @param changeValue
     */
    async setGroupedEffect(effectGrouper, changeValue) {
        await this.clearGroupedEffect(effectGrouper);

        let localEffect = this.effects.find(e => {
            return e.changes && e.changes.find(c => c.key === effectGrouper && c.value === changeValue);
        })

        let statusEffect = CONFIG.statusEffects.find(e => {
            return e.changes && e.changes.find(c => c.key === effectGrouper && c.value === changeValue);
        })

        if(localEffect){
            statusEffect.changes = localEffect.changes;
        }

        await this.activateStatusEffect(statusEffect);
    }

    /**
     * @param {string} effectGrouper
     */
    async clearGroupedEffect(effectGrouper) {
        const ids = [];
        for (const effect of this.effects) {
            if(effect.statuses.find(status => status.startsWith(effectGrouper))){
                if(effect.origin){
                    if(!effect.isDisabled){
                        effect.disable(true)
                    }
                } else {
                    ids.push(effect.id);
                }
            }
        }

        await this.deleteEmbeddedDocuments("ActiveEffect", ids);
    }

    changeShields(number) {
        const data = {}
        data["system.shields.value"] = Math.max(this.shields.value + number, 0);
        this.safeUpdate(data)
    }

    async reduceCondition(number = 1) {
        let i = SWSE.conditionTrack.indexOf(`${this.system.condition}`);

        let resultFlavor = ""
        //if this is reducing condition then we should consider anything that increases that reduction
        if(number > 0){
            if(getInheritableAttribute({entity:this, attributeKey:"implantDisruption", reduce: "OR"})){
                resultFlavor = "An additional step down the condition track was taken due to Implant Disruption."
                number++;
            }
        }

        if(i+number === 0){
            await this.clearGroupedEffect("condition");

            return `condition track reset. ${resultFlavor}`
        }else {
            const number1 = Math.min(i + number, 5);
            let newCondition = SWSE.conditionTrack[number1];

            await this.setGroupedEffect('condition', newCondition)

            return `condition set to ${newCondition}.  ${resultFlavor}`;
        }
    }
    async activateStatusEffect(statusEffect) {
        if (!statusEffect) {
            return;
        }

        if(statusEffect.origin){
            statusEffect.disable(false);
            return;
        }

        const createData = foundry.utils.deepClone(statusEffect);
        createData.label = game.i18n.localize(statusEffect.label);
        createData["statuses"] = [statusEffect.id]
        delete createData.id;
        const cls = getDocumentClass("ActiveEffect");
        await cls.create(createData, {parent: this});
    }

    async applyDamage(options) {
        let update = {};
        let totalDamage = toNumber(options.damage);

        const damageTypes = options.damageType.split(COMMMA_LIST);

        let resultFlavor = "";
        if (!options.skipShields && !bypassShields(damageTypes)) {
            let shields = this.system.shields;
            let shieldValue = shields.value;
            if (shields.active && shieldValue > 0) {
                if (totalDamage > shieldValue) {
                    this.changeShields(-5)
                    resultFlavor += "Shields overwhelmed. Shield value reduced by 5. "
                }
                totalDamage = Math.max(totalDamage - shieldValue, 0);
            }
        }

        if (!options.skipDamageReduction) {
            let damageReductions = getInheritableAttribute({entity: this, attributeKey: "damageReduction"})
            let lightsaberResistance = getInheritableAttribute({
                entity: this,
                attributeKey: "blocksLightsaber",
                reduce: "OR"
            })

            if (!damageTypes.includes("Lightsabers") || lightsaberResistance) {
                for (let damageReduction of damageReductions) {
                    let modifier = damageReduction.modifier || "";

                    let modifiers = modifier.split(COMMMA_LIST);
                    let innerJoin1 = innerJoin(damageTypes, modifiers);
                    if (!modifier || innerJoin1.length === 0) {
                        totalDamage = Math.max(totalDamage - toNumber(damageReduction.value), 0)
                    }
                }
            }
        }



        let conditionReduction = 1;
        const currentHealth = this.system.health.value;


        let damageThreshhold = this.defense.damageThreshold.total;
        let reducedToZero = false;
        if(damageTypes.includes("Energy (Ion)")){
            if (this.takesFullDamageFromIon) {
                if(totalDamage >= currentHealth){
                    conditionReduction = 5;
                    resultFlavor += "The Ion Damage reduced hitpoints to 0 and has caused them to become helpless. "
                    reducedToZero = true;
                } else if(totalDamage > damageThreshhold){
                    conditionReduction = 2;
                    resultFlavor += "An additional step was taken down the condition track due to Ion Damage. "
                }
            } else {
                totalDamage = Math.floor(totalDamage / 2);
            }
        } else if(damageTypes.includes("Energy (Stun)")){
            if(this.isEffectedByStun){
                if(totalDamage >= currentHealth){
                    conditionReduction = 5;
                    resultFlavor += "The Stun Damage reduced hitpoints to 0 and has caused them to become helpless. "
                    reducedToZero = true;
                } else if(totalDamage > damageThreshhold){
                    conditionReduction = 2;
                    resultFlavor += "An additional step was taken down the condition track due to Stun Damage. "
                }
            } else {
                totalDamage = 0;
            }
        }

        let reducedCondition = "";
        if (options.affectDamageThreshold) {
            if (totalDamage > damageThreshhold || reducedToZero) {
                reducedCondition = await this.reduceCondition(conditionReduction)
            }
        }

        //TODO Floating numbers tie in
        if(totalDamage < 0){
            totalDamage = 0;
        }


        update[`system.health.value`] = currentHealth - totalDamage;
        const content = `${this.name} has has taken ${totalDamage} damage.  ${resultFlavor}  ${reducedCondition}`
        toChat(content, this)


        // if(this.canUserModify(game.user, 'update')){
            this.safeUpdate(update);
        // } else {
        //     console.log(this)
        //     let ownerIds = Object.entries(this.ownership).filter(e => e[1]  === 3).map(e => e[0])
        //     for (let ownerId of ownerIds) {
        //         this.safeUpdate(update, {bypass: true, owner: ownerId})
        //         // let owner = game.users.get(ownerId)
        //         // console.log((owner))
        //     }
        // }
    }

    applyHealing(options) {
        let update = {};
        const proposedHealAmount = toNumber(options.heal);
        const maxHealAmount = this.system.health.max - this.system.health.value;
        const healAmount = Math.min(proposedHealAmount, maxHealAmount);
        update[`system.health.value`] = this.system.health.value + healAmount;

        const content = `${this.name} has has healed ${healAmount} damage` + (maxHealAmount < proposedHealAmount ? " reaching max health." : ".")
        toChat(content, this)
        this.safeUpdate(update, {bypass: true});
    }

    get recoveryActions(){
        return this.system.recoveryActions || 0;
    }

    get totalRecoveryActions(){
        return 3;
    }

    async setAttributes(attributes) {
        let update = {};
        for (let [key, ability] of Object.entries(attributes)) {
            update[`system.attributes.${key}.base`] = ability;
        }
        await this.safeUpdate(update);
    }

    async addChange(change) {
        let update = {};
        update[`system.changes`] = this.system.changes || [];
        update[`system.changes`].push(change);
        await this.safeUpdate(update);
    }


    get attributes() {
        return this._attributes();
    }

    _attributes(options){
        return this.getCached("attributes", () => {
            generateAttributes(this, options)
            return this.system.attributes;
        })
    }



    getAttributeBases() {
        let response = {};
        for (let [key, attribute] of Object.entries(this.attributes)) {
            response[key] = attribute.base;
        }
        return response;
    }

    getAttributeBonuses() {
        let response = {};
        for (let [key, attribute] of Object.entries(this.attributes)) {
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

    /**
     *
     * @param actor {SWSEActor}
     * @param attributeName
     * @return {*}
     */
    static getActorAttribute(actor, attributeName, options) {
        let attributes = actor._attributes(options);
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
                const classObjects = filterItemsByTypes(this.items.values(), ["class"]);
                let heroicLevel = 0;
                let charLevel = 0;
                for (let co of classObjects) {
                    if (getInheritableAttribute({
                        entity: co,
                        attributeKey: "isHeroic",
                        reduce: "OR"
                    })) {
                        heroicLevel += co.system.levelsTaken.length;
                    }
                    charLevel += co.system.levelsTaken.length;
                }
                this.resolvedVariables.set("@heroicLevel", heroicLevel);
                this.resolvedVariables.set("@charLevel", charLevel);
                return heroicLevel;
            }
            return 0;
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

    /**
     * @return boolean
     */
    get isDroid() {
        if (this.type === 'vehicle' || this.type === 'npc-vehicle') {
            return false;
        } else {
            for (const species of this.itemTypes.species) {
                for (const change of species.system.changes) {
                    if (change.key === "isDroid" && (change.value === true || change.value === "true")) {
                        return true;
                    }
                }
            }
            return false;
        }
    }

    /**
     * @return boolean
     */
    get takesFullDamageFromIon(){
        if(this.isDroid){
            return true;
        }

        for(const implant of this.itemTypes["implant"].filter(implant => implant.system?.equipped === "equipped")){
            const isCybernetic = getInheritableAttribute({entity: implant, attributeKey: "cybernetic", reduce: "OR"});
            const isShielded = getInheritableAttribute({entity: implant, attributeKey: "ionShielded", reduce: "OR"});

            if(isCybernetic && !isShielded){
                return true;
            }
        }
        return false;
    }

    get isEffectedByStun(){
        return !(this.isDroid || this.type === 'vehicle' || this.type === 'npc-vehicle');

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

    get handleLevelBasedAttributeBonuses() {

        if (this.system.attributeGenerationType === "Manual") {
            return 0;
        }

        let characterLevel = this.classes.length;

        return (characterLevel - (characterLevel % 4)) / 4
    }

    ignoreCon() {
        let skip = this.attributes.con?.skip;
        return skip === undefined ? true : skip;
    }


    static _getEquippedItems(system, items, equipTypes) {
        if (!equipTypes) {
            return items.filter(item => !item.system.equipped);
        }
        equipTypes = Array.isArray(equipTypes) ? equipTypes : [equipTypes];

        return items.filter(item => equipTypes.includes(item.system.equipped));
    }
    get inventoryItems() {
        return this.getCached("inventoryItems", () => {
            const inventoryItems = [];
            for (const type of ['weapon', 'armor', 'equipment', 'vehicleSystem', 'droid system']) {
                inventoryItems.push(...this.itemTypes[type])
            }
            return inventoryItems.filter(item => !item.system.hasItemOwner);
        }) 
    }
//TODO, this is a better title case. i should move this
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

    itemsWithTypes(types){
        const items = [];
        for(let type of types){
            try{
                items.push(...this.itemTypes[type])
            } catch (e) {
                console.error("INVALID ITEM TYPE: " + type, e);
            }
        }
        return items;
    }

    /**
     *
     * @param ability {string}
     * @returns {*}
     */
    getAttributeMod(ability) {
        if (!ability) return;
        return this.attributes[ability.toLowerCase()]?.mod;
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
        const strings = Array.from(this.items.values())
            .map(i => `${i.finalName}:${i.type}`);
        return strings
            .includes(`${item.finalName}:${item.type}`);
    }

    hasAnyOf(items) {
        for (const item of items) {
            if (this.hasItem(item)) {
                return true;
            }
        }
        return false;
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

    get availableItems(){
        return this.getCached("availableItems", () => {
            const availableItems = {};
            availableItems['Ability Score Level Bonus'] = this.handleLevelBasedAttributeBonuses;

            let dynamicGroups = {};
            let specificProvided = {};
            if(getInheritableAttribute({
                    entity: this,
                    attributeKey: "telekineticProdigy",
                    reduce: "OR"
                })){

                const forceTrainingCount = getInheritableAttribute({entity: this, attributeKey: "forceTraining", reduce: "COUNT"})
                const moveObjectCount = this.itemTypes["forcePower"].filter(power => power.name === "Move Object").length

                availableItems['Telekinetic Force Powers'] = Math.min(forceTrainingCount, moveObjectCount)
            }

            const provides = getInheritableAttribute({
                entity: this,
                attributeKey: "provides"
            });
            for (let provided of provides) {
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
                availableItems[key] = availableItems[key] ? availableItems[key] + value : value;
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
                availableItems[key] = availableItems[key] ? availableItems[key] - value : 0 - value;
            }

            let classLevel = this.classes?.length;
            availableItems['General Feats'] = 1 + Math.floor(classLevel / 3) + (availableItems['General Feats'] ? availableItems['General Feats'] : 0);

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
                    let types = innerJoin(providers, Object.keys(availableItems))
                    if (types && types.length > 0) {
                        type = types[0]
                    }
                }

                if (!type && innerJoin(bonusTalentTrees, providers).length > 0) {
                    bonusTreeTalents.push(talent);
                    continue;
                }

                this.reduceAvailableItem(availableItems, type);  //talentTreeSource is the old one

            }

            for (let talent of bonusTreeTalents) {
                let type = Object.keys(availableItems).find(item => item.includes("Talent"))
                this.reduceAvailableItem(availableItems, type);
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
                        let selection = innerJoin(bonusFeatCategories, Object.keys(availableItems))
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

                this.reduceAvailableItem(availableItems, type, 1, "General Feats");
            }
            this.reduceAvailableItem(availableItems, "Force Secret", this.secrets.length);
            this.reduceAvailableItem(availableItems, "Force Technique", this.techniques.length);
            for (let forcePower of this.powers) {
                this.reduceAvailableItem(availableItems, forcePower.system.activeCategory || "Force Powers", forcePower.system.quantity, "Force Powers");
            }

            return availableItems;
        });

    }


    reduceAvailableItem(availableItems, type, reduceBy = 1, backupType) {
        if (!type && !backupType) {
            if (!KNOWN_WEIRD_UNITS.includes(this.name)) {
                //console.warn("tried to reduce undefined on: " + this.name, this)
            }
            return;
        }

        const availableItem = availableItems[type] || 0;
        availableItems[type] = availableItem - reduceBy;

        if (backupType && availableItems[type] < 0) {
            let availableBackup = availableItems[backupType] || 0;
            availableItems[type] = availableBackup + availableItems[type];
            availableItems[type] = 0;
        }

        if (availableItems[type] === 0) {
            delete availableItems[type];
        }
        if (availableItems[backupType] === 0) {
            delete availableItems[backupType];
        }
    }

    cleanSkillName(key) {
        return this._uppercaseFirstLetters(key).replace("Knowledge ", "K").replace("(", "").replace(")", "").replace(" ", "").replace(" ", "")
    }
    /**
     *
     * @param itemIds
     */
    rollOwnedItem(itemIds) {
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
            this.attack.createAttackDialog(null, {
                type: (itemIds.length === 1 ? "singleAttack" : "fullAttack"),
                items: itemIds
            })
        } else {
            for (let item of items) {
                item.rollItem(this).render(true);
            }
        }

    }

    async sendRollToChat(template, formula, modifications, notes, name, actor) {
        let roll = await new Roll(formula).roll();
        roll.toMessage({
            speaker: ChatMessage.getSpeaker({actor}),
            flavor: name
        });
    }

    async _onCreate(item, options, userId) {
        if (item.type === "character") await this.safeUpdate({"token.actorLink": true}, {updateChanges: false});
        if (item.type === "npc") await this.safeUpdate({
            "type": "character",
            "system.isNPC": true
        }, {updateChanges: false});
        if (item.type === "vehicle") await this.safeUpdate({"token.actorLink": true}, {updateChanges: false});
        if (item.type === "npc-vehicle") await this.safeUpdate({
            "type": "vehicle",
            "system.isNPC": true
        }, {updateChanges: false});


        // if (userId === game.user._id) {
        //     await updateChanges.call(this);
        // }

        super._onCreate(item, options, userId);

        const automaticFeats = game.settings.get("swse", "automaticItems")
        const featTokens = automaticFeats.split(",").map(f => {
            f = f.trim();
            const toks = f.split(":");
            return {name: toks[1], type: toks[0], granted: "Automatic from system configuration"}
        });
        this.addItems({items: featTokens, provided: true})
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


    setAge(age) {
        this.safeUpdate({'system.age': age}).then(r => {})
    }

    setGender(sex, gender) {
        this.safeUpdate({'system.sex': sex, 'system.gender': gender}).then(r=> {})
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
        if (find?.system.prerequisite) {
            console.error(find);
        }
        return find || false;
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


    getItemsFromRelationships() {
        if (['vehicle', 'npc-vehicle'].includes(this.type)) {
            return this.items.filter(item => item.type === "vehicleSystem" && item.system.subtype && item.system.subtype.toLowerCase() === 'weapon systems' && !!item.system.equipped)
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
     * @param context.newFromCompendium {boolean} is this a new item from the compendium
     * @param context.modifications {[ProvidedItem]}
     * @param context.skipPrerequisite {boolean} should this item ignore prerequisites?
     * @param context.isUpload {boolean} is this part of a bulk upload (TODO we should probably deprecate this and do a better job of generating the upload data)
     * @param context.isFirstLevel {boolean} does this item represent the first level for a character?
     * @param context.provided {boolean} is this a new item from the compendium
     * TODO refactor this
     */
    async checkPrerequisitesAndResolveOptions(entity, context) {

        let choices = await activateChoices(entity, context);
        if (!choices.success) {
            return false;
        }

        if (!context.isUpload && !context.provided && !context.skipPrerequisite) {
            context.actor = this;
            context.entity = entity;
            for (const validator of VALIDATORS) {
                if (!(await validator(context))) {
                    return false;
                }
            }
        }


        let providedItems = entity.getProvidedItems() || [];
        //on uploads add "provide" changes for classFeats

        if(entity.type === "vehicleBaseType"){
            Dialog.confirm({
                title: `Overwrite Vehicle attributes?`,
                content: `<p>Overwriting attributes will overwrite attributes from previous base types.  Would you like to continue?</p>`,
                yes: async (html)=>{
                    await this.applyVehicleAttributes(entity)
                    console.log(this)
            }
            })
            //
            // return await Dialog.prompt({
            //     title: `Overwrite Vehicle attributes?`,
            //     content: `<p>Overwriting attributes will overwrite attributes from previous base types.  Would you like to continue?</p>`,
            //     callback: async (html) => {
            //         let feat = html.find("#feat")[0].value;
            //         await this.addItems(context, [{
            //             type: 'TRAIT',
            //             name: `Bonus Feat (${feat})`
            //         }, {
            //             type: 'FEAT',
            //             name: feat
            //         }], parentItem);
            //         return feat;
            //     }
            // });

            return {addedItem: entity, toBeAdded:[]}
        }

        if (context.isUpload) {
            if (entity.type === "class") {
                let isFirstLevelOfClass = this._isFirstLevelOfClass(entity.name);
                let availableClassFeats = getInheritableAttribute({
                    entity: entity,
                    attributeKey: "availableClassFeats",
                    reduce: "SUM"
                });
                let classFeats = getInheritableAttribute({
                    entity: entity,
                    attributeKey: "classFeat",
                    reduce: "VALUES"
                });
                if (!availableClassFeats) {
                    availableClassFeats = classFeats.length
                }
                if (context.isFirstLevel && availableClassFeats) {
                    SWSEActor.updateOrAddChange(entity, "provides", `${entity.name} Starting Feats:${availableClassFeats}`, true)
                } else if (isFirstLevelOfClass) {
                    entity.system.changes.push({key: "provides", value: `${entity.name} Starting Feats`})
                }

            }

            for (let addProvider of providedItems.filter(i => i.type !== "trait")) {
                SWSEActor.updateOrAddChange(entity, "provides", `${entity.name} ${entity.type} ${addProvider.type}:${addProvider.type.toUpperCase()}:${addProvider.name}`, true)
            }
            providedItems = providedItems.filter(i => i.type === "trait")
        }
        providedItems.push(...choices.items);

        const modifications = context.modifications || [];
        const nonMods = [];
        for (const providedItem of providedItems) {
            if (providedItem.modifier) {
                modifications.push(providedItem);
            } else {
                nonMods.push(providedItem)
            }
        }

        let shouldLazyLoad = entity.type !== "class" && modifications.length === 0 && nonMods.length === 0;
        let addedItem;
        const toBeAdded = [];

        if (shouldLazyLoad) {
            toBeAdded.push(entity.toObject(false))
        } else {
            let providedItemContext = Object.assign({}, context);
            providedItemContext.newFromCompendium = false;
            providedItemContext.provided = true;
            providedItemContext.skipPrerequisite = true;
            addedItem = (await this.createEmbeddedDocuments("Item", [entity.toObject(false)]))[0];
            await this.addItems(providedItemContext, nonMods, addedItem);

            if (entity.type === "class") {
                await this.addClassFeats(addedItem, providedItemContext);
            }

            for (let modification of modifications) {
                let {payload, itemName, entity} = await resolveEntity(modification)
                if (entity) {
                    await addedItem.addItemModificationEffectFromItem(entity, providedItemContext)
                }
            }
        }


        return {addedItem: addedItem, toBeAdded: toBeAdded};
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

    static removeChange(entity, key, forceAdd = false, source = undefined) {
        entity.system.changes = (entity.system.changes || Object.values(entity.system.attributes)).filter(v => v.key !== key && v.source !== source);
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
        }).map(feat => cleanItemName(feat));

        if (feats.length === 0) {
            return;
        }

        let isFirstLevelOfClass = this._isFirstLevelOfClass(item.name);
        let availableClassFeats = getInheritableAttribute({
            entity: item,
            attributeKey: "availableClassFeats",
            reduce: "SUM"
        });

        const currentFeats = this.feats || [];
        if (context.isFirstLevel) {
            if (!(availableClassFeats > 0 && availableClassFeats < feats.length)) {
                await this.addItems(context, feats.map(feat => {
                    return {type: 'TRAIT', name: `Bonus Feat (${feat})`}
                }), item);
                let featString = await this.addItems(context, feats.map(feat => {
                    return {type: 'FEAT', name: feat}
                }), item);


                if (!this.suppressDialog) {
                    new Dialog({
                        title: "Adding Class Starting Feats",
                        content: `Adding class starting feats: <ul>${featString.map(item => item?.name).filter(name => !!name).join(", ")}</ul>`,
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
            }).map(feat => cleanItemName(feat))))

            let ownedFeats = currentFeats.map(f => f.finalName);
            await this.selectFeat(availableFeats, ownedFeats, item, context);
        }
    }

    async selectFeat(availableFeats, ownedFeats, parentItem, context) {
        if (context.itemAnswers) {
            for (const answer of context.itemAnswers) {
                if (availableFeats.includes(answer)) {
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
                await this.addItems(context, [{
                    type: 'TRAIT',
                    name: `Bonus Feat (${feat})`
                }, {
                    type: 'FEAT',
                    name: feat
                }], parentItem);
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
                skills().forEach(skill => {
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
     * @param criteria
     * @param criteria.items {[{name: string,type: string}]}
     * @param items {[{name: string,type: string}] | {name: string, type: string}}
     * @param parent {SWSEItem}
     * @param criteria.returnAdded this flag makes the method return added items
     * @returns {string | [SWSEItem]}
     */
    async addItems(criteria = {}, items, parent) {
        const providedItems = [];
        if (criteria.items) {
            for (const item of criteria.items.filter(item => !!item)) {
                if(item.quantity > 0){
                    for (let i =0; i < item.quantity; i++) {
                        providedItems.push(item)
                    }
                } else {
                    providedItems.push(item)
                }
            }
        }

        if (items) {
            for (const item of items.filter(item => !!item)) {
                providedItems.push(item)
            }
        }

        let notificationMessages = "";
        let addedItems = [];
        const lazyAdd = [];
        for (let providedItem of providedItems.filter(item => (item.name && item.type) || (item.uuid && item.type) || (item.id && item.pack) || item.duplicate)) {
            criteria.items = [];

            if(providedItem.parent){
                parent = providedItem.parent;
            }

            const {notificationMessage, addedItem, toBeAdded} = await this.addItem(providedItem, parent, criteria);
            if (toBeAdded) {
                lazyAdd.push(...toBeAdded);
            }
            notificationMessages += notificationMessage;
            if (addedItem) {
                addedItems.push(addedItem);
            }
        }
        if (lazyAdd.length > 0) {
            addedItems.push(...await this.createEmbeddedDocuments("Item", lazyAdd))
        }

        let addedToFollowers = getInheritableAttribute({entity: addedItems, attributeKey: "followerProvides"})
        if(addedToFollowers.length > 0) {
            for (const linkedActor of this.linkedActors.values()) {
                if(linkedActor.isFollower){
                    await linkedActor.addProvided(addedToFollowers)
                }
            }
        }


        if (criteria.returnAdded) {
            return addedItems;
        }
        return notificationMessages;
    }

    get isFollower(){
        return getInheritableAttribute({entity: this, attributeKey:"follower", reduce: "OR"})
    }


    /**
     *
     * @param provided
     * @return {Promise<void>}
     * TODO is this being used?
     */
    async addProvided(provided){
        const provideTypes = ['FEAT', 'TALENT']
        const providedItems = []
        for (const s of provided) {
            const toks = s.value.split(":");
            const parent = {name: s.sourceString, id: s.source ,type: "UNKNOWN"}

            if(provideTypes.includes(toks[0].toUpperCase())){
                providedItems.push({name: toks[1], type: toks[0], parent: parent})
                continue;
            }

            providedItems.push({name: "Provides ("+s.value+")", type: "trait", system: {changes: [{key: "provides", value: s.value}]}, parent:parent})
            //await this.addChange({key: "provides", value: s.value})
        }
        await this.addItems({items: providedItems, provided: true});
    }

    /**
     *
     * @param item
     * @param parent
     * @param parent.name {String}
     * @param parent.id {String}
     * @param parent.type {String}
     * @param options
     * @return {Promise<{addedItem, notificationMessage: (string|string), toBeAdded: *[]}|{}|{addedItem: undefined, notificationMessage: string}>}
     */
    async addItem(item, parent, options) {
        //TODO FUTURE WORK let namedCrew = item.namedCrew; //TODO Provides a list of named crew.  in the future this should check actor compendiums for an actor to add.
        let {payload, itemName, entity, createdItem} = await resolveEntity(item);

        if (!entity) {
            if (options.suppressWarnings) {
                console.debug(`attempted to add ${JSON.stringify(item)}`)
            } else {
                console.warn(`attempted to add ${JSON.stringify(item)}`)
            }
            return {};
        }
        entity.prepareData();

        if (entity.type === "class") {
            let levels = [0];
            for (let clazz of this.itemTypes.class) {
                levels.push(...(clazz.levelsTaken || []))
            }

            let nextLevel = item.firstLevel ? 1 : Math.max(...levels) + 1

            let existing = this.itemTypes.class.find(item => item.name === entity.name)
            if (existing) {
                let levels = existing.levelsTaken || [];
                levels.push(nextLevel);
                await existing.safeUpdate({"system.levelsTaken": levels});
                let notificationMessage = `<li>Took level of ${existing.name}</li>`
                return {notificationMessage, addedItem: undefined}
            }

            entity.system.levelsTaken = [nextLevel];
        }

        if (entity.type === "feat") {
            const classes = CLASSES_BY_STARTING_FEAT[itemName];
            if (classes) {
                for (let charClass of classes) {
                    entity.system.possibleProviders.push(`${charClass} Starting Feats`)
                }
            }
            if (entity.name === 'Skill Training') {
                SWSEActor.updateOrAddChange(entity, "trainedSkills", "1");
                SWSEActor.removeChange(entity, "automaticTrainedSkill");
            }
        }

        if (entity.type === "trait") {
            if (entity.name === 'Bonus Trained Skill') {
                SWSEActor.updateOrAddChange(entity, "trainedSkills", "1");
                SWSEActor.removeChange(entity, "automaticTrainedSkill");
            }
            if (entity.name === 'Bonus Feat' && !payload) {
                SWSEActor.updateOrAddChange(entity, "provides", "General Feats");
            }
        }

        entity.addItemAttributes(item.changes);
        const providedItems = item.providedItems || [];
        const automaticItemsWhenItemIsAdded = game.settings.get("swse", "automaticItemsWhenItemIsAdded");
        if (automaticItemsWhenItemIsAdded) {
            automaticItemsWhenItemIsAdded.split(",").forEach(entry => {
                const toks = entry.split(">").map(e => e.trim())

                const triggerItem = toks[0].split(":")
                const bonusItem = toks[1].split(":")
                if (entity.name.toLowerCase() === triggerItem[1].toLowerCase() && entity.type.toLowerCase() === triggerItem[0].toLowerCase()) {
                    providedItems.push({name: bonusItem[1], type: bonusItem[0]})
                }

                providedItems.push()
            })
        }
        entity.addProvidedItems(providedItems);
        if (parent) await entity.setParent(parent, item.unlocked);
        else if (item.granted) entity.setGranted(item.granted);
        entity.setPrerequisite(item.prerequisite); //TODO this only sets if it's defined... idk if i like how this works

        //TODO payload should be deprecated in favor of payloads
        if (!!payload) {
            entity.setChoice(payload)
            await entity.setPayload(payload);
        }
        for (let payload of Object.entries(item.payloads || {})) {
            entity.setChoice(payload[1]);
            await entity.setPayload(payload[1], payload[0]);
        }

        let equip = item.equip;
        if (equip) {
            entity.system.equipped = equip
        }

        entity.setTextDescription();
        entity.handleLegacyData()


        delete options.actor;
        let childOptions = JSON.parse(JSON.stringify(options))
        childOptions.itemAnswers = item.answers;
        childOptions.modifications = item.modifications;
        childOptions.actor = this;
        let {addedItem, toBeAdded} = await this.checkPrerequisitesAndResolveOptions(entity, childOptions);

        let notificationMessage = addedItem ? `<li>${addedItem.finalName}</li>` : "";



        return {notificationMessage, addedItem, toBeAdded};
    }

    get warnings() {
        return warningsFromActor(this);
    }

    get errors() {
        return errorsFromActor(this);
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
            let meetsPrereqs = meetsPrerequisites(this, item.system.prerequisite, {isAdd: true});
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
            let meetsPrereqs = meetsPrerequisites(this, item.system.prerequisite, {isAdd: true});
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
    }

    async unequipItem(itemId) {
        let item = this.items.get(itemId);
        item.unequip();
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

    async scrapeExternal(externalLink) {
        // const browser = await puppeteer.launch({
        //     headless: false,
        //     defaultViewport: null,
        // });
        //
        //
        // const page = await browser.newPage();
        // await page.goto(externalLink, {
        //     waitUntil: "domcontentloaded",
        // });
        //
        // await page.evaluate(() =>{
        //     console.log(document)
        // })
    }

    applyConversions(speed, conversions) {
        for (const conversion of conversions) {
            const toks = conversion.split("->");
            for (const splitElement of toks[0].split("/")) {
                speed.type = speed.type.replace(splitElement.trim(), toks[1].trim());
            }
        }
        return speed;
    }

    async applyVehicleAttributes(item) {
        SWSEActor.removeChange(this, undefined, false, "vehicleBaseType")

        const data = {};
        const changes = item.system.changes || Object.values(item.system.attributes || {});
        for (const change of changes) {
                change.source = "vehicleBaseType"
                switch (change.key) {
                    case "vehicleSubType":
                        data['system.subType'] = change.value;
                        break;
                    case "baseStrength":
                        data['system.attributes.str.manual'] = change.value;
                        break;
                    case "baseDexterity":
                        data['system.attributes.dex.manual'] = change.value;
                        break;
                    case "baseIntelligence":
                        data['system.attributes.int.manual'] = change.value;
                        break;
                    case "speedCharacterScale":
                        data['system.vehicle.speed.characterScale'] = change.value;
                        break;
                    case "speedStarshipScale":
                        data['system.vehicle.speed.starshipScale'] = change.value;
                        break;
                    case "hitPointEq":
                        data['system.health.override'] = change.value;
                        break;
                    case "damageThresholdBonus":
                        await this.addChange(change)
                        //data['system.vehicle.damageThresholdBonus'] = change.value;
                        break;
                    case "armorReflexDefenseBonus":
                        await this.addChange(change)
                        //data['system.vehicle.armorReflexDefenseBonus'] = change.value;
                        break;
                    case "cost":
                        data['system.vehicle.cost'] = change.value;
                        break;
                    case "crew":
                        data['system.vehicle.crew'] = change.value;
                        break;
                    case "passengers":
                        data['system.vehicle.passengers'] = change.value;
                        break;
                    case "cargoCapacity":
                        data['system.vehicle.cargoCapacity.capacity'] = change.value;
                        break;
                    case "consumables":
                        data['system.vehicle.consumables'] = change.value;
                        break;
                    case "emplacementPoints":
                        data['system.vehicle.emplacementPoints'] = change.value;
                        break;
                    default:
                        console.log(change.key);
                }
        }
        await this.safeUpdate(data);
    }
}

