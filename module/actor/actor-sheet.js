import {filterItemsByType, getCompendium, unique} from "../util.js";
import {lightsaberForms, skills} from "../constants.js";
import {formatPrerequisites, meetsPrerequisites} from "../prerequisite.js";
import {SWSEItem} from "../item/item.js";
import {getActorFromId} from "../swse.js";

// noinspection JSClosureCompilerSyntax
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

        let type = this.actor.data.type;
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

        // Everything below here is only needed if the sheet is editable
        if (!this.options.editable) return;


        //html.find("input.plain").on("change", this._onChangeInput.bind(this));

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

        // html.find("div.item-container").each((i, div) => {
        //     div.addEventListener("drop", (ev) => this._onDrop(ev), false);
        // });
        //end dragging

        html.find('.condition-radio').on("click", async event => {
            await this.actor.update({"data.condition": parseInt(event.currentTarget.value)});
        })

        html.find('.mode-selector').on("click", async event => {
            //event.preventDefault();
            event.stopPropagation();
            let modePath = $(event.currentTarget).data("modePath");
            let item = this.actor.items.get($(event.currentTarget).data("itemId"));
            item.activateMode(modePath)
        })

        html.find("#selectAge").on("click", event => this._selectAge(event, this));
        html.find("#selectGender").on("click", event => this._selectGender(event, this));
        html.find("#selectWeight").on("click", () => this._unavailable());
        html.find("#selectHeight").on("click", () => this._unavailable());
        html.find("#fullAttack").on("click", () => this.actor.attack(event, {type: "fullAttack"}));

        html.find(".generationType").on("click", event => this._selectAttributeGeneration(event, this));
        html.find(".rollAbilities").on("click", async event => this._selectAttributeScores(event, this, {}, true));
        html.find(".assignStandardArray").on("click", async event => this._selectAttributeScores(event, this, CONFIG.SWSE.Abilities.standardScorePackage, false));
        html.find(".assignAttributePoints").on("click", event => this._assignAttributePoints(event, this));
        html.find(".assignManual").on("click", async event => this._selectAttributesManually(event, this));
        html.find(".leveledAttributeBonus").each((i, button) => {
            button.addEventListener("click", (event) => this._selectAttributeLevelBonuses(event, this));
        })

        // Add Inventory Item
        html.find('.item-create').click(this._onItemCreate.bind(this));

        // Update Inventory Item
        html.find('.item-edit').click(ev => {
            let li = $(ev.currentTarget);
            if (!li.hasClass("item")) {
                li = li.parents(".item");
            }
            const item = this.actor.items.get(li.data("itemId"));
            item.sheet.render(true);
        });

        // Delete Inventory Item
        html.find('.item-delete').click(async ev => await this._onItemDelete(ev));

        html.find('.item-duplicate').click(async ev => {
            const li = $(ev.currentTarget).parents(".item");
            let itemToDuplicate = this.actor.items.get(li.data("itemId"));
            let {id, pack} = SWSEActorSheet.parseSourceId(itemToDuplicate.data.flags.core.sourceId)

            await this._onDropItem(ev, {id, pack, 'type': 'Item'})
        })

        // Rollable abilities.
        html.find('.rollable').click(this._onRoll.bind(this));

        html.find('[data-action="compendium"]').click(this._onOpenCompendium.bind(this));
        html.find('[data-action="view"]').click(event => this._onItemEdit(event));

        html.find('.dark-side-button').click(ev => {
            this.actor.darkSideScore = $(ev.currentTarget).data("value");
        });
    }


    /** @inheritdoc */
    _onDragStart(event) {
        super._onDragStart(event);
        let dragData = JSON.parse(event.dataTransfer.getData("text/plain"));

        const elem = event.currentTarget;

        dragData.variable = elem.dataset.variable;
        dragData.label = elem.dataset.label;

        if (dragData.label === 'Unarmed Attack') {
            dragData.type = 'Item';
        }

        dragData.img = elem.dataset.img;
        dragData.itemId = elem.dataset.itemId;
        dragData.actorId = this.actor.id;
        if (this.actor.isToken) {
            dragData.sceneId = canvas.scene.id;
            dragData.tokenId = this.actor.token.id;
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
            await this.removeItemFromActor(itemId, itemToDelete);
        } else {
            button.disabled = true;

            let title = `Are you sure you want to delete ${itemToDelete.data.finalName}`;
            await Dialog.confirm({
                title: title,
                content: title,
                yes: async () => {
                    await this.removeItemFromActor(itemId, itemToDelete);
                    button.disabled = false
                },
                no: () => (button.disabled = false),
            });
        }
    }

    async removeItemFromActor(itemId, itemToDelete) {
        await this.removeChildItems(itemToDelete);
        let ids = await this.removeSuppliedItems(itemToDelete);
        ids.push(itemId);
        await this.actor.deleteEmbeddedDocuments("Item", ids);
    }

    async removeChildItems(itemToDelete) {
        if (itemToDelete.data.data.items) {
            for (let childItem of itemToDelete.data.data.items) {
                let ownedItem = this.actor.items.get(childItem._id);
                await itemToDelete.revokeOwnership(ownedItem);
            }
        }
    }

    async removeSuppliedItems(itemToDelete) {
        return this.actor.items.filter(item => item.data.data.supplier?.id === itemToDelete.id).map(item => item.id) || []
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

    async _selectAttributeGeneration(event, sheet) {
        let genType = sheet.actor.getAttributeGenerationType();
        let rollSelected = genType === 'Roll' ? 'selected' : '';
        let arraySelected = genType === 'Standard Array' ? 'selected' : '';
        let pointBuySelected = genType === 'Point Buy' ? 'selected' : '';
        let manualSelected = genType === 'Manual' ? 'selected' : '';

        let content = `<p>Select an Attribute Generation Type</p>
                        <div>
                          <select id='choice'>
                            <option ${rollSelected}>Roll</option>
                            <option ${arraySelected}>Standard Array</option>
                            <option ${pointBuySelected}>Point Buy</option>
                            <option ${manualSelected}>Manual</option>
                          </select> 
                        </div>`;

        await Dialog.prompt({
            title: "Select an Attribute Generation Type",
            content: content,
            callback: async (html) => {
                let key = html.find("#choice")[0].value;
                sheet.actor.setAttributeGenerationType(key);
            }
        });
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

                if (getProperty(this.actor.data, name) !== value) {
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
            updateTarget.update(data);
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
        if ( !this.actor.isOwner ) return false;

        if(["vehicle","vehicle-npc"].includes(this.actor.data.type)){
            let actor = getActorFromId(data.id);
            if(["character","npc"].includes(actor.data.type)) {
                let targetItemContainer = this.getParentByHTMLClass(event, "vehicle-station");
                console.log(targetItemContainer)

                if(targetItemContainer !== null) {
                    let crewPositions = ['pilot', 'copilot', 'gunner', 'commander', 'systemOperator', 'engineer'];
                    let currentPosition = crewPositions.filter(x => targetItemContainer.classList.contains(x));
                    if (currentPosition.length>0) {
                        currentPosition = currentPosition[0];

                        if (this.actor.data.data[currentPosition].length < this.actor[`available${currentPosition.titleCase()}Slots`]) {
                            await this.removeCrewFromPositions(crewPositions.filter(p => p !== currentPosition), actor.id, event);
                            await this.addCrew(actor.id, currentPosition, event);
                        }
                    }
                }

                    //.classList.contains("equipped")
                //if we find a container we'll figure out what container it is an attempt to assign that actor to that position
                //if we don't find a container than we'll attempt to add the actor as a passenger
            }
        }
    }




    async removeCrewFromPositions(crewPositions, id, ev) {
        for(let crewPosition of crewPositions){
            let datum = this.actor.data.data[crewPosition];
            if(datum.includes(id)){
                await this.removeCrew(id, crewPosition, ev, true)
            }
        }
    }

    async addCrew(actorId, position, ev, delay = false) {

        this._pendingUpdates[`data.${position}`] = [actorId].concat(this.actor.data.data[position]);
        if(!delay) {
            await this._onSubmit(ev);
        }
    }

    async removeCrew(actorId, position, ev, delay = false) {
        this._pendingUpdates[`data.${position}`] = this.actor.data.data[position].filter(value => value !== actorId);
        if(!delay) {
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
            }
        }

        //the dropped item is from a compendium
        const compendiumItem = await Item.implementation.fromDropData(data);

        let item = compendiumItem.clone();
        item.prepareData();

        if (!this.isPermittedForActorType(item.data.type)) {
            new Dialog({
                title: "Innapropriate Item",
                content: `You can't add a ${item.data.type} to a ${this.actor.data.type}.`,
                buttons: {
                    ok: {
                        icon: '<i class="fas fa-check"></i>',
                        label: 'Ok'
                    }
                }
            }).render(true);
            return;
        }

        let context = {};

        switch (item.data.type) {
            case "vehicleTemplate":
            case "species":
                await this.addItemWithOneItemRestriction(item);
                break;
            case "class":
                await this.addClass(item, context);
                break;
            case "feat":
                await this.addFeat(item);
                break;
            case "forceSecret":
            case "forceTechnique":
            case "forcePower":
            case "affiliation":
                await this.addForceItem(item);
                break;
            case "talent":
                await this.addTalent(item);
                break;
            case "weapon":
            case "armor":
            case "equipment":
            case "template":
            case "upgrade":
                await this.addItem(item);
                break;

        }


    }

    isPermittedForActorType(type) {
        if (["character", "npc"].includes(this.actor.data.type)) {
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
                "trait", "template"].includes(type)
        } else if (["vehicle", "npc-vehicle"].includes(this.actor.data.type)) {
            return ["vehicleTemplate"].includes(type)
        }

        return false;
    }


    async addTalent(item) {
        //TODO this should be a tighter system with less regex
        let possibleTalentTrees = new Set();
        let allTreesOnTalent = new Set();
        let optionString = "";

        let actorsBonusTrees = this.actor.getInheritableAttributesByKey('bonusTalentTree', "VALUES");
        if (actorsBonusTrees.includes(item.data.data.bonusTalentTree)) {
            for (let [id, item] of Object.entries(this.actor.data.availableItems)) {
                if (id.includes("Talent") && !id.includes("Force") && item > 0) {
                    optionString += `<option value="${id}">${id}</option>`
                    possibleTalentTrees.add(id);
                }
            }
        } else {
            for (let talentTree of item.data.data.possibleProviders.filter(unique)) {
                allTreesOnTalent.add(talentTree);
                let count = this.actor.data.availableItems[talentTree];
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

        item.data.data.talentTreeSource = Array.from(possibleTalentTrees)[0];

        await this.checkPrerequisitesAndResolveOptions(item, "Talent");
    }

    async addForceItem(item) {
        let viewable = item.data.type.replace(/([A-Z])/g, " $1");
        if (!this.actor.data.availableItems[itemType] && itemType !== 'Affiliations') {
            await Dialog.prompt({
                title: `You can't take any more ${viewable.titleCase()}`,
                content: `You can't take any more ${viewable.titleCase()}`,
                callback: () => {
                }
            });
            return [];
        }
        await this.checkPrerequisitesAndResolveOptions(item, itemType);
    }

    /**
     * Checks prerequisites of an item and offers available options
     * @param item {SWSEItem}
     * @param type
     */
    async checkPrerequisitesAndResolveOptions(item, type) {
        let choices = await this.activateChoices(item, {});
        if (!choices.success) {
            return [];
        }

        if (type !== "provided") {
            let takeMultipleTimes = item.getInheritableAttributesByKey("takeMultipleTimes").map(a => a.value === "true").reduce((a, b) => a || b, false);

            if (this.actor.hasItem(item) && !takeMultipleTimes) {
                await Dialog.prompt({
                    title: `You already have this ${type}`,
                    content: `You have already taken the ${item.data.finalName} ${type}`,
                    callback: () => {
                    }
                })
                return [];
            }

            //entitiesToAdd.push(item.data.toObject(false))

            let meetsPrereqs = meetsPrerequisites(this.actor, item.data.data.prerequisite);

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

        let mainItem = await super._onDropItemCreate(item.data.toObject(false));

        let providedItems = item.getProvidedItems();
        providedItems.push(...choices.items);
        await this.addItemsFromCompendium(providedItems, mainItem[0]);
    }


    /**
     *
     * @param items {[{name: string,type: string}] | {name: string, type: string}}
     * @param parent {SWSEItem}
     * @returns {Promise<string>}
     */
    async addItemsFromCompendium(items, parent) {
        if (!Array.isArray(items)) {
            items = [items];
        }
        let indices = {};
        let notificationMessage = "";
        for (let provided of items.filter(item => !!item)) {
            let item = provided.name;
            let prerequisite = provided.prerequisite;
            let type = provided.type;
            let {index, pack} = await this.getIndexAndPack(indices, type);
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
            await this.checkPrerequisitesAndResolveOptions(entity, "provided");
            //entities.push(entity.data.toObject(false));
        }
        return notificationMessage;
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


    async getIndexAndPack(indices, type) {
        let index = indices[type];
        let pack = getCompendium(type);
        if (!index) {
            index = await pack.getIndex();
            indices[type] = index;
        }
        return {index, pack};
    }


    async addFeat(item) {
        let possibleFeatTypes = [];

        let optionString = "";
        for (let category of item.data.data.bonusFeatCategories) {
            if (this.actor.data.availableItems[category.value] > 0) {
                possibleFeatTypes.push(category);
                optionString += `<option value="${JSON.stringify(category).replace(/"/g, '&quot;')}">${category.value}</option>`;
            }
        }

        if (possibleFeatTypes.length > 1) {
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

        // for (let category of item.data.data.categories) {
        //     if (!category.value.endsWith(" Bonus Feats")) {
        //         possibleFeatTypes.push(category);
        //     }
        // }

        item.data.data.categories = possibleFeatTypes;

        await this.checkPrerequisitesAndResolveOptions(item, "Feat");
    }

    async addClass(item) {

        let meetsPrereqs = meetsPrerequisites(this.actor, item.data.data.prerequisite);
        if (meetsPrereqs.doesFail) {
            new Dialog({
                title: "You Don't Meet the Prerequisites!",
                content: `You do not meet the prerequisites for the ${item.data.finalName} class:<br/> ${formatPrerequisites(meetsPrereqs.failureList)}`,
                buttons: {
                    ok: {
                        icon: '<i class="fas fa-check"></i>',
                        label: 'Ok'
                    }
                }
            }).render(true);
            return [];
        }
        if (meetsPrereqs.failureList.length > 0) {
            new Dialog({
                title: "You MAY Meet the Prerequisites!",
                content: `You MAY meet the prerequisites for this class. Check the remaining reqs:<br/> ${formatPrerequisites(meetsPrereqs.failureList)}`,
                buttons: {
                    ok: {
                        icon: '<i class="fas fa-check"></i>',
                        label: 'Ok'
                    }
                }
            }).render(true);
        }
        let context = {};
        context.isFirstLevel = this.actor.classes.length === 0;
        if (item.name === "Beast" && !context.isFirstLevel && this.actor.classes.filter(clazz => clazz.name === "Beast").length === 0) {
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
        if (item.name !== "Beast" && this.actor.classes.filter(clazz => clazz.name === "Beast").length > 0 && this.actor.getAttribute("INT") < 3) {
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
        let choices = await this.activateChoices(item, context);
        if (!choices.success) {
            return;
        }
        item.data.data.attributes[Object.keys(item.data.data.attributes).length] = {
            type: "Boolean",
            value: context.isFirstLevel,
            key: "isFirstLevel"
        };
        let mainItem = await super._onDropItemCreate(item.data.toObject(false));

        await this.addItemsFromCompendium(choices.items, mainItem[0])

        await this.addClassFeats(mainItem[0], context);
    }

    async addItem(item) {
        //let entities = [];
        let context = {};
        //TODO might return future items
        let choices = await this.activateChoices(item, context);
        if (!choices.success) {
            return [];
        }
        let mainItem = await super._onDropItemCreate(item.data.toObject(false));


        let providedItems = item.getProvidedItems();
        providedItems.push(...choices.items);

        await this.addItemsFromCompendium(providedItems, mainItem);

        // entities.forEach(item => item.data.supplier = {
        //     id: mainItem[0].id,
        //     name: mainItem[0].name,
        //     type: mainItem[0].data.type
        // })

        return;
    }
    async addItemWithOneItemRestriction(item) {
        let type = item.data.type;
        let viewable = type.replace(/([A-Z])/g, " $1");
        if (filterItemsByType(this.actor.items.values(), type).length > 0) {
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
            return;
        }
        await this.checkPrerequisitesAndResolveOptions(item, type.titleCase())
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
            let itemId = data.data._id;

            if (targetItemContainer.classList.contains("equipped")) {
                await this.equipItem(itemId, ev);
            } else if (targetItemContainer.classList.contains("unequipped")) {
                await this.unequipItem(itemId, ev);
            }
        }
    }

    async equipItem(itemId, ev) {
        let item = this.actor.items.get(itemId);

        let meetsPrereqs = meetsPrerequisites(this.actor, item.data.data.prerequisite);
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

        this._pendingUpdates['data.equippedIds'] = [itemId].concat(this.actor.data.data.equippedIds);
        await this._onSubmit(ev);
    }

    async unequipItem(itemId, ev) {
        this._pendingUpdates['data.equippedIds'] = this.actor.data.data.equippedIds.filter(value => value !== itemId);
        await this._onSubmit(ev);
    }

    getParentByHTMLClass(ev, token) {
        let cursor = ev.target;
        while (cursor != null && !cursor.classList.contains(token)) {
            cursor = cursor.parentElement;
        }
        return cursor;
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
        if (choices.length === 0) {
            return {success: true, items: []};
        }
        let items = [];
        for (let choice of choices ? choices : []) {
            if (choice.isFirstLevel && !context.isFirstLevel) {
                continue;
            }

            let options = this._explodeOptions(choice.options);

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

    /**
     * Adds Feats provided by a class and provides choices to the player when one is available
     * @param item {SWSEItem}
     * @param context
     * @returns {Promise<[]>}
     */
    async addClassFeats(item, context) {
        let feats = item.getInheritableAttributesByKey("classFeat").map(attr => attr.value);
        let availableClassFeats = item.getInheritableAttributesByKey("availableClassFeats", "SUM");
        if (feats.length === 0) {
            return [];
        }
        feats = feats.map(feat => this.cleanItemName(feat))
        if (context.isFirstLevel) {
            if (availableClassFeats > 0 && availableClassFeats < feats.length) {
                let selectedFeats = [];
                for (let i = 0; i < availableClassFeats; i++) {
                    let options = "";

                    for (let feat of this._explodeFeatNames(feats)) {
                        let owned = "";
                        let ownedFeats = this.actor.feats.filter(f => f.finalName === feat);
                        ownedFeats.push(...selectedFeats.filter(f => f === feat))
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
                            selectedFeats.push(feat);
                            await this.addItemsFromCompendium([{
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
                await this.addItemsFromCompendium(feats.map(feat => {
                    return {type: 'TRAIT', name: `Bonus Feat (${feat})`}
                }), item);
                let featString = await this.addItemsFromCompendium(feats.map(feat => {
                    return {type: 'FEAT', name: feat}
                }), item);


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
        } else if (this._isFirstLevelOfClass(item.data.name)) {
            let options = "";
            for (let feat of feats) {
                let owned = "";
                let ownedFeats = this.actor.feats.filter(f => f.finalName === feat);
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
                    await this.addItemsFromCompendium({
                        type: 'TRAIT',
                        name: `Bonus Feat (${feat})`
                    }, item);
                    await this.addItemsFromCompendium({type: 'FEAT', name: feat}, item);
                }
            });
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
            let roll = new Roll(rollStr, this.actor.data.data);
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
                updateCandidate.update(update);
            } else {
                roll.toMessage({
                    speaker: ChatMessage.getSpeaker({actor: this.actor}),
                    flavor: label
                });
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
//TODO change this when compendiums are part of the game system
        let newVar = game.packs.filter(pack => pack.collection.startsWith(target))[0];
        //console.log(newVar)
        newVar.render(true);
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


    _isFirstLevelOfClass(name) {
        let items = this.actor.items.filter(i => i.name === name);
        return items.length === 1;
    }

    _explodeFeatNames(feats) {
        let explode = [];
        for (let feat of feats) {
            if ("Skill Focus" === feat) {
                skills.forEach(skill => {
                    console.log("skill", skill)
                    if (skill && !this.actor.focusSkills.includes(skill.toLowerCase())) {
                        explode.push(`${feat} (${skill})`);
                    }
                })
            } else {
                explode.push(feat)
            }
        }
        return explode;
    }

    _explodeOptions(options) {
        let resolvedOptions = {};
        for (let [key, value] of Object.entries(options)) {
            if (key === 'AVAILABLE_EXOTIC_WEAPON_PROFICIENCY') {
                let weaponProficiencies = this.actor.getInheritableAttributesByKey("weaponProficiency", "VALUES")
                for (let weapon of game.generated.exoticWeapons) {
                    if (!weaponProficiencies.includes(weapon)) {
                        resolvedOptions[weapon] = {abilities: [], items: [], payload: weapon};
                    }
                }
            } else if (key === 'AVAILABLE_WEAPON_FOCUS') {
                let focuses = this.actor.getInheritableAttributesByKey("weaponFocus", "VALUES")
                for (let weapon of this.actor.getInheritableAttributesByKey("weaponProficiency", "VALUES")) {
                    if (!focuses.includes(weapon)) {
                        resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                    }
                }
            } else if (key === 'AVAILABLE_WEAPON_SPECIALIZATION') {
                let weaponSpecializations = this.actor.getInheritableAttributesByKey("weaponSpecialization", "VALUES")
                for (let weapon of this.actor.getInheritableAttributesByKey("weaponFocus", "VALUES")) {
                    if (!weaponSpecializations.includes(weapon)) {
                        resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                    }
                }
            } else if (key === 'AVAILABLE_GREATER_WEAPON_SPECIALIZATION') {
                let greaterWeaponSpecialization = this.actor.getInheritableAttributesByKey("greaterWeaponSpecialization", "VALUES")
                let greaterWeaponFocus = this.actor.getInheritableAttributesByKey("greaterWeaponFocus", "VALUES")
                for (let weaponSpecialization of this.actor.getInheritableAttributesByKey("weaponSpecialization", "VALUES")) {
                    if (!greaterWeaponSpecialization.includes(weaponSpecialization) && greaterWeaponFocus.includes(weaponSpecialization)) {
                        resolvedOptions[weaponSpecialization.titleCase()] = {
                            abilities: [],
                            items: [],
                            payload: weaponSpecialization.titleCase()
                        };
                    }
                }
            } else if (key === 'AVAILABLE_GREATER_WEAPON_FOCUS') {
                let greaterWeaponFocus = this.actor.getInheritableAttributesByKey("greaterWeaponFocus", "VALUES")
                for (let weaponFocus of this.actor.getInheritableAttributesByKey("weaponFocus", "VALUES")) {
                    if (!greaterWeaponFocus.includes(weaponFocus)) {
                        resolvedOptions[weaponFocus.titleCase()] = {
                            abilities: [],
                            items: [],
                            payload: weaponFocus.titleCase()
                        };
                    }
                }
            } else if (key === 'AVAILABLE_WEAPON_PROFICIENCIES') {
                let weaponProficiencies = this.actor.getInheritableAttributesByKey("weaponProficiency", "VALUES");
                for (let weapon of ["Simple Weapons", "Pistols", "Rifles", "Lightsabers", "Heavy Weapons", "Advanced Melee Weapons"]) {
                    if (!weaponProficiencies.includes(weapon)) {
                        resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                    }
                }
            } else if (key === 'UNFOCUSED_SKILLS') {
                let skillFocuses = this.actor.getInheritableAttributesByKey("skillFocus", "VALUES");
                for (let skill of skills) {
                    if (!skillFocuses.includes(skill)) {
                        resolvedOptions[skill.titleCase()] = {abilities: [], items: [], payload: skill.titleCase()};
                    }
                }
            } else if (key === 'AVAILABLE_SKILL_FOCUS') {
                let skillFocuses = this.actor.getInheritableAttributesByKey("skillFocus", "VALUES");
                for (let skill of this.actor.trainedSkills) {
                    if (!skillFocuses.includes(skill.key)) {
                        resolvedOptions[skill.key.titleCase()] = {
                            abilities: [],
                            items: [],
                            payload: skill.key.titleCase()
                        };
                    }
                }
            } else if (key === 'AVAILABLE_SKILL_MASTERY') {
                let masterSkills = this.actor.getInheritableAttributesByKey("skillMastery", "VALUES");
                masterSkills.push("Use The Force")
                for (let skill of this.actor.getInheritableAttributesByKey("skillFocus", "VALUES")) {
                    if (!masterSkills.includes(skill)) {
                        resolvedOptions[skill.titleCase()] = {abilities: [], items: [], payload: skill.titleCase()};
                    }
                }
            } else if (key === 'AVAILABLE_DOUBLE_ATTACK') {
                let doubleAttack = this.actor.getInheritableAttributesByKey("doubleAttack", "VALUES")
                for (let weapon of this.actor.getInheritableAttributesByKey("weaponProficiency", "VALUES")) {
                    if (!doubleAttack.includes(weapon)) {
                        resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                    }
                }
            } else if (key === 'AVAILABLE_TRIPLE_ATTACK') {
                let tripleAttack = this.actor.getInheritableAttributesByKey("tripleAttack", "VALUES")

                for (let weapon of this.actor.getInheritableAttributesByKey("doubleAttack", "VALUES")) {
                    if (!tripleAttack.includes(weapon.toLowerCase())) {
                        resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                    }
                }
            } else if (key === 'AVAILABLE_SAVAGE_ATTACK') {
                let savageAttack = this.actor.getInheritableAttributesByKey("savageAttack", "VALUES")

                for (let weapon of this.actor.getInheritableAttributesByKey("doubleAttack", "VALUES")) {
                    if (!savageAttack.includes(weapon)) {
                        resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                    }
                }
            } else if (key === 'AVAILABLE_RELENTLESS_ATTACK') {
                let relentlessAttack = this.actor.getInheritableAttributesByKey("relentlessAttack", "VALUES")

                for (let weapon of this.actor.getInheritableAttributesByKey("doubleAttack", "VALUES")) {
                    if (!relentlessAttack.includes(weapon)) {
                        resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                    }
                }
            } else if (key === 'AVAILABLE_AUTOFIRE_SWEEP') {
                let autofireSweep = this.actor.getInheritableAttributesByKey("autofireSweep", "VALUES")

                for (let weapon of this.actor.getInheritableAttributesByKey("weaponFocus", "VALUES")) {
                    if (!autofireSweep.includes(weapon)) {
                        resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                    }
                }
            } else if (key === 'AVAILABLE_AUTOFIRE_ASSAULT') {
                let autofireAssault = this.actor.getInheritableAttributesByKey("autofireAssault", "VALUES")

                for (let weapon of this.actor.getInheritableAttributesByKey("weaponFocus", "VALUES")) {
                    if (!autofireAssault.includes(weapon)) {
                        resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                    }
                }
            } else if (key === 'AVAILABLE_HALT') {
                let halt = this.actor.getInheritableAttributesByKey("halt", "VALUES")

                for (let weapon of this.actor.getInheritableAttributesByKey("weaponFocus", "VALUES")) {
                    if (!halt.includes(weapon)) {
                        resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                    }
                }
            } else if (key === 'AVAILABLE_RETURN_FIRE') {
                let returnFire = this.actor.getInheritableAttributesByKey("returnFire", "VALUES")

                for (let weapon of this.actor.getInheritableAttributesByKey("weaponFocus", "VALUES")) {
                    if (!returnFire.includes(weapon.toLowerCase())) {
                        resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                    }
                }
            } else if (key === 'AVAILABLE_CRITICAL_STRIKE') {
                let criticalStrike = this.actor.getInheritableAttributesByKey("criticalStrike", "VALUES")

                for (let weapon of this.actor.getInheritableAttributesByKey("weaponFocus", "VALUES")) {
                    if (!criticalStrike.includes(weapon.toLowerCase())) {
                        resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                    }
                }
            } else if (key === 'AVAILABLE_LIGHTSABER_FORMS') {
                for (let form of lightsaberForms) {
                    if (!this.actor.talents.map(t => t.name).includes(form)) {
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
        let existingValues = sheet.actor.getAttributeBases();
        let combined = {};
        for (let val of Object.keys(existingValues)) {
            combined[val] = {val: existingValues[val], skip: CONFIG.SWSE.Abilities.droidSkip[val]};
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
                    response[$(item).data("label")] = Math.min(Math.max(parseInt(item.value), 8), 18);
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
        let itemId = elem.dataset.itemId;
        if (!itemId) {
            itemId = elem.dataset.label;
        }
        //let itemId = div.data("itemId");
        //this.actor.rollOwnedItem(itemId);
        this.actor.attack(ev, {type: "singleAttack", items: [itemId]});
        return undefined;
    }
}

