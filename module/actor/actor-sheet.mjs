import {
    filterItemsByType,
    getCleanListFromCSV,
    getDocumentByUuid,
    getParentByHTMLClass,
    linkEffects,
    numericOverrideOptions,
    onCollapseToggle,
    toChat,
    unique
} from "../common/util.mjs";
import {vehicleActorTypes} from "../common/constants.mjs";
import {Attack} from "./attack/attack.mjs";
import {addSubCredits, transferCredits} from "./credits.mjs";
import {SWSECompendiumDirectory} from "../compendium/compendium-directory.mjs";
import {
    changeCheckbox,
    changeSelect,
    changeText,
    onChangeControl,
    onEffectControl,
    onSpanTextInput,
    onToggle
} from "../common/listeners.mjs";
import {getDefaultDataByType} from "../common/classDefaults.mjs";
import {CompendiumWeb} from "../compendium/compendium-web.mjs";

// noinspection JSClosureCompilerSyntax

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */

export class SWSEActorSheet extends ActorSheet {
    constructor(...args) {
        super(...args);
        this._pendingUpdates = {};
    }


    /** @override */
    static get defaultOptions() {

        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["swse", "sheet", "actor"],
            width: 1000,
            height: 900,
            tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "summary"}]
        });
    }

    get template() {
        const path = "systems/swse/templates/actor";

        let type = this.actor.type;
        if (type === 'character') {
            return `${path}/actor-sheet.hbs`;
        }
        if (type === 'npc') {
            return `${path}/actor-sheet.hbs`;
        }
        if (type === 'computer') {
            return `${path}/computer-sheet.hbs`;
        }
        if (type === 'vehicle') {
            return `${path}/vehicle-sheet.hbs`;
        }
        if (type === 'npc-vehicle') {
            return `${path}/vehicle-sheet.hbs`;
        }

        return `${path}/actor-sheet.hbs`;
    }

    /* -------------------------------------------- */

    /** @override */
    getData(options) {
        let data = super.getData(options);

        data.modes = Object.entries(CONST.ACTIVE_EFFECT_MODES).reduce((obj, e) => {
            obj[e[1]] = game.i18n.localize("EFFECT.MODE_"+e[0]);
            return obj;
        }, {})
        return data;
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


        html.find("select.direct").on("change", changeSelect.bind(this));
        html.find("input[type=text].direct").on("change", changeText.bind(this));
        html.find("input[type=number].direct").on("change", changeText.bind(this));
        html.find("input[type=checkbox].direct").on("click", changeCheckbox.bind(this));

        html.find("span.text-box.item-attribute").on("click", (event) => {
            onSpanTextInput.call(this, event, this._adjustItemAttributeBySpan.bind(this), "text");
        });
        // Add general text box (span) handler
        html.find("span.text-box.direct").on("click", (event) => {
            onSpanTextInput.call(this, event, this._adjustActorPropertyBySpan.bind(this), "text");
        });
        html.find("span.text-box.item-action").on("click", (event) => {
            onSpanTextInput.call(this, event, this._performItemAction.bind(this), "text");
        });
        html.find("input.input").on("keyup", (event) => {

            if (event.code === 'Enter' || event.code === 'NumpadEnter') {
                this._adjustActorPropertyBySpan.bind(this)

            }
        });
        // html.find("input.plain").on("keypress", (event) => {
        //     if (event.code === 'Enter' || event.code === 'NumpadEnter') {
        //         event.stopPropagation();
        //         //if (!changed) {
        //         this._onSubmit(event);
        //         //}
        //     }
        // });

        // html.find("input.direct").on("click", (event) => {
        //     this._pendingUpdates['data.classesfirst'] = event.target.value;
        // });

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

        html.find("#selectWeight").on("click", () => this._unavailable());
        html.find("#selectHeight").on("click", () => this._unavailable());

        html.find(".rollAbilities").on("click", async event => this._selectAttributeScores(event, this, {}, true));
        html.find(".assignStandardArray").on("click", async event => this._selectAttributeScores(event, this, CONFIG.SWSE.Abilities.standardScorePackage, false));
        html.find(".assignAttributePoints").on("click", event => this._assignAttributePoints(event, this));
        html.find(".assignManual").on("click", async event => this._selectAttributesManually(event, this));
        html.find(".leveledAttributeBonus").each((i, button) => {
            button.addEventListener("click", (event) => this._selectAttributeLevelBonuses(event, this));
        })

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
        html.find('[data-action="credit"]').click(this._onCredit.bind(this));
        html.find('[data-action="shield"]').click(this._onShield.bind(this));
        html.find('[data-action="decrease-quantity"]').click(this._onDecreaseItemQuantity.bind(this));
        html.find('[data-action="increase-quantity"]').click(this._onIncreaseItemQuantity.bind(this));
        html.find('[data-action="toggle-use"]').click(this._onToggleUse.bind(this));
        html.find('[data-action="toggle-second-wind"]').click(this._onToggleSecondWind.bind(this));
        html.find('[data-action="create"]').click(this._onCreateNewItem.bind(this));
        html.find('[data-action="quickCreate"]').on("keyup", this._onQuickCreate.bind(this));
        html.find('[data-action="to-chat"]').click(this._onToChat.bind(this));
        html.find('[data-action="change-control"]').click(onChangeControl.bind(this));
        html.find('[data-action="gm-bonus"]').click(this._onAddGMBonus.bind(this));
        html.find('[data-action="level-up-bonus"]').click(this._onAddLevelUpBonus.bind(this));
        html.find('[data-action="effect-control"]').click(onEffectControl.bind(this));
        html.find('[data-action="gender"]').on("click", event => this._selectGender(event, this));
        html.find('[data-action="age"]').on("click", event => this._selectAge(event, this));
        html.find('[data-action="remove-class-level"]').on("click", event => this.removeClassLevel(event, this));
        html.find('[data-action="reload"]').click(this._onReload.bind(this));

        html.find('.dark-side-button').click(ev => {
            this.actor.darkSideScore = $(ev.currentTarget).data("value");
        });

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

    _onCredit(event) {
        let type = $(event.currentTarget).data("action-type")

        if ('add' === type || 'sub' === type) {
            addSubCredits(type, this.actor);
        } else if ('transfer' === type) {
            transferCredits(this.actor);
        }
    }

    async _onConditionChange(event) {
        event.stopPropagation();
        await this.object.clearCondition();
        await this.object.setCondition(event.currentTarget.value);
    }

    async _onGravityChange(event) {
        event.stopPropagation();
        await this.object.safeUpdate({"system.gravity": event.currentTarget.value})
    }

    async _onShield(event) {
        event.stopPropagation();
        const type = $(event.currentTarget).data("action-type");
        switch (type) {
            case 'plus':
                this.object.shields = this.object.shields + 5
                break;
            case 'minus':
                this.object.shields = this.object.shields - 5
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

    async _selectAge(event, sheet) {
        let options = this.buildAgeDialog(sheet);
        await Dialog.prompt(options);
    }


    async _selectGender(event, sheet) {
        let options = this.buildGenderDialog(sheet);
        await Dialog.prompt(options);
    }

    buildAgeDialog(sheet) {
        let age = sheet.actor.system.age ? parseInt(sheet.actor.system.age) : 0;
        let ageEffects = filterItemsByType(sheet.actor.items.values(), "trait")
            .map(trait => {
                //let prereqs = trait.system.prerequisite.filter(prereq => );
                let prereq = this._prerequisiteHasTypeInStructure(trait.system.prerequisite, 'AGE')
                if (prereq) {
                    return {
                        name: trait.name,
                        low: parseInt(prereq.low),
                        high: prereq.high ? parseInt(prereq.high) : -1,
                        text: prereq.text
                    }
                }
                return undefined;
            }).filter(trait => !!trait)

        ageEffects.sort(
            (a, b) => a.low - b.low);

        let traits = '';
        for (let effect of ageEffects) {
            let current = age >= effect.low && (age <= effect.high || effect.high === -1) ? ' current' : '';
            traits += `<div class="flex-grow ageRange${current}" data-low="${effect.low}" data-high="${effect.high}">${effect.name}: ${effect.text}</div>`;
        }
        if (traits === '') {
            traits = `<div>This species has no traits related to age.</div>`;
        }
        let content = `<p>Enter your age. Adults have no modifiers:</p><input class="range" id="age" placeholder="Age" type="number" value="${age}"><div>${traits}</div>`

        return {
            title: "Age Selection",
            content: content,
            callback: async (html) => {
                let key = html.find("#age")[0].value;
                sheet.actor.setAge(key);
            },
            render: async (html) => {
                let ageInput = html.find("#age");
                this.moveAgeCursor(html);
                ageInput.on("input", () => {
                    this.moveAgeCursor(html);
                })
            }
        };
    }


    buildGenderDialog(sheet) {
        let sex = sheet.actor.system.sex ? sheet.actor.system.sex : "";
        let gender = sheet.actor.system.gender ? sheet.actor.system.gender : "";
        let searchString = "GENDER";
        let genderEffects = filterItemsByType(sheet.actor.items.values(), "trait")
            .filter(trait => this._prerequisiteHasTypeInStructure(trait.system.prerequisite, searchString)).map(trait => {
                let prerequisite = this._prerequisiteHasTypeInStructure(trait.system.prerequisite, searchString)

                return {
                    gender: prerequisite.text,
                    name: trait.data.finalName
                }
            })

        genderEffects.sort(
            (a, b) =>
                a.gender <
                b.gender ? 1 : -1);

        let traits = '';
        for (let effect of genderEffects) {
            let current = gender.toLowerCase() === effect.gender ? ' current' : '';
            traits += `<div class="flex-grow gender${current}" data-gender="${effect.gender}" >${effect.gender}: ${effect.name}</div>`;
        }
        if (traits === '') {
            traits = `<div>This species has no traits related to sex.</div>`;
        }

        let content = `<p>Enter your sex, some species have traits tied to sex.  Optionally, enter your gender. If included it will be displayed throughout your sheet instead of sex.</p>
<input class="range" id="sex" type="text" placeholder="Sex" value="${sex}">
<input class="range" id="gender" type="text" placeholder="Gender" value="${gender}">
<div>${traits}</div>`

        return {
            title: "Gender Selection",
            content: content,
            callback: async (html) => {
                sheet.actor.setGender(html.find("#sex")[0].value, html.find("#gender")[0].value);
            },
            render: async (html) => {
                let genderInput = html.find("#sex");
                this.moveGenderCursor(html);
                genderInput.on("input", () => {
                    this.moveGenderCursor(html);
                })
            }
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
            return CONFIG.SWSE.Abilities.droidPointBuyTotal;
        }
        return CONFIG.SWSE.Abilities.defaultPointBuyTotal;
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
        // Translate CR
        const cr = formData["system.details.cr.base"];
        if (typeof cr === "string") formData["system.details.cr.base"] = CR.fromString(cr);

        // Update from elements with 'data-name'
        {
            const elems = this.element.find("*[data-name]");
            let changedData = {};
            for (const el of elems) {
                const name = el.dataset.name;
                let value;
                if (el.nodeName === "INPUT") {
                    switch (el.type) {
                        case "checkbox":
                            value = el.checked;
                            break;
                        default:
                            value = el.value;
                    }
                } else if (el.nodeName === "SELECT") value = el.options[el.selectedIndex].value;

                if (el.dataset.dtype === "Number") value = Number(value);
                else if (el.dataset.dtype === "Boolean") value = Boolean(value);

                if (foundry.utils.getProperty(this.actor, name) !== value) {
                    changedData[name] = value;
                }
            }

            for (let [k, v] of Object.entries(changedData)) {
                formData[k] = v;
            }
        }

        // Add pending updates
        for (let [k, v] of Object.entries(this._pendingUpdates)) {
            formData[k] = v;
        }
        this._pendingUpdates = {};

        return super._updateObject(event, formData);
    }

    _adjustActorPropertyBySpan(event) {
        event.preventDefault();
        const el = event.currentTarget;

        this._mouseWheelAdd(event.originalEvent, el);
        const value = el.tagName.toUpperCase() === "INPUT" ? Number(el.value) : Number(el.innerText);

        let name = el.getAttribute("name");
        if (el.dataset.name) {
            name = el.dataset.name;
        }

        if (name) {
            let updateTarget = this.actor;
            if (el.dataset.item) {
                updateTarget = this.actor.items.get(el.dataset.item)
            }
            let data = {};
            data[name] = value;
            updateTarget.safeUpdate(data);
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

    _adjustItemAttributeBySpan(event) {
        event.preventDefault();
        const el = event.currentTarget;

        this._mouseWheelAdd(event.originalEvent, el);
        const value = el.tagName.toUpperCase() === "INPUT" ? Number(el.value) : Number(el.innerText);

        // let name = el.getAttribute("name");
        // if (el.dataset.name) {
        //     name = el.dataset.name;
        // }
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

    async _onDropActor(event, data) {
        event.preventDefault();
        if (!this.actor.isOwner) return false;

        if (!vehicleActorTypes.includes(this.actor.type)) {
            return;
        }
        let actor = getDocumentByUuid(data.uuid);
        if (!["character", "npc"].includes(actor.type)) {
            return;
        }
        let targetItemContainer = getParentByHTMLClass(event, "vehicle-station");

        if (targetItemContainer === null) {
            return;
        }

        const postion = $(targetItemContainer).data('position');
        const slot = $(targetItemContainer).data('slot');
        if(!postion){
            console.error("no position associated with the activated crew slot")
            return;
        }

        if (postion === 'Astromech Droid') {
            if (actor.species.name !== 'Astromech Droid' && actor.species.name !== '2nd-Degree Droid Model') {
                this.onlyAllowsAstromechsDialog();
                return;
            }
        }

                //if (!this.object.crewMembers.find(crewMember => crewMember.position === postion && crewMember.slot === slot)) {
                    //await this.removeCrewFromPositions(actor, actor.id, crewPositions);
        //await this.object.removeActorLink(actor)
        await this.object.addActorLink(actor,postion, slot);
                //}
    }

    async _onDropItem(ev, data) {
        if(ev) ev.preventDefault();
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

    _onAddLevelUpBonus(){
        if(this.object.isHeroic){
            this.object.addItems({items: [{name: "Heroic Ability Score Level Bonus", type: "trait"}]})
        } else {
            this.object.addItems({items: [{name: "Nonheroic Ability Score Level Bonus", type: "trait"}]})
        }
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
                //let types = this.object.system.equippedIds.filter(e => e.type.startsWith("gunnerInstalled")).map(e => e.type === "gunnerInstalled" ? 0 : parseInt(e.type.replace("gunnerInstalled", ""))).filter(unique);
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
     * @param {Event} event   The originating click event
     * @private
     */
    async _onRoll(event) {
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
            roll = await roll.roll();
            let item = dataset.item;
            let level = dataset.level
            const attributeKey = dataset.itemAttribute;
            if (attributeKey) {
                if (item && level) {

                    const context = element.dataset.context
                    this.updateItemEffectAttribute(roll.total, item, parseInt(level), attributeKey, context);
                } else if (item) {
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
                // roll.toMessage({
                //     speaker: speaker,
                //     flavor: label, flags: {f1: "thing"}
                // });


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
                //if (rollMode) msg.applyRollMode(rollMode);

                return cls.create(msg.data);
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

        let itemId = li.data("itemId");
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
    async removeClassLevel(event, sheet) {
        event.preventDefault();
        const button = event.currentTarget;
        if (button.disabled) return;

        const li = $(button).closest(".item");

        let itemId = li.data("itemId");
        let itemToDelete = this.actor.items.get(itemId);
        if (game.keyboard.downKeys.has("Shift") || game.keyboard.downKeys.has("ShiftLeft")) {
            await this.object.removeClassLevel(itemId);
        } else {
            button.disabled = true;

            let title = `Are you sure you want to delete ${itemToDelete.finalName}`;
            await Dialog.confirm({
                title: title,
                content: title,
                yes: async () => {
                    await this.object.removeClassLevel(itemId);
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
    _onToggleSecondWind(event) {
        event.preventDefault();
        let toggle = event.currentTarget.checked
        let key = event.currentTarget.dataset.name
        let data = {};
        data[key] = toggle
        this.actor.safeUpdate(data)
        //const li = event.currentTarget.closest(".item");
        // const item = this.actor.items.get(li.dataset.itemId);
        // item.toggleUse(key, toggle)
    }

    /**
     *
     * @param event
     * @param sheet {SWSEActorSheet}
     * @param scores
     * @param canReRoll
     * @returns {Promise<void>}
     * @private
     */
    async _selectAttributeScores(event, sheet, scores, canReRoll) {
        if (Object.keys(scores).length === 0) {
            let existingValues = sheet.actor.getAttributeBases();

            scores = {str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8};
            for (let val of Object.keys(existingValues)) {
                scores[val] = existingValues[val];
            }
        }

        let data = {
            canReRoll,
            abilities: CONFIG.SWSE.Abilities.droidSkip,
            isDroid: sheet.actor.isDroid,
            scores,
            formula: CONFIG.SWSE.Abilities.defaultAbilityRoll
        };
        const template = `systems/swse/templates/dialog/roll-and-standard-array.hbs`;

        let content = await renderTemplate(template, data);

        let response = await Dialog.confirm({
            title: "Assign Ability Scores",
            content: content,
            yes: async (html) => {
                let response = {str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8};
                html.find(".container").each((i, item) => {
                    let ability = $(item).data("ability");
                    let value = 8;
                    if (item.innerText) {
                        value = parseInt(item.innerText);
                    }
                    if (ability) {
                        response[ability] = value;
                    }
                })
                return response;
            },
            no: async () => {

            },
            render: (html) => {
                html.find(".movable").each((i, item) => {
                    item.setAttribute("draggable", true);
                    item.addEventListener("dragstart", (ev) => this._onDragStart(ev), false);
                });

                html.find(".container").each((i, item) => {
                    item.addEventListener("drop", (ev) => this._onDragEndMovable(ev), false);
                });

                if (canReRoll) {
                    html.find("#reRoll").each((i, button) => {
                        button.addEventListener("click", () => {
                            let rollFormula = CONFIG.SWSE.Abilities.defaultAbilityRoll;
                            html.find(".movable").each(async (i, item) => {
                                let roll = await new Roll(rollFormula).roll();
                                let title = "";
                                for (let term of roll.terms) {
                                    for (let result of term.results) {
                                        if (title !== "") {
                                            title += ", "
                                        }
                                        if (result.discarded) {
                                            title += `(Ignored: ${result.result})`
                                        } else {
                                            title += result.result
                                        }

                                    }
                                }
                                item.title = title;
                                item.innerHTML = roll.total;
                            });
                        })
                    })
                }
            }
        });
        if (response) {
            sheet.actor.setAttributes(response);
        }
    }

    /**
     *
     * @param event
     * @param sheet {SWSEActorSheet}
     * @returns {Promise<void>}
     * @private
     */
    async _selectAttributesManually(event, sheet) {
        let existingValues = sheet.actor.getAttributes();
        let combined = {};
        for (let val of Object.keys(existingValues)) {
            combined[val] = {val: existingValues[val].base, skip: existingValues[val].skip};
        }

        let data = {
            availablePoints: sheet.getPointBuyTotal(),
            abilityCost: CONFIG.SWSE.Abilities.abilityCost,
            abilities: combined,
            isDroid: sheet.actor.isDroid
        };
        const template = `systems/swse/templates/dialog/manual-attributes.hbs`;

        let content = await renderTemplate(template, data);

        let response = await Dialog.confirm({
            title: "Assign Ability Score Points",
            content: content,
            yes: async (html) => {
                let response = {};
                html.find(".adjustable-value").each((i, item) => {
                    response[$(item).data("label")] = item.value;
                })
                return response;
            }
        });
        if (response) {
            sheet.actor.setAttributes(response);
        }

    }

    /**
     *
     * @param event
     * @param sheet {SWSEActorSheet}
     * @returns {Promise<void>}
     * @private
     */
    async _selectAttributeLevelBonuses(event, sheet) {
        let level = $(event.currentTarget).data("level");
        let bonus = sheet.actor.getAttributeLevelBonus(level);

        let combined = {};
        for (let val of Object.keys(CONFIG.SWSE.Abilities.droidSkip)) {
            combined[val] = {val: bonus[val], skip: CONFIG.SWSE.Abilities.droidSkip[val]};
        }

        let availableBonuses = [false];
        if (this.actor.isHeroic) {
            availableBonuses = [false, false];
        }
        for (let i = 0; i < availableBonuses.length - Object.values(bonus).filter(b => b === 1).length; i++) {
            availableBonuses[i] = true;
        }

        let data = {
            abilityCost: CONFIG.SWSE.Abilities.abilityCost,
            abilities: combined,
            isDroid: sheet.actor.isDroid,
            availableBonuses
        };
        const template = `systems/swse/templates/dialog/level-attribute-bonus.hbs`;

        let content = await renderTemplate(template, data);

        let response = await Dialog.confirm({
            title: "Assign Ability Score Points",
            content: content,
            yes: async (html) => {
                let response = {};
                html.find(".container").each((i, item) => {
                    let ability = $(item).data("ability");
                    let value = null;
                    if (item.innerText) {
                        value = parseInt(item.innerText);
                    }
                    if (ability) {
                        response[ability] = value;
                    }
                })
                return response;
            },
            render: (html) => {
                html.find(".movable").each((i, item) => {
                    item.setAttribute("draggable", true);
                    item.addEventListener("dragstart", (ev) => this._onDragStart(ev), false);
                });

                html.find(".container").each((i, item) => {
                    item.addEventListener("drop", (ev) => this._onDragEndMovable(ev), false);
                });
            }
        });
        if (response) {
            sheet.actor.setAttributeLevelBonus(level, response);
        }
    }

    /**
     *
     * @param event
     * @param sheet {SWSEActorSheet}
     * @returns {Promise<void>}
     * @private
     */
    async _assignAttributePoints(event, sheet) {
        let existingValues = sheet.actor.getAttributeBases();
        let bonuses = sheet.actor.getAttributeBonuses();
        let combined = {};
        for (let val of Object.keys(existingValues)) {
            combined[val] = {val: existingValues[val], skip: CONFIG.SWSE.Abilities.droidSkip[val], bonus: bonuses[val]};
        }

        let data = {
            availablePoints: sheet.getPointBuyTotal(),
            abilityCost: CONFIG.SWSE.Abilities.abilityCost,
            abilities: combined,
            isDroid: sheet.actor.isDroid
        };
        const template = `systems/swse/templates/dialog/point-buy.hbs`;

        let content = await renderTemplate(template, data);

        let response = await Dialog.confirm({
            title: "Assign Ability Score Points",
            content: content,
            yes: async (html) => {
                let response = {};
                html.find(".adjustable-value").each((i, item) => {
                    response[$(item).data("label")] = parseInt(item.innerHTML);
                })
                return response;
            },
            render: (html) => {
                sheet.updateTotal(html);

                html.find(".adjustable-plus").on("click", (event) => {
                    const parent = $(event.currentTarget).parents(".adjustable");
                    const valueContainer = parent.children(".adjustable-value");
                    valueContainer.each((i, item) => {
                        item.innerHTML = parseInt(item.innerHTML) + 1;
                        if (parseInt(item.innerHTML) > 18 || sheet.getTotal(html).total > sheet.getPointBuyTotal()) {
                            item.innerHTML = parseInt(item.innerHTML) - 1;
                        }
                    });
                    sheet.updateTotal(html);
                });
                html.find(".adjustable-minus").on("click", (event) => {
                    const parent = $(event.currentTarget).parents(".adjustable");
                    const valueContainer = parent.children(".adjustable-value");
                    valueContainer.each((i, item) => {
                        item.innerHTML = parseInt(item.innerHTML) - 1;
                        if (parseInt(item.innerHTML) < 8) {
                            item.innerHTML = parseInt(item.innerHTML) + 1;
                        }
                    });
                    sheet.updateTotal(html);
                });
            }
        });
        if (response) {
            sheet.actor.setAttributes(response);
        }
    }

    _unavailable() {
        Dialog.prompt({
            title: "Sorry this content isn't finished.",
            content: "Sorry, this content isn't finished.  if you have an idea of how you think it should work please let me know.",
            callback: () => {
            }
        })
    }

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
}



