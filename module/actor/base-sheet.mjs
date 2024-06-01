import {getDefaultDataByType} from "../common/classDefaults.mjs";
import {
    onChangeControl,
    onEffectControl,
    onToggle
} from "../common/listeners.mjs";
import {
    getCleanListFromCSV,
    getDocumentByUuid,
    getParentByHTMLClass,
    linkEffects,
    numericOverrideOptions,
    onCollapseToggle,
    toChat,
    toNumber,
    unique
} from "../common/util.mjs";
import {SWSECompendiumDirectory} from "../compendium/compendium-directory.mjs";
import {CompendiumWeb} from "../compendium/compendium-web.mjs";
import {Attack} from "./attack/attack.mjs";

// noinspection JSClosureCompilerSyntax

/**
 * Extend the basic ActorSheet with some modifications for SWSE actors
 * @extends {ActorSheet}
 */

export class SWSEActorSheet extends ActorSheet {
    constructor(...args) {
        super(...args);
        this.rollMode = 'publicRoll';
    }

    /** @override */
    static get defaultOptions() {

        return mergeObject(super.defaultOptions, {
            classes: ["swse", "sheet", "actor"],
            width: 1000,
            height: 900,
            closeOnSubmit: false,
            submitOnClose: true,
            submitOnChange: true,
            baseApplication: "ActorSheet",
            tabs: [
                {
                    navSelector: ".sheet-tabs",
                    contentSelector: ".sheet-body",
                    initial: "summary",
                },
            ],
        });
    }

    /** @override */
    get template() {
        const path = "systems/swse/templates/actor";

        let type = this.actor.type;
        if (type === 'computer') {
            return `${path}/computer-sheet.hbs`;
        }
        if (type === 'vehicle') {
            return `${path}/vehicle-sheet.hbs`;
        }
        if (type === 'npc-vehicle') {
            return `${path}/vehicle-sheet.hbs`;
        }
        return `${path}/${type}-sheet.hbs`;
    }

    /* -------------------------------------------- */

    /** @override */
    getData(options) {
        // Retrieve the data structure from the base sheet. You can inspect or log
        // the context variable to see the structure, but some key properties for
        // sheets are the actor object, the data object, whether or not it's
        // editable, the items array, and the effects array.
        const context = super.getData(options);

        // Use a safe clone of the actor data for further operations.
        const actorData = context.data;

        const systemDerived = this.actor.system;

        // Add the actor's data to context.data for easier access, as well as flags.
        context.system = actorData.system;
        context.flags = actorData.flags;

        context.abilities = systemDerived.abilities;
        context.health = actorData.system.health;
        context.shields = actorData.system.shields;
        context.modes = Object.entries(CONST.ACTIVE_EFFECT_MODES).reduce(
            (obj, e) => {
                obj[e[1]] = game.i18n.localize("EFFECT.MODE_" + e[0]);
                return obj;
            },
            {}
        );

        this._prepareBaseActorSheetData(context);

        context.settings = systemDerived.settings;

        return context;
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        //disable submit on enter
        $(document).ready(function() {
            $(window).keydown(function(event){
                if(event.keyCode === 13) {
                    event.preventDefault();
                    return false;
                }
            });
        });

        html.find(".collapse-toggle").on("click", event => onCollapseToggle(event))

        
        // Everything below here is only needed if the sheet is editable
        if (!this.isEditable) return;


        html.find(".toggle").on("click", onToggle.bind(this))
        new ContextMenu(html, ".numeric-override", numericOverrideOptions(this.actor))

        // crew controls
        html.find(".crew-control").click(this._onCrewControl.bind(this));

        // Item Dragging
        html.find(".draggable").each((i, li) => {
            if (li.classList.contains("inventory-header")) return;
            li.setAttribute("draggable", true);
            li.addEventListener("dragstart", (ev) => this._onDragStart(ev), false);
        });

        html.find("div.attack").each((i, div) => {
            div.setAttribute("draggable", true);
            div.addEventListener("dragstart", (ev) => this._onDragStart(ev), false);
            div.addEventListener("click", (ev) => this._onActivateItem(ev), false);
        });
        html.find("#fullAttack").on("click", () => this.object.attack.createAttackDialog(event, {type: "fullAttack"}));

        html.find('.condition-radio').on("click", this._onConditionChange.bind(this))
        html.find('.gravity-radio').on("click", this._onGravityChange.bind(this))

        //TODO merge these using data-action and data-type
        // Add Inventory Item
        html.find('.item-create').click(this._onItemCreate.bind(this));
        // Delete Inventory Item
        html.find('.item-delete').click(this._onItemDelete.bind(this));
        html.find('.item-duplicate').click(this._onDuplicate.bind(this))

        // Rollable abilities.
        html.find('.rollable').click(this._onRoll.bind(this));

        //html.find('[data-action="compendium"]').click(this._onOpenCompendium.bind(this));
        html.find('[data-action="compendium"]').click(SWSECompendiumDirectory.viewCompendiumItemsByFilter.bind(this));
        html.find('[data-action="compendium-web"]').click((e) => {
            let target = e.currentTarget
            let type = target.dataset.type
            let providerSource = target.dataset.providerSource
            if(type){
                type = type.split(",").map(t => t.trim())
            }
            let webFilters = {};

            if(providerSource){
                webFilters['provider-filter'] = providerSource
            }

            new CompendiumWeb({type, webFilters}).render(!0)
        });
        html.find('[data-action="view"]').click(this._onItemEdit.bind(this));
        html.find('[data-action="delete"]').click(this._onItemDelete.bind(this));
        html.find('[data-action="shield"]').click(this._onShield.bind(this));
        html.find('[data-action="decrease-quantity"]').click(this._onDecreaseItemQuantity.bind(this));
        html.find('[data-action="increase-quantity"]').click(this._onIncreaseItemQuantity.bind(this));
        html.find('[data-action="toggle-use"]').click(this._onToggleUse.bind(this));
        html.find('[data-action="create"]').click(this._onCreateNewItem.bind(this));
        html.find('[data-action="quickCreate"]').on("keyup", this._onQuickCreate.bind(this));
        html.find('[data-action="to-chat"]').click(this._onToChat.bind(this));
        html.find('[data-action="change-control"]').click(onChangeControl.bind(this));
        html.find('[data-action="gm-bonus"]').click(this._onAddGMBonus.bind(this));
        html.find('[data-action="effect-control"]').click(onEffectControl.bind(this));
        html.find('[data-action="reload"]').click(this._onReload.bind(this));
    }


    _onReload(event) {
        event.preventDefault();
        event.stopPropagation();
        const a = event.currentTarget;
        const ammoKey = a.dataset.ammoKey;
        const itemId = a.dataset.itemId;
        const item = this.object.items.get(itemId);
        item.ammunition.reload(ammoKey);
    }

    _performItemAction(event){
            const target = $(event.currentTarget)
            const value = event.currentTarget.value;
            const context = target.data("context")

            if (target.data("action") === "update-level-attribute") {

                this.updateItemEffectAttribute(value, target.data("item"), parseInt(target.data("level")), target.data("attribute"), context);
            }
    }

    updateItemEffectAttribute( value, itemId, level, attributeKey, context = undefined) {

        if(context === "health" && game.settings.get("swse", "enableNotificationsOnHealthChange")){
            let content = `${game.user.name} has changed level ${level} health to ${value}`

            toChat(content, this.object)
        }

        const classObject = this.document.items.get(itemId);
        const levelEffect = classObject.level(level);
        let change = levelEffect.changes.find(change => change.key === attributeKey)
        let data = {};

        data.changes = levelEffect.changes;
        if (!change) {
            change = {key: attributeKey, mode: 2, value}
            data.changes.push(change);
        } else {
            change.value = value;
        }
        levelEffect.safeUpdate(data);
        this._render()
    }

    _onToChat(event) {
        event.preventDefault();
        const a = event.currentTarget;
        const type = a.dataset.actionType;

        let content = "";
        switch (type){
            case "defense":
                let defense = this.actor.system.defense;
                content += `<h3>Defenses</h3>`

                for (let value of Object.values(defense)){
                    content += this.defenseToTableRow(value)
                }

                content += `<tr><th>Damage Threshold</th><td>${defense.damageThreshold.total}</td></tr>`
                content += `<tr><th>Damage Reduction</th><td>${defense.damageReduction}</td></tr>`

                let bonusString = ""
                for(let bonus of defense.situationalBonuses){
                    bonusString += bonus;
                }

                content = `<table>${content}</table><ol>${bonusString}</ol>`

                break;
        }
        return toChat(content);
    }



    _onCreateNewItem(event){
        let itemType = $(event.currentTarget).data("action-type")

        this.actor.createEmbeddedDocuments('Item', [{
            name: `New ${itemType}`,
            type: itemType,
            data: getDefaultDataByType(itemType)
        }]);
    }

    _onQuickCreate(event) {
        if (!(event.code === "Enter" || event.code === "NumpadEnter")) {
            return;
        }
        event.stopPropagation();
        let element = $(event.currentTarget);
        let itemType = element.data("action-type");
        const defaultDataByType = getDefaultDataByType(itemType);

        this.actor.createEmbeddedDocuments('Item',
            getCleanListFromCSV(element[0].value).map(name => {
                return {
                name: name,
                type: itemType,
                data: defaultDataByType
            }
        }));
    }

    async _onConditionChange(event) {
        event.stopPropagation();
        await this.object.clearCondition();
        await this.object.setCondition(event.currentTarget.value);
    }

    async _onGravityChange(event) {
        event.stopPropagation();
        await this.object.safeUpdate({"data.gravity": event.currentTarget.value})
    }

    async _onShield(event) {
        event.stopPropagation();
        const type = $(event.currentTarget).data("action-type");
        switch (type) {
            case 'plus':
                if (this.object.type === "character") {
                    this.object.system.shieldValue =
                        this.object.system.shields.value + 5;
                } else {
                    this.object.shields = this.object.shields + 5;
                }
                break;
            case 'minus':
                if (this.object.type === "character") {
                    this.object.system.shieldValue =
                        this.object.system.shields.value - 5;
                } else {
                    this.object.shields = this.object.shields - 5;
                }
                break;
            case 'toggle':
                let ids = this.object.effects
                    .filter(effect => effect.icon?.includes("/shield.svg")).map(effect => effect.id)
                if(ids.length === 0){
                    let statusEffect = CONFIG.statusEffects.find(e => e.id === "shield")
                    await this.object.activateStatusEffect(statusEffect);
                } else {
                    await this.object.deleteEmbeddedDocuments("ActiveEffect", ids);
                }
                break;
        }
    }

    _onDuplicate(event) {
        const li = $(event.currentTarget).parents(".item");
        let itemToDuplicate = this.object.items.get(li.data("itemId"));

        this._onDropItem(event, {item: itemToDuplicate, duplicate: true})
    }

    /** @inheritdoc */
    _onDragStart(event) {
        super._onDragStart(event);
        let dragData = JSON.parse(event.dataTransfer.getData("text/plain") || "{}");

        const elem = event.currentTarget;

        dragData.variable = elem.dataset.variable;
        dragData.label = elem.dataset.label;
        dragData.uuid = elem.dataset.uuid
        dragData.data = JSON.parse(elem.dataset.data)

        if(elem.dataset.type && !dragData.type){
            dragData.type = elem.dataset.type
        }

        dragData.img = elem.dataset.img;
        dragData.itemId = elem.dataset.itemId;
        dragData.providerId = elem.dataset.providerId;
        dragData.actorId = this.actor.id;
        dragData.attacks = elem.dataset.attacks ? JSON.parse(unescape(elem.dataset.attacks)) : [];
        if (this.actor.isToken) {
            dragData.sceneId = canvas.scene.id;
            dragData.tokenId = this.actor.token.id;
        }

        if (dragData.attacks.length > 0) {
            dragData.type = 'attack';
        }

        dragData.sourceContainer = getParentByHTMLClass(event, "item-container");
        dragData.draggableId = event.target.id;


        if(elem.dataset.effectId){
            dragData.effectId = elem.dataset.effectId
            dragData.effectUuid = elem.dataset.uuid
            dragData.type = "ActiveEffect";
        }

        event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
    }

    _onDragOver(ev) {
        ev.preventDefault();
        ev.dataTransfer.dropEffect = "move";
    }

    _onDragEndMovable(ev) {
        ev.preventDefault();
        // Get the id of the target and add the moved element to the target's DOM
        const data = JSON.parse(ev.dataTransfer.getData("text/plain"));
        if (ev.target.children.length === 0 && ev.target.classList.contains("container")) {
            ev.target.appendChild(document.getElementById(data.draggableId));
        }
    }

    buildAgeDialog(sheet) {
        let system = sheet.actor.system;
        let ageEffects = sheet.actor.itemTypes.trait
            .map((trait) => {
                //let prereqs = trait.system.prerequisite.filter(prereq => );
                let prereq = this._prerequisiteHasTypeInStructure(trait.system.prerequisite, 'AGE');
                if (prereq) {
                    return {
                        name: trait.name,
                        low: parseInt(prereq.low),
                        high: prereq.high ? parseInt(prereq.high) : -1,
                        text: prereq.text
                    };
                }
                return undefined;
            }).filter(trait => !!trait);

        ageEffects.sort(
            (a, b) => a.low - b.low);

        let traits = '';
        for (let effect of ageEffects) {
            let current =
                system.details.age >= effect.low &&
                    (system.details.age <= effect.high || effect.high === -1)
                    ? " current"
                    : "";
            traits += `<div class="flex-grow ageRange${current}" data-low="${effect.low}" data-high="${effect.high}">${effect.name}: ${effect.text}</div>`;
        }
        if (traits === '') {
            traits = `<div>This species has no traits related to age.</div>`;
        }
        let content = `<p>Enter your age. Adults have no modifiers:</p><input class="range" id="age" placeholder="Age" type="number" value="${system.details.age}" onfocus="this.select()"><div>${traits}</div>`;

        return {
            title: "Age Selection",
            content: content,
            callback: async (html) => {
                let key = html.find("#age")[0].value;
                sheet.actor.update({ "system.details.age": key });
            },
            render: async (html) => {
                let ageInput = html.find("#age");
                this.moveAgeCursor(html);
                ageInput.on("input", () => {
                    this.moveAgeCursor(html);
                });
            }
        };
    }


    buildGenderDialog(sheet) {
        let system = sheet.actor.system;
        let searchString = "GENDER";
        let genderEffects = sheet.actor.itemTypes.trait
            .filter((trait) =>
                this._prerequisiteHasTypeInStructure(
                    trait.system.prerequisite,
                    searchString
                )
            )
            .map((trait) => {
                let prerequisite = this._prerequisiteHasTypeInStructure(
                    trait.system.prerequisite,
                    searchString
                );

                return {
                    gender: prerequisite.text,
                    name: trait.data.finalName,
                };
            });

        genderEffects.sort((a, b) => (a.gender < b.gender ? 1 : -1));

        let traits = '';
        for (let effect of genderEffects) {
            let current =
                system.details.gender.toLowerCase() === effect.gender
                    ? " current"
                    : "";
            traits += `<div class="flex-grow gender${current}" data-gender="${effect.gender}" >${effect.gender}: ${effect.name}</div>`;
        }
        if (traits === '') {
            traits = `<div>This species has no traits related to sex.</div>`;
        }

        let content = `<p>Enter your sex, some species have traits tied to sex.  Optionally, enter your gender. If included it will be displayed throughout your sheet instead of sex.</p>
<input class="range" id="sex" type="text" placeholder="Sex" value="${system.details.sex}" onfocus="this.select()">
<input class="range" id="gender" type="text" placeholder="Gender" value="${system.details.gender}"onfocus="this.select()">
<div>${traits}</div>`;

        return {
            title: "Gender Selection",
            content: content,
            callback: async (html) => {
                let updates = {};

                let gender = html.find("#gender")[0].value;
                if (gender) updates["system.details.gender"] = gender;

                let sex = html.find("#sex")[0].value;
                if (sex) updates["system.details.sex"] = sex;

                if (!foundry.utils.isEmpty(updates))
                    sheet.actor.update(updates);
            },
            render: async (html) => {
                let genderInput = html.find("#sex");
                this.moveGenderCursor(html);
                genderInput.on("input", () => {
                    this.moveGenderCursor(html);
                });
            },
        };
    }

    moveAgeCursor(html) {
        let age = parseInt(html.find("#age")[0].value);
        let rangeDivs = html.find(".ageRange")
        for (let div of rangeDivs) {
            let low = parseInt($(div).data("low"));
            let high = parseInt($(div).data("high"));

            if (div.classList.contains("cursor")) {
                div.classList.remove("cursor")
            }
            if (age >= low && (age <= high || high === -1)) {
                div.classList.add("cursor")
            }
        }
    }

    moveGenderCursor(html) {
        let gender = html.find("#sex")[0].value;
        let rangeDivs = html.find(".gender")
        for (let div of rangeDivs) {
            if (div.classList.contains("cursor")) {
                div.classList.remove("cursor")
            }
            if (gender.toLowerCase() === $(div).data('gender').toLowerCase()) {
                div.classList.add("cursor")
            }
        }
    }

    getPointBuyTotal() {
        if (this.actor.isDroid) {
            return CONFIG.SWSE.droidAbilityPointBuyTotal;
        }
        return CONFIG.SWSE.defaultAbilityPointBuyTotal;
    }

    updateTotal(html) {
        let values = this.getTotal(html);

        html.find(".adjustable-total").each((i, item) => {
            item.innerHTML = values.total
        })
        html.find(".attribute-total").each((i, item) => {
            let att = item.dataset.attribute
            item.innerHTML = parseInt(values[att]) + parseInt(item.dataset.bonus);
        })
    }

    getTotal(html) {
        let abilityCost = CONFIG.SWSE.Abilities.abilityCost;
        let response = {};
        let total = 0;
        html.find(".adjustable-value").each((i, item) => {
            total += abilityCost[item.innerHTML];
            response[item.dataset["label"]] = item.innerHTML;
        })
        response.total = total;
        return response;
    }


    _updateObject(event, formData) {
        const source = this.object.toObject();

        if (source.system.settings.abilityGeneration?.value === "Manual") {
            formData['system.abilities.str.base'] = toNumber(formData['system.abilities.str.base']);
            formData['system.abilities.dex.base'] = toNumber(formData['system.abilities.dex.base']);
            formData['system.abilities.con.base'] = toNumber(formData['system.abilities.con.base']);
            formData['system.abilities.wis.base'] = toNumber(formData['system.abilities.wis.base']);
            formData['system.abilities.int.base'] = toNumber(formData['system.abilities.int.base']);
            formData['system.abilities.cha.base'] = toNumber(formData['system.abilities.cha.base']);
        }

        let formExpandData = foundry.utils.expandObject(formData);

        let sourceDiff = foundry.utils.diffObject(source, formExpandData, { inner: true });

        if (foundry.utils.isEmpty(sourceDiff)) {
            let formDiff = foundry.utils.diffObject(source, formExpandData);
            super._updateObject(event, formDiff);
            // this.render();
        }
        else {
            this.object.update(sourceDiff);
        }
    }

    _adjustItemAttributeBySpan(event) {
        event.preventDefault();
        const el = event.currentTarget;

        this._mouseWheelAdd(event.originalEvent, el);
        const value = el.tagName.toUpperCase() === "INPUT" ? Number(el.value) : Number(el.innerText);

        let item = el.getAttribute("item");
        if (el.dataset.item) {
            item = el.dataset.item;
        }
        let itemAttribute = el.getAttribute("itemAttribute");
        if (el.dataset.itemAttribute) {
            itemAttribute = el.dataset.itemAttribute;
        }

        if (item) {
            let updateTarget = this.actor.items.get(item);
            updateTarget.setAttribute(itemAttribute, value);
        }

        // Update on lose focus
        if (event.originalEvent instanceof MouseEvent) {
            if (!this._submitQueued) {
                $(el).one("mouseleave", (event) => {
                    this._onSubmit(event);
                });
            }
        } else this._onSubmit(event);
    }

    _mouseWheelAdd(event, el) {
        const isInput = el.tagName.toUpperCase() === "INPUT";

        if (event && event instanceof WheelEvent) {
            const value = (isInput ? parseFloat(el.value) : parseFloat(el.innerText)) || 0;
            if (Number.isNaN(value)) return;

            const increase = -Math.sign(event.deltaY);
            const amount = parseFloat(el.dataset.wheelStep) || 1;

            if (isInput) {
                el.value = value + amount * increase;
            } else {
                el.innerText = (value + amount * increase).toString();
            }
        }
    }

    async _onDropItem(ev, data) {
        ev.preventDefault();
        if (!this.actor.isOwner) return false;
        //the dropped item has an owner
        if (data.actorId) {
            if (data.actorId === this.actor.id) {
                await this.moveExistingItemWithinActor(data, ev);
                return;
            } else {
                //TODO implement logic for dragging to another character sheet
                let sourceActor = game.actors.find(actor => actor.id === data.actorId);
                await sourceActor.removeItem(data.itemId)
            }
        }

        await this.object.addItems({
            newFromCompendium: true,
            answers: data.answers,
            items: [data]
        });

    }

    async _onDropActiveEffect(event, data) {
        let targetEffect = getParentByHTMLClass(event, "effect")
        if(targetEffect){
            let droppedItem;
            try {
                droppedItem = JSON.parse(event.dataTransfer.getData("text/plain"));
            } catch (err) {
                console.error(`Parsing error: ${event.dataTransfer.getData("text/plain")}`)
                return false;
            }
            droppedItem.targetEffectUuid = targetEffect.dataset.uuid;
            if(droppedItem.effectUuid && droppedItem.targetEffectUuid){
                linkEffects.call(this.item, droppedItem.effectUuid, droppedItem.targetEffectUuid);
                return false;
            }
        }


        const effect = await ActiveEffect.implementation.fromDropData(data);
        if ( !this.actor.isOwner || !effect ) return false;
        if ( this.actor.uuid === effect.parent?.uuid ) return false;
        return ActiveEffect.create(effect.toObject(), {parent: this.actor});
    }

    _onAddGMBonus(){
        this.object.addItems({items: [{name: "GM Bonus", type: "trait"}]})
    }

    async moveExistingItemWithinActor(data, ev) {
        if (data.modId) {
            let movedItem = this.actor.items.get(data.modId);
            let parentItem = this.actor.items.get(data.itemId);
            await parentItem.revokeOwnership(movedItem);
        } else {
            //equip/unequip workflow
            let targetItemContainer = getParentByHTMLClass(ev, "item-container");

            if (targetItemContainer == null) {
                return;
            }
            const containerId = $(targetItemContainer).data("containerId");
            let itemId = data.itemId;
            let item = this.object.items.get(itemId);

            //This type does not allow weapon systems
            let equipTypes = ["equipped", "installed"];
            let weaponSystemOnlyTypes = ["pilotInstalled"];
            let gunnerPositions = this.actor.gunnerPositions || [];
            weaponSystemOnlyTypes.push(...gunnerPositions.filter(e => !!e.id).map(e => e.id).filter(unique));

            let unequipTypes = ["unequipped", "uninstalled"];


            if(unequipTypes.includes(containerId)){
                await this.object.unequipItem(itemId, ev);
            } else if(containerId === "new-gunner"){
                if (item.system.subtype.toLowerCase() !== "weapon systems") {
                    this.onlyAllowsWeaponsDialog();
                    return;
                }
                let types = this.object.getEquipTypes().filter(e=> !!e);
                let equipType;
                for (let i = 0; i <= types.length; i++) {
                    equipType = `gunnerInstalled${i}`;
                    if (!types.includes(equipType)) {
                        break;
                    }
                }
                await this.object.equipItem(itemId, equipType, {event:ev, offerOverride:true});

            } else if(equipTypes.includes(containerId)){
                if (item.system.subtype.toLowerCase() === "weapon systems") {
                    this.onlyAllowsWeaponsDialog(false);
                } else {
                    await this.object.equipItem(itemId, containerId, {event:ev});
                }
            } else if(weaponSystemOnlyTypes.includes(containerId)){
                if (item.system.subtype.toLowerCase() === "weapon systems") {
                    await this.object.equipItem(itemId, containerId, {event:ev, offerOverride:true});
                } else {
                    this.onlyAllowsWeaponsDialog();
                }
            } else {
                //ui.notifications.
                console.warn(`${containerId} is an unknown equip type`)
            }
        }
    }




    /* -------------------------------------------- */

    /**
     * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
     * @param {Event} event   The originating click event
     * @private
     */
    _onItemCreate(event) {
        event.preventDefault();

        const header = event.currentTarget;
        // Get the type of item to create.
        const type = header.dataset.type;
        // Grab any data associated with this control.
        const data = duplicate(header.dataset);
        // Initialize a default name.
        const name = `New ${type.capitalize()}`;
        // Prepare the item object.
        const itemData = {
            name: name,
            type: type,
            data: data
        };
        // Remove the type from the dataset since it's in the itemData.type prop.
        delete itemData.data["type"];

        // Finally, create the item!
        return this.actor.createOwnedItem(itemData);
    }

    /**
     * Handle clickable rolls.
     * 
     *      dataset for Element:
     * data-roll : required - the roll string
     * data-variable
     * data-label
     * data-item
     * data-level
     * data-itemAttribute
     * data-context
     * data-name
     * 
     * @param {Event} event   The originating click event
     * @private
     */
    _onRoll(event) {
        event.preventDefault();
        const element = event.currentTarget;

        let draggable = getParentByHTMLClass(event, "draggable")
        if (draggable) {
            this.actor.rollVariable(draggable.dataset.variable)
            return;
        }

        const dataset = element.dataset;
        if (!dataset.roll) return;

        let rolls = [dataset.roll];
        if (dataset.roll.includes(",")) {
            rolls = dataset.roll.split(",");
        }
        for (let rollStr of rolls) {
            let roll = new Roll(rollStr, this.actor.system);
            let label = dataset.label ? `${this.name} rolls for ${label}!` : '';
            roll = roll.roll({async: false});
            let item = dataset.item;
            let level = dataset.level
            const attributeKey = dataset.itemAttribute;
            if (attributeKey) {
                if (item && level) {

                    const context = element.dataset.context
                    this.updateItemEffectAttribute(roll.total, item, parseInt(level), attributeKey, context);
                } else if (item){
                    let updateTarget = this.actor.items.get(item);
                    updateTarget.setAttribute(attributeKey, roll.total);
                }
            } else if (dataset.name) {
                let updateCandidate = this.actor;
                if (item) {
                    updateCandidate = this.actor.items.get(item);
                }

                let update = {};
                update[dataset.name] = roll.total;
                updateCandidate.safeUpdate(update);
            } else {
                let speaker = ChatMessage.getSpeaker({actor: this.actor});

                let messageData = {
                    user: game.user.id,
                    speaker: speaker,
                    flavor: label,
                    type: CONST.CHAT_MESSAGE_TYPES.ROLL,
                    content: roll.total,
                    sound: CONFIG.sounds.dice,
                    roll
                }

                let cls = getDocumentClass("ChatMessage");
                let msg = new cls(messageData);
                
                return cls.create(msg, {rollMode:this.rollMode});
            }
        }
    }

    async _onCrewControl(event) {
        event.preventDefault();
        const a = event.currentTarget;

        // Delete race
        if (a.classList.contains("crew-remove")) {
            const uuid = $(a).data("uuid");
            let actor = getDocumentByUuid(uuid);
            await this.object.removeActorLink(actor);
        }
    }

    _onOpenCompendium(event) {
        event.preventDefault();
        const a = event.currentTarget;
        const target = a.dataset.actionTarget;
        let newVar = game.packs.filter(pack => pack.collection.startsWith(target))[0];
        //console.log(newVar)
        newVar.render(true);
    }

    /**
     * Handle deleting an existing Owned Item for the Actor
     * @param {Event} event   The originating click event
     * @private
     */
    async _onItemDelete(event) {
        event.preventDefault();
        const button = event.currentTarget;
        if (button.disabled) return;

        const li = $(button).closest(".item");

        let itemId = button.dataset.itemId || li.data("itemId");
        let itemToDelete = this.actor.items.get(itemId);
        if (game.keyboard.downKeys.has("Shift")) {
            await this.object.removeItem(itemId);
        } else {
            button.disabled = true;

            let title = `Are you sure you want to delete ${itemToDelete.finalName}`;
            await Dialog.confirm({
                title: title,
                content: title,
                yes: async () => {
                    await this.object.removeItem(itemId);
                    button.disabled = false
                },
                no: () => (button.disabled = false),
            });
        }
    }

    /**
     * Handle editing an existing Owned Item for the Actor
     * @param {Event} event   The originating click event
     * @private
     */
    _onItemEdit(event) {
        event.preventDefault();
        const li = event.currentTarget.closest(".item");
        const item = this.actor.items.get(li.dataset.itemId);
        item.sheet.render(true);
    }

    _onDecreaseItemQuantity(event) {
        event.preventDefault();
        const li = event.currentTarget.closest(".item");
        const item = this.actor.items.get(li.dataset.itemId);
        item.decreaseQuantity();
    }
    _onIncreaseItemQuantity(event) {
        event.preventDefault();
        const li = event.currentTarget.closest(".item");
        const item = this.actor.items.get(li.dataset.itemId);
        item.increaseQuantity();
    }

    _onToggleUse(event) {
        event.preventDefault();
        let toggle = event.currentTarget.checked
        let key = event.currentTarget.dataset.name
        const li = event.currentTarget.closest(".item");
        const item = this.actor.items.get(li.dataset.itemId);
        item.toggleUse(key, toggle)
    }

    // _unavailable() {
    //     Dialog.prompt({
    //         title: "Sorry this content isn't finished.",
    //         content: "Sorry, this content isn't finished.  if you have an idea of how you think it should work please let me know.",
    //         callback: () => {
    //         }
    //     })
    // }

    _prerequisiteHasTypeInStructure(prereq, type) {
        if (!prereq) {
            return false;
        }
        if (prereq.type === type) {
            return prereq;
        }
        if (prereq.children) {
            for (let child of prereq.children) {
                let prerequisiteHasTypeInStructure = this._prerequisiteHasTypeInStructure(child, type);
                if (prerequisiteHasTypeInStructure) {
                    return prerequisiteHasTypeInStructure;
                }
            }
        }
        return false;
    }

    _onActivateItem(ev) {
        let elem = ev.currentTarget;
        let attacks = Attack.fromJSON(elem.dataset.attacks);

        this.object.attack.createAttackDialog(ev, {type: "singleAttack", attacks});
    }

    onlyAllowsWeaponsDialog(weaponOnly = true) {
        if(this.object.suppressDialog){return;}
        if (weaponOnly) {
            new Dialog({
                title: "Weapon Systems Only",
                content: `This slot only allows weapon systems to be added at this time.`,
                buttons: {
                    ok: {
                        icon: '<i class="fas fa-check"></i>',
                        label: 'Ok'
                    }
                }
            }).render(true);
        } else {

            new Dialog({
                title: "Weapon Systems Not Allowed",
                content: `This slot does not allow weapon systems to be added at this time.`,
                buttons: {
                    ok: {
                        icon: '<i class="fas fa-check"></i>',
                        label: 'Ok'
                    }
                }
            }).render(true);
        }
    }

    onlyAllowsAstromechsDialog() {
        new Dialog({
            title: "Astromech Droids Only",
            content: `This slot only allows Astromech droids and other 2nd-Degree droids to be added at this time.`,
            buttons: {
                ok: {
                    icon: '<i class="fas fa-check"></i>',
                    label: 'Ok'
                }
            }
        }).render(true);
    }

    defenseToTableRow(value) {
        const strings = Object.keys(value);
        let rows = []
        if (strings.includes('name') && strings.includes('total')){
            rows.push(`<tr><th>${value.name}</th><td>${value.total}</td></tr>`)
            for(let defenseModifier of value.defenseModifiers || []){
                rows.push(this.defenseToTableRow(defenseModifier))
            }
        }
        return rows.join("");
    }

    _prepareBaseActorSheetData(context) {

        //********************************
        //Add ability labels
        for (let [key, ability] of Object.entries(CONFIG.SWSE.abilities)) {
            context.abilities[key].label = ability.label;
            context.abilities[key].abbrev = ability.abbreviation;
        }

        //********************************
        //Add defense data
        // for (let [key, defense] of Object.entries(CONFIG.SWSE.defenses)) {
        // 	context.defense[key].label = defense.label;
        // 	context.defense[key].abbrev = key;
        // }

        //********************************
        //Add grapple
        context.grapple = this.actor.grapple;

        //********************************
        //Add speed
        context.speed = this.actor.speed;

        //********************************
        //Add shield active
        let shieldEffect = context.effects.find(
            (effect) =>
                !!effect &&
                !!effect.statuses?.find((status) => status.startsWith("shield"))
        );
        context.shields.active = shieldEffect ? true : false;

        //********************************
        //Add Condition status
        context.condition = 0;
        let conditionEffect = context.effects.find(
            (effect) =>
                !!effect &&
                !!effect.statuses?.find((status) =>
                    status.startsWith("condition")
                )
        );

        if (conditionEffect) {
            context.condition = conditionEffect.changes.find(
                (change) => change.key === "condition"
            ).value;
        }
    }
}
