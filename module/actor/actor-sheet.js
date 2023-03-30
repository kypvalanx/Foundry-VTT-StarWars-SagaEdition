import {filterItemsByType, unique} from "../util.js";
import {crewPositions, vehicleActorTypes} from "../constants.js";
import {getActorFromId} from "../swse.js";
import {Attack} from "./attack.js";
import {addSubCredits, transferCredits} from "./credits.js";
import {SWSECompendiumDirectory} from "../compendium/compendium-directory.js";

// noinspection JSClosureCompilerSyntax

function getDefaultDataByType(itemType) {
    switch (itemType) {
        case "language":
            return {
                attributes: {
                    0 : {key: "readable", value: true, override: false},
                    1 : {key: "writable", value: true, override: false},
                    2 : {key: "spoken", value: true, override: false},
                    3 : {key: "characterReads", value: true, override: false},
                    4 : {key: "characterWrites", value: true, override: false},
                    5 : {key: "characterSpeaks", value: true, override: false},
                    6 : {key: "silentCommunication", value: false, override: false},
                    7 : {key: "visualCommunication", value: false, override: false}
                }
            }
        default:
            return {};
    }
}

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */

export class SWSEActorSheet extends ActorSheet {

    /**
     * A convenience reference to the Actor entity
     * @type {SWSEActor}
     */
    get actor() {
        return this.object;
    }


    constructor(...args) {
        super(...args);
        this._pendingUpdates = {};
    }


    /** @override */
    static get defaultOptions() {

        return mergeObject(super.defaultOptions, {
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
        return super.getData(options);
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);


        html.find(".toggle").on("click", event => {
            event.stopPropagation();
            let toggleId = event.currentTarget.dataset.toggleId
            let data = {};

            let toggles = this.actor.system.toggles || {};
            data[`system.toggles.${toggleId}`] = !(toggles[toggleId] || false)

            this.actor.safeUpdate(data);
        })


        html.find(".collapse-toggle").on("click", event => {
            let down = "fa-minus";
            let up = "fa-plus";
            event.stopPropagation();
            let button = $(event.currentTarget);

            let children = button.find("i.fas");
            children.each((i, e) =>{
                if(e.classList.contains(down)){
                    e.classList.remove(down);
                    e.classList.add(up);
                } else if(e.classList.contains(up)){
                    e.classList.remove(up);
                    e.classList.add(down);
                }
            })

            let container = button.parents(".collapsible-container")
            let collapsible = container.children(".collapsible")
            collapsible.each((i, div) => {
                if(div.style.display === "grid"){
                    div.style.display = "none"
                } else {
                    div.style.display = "grid"
                }
            })
        })

        // Everything below here is only needed if the sheet is editable
        if (!this.options.editable) return;
        // html.find(".numeric-override").each((i, li)=>{
        //
        //     new ContextMenu($(li), ".numeric-override", getHealthOptions(this.actor))
        // })
        new ContextMenu(html, ".numeric-override", getHealthOptions(this.actor))

        // Add general text box (span) handler
        html.find("span.text-box.direct").on("click", (event) => {
            this._onSpanTextInput(event, this._adjustActorPropertyBySpan.bind(this), "text");
        });

        html.find("span.text-box.item-attribute").on("click", (event) => {
            this._onSpanTextInput(event, this._adjustItemAttributeBySpan.bind(this), "text");
        });

        html.find("input.plain").on("keypress", (event) => {
            if (event.code === 'Enter' || event.code === 'NumpadEnter') {
                event.stopPropagation();
                //if (!changed) {
                this._onSubmit(event);
                //}
            }
        });

        html.find("input.direct").on("click", (event) => {
            this._pendingUpdates['data.classesfirst'] = event.target.value;
        });

        // Species controls
        html.find(".species-control").click(this._onSpeciesControl.bind(this));
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

        html.find('.condition-radio').on("click", this._onConditionChange.bind(this))
        html.find('.gravity-radio').on("click", this._onGravityChange.bind(this))

        html.find('.mode-selector').on("click", async event => {
            //event.preventDefault();
            event.stopPropagation();
            const target = $(event.currentTarget);
            let modePath = target.data("modePath");
            let type = target.data("type");
            let group = target.data("group");
            let data = target.data("itemId");
            let attributes = target.data("attributes");
            let item = this.actor.items.get(data);
            item.activateMode(modePath,type, group, attributes)
        })

        html.find("#selectAge").on("click", event => this._selectAge(event, this));
        html.find("#selectGender").on("click", event => this._selectGender(event, this));
        html.find("#selectWeight").on("click", () => this._unavailable());
        html.find("#selectHeight").on("click", () => this._unavailable());
        html.find("#fullAttack").on("click", () => this.actor.attack(event, {type: "fullAttack"}));

        html.find(".rollAbilities").on("click", async event => this._selectAttributeScores(event, this, {}, true));
        html.find(".assignStandardArray").on("click", async event => this._selectAttributeScores(event, this, CONFIG.SWSE.Abilities.standardScorePackage, false));
        html.find(".assignAttributePoints").on("click", event => this._assignAttributePoints(event, this));
        html.find(".assignManual").on("click", async event => this._selectAttributesManually(event, this));
        html.find(".leveledAttributeBonus").each((i, button) => {
            button.addEventListener("click", (event) => this._selectAttributeLevelBonuses(event, this));
        })

        // Add Inventory Item
        html.find('.item-create').click(this._onItemCreate.bind(this));

        // Delete Inventory Item
        html.find('.item-delete').click(this._onItemDelete.bind(this));

        html.find('.item-duplicate').click(this._onDuplicate.bind(this))

        // Rollable abilities.
        html.find('.rollable').click(this._onRoll.bind(this));

        //html.find('[data-action="compendium"]').click(this._onOpenCompendium.bind(this));
        html.find('[data-action="compendium"]').click(SWSECompendiumDirectory.viewCompendiumItemsByFilter.bind(this));
        html.find('[data-action="view"]').click(this._onItemEdit.bind(this));
        html.find('[data-action="delete"]').click(this._onItemDelete.bind(this));
        html.find('[data-action="credit"]').click(this._onCredit.bind(this));
        html.find('[data-action="shield"]').click(this._onShield.bind(this));
        html.find('[data-action="decrease-quantity"]').click(this._onDecreaseItemQuantity.bind(this));
        html.find('[data-action="increase-quantity"]').click(this._onIncreaseItemQuantity.bind(this));
        html.find('[data-action="toggle-use"]').click(this._onToggleUse.bind(this));
        html.find('[data-action="toggle-second-wind"]').click(this._onToggleSecondWind.bind(this));
        html.find('[data-action="create"]').click(this._onCreateNewItem.bind(this));
        html.find('[data-action="quickCreate"]').on("keypress", this._onQuickCreate.bind(this));
        html.find('[data-action="to-chat"]').click(this._onToChat.bind(this));

        html.find('.dark-side-button').click(ev => {
            this.actor.darkSideScore = $(ev.currentTarget).data("value");
        });

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


        let speaker = ChatMessage.getSpeaker({actor: this.object.parent});

        let messageData = {
            user: game.user.id,
            speaker: speaker,
            flavor: name,
            type: CONST.CHAT_MESSAGE_TYPES.OOC,
            content,
            sound: CONFIG.sounds.dice
        }

        let cls = getDocumentClass("ChatMessage");

        let msg = new cls(messageData);

        return cls.create(msg.data, {});
    }

    _onCreateNewItem(event){
        let element = $(event.currentTarget);
        let itemType = element.data("action-type")

        let itemData = {
            name: `New ${itemType}`,
            type: itemType,
            data: getDefaultDataByType(itemType)
        }

        this.actor.createEmbeddedDocuments('Item', [itemData]);
    }

    _onQuickCreate(event) {
        let element = $(event.currentTarget);
        let itemType = element.data("action-type");
            if(event.code === "Enter" || event.code === "NumpadEnter"){
                event.preventDefault();
                let name = element[0].value;
                let names = [name]
                if(name.includes(",")){
                    names = name.split(",").map(n => n.trim());
                }

                let itemData = names.map(name => {
                    return {
                        name: name,
                        type: itemType,
                        data: getDefaultDataByType(itemType)
                    }
                })

                this.actor.createEmbeddedDocuments('Item', itemData);
            }

    }

    _onCredit(event) {
        let element = $(event.currentTarget);
        let type = element.data("action-type")
        let actor = this.actor;
        if ('add' === type || 'sub' === type) {
            addSubCredits(type, actor);
        }
        if ('transfer' === type) {
            transferCredits(actor, type);
        }
    }

    async _onConditionChange(event) {
        event.stopPropagation();
        await this.actor.clearCondition();
        //this.actor.deleteEmbeddedDocuments("")
        await this.actor.setCondition(event.currentTarget.value);
    }
    async _onGravityChange(event) {
        event.stopPropagation();
        await this.actor.safeUpdate({"data.gravity": event.currentTarget.value})
    }



    async _onShield(event) {
        let element = $(event.currentTarget);
        let type = element.data("action-type")
        let actor = this.actor;
        switch (type) {
            case 'plus':
                actor.shields = actor.system.shields.value + 5
                break;
            case 'minus':
                actor.shields = actor.system.shields.value - 5
                break;
            case 'toggle':

                let ids = this.actor.effects
                    .filter(effect => effect.icon?.includes("/shield.svg")).map(effect => effect.id)

                await this.actor.deleteEmbeddedDocuments("ActiveEffect", ids);

                if(ids.length === 0){
                    let statusEffect = CONFIG.statusEffects.find(e => e.id === "shield")
                    await this.actor.activateStatusEffect(statusEffect);
                }

                break;
        }
    }


    _onDuplicate(event) {
        const li = $(event.currentTarget).parents(".item");
        let itemToDuplicate = this.actor.items.get(li.data("itemId"));
        let data = {item: itemToDuplicate, duplicate:true}
        //let {id, pack} = SWSEActorSheet.parseSourceId(itemToDuplicate.data.flags.core.sourceId)

        this._onDropItem(event, data)
    }

    /** @inheritdoc */
    _onDragStart(event) {
        super._onDragStart(event);
        let data = event.dataTransfer.getData("text/plain") || "{}";
        let dragData = JSON.parse(data);

        const elem = event.currentTarget;

        dragData.variable = elem.dataset.variable;
        dragData.label = elem.dataset.label;

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

        dragData.sourceContainer = this.getParentByHTMLClass(event, "item-container");
        dragData.draggableId = event.target.id;

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
        let age = sheet.actor.data.data.age ? parseInt(sheet.actor.data.data.age) : 0;
        let ageEffects = filterItemsByType(sheet.actor.items.values(), "trait")
            .map(trait => {
                //let prereqs = trait.data.data.prerequisite.filter(prereq => );
                let prereq = this._prerequisiteHasTypeInStructure(trait.data.data.prerequisite, 'AGE')
                if (prereq) {
                    return {
                        name: trait.data.finalName,
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
        let sex = sheet.actor.data.data.sex ? sheet.actor.data.data.sex : "";
        let gender = sheet.actor.data.data.gender ? sheet.actor.data.data.gender : "";
        let searchString = "GENDER";
        let genderEffects = filterItemsByType(sheet.actor.items.values(), "trait")
            .filter(trait => this._prerequisiteHasTypeInStructure(trait.data.data.prerequisite, searchString)).map(trait => {
                let prerequisite = this._prerequisiteHasTypeInStructure(trait.data.data.prerequisite, searchString)

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

    parseRange(range) {
        if (range.includes("-")) {
            let tok = range.split("-");
            return {low: parseInt(tok[0]), high: parseInt(tok[1])};
        }
        return {low: parseInt(range.replace("+", "")), high: -1};
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
        const cr = formData["data.details.cr.base"];
        if (typeof cr === "string") formData["data.details.cr.base"] = CR.fromString(cr);

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

                if (getProperty(this.actor, name) !== value) {
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

    _onSpanTextInput(event, callback = null, type) {
        const el = event.currentTarget;
        const parent = el.parentElement;

        // Replace span element with an input (text) element
        const newEl = document.createElement(`INPUT`);
        newEl.type = type;
        if (el.dataset?.dtype) newEl.dataset.dtype = el.dataset.dtype;
        if (el.dataset?.item) newEl.dataset.item = el.dataset.item;
        if (el.dataset?.itemAttribute) newEl.dataset.itemAttribute = el.dataset.itemAttribute;

        // Set value of new input element
        let prevValue = el.innerText;
        if (el.classList.contains("placeholder")) prevValue = "";

        let name = el.getAttribute("name");
        if (el.dataset.name) {
            name = el.dataset.name;
        }
        let item = el.dataset.item;
        let maxValue;
        if (name) {
            newEl.setAttribute("name", name);

            let source = this.actor.data;
            if (item) {
                source = this.actor.items.get(item);
                name = "data." + name; //TODO make this less hacky
            }
            prevValue = getProperty(source, name);
            if (prevValue && typeof prevValue !== "string") prevValue = prevValue.toString();

            if (name.endsWith(".value")) {
                const maxName = name.replace(/\.value$/, ".max");
                maxValue = getProperty(this.actor.data, maxName);
            }
        }
        newEl.value = prevValue;

        // Toggle classes
        const forbiddenClasses = ["placeholder", "direct", "allow-relative"];
        for (let cls of el.classList) {
            if (!forbiddenClasses.includes(cls)) newEl.classList.add(cls);
        }

        // Replace span with input element
        const allowRelative = el.classList.contains("allow-relative");
        parent.replaceChild(newEl, el);
        let changed = false;
        if (callback) {
            newEl.addEventListener("change", (...args) => {
                changed = true;
                if (allowRelative) {
                    newEl.value = adjustNumberByStringCommand(parseFloat(prevValue), newEl.value, maxValue);
                }

                if (newEl.value === prevValue) {
                    this._render();
                } else {
                    callback.call(this, ...args);
                }
            });
        }
        newEl.addEventListener("focusout", () => {
            if (!changed) {
                this._render();
            }
        });


        newEl.addEventListener("keypress", (event) => {
            if (event.code === 'Enter' || event.code === 'NumpadEnter') {
                event.stopPropagation();
                if (!changed) {
                    this._render();
                }
            }
        });

        // Select text inside new element
        newEl.focus();
        newEl.select();
        //newEl.click()
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

        if (!vehicleActorTypes.includes(this.actor.data.type)) {
            return;
        }
        let actor = getActorFromId(data.id);
        if (!["character", "npc"].includes(actor.data.type)) {
            return;
        }
        let targetItemContainer = this.getParentByHTMLClass(event, "vehicle-station");

        if (targetItemContainer !== null) {
            let currentPosition = crewPositions.filter(x => targetItemContainer.dataset.position === x);
            if (currentPosition.length > 0) {
                currentPosition = currentPosition[0];

                if (currentPosition === 'Astromech Droid') {
                    if (actor.species.name !== 'Astromech Droid' && actor.species.name !== '2nd-Degree Droid Model') {
                        this.onlyAllowsAstromechsDialog();
                        return;
                    }
                }

                if (!this.actor.data.data.crew.find(crewMember => crewMember.position === currentPosition && crewMember.slot === targetItemContainer.dataset.slot)) {
                    await this.removeCrewFromPositions(actor, actor.id, crewPositions, event);
                    await this.addCrew({
                        actor,
                        id: actor.id,
                        position: currentPosition,
                        slot: targetItemContainer.dataset.slot
                    }, event);
                }
            }
        }
    }

    async removeCrewFromPositions(actor, actorId, positions, ev, delay = false) {
        for (let position of positions) {
            await this.removeCrew(actorId, position, ev, delay);
        }
    }

    async removeCrew(actorId, position, ev, delay = false) {
        let crew = getActorFromId(actorId);
        await crew?.removeCrew(this.actor.id, position)
        await this.actor.removeCrew(actorId, position)
    }

    async addCrew(crewMember, ev, delay = false) {
        await this.actor.addCrew(crewMember.actor, crewMember.position, crewMember.slot)
        await crewMember.actor.addCrew(this.actor, crewMember.position, crewMember.slot)
    }


    async removeReciprocalCrewLinks(actorId, positions, ev, delay = false) {

        this._pendingUpdates['data.crew'] = this.actor.data.data.crew.filter(crewMember => crewMember.id !== actorId || !positions.includes(crewMember.position));
        if (!delay) {
            await this._onSubmit(ev);
        }
    }

    async removeRecipricalCrewLink(actorId, position, ev, delay = false) {

        this._pendingUpdates['data.crew'] = this.actor.data.data.crew.filter(crewMember => crewMember.id !== actorId || crewMember.position !== position);

        if (!delay) {
            await this._onSubmit(ev);
        }
    }

    async addRecipricalCrewLink(crewMember, ev, delay = false) {
        this._pendingUpdates['data.crew'] = [crewMember].concat(this.actor.data.data.crew);
        if (!delay) {
            await this._onSubmit(ev);
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

        let context = {};
        context.newFromCompendium = true;

        await this.actor.addItems([data], undefined, context);

    }

    async moveExistingItemWithinActor(data, ev) {
        if (data.modId) {
            let movedItem = this.actor.items.get(data.modId);
            let parentItem = this.actor.items.get(data.itemId);
            await parentItem.revokeOwnership(movedItem);
        } else {
            //equip/unequip workflow
            let targetItemContainer = this.getParentByHTMLClass(ev, "item-container");

            if (targetItemContainer == null) {
                return;
            }
            let itemId = data.itemId;


            //TODO clean this up. the design was good when it was a few lists, but with 4 lists it's clunky  maybe a map to rules?
            let specialTypes = ["new-gunner"]
            let specialType = specialTypes.find(x => targetItemContainer.classList.contains(x));

            //This type does not allow weapon systems
            let equipTypes = ["equipped", "installed"];
            let equipType = equipTypes.find(x => targetItemContainer.classList.contains(x));

            let weaponSystemOnlyTypes = ["pilotInstalled"];
            let gunnerPositions = this.actor.gunnerPositions || [];
            weaponSystemOnlyTypes.push(...gunnerPositions.filter(e => !!e.id).map(e => e.id).filter(unique));
            let weaponSystemOnlyType = weaponSystemOnlyTypes.find(x => targetItemContainer.classList.contains(x));

            let unequipTypes = ["unequipped", "uninstalled"];
            let unequipType = unequipTypes.find(x => targetItemContainer.classList.contains(x));

            let item = this.actor.items.get(itemId);
            if (equipType) {
                if (item.system.subtype.toLowerCase() === "weapon systems") {
                    this.onlyAllowsWeaponsDialog(false);
                } else {
                    await this.actor.equipItem(itemId, equipType, {event:ev});
                }
            } else if (weaponSystemOnlyType) {
                if (item.system.subtype.toLowerCase() === "weapon systems") {
                    await this.actor.equipItem(itemId, weaponSystemOnlyType, {event:ev, offerOverride:true});
                } else {
                    this.onlyAllowsWeaponsDialog();
                }
            } else if (unequipType) {
                await this.actor.unequipItem(itemId, ev);
            } else if (specialType === "new-gunner") {
                if (item.system.subtype.toLowerCase() === "weapon systems") {
                    let types = this.actor.system.equippedIds.filter(e => e.type.startsWith("gunnerInstalled")).map(e => e.type === "gunnerInstalled" ? 0 : parseInt(e.type.replace("gunnerInstalled", ""))).filter(unique);
                    let equipType;
                    for (let i = 0; i <= types.length; i++) {
                        if (!types.includes(i)) {
                            equipType = `gunnerInstalled${i}`;
                            break;
                        }
                    }
                    await this.actor.equipItem(itemId, equipType, {event:ev, offerOverride:true});
                } else {
                    this.onlyAllowsWeaponsDialog();
                }
            }
        }
    }


    getParentByHTMLClass(ev, token) {
        let cursor = ev.target;
        while (cursor != null && !cursor.classList.contains(token)) {
            cursor = cursor.parentElement;
        }
        return cursor;
    }


    /* -------------------------------------------- */

    /**
     * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
     * @param {Event} event   The originating click event
     * @private
     */
    _onItemCreate(event) {
        event.preventDefault();
        console.log(event);
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
    _onRoll(event) {
        event.preventDefault();
        const element = event.currentTarget;

        let draggable = this.getParentByHTMLClass(event, "draggable")
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
            if (dataset.itemAttribute) {
                if (item) {
                    let updateTarget = this.actor.items.get(item);
                    updateTarget.setAttribute(dataset.itemAttribute, roll.total);
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


    async _onSpeciesControl(event) {
        event.preventDefault();
        const a = event.currentTarget;


        // Add race
        if (a.classList.contains("add")) {
            const itemData = {
                name: "New Species",
                type: "species",
            };
            await this.actor.createOwnedItem(itemData);
        }
        // Edit race
        else if (a.classList.contains("edit")) {
            this._onItemEdit(event);
        }
        // Delete race
        else if (a.classList.contains("delete")) {
            this._onItemDelete(event);
        }
    }


    async _onCrewControl(event) {
        event.preventDefault();
        const a = event.currentTarget;

        // Delete race
        if (a.classList.contains("crew-remove")) {
            await this.removeCrew(a.dataset.actorId, a.dataset.position, event);
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
            await this.actor.removeItem(itemId);
        } else {
            button.disabled = true;

            let title = `Are you sure you want to delete ${itemToDelete.finalName}`;
            await Dialog.confirm({
                title: title,
                content: title,
                yes: async () => {
                    await this.actor.removeItem(itemId);
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
                            html.find(".movable").each((i, item) => {
                                let roll = new Roll(rollFormula).roll({async: false});
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

    async addOptionalRuleFeats(item) {
        let items = [];

        // if (item.name === 'Point-Blank Shot') {
        //     if (game.settings.get('swse', 'mergePointBlankShotAndPreciseShot')) {
        //         await this.actor.addItemsFromCompendium('feat', items, {
        //             category: 'Precise Shot',
        //             prerequisite: 'SETTING:mergePointBlankShotAndPreciseShot'
        //         });
        //     }
        // }

        return items;
    }

    static parseSourceId(sourceId) {
        let first = sourceId.indexOf(".");
        let lastIndex = sourceId.lastIndexOf(".");
        let pack = sourceId.substr(first + 1, lastIndex - first - 1);
        let id = sourceId.substr(lastIndex + 1);
        return {id, pack};
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

        this.actor.attack(ev, {type: "singleAttack", attacks});
        return undefined;
    }

    onlyAllowsWeaponsDialog(weaponOnly = true) {
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



function getHealthOptions(actor) {
    let options = [];
    options.push({name: "Set Override",
            icon: '<i class="fas fa-edit">',
            callback: async element => {
                let overrideKey = element.data('override-key');
                let overrideName = element.data('override-name');
                let value = await Dialog.prompt({
                    title: `Set ${overrideName}`,
                    content: `<p>Set ${overrideName}</p><br/><input class="choice" type="number" data-option-key="">`,
                    callback: html => {
                        let find = html.find(".choice");

                        for (let foundElement of find) {
                            return foundElement.value;
                        }
                    }
                })

                let data = {};
                data[overrideKey] = value;
                await actor.safeUpdate(data);
            }})

    options.push({name: `Remove Override`,
        icon: '<i class="fas fa-delete">',
        callback: element =>{

            let overrideKey = element.data('override-key');
            let data = {};
            data[overrideKey] = null;
            actor.safeUpdate(data);
        },
        condition: element => {
        let override = element[0].dataset["override"]
        return !!override
        }
    })

    return options;
}
