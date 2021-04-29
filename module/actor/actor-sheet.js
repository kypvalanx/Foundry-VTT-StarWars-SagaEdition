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
        Handlebars.registerHelper('ifEquals', function (arg1, arg2, options) {
            return (arg1 === arg2) ? options.fn(this) : options.inverse(this);
        });

        return mergeObject(super.defaultOptions, {
            classes: ["swse", "sheet", "actor"],
            template: "systems/swse/templates/actor/actor-sheet.hbs",
            width: 1000,
            height: 900,
            tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "summary"}]
        });
    }

    /* -------------------------------------------- */

    /** @override */
    getData() {
        const data = super.getData();
        data.dtypes = ["String", "Number", "Boolean"];
        for (let attr of Object.values(data.data.attributes)) {
            attr.isCheckbox = attr.dtype === "Boolean";
        }
        return data;
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        // Everything below here is only needed if the sheet is editable
        if (!this.options.editable) return;

        // Add general text box (span) handler
        html.find("span.text-box.direct").on("click", (event) => {
            this._onSpanTextInput(event, this._adjustActorPropertyBySpan.bind(this), "text");
        });

        html.find("input.direct").on("click", (event) => {
            this._pendingUpdates['data.classesfirst'] = event.target.value;
        });

        html.find("input.skill").on("change", (event) => {
            let data = {};
            data["data.skills." + event.currentTarget.dataset.id + ".trained"] = event.currentTarget.checked;
            this.actor.update(data);
        })

        // Species controls
        html.find(".species-container .species-control").click(this._onSpeciesControl.bind(this));

        // Item Dragging
        html.find("li.draggable").each((i, li) => {
            if (li.classList.contains("inventory-header")) return;
            li.setAttribute("draggable", true);
            li.addEventListener("dragstart", (ev) => this._onDragStart(ev), false);
        });

        html.find('.condition-radio').on("change", event => {
            this.actor.update({"data.health.condition": parseInt(event.currentTarget.value)});
        })

        // html.find("div.item-container").each((i, div) => {
        //   div.addEventListener("dragend", (ev) => this._onDragEnd(ev), false);
        // });

        html.find("tr.skill").each((i, li) => {
            li.setAttribute("draggable", true);
            li.addEventListener("dragstart", (ev) => this._onDragSkillStart(ev), false);
        });

        html.find("tr.ability").each((i, li) => {
            li.setAttribute("draggable", true);
            li.addEventListener("dragstart", (ev) => this._onDragAbilityStart(ev), false);
        });

        html.find("div.attack").each((i, li) => {
            li.setAttribute("draggable", true);
            li.addEventListener("dragstart", (ev) => this._onDragAttackStart(ev), false);
        });

        html.find("#generationType").on("click", event => this._selectAttributeGeneration(event, this));
        html.find("#rollAbilities").on("click", async event => this._selectAttributeScores(event, this, {}, true));
        html.find("#assignStandardArray").on("click", async event => this._selectAttributeScores(event, this, CONFIG.SWSE.Abilities.standardScorePackage, false));
        html.find("#assignAttributePoints").on("click", event => this._assignAttributePoints(event, this));
        html.find("#assignManual").on("click", async event => this._selectAttributesManually(event, this));
        html.find(".leveledAttributeBonus").each((i, button) => {
            button.addEventListener("click", (event) => this._selectAttributeLevelBonuses(event, this));
        })


        // Add Inventory Item
        html.find('.item-create').click(this._onItemCreate.bind(this));

        // Update Inventory Item
        html.find('.item-edit').click(ev => {
            const li = $(ev.currentTarget).parents(".item");
            const item = this.actor.getOwnedItem(li.data("itemId"));
            console.log(item)
            item.sheet.render(true);
        });

        // Delete Inventory Item
        html.find('.item-delete').click(ev => {
            const li = $(ev.currentTarget).parents(".item");
            let title = `Are you sure you want to delete ${li.data("itemName")}`;
            Dialog.confirm({
                title: title,
                content: title,
                yes: async () => {
                    let itemToDelete = this.actor.getOwnedItem(li.data("itemId"));
                    if (itemToDelete.data.data.items) {
                        for (let childItem of itemToDelete.data.data.items) {
                            let ownedItem = this.actor.getOwnedItem(childItem._id);
                            await itemToDelete.revokeOwnership(ownedItem);
                        }
                    }

                    await this.actor.deleteOwnedItem(li.data("itemId"));
                    li.slideUp(200, () => this.render(false));
                    this.actor.data.data.equippedIds = this.actor.data.data.equippedIds.filter((val) => {
                        return val !== li.data("itemId")
                    });
                },
                no: () => {
                },
            });
        });

        // Rollable abilities.
        html.find('.rollable').click(this._onRoll.bind(this));

        html.find('[data-action="compendium"]').click(this._onOpenCompendium.bind(this));
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
        return CONFIG.SWSE.Abilities.defaultPointBuyTotal;
    }

    updateTotal(html) {
        let total = this.getTotal(html);

        html.find(".adjustable-total").each((i, item) => {
            item.innerHTML = total
        })
    }

    getTotal(html) {
        let abilityCost = CONFIG.SWSE.Abilities.abilityCost;
        let total = 0;
        html.find(".adjustable-value").each((i, item) => {
            total += abilityCost[item.innerHTML];
        })
        return total;
    }

    _onDragMiscStart(event, type) {
        const result = {
            type: type,
            actor: this.actor._id,
        };
        if (this.actor.isToken) {
            result.sceneId = canvas.scene._id;
            result.tokenId = this.actor.token._id;
        }

        event.dataTransfer.setData("text/plain", JSON.stringify(result));
    }

    _onDragAbilityStart(event) {
        const elem = event.currentTarget;

        const result = {
            type: "ability",
            actor: this.actor._id,
            ability: elem.dataset.label
        };
        if (this.actor.isToken) {
            result.sceneId = canvas.scene._id;
            result.tokenId = this.actor.token._id;
        }

        event.dataTransfer.setData("text/plain", JSON.stringify(result));
    }

    _onDragSkillStart(event) {
        const elem = event.currentTarget;

        let skill = elem.dataset.skill;
        let label = elem.dataset.label;

        const result = {
            type: "skill",
            actor: this.actor._id,
            skill: skill,
            label: label

        };
        if (this.actor.isToken) {
            result.sceneId = canvas.scene._id;
            result.tokenId = this.actor.token._id;
        }

        event.dataTransfer.setData("text/plain", JSON.stringify(result));
    }

    _onDragAttackStart(event) {
        const elem = event.currentTarget;

        let attackId = elem.dataset.attackId;
        let label = elem.dataset.label;
        let img = elem.dataset.img;

        const result = {
            type: "attack",
            actor: this.actor._id,
            attackId,
            label,
            img
        };
        if (this.actor.isToken) {
            result.sceneId = canvas.scene._id;
            result.tokenId = this.actor.token._id;
        }

        event.dataTransfer.setData("text/plain", JSON.stringify(result));
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
                if (el.nodeName === "INPUT") value = el.value;
                else if (el.nodeName === "SELECT") value = el.options[el.selectedIndex].value;

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
                updateTarget = this.actor.getOwnedItem(el.dataset.item)
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

    _onSpanTextInput(event, callback = null, type) {
        const el = event.currentTarget;
        const parent = el.parentElement;

        // Replace span element with an input (text) element
        const newEl = document.createElement(`INPUT`);
        newEl.type = type;
        if (el.dataset?.dtype) newEl.dataset.dtype = el.dataset.dtype;
        if (el.dataset?.item) newEl.dataset.item = el.dataset.item;

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
                source = this.actor.getOwnedItem(item);
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
        newEl.addEventListener("focusout", (event) => {
            if (!changed) {
                this._render();
            }
        });

        // Select text inside new element
        newEl.focus();
        newEl.select();
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
        if (data.data) {
            await this.moveExistingItem(data, ev);
            return;
        }
        const item = await Item.fromDropData(data);

        //console.log("Item Dropped: ",item);

        let additionalEntitiesToAdd = [];
        let context = {};

        //only one species allowed
        if (item.data.type === "species") {
            //TODO apply species items
            if (this.actor.data.species != null) {
                new Dialog({
                    title: "Species Selection",
                    content: "Only one species allowed at a time.  Please remove the existing one before adding a new one.",
                    buttons: {
                        ok: {
                            icon: '<i class="fas fa-check"></i>',
                            label: 'Ok'
                        }
                    }
                }).render(true);
                return;
            }

            await this.actor.addItemsFromCompendium('ability', item, additionalEntitiesToAdd, item.data.data.categories);
            await this.actor.addItemsFromCompendium('feat', item, additionalEntitiesToAdd, this._getFeatsFromCategories(item.data.data.categories));
            await this.actor.addItemsFromCompendium('item', item, additionalEntitiesToAdd, item.data.data.attributes.items);

        } else if (item.data.type === "class") {
            let meetsPrereqs = this._meetsClassPrereqs(item.data.data.prerequisites);
            if (meetsPrereqs.doesFail) {
                new Dialog({
                    title: "You Don't Meet the Prerequisites!",
                    content: "You do not meet the prerequisites for this class:<br/>" + this._formatPrerequisites(meetsPrereqs.failureList),
                    buttons: {
                        ok: {
                            icon: '<i class="fas fa-check"></i>',
                            label: 'Ok'
                        }
                    }
                }).render(true);
                return;
            } else if (!meetsPrereqs.doesFail && meetsPrereqs.failureList.length > 0) {
                new Dialog({
                    title: "You MAY Meet the Prerequisites!",
                    content: "You MAY meet the prerequisites for this class. Check the remaining reqs:<br/>" + this._formatPrerequisites(meetsPrereqs.failureList),
                    buttons: {
                        ok: {
                            icon: '<i class="fas fa-check"></i>',
                            label: 'Ok'
                        }
                    }
                }).render(true);
            }
            if (!item.data.data.prerequisites.isPrestige) {
                if (item.data.data.feats.feats.length > 0) {
                    await this.addClassFeats(item, additionalEntitiesToAdd);
                }
                item.data.data.attributes.first = this.actor.data.classes.length === 0;

                if (item.data.data.attributes.first) {
                    item.data.data.health.rolledHp = item.data.data.health.firstLevel;
                    context.isFirstLevel = true;
                }

            }
        } else if (item.data.type === "feat") {
            let possibleFeatTypes = [];

            let optionString = "";
            for (let category of item.data.bonusFeatCategories) {
                if (this.actor.data.availableItems[category] > 0) {
                    possibleFeatTypes.push(category);
                    optionString += `<option value="${category}">${category}</option>`;
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
                        possibleFeatTypes = [key];
                    }
                });
            }
            let filteredCategories = [];
            for (let category of item.data.data.categories) {
                if (!category.endsWith(" Bonus Feats")) {
                    possibleFeatTypes.push(category);
                }
            }
            filteredCategories.push(...possibleFeatTypes);


            item.data.data.categories = filteredCategories;


            if (item.data.data.prerequisites) {
                let meetsPrereqs = this.actor.meetsFeatPrerequisites(item.data.data.prerequisites, true);
                if (meetsPrereqs.doesFail) {
                    return;
                }
            }
        } else if (item.data.type === "forcePower" || item.data.type === "forceTechnique" || item.data.type === "forceSecret") {

            if (item.data.type === "forceSecret") {
                if (!this.actor.data.availableItems["Force Secrets"]) {
                    await Dialog.prompt({
                        title: "You can't take any more Force Secrets",
                        content: "You can't take any more Force Secrets",
                        callback: () => {
                        }
                    });
                    return;
                }
            } else if (item.data.type === "forceTechnique") {
                if (!this.actor.data.availableItems["Force Techniques"]) {
                    await Dialog.prompt({
                        title: "You can't take any more Force Techniques",
                        content: "You can't take any more Force Techniques",
                        callback: () => {
                        }
                    });
                    return;
                }
            } else if (item.data.type === "forcePower") {
                if (!this.actor.data.availableItems["Force Powers"]) {
                    await Dialog.prompt({
                        title: "You can't take any more Force Powers",
                        content: "You can't take any more Force Powers",
                        callback: () => {
                        }
                    });
                    return;
                }
            }


            if (item.data.data.prerequisites) {
                let meetsPrereqs = this.actor.meetsFeatPrerequisites(item.data.data.prerequisites, true);
                if (meetsPrereqs.doesFail) {
                    return;
                }
            }
        } else if (item.data.type === "talent") {
            let pattern = /([\w\s\d-]*) Talent Trees?/;
            let possibleTalentTrees = [];
            let optionString = "";

            if (item.data.talentTree === this.actor.data.data.bonusTalentTree) {
                for (let [id, item] of Object.entries(this.actor.data.availableItems)) {
                    if (id.includes("Talent") && !id.includes("Force") && item > 0) {
                        optionString += `<option value="${id}">${id}</option>`
                        possibleTalentTrees.push(id);
                    }
                }
            } else {
                for (let talentTree of item.data.data.categories) {
                    let type = pattern.exec(talentTree);
                    if (type) {
                        talentTree = type[1] + " Talents";
                        let count = this.actor.data.availableItems[talentTree];
                        if (count && count > 0) {
                            optionString += `<option value="${talentTree}">${talentTree}</option>`
                            possibleTalentTrees.push(talentTree);
                        }
                    }
                }
            }
            // if(!isForce && this.actor.data.data.bonusTalentTree && this.actor.data.data.bonusTalentTree.length > 0){
            //     possibleTalentTrees.push(this.actor.data.data.bonusTalentTree.replace("Talent Tree", "Talents"));
            // }

            if (possibleTalentTrees.length === 0) {
                await Dialog.prompt({
                    title: "You can't take any more talents of that type",
                    content: "You can't take any more talents of that type",
                    callback: () => {
                    }
                });
                return;
            } else if (possibleTalentTrees.length > 1) {
                let content = `<p>Select an unused talent source.</p>
                        <div><select id='choice'>${optionString}</select> 
                        </div>`;

                await Dialog.prompt({
                    title: "Select an unused talent source.",
                    content: content,
                    callback: async (html) => {
                        let key = html.find("#choice")[0].value;
                        possibleTalentTrees = [key];
                    }
                });
            }
            let filteredCategories = [];
            for (let category of item.data.data.categories) {
                if (!category.endsWith(" Talent Trees") && !category.endsWith(" Talent Tree")) {
                    filteredCategories.push(category);
                }
            }
            filteredCategories.push(...possibleTalentTrees);


            item.data.data.categories = filteredCategories;

            if (item.data.prerequisites) {
                let meetsPrereqs = this.actor.meetsFeatPrerequisites(item.data.prerequisites);
                if (meetsPrereqs.doesFail) {
                    return;
                }
            }
        }
        await this.activateChoices(item, additionalEntitiesToAdd, context);
        //await this._addItemsFromItems(actorData);
        additionalEntitiesToAdd.push(item)
        console.log(additionalEntitiesToAdd)
       // debugger
        await super._onDropItemCreate(additionalEntitiesToAdd.map(entity => entity.data));
    }


    async moveExistingItem(data, ev) {
        if (data.itemId) {
            console.log(data.data._id)
            let movedItem = this.actor.getOwnedItem(data.data._id);
            let parentItem = this.actor.getOwnedItem(data.itemId);

            await parentItem.revokeOwnership(movedItem);
        } else {
            //equip/unequip workflow
            let cursor = ev.target;
            while (cursor != null && !cursor.classList.contains("item-container")) {
                cursor = cursor.parentElement;
            }

            if (cursor != null) {
                let ids = this.actor.data.data.equippedIds;
                let itemId = data.data._id;

                if (cursor.classList.contains("equipped")) {
                    ids = [itemId].concat(this.actor.data.data.equippedIds);
                } else if (cursor.classList.contains("unequipped")) {
                    ids = this.actor.data.data.equippedIds.filter((value => {
                        return value !== itemId
                    }))
                }

                this._pendingUpdates['data.equippedIds'] = ids;
                await this._onSubmit(ev);
            }
        }
    }

    async activateChoices(item, additionalEntitiesToAdd, context) {
        let choices = item.data.data.choices;
        for (let choice of choices ? choices : []) {
            if (choice.isFirstLevel && !context.isFirstLevel) {
                continue;
            }

            let options = await this._explodeOptions(choice.options);

            let greetingString;
            let optionString = "";
            if (Object.keys(options).length === 0){
                greetingString = choice.noOptions;
            } else if (Object.keys(options).length === 1){
                greetingString = choice.oneOption;
                let optionLabel = Object.keys(options)[0];
                optionString = `<div id="choice" value="${optionLabel}">${optionLabel}</div>`
            } else {
                greetingString = choice.description;

                for (let optionLabel of Object.keys(options)) {
                    optionString += `<option value="${optionLabel}">${optionLabel}</option>`
                }

                if (optionString !== "") {
                    optionString = `<div><select id='choice'>${optionString}</select> 
                        </div>`
                }
            }



            let content = `<p>${greetingString}</p>${optionString}`;

            await Dialog.prompt({
                title: greetingString,
                content: content,
                callback: async (html) => {

                    let choice = html.find("#choice")[0];
                    let key = choice?.value;

                    if(!key){
                        key = choice?.innerText;
                    }
                    let selectedChoice = options[key];
                    console.log(selectedChoice)
                    if (selectedChoice.abilities && selectedChoice.abilities.length > 0) {
                        await this.actor.addItemsFromCompendium('ability', item, additionalEntitiesToAdd, selectedChoice.abilities);
                    }
                    if (selectedChoice.items && selectedChoice.items.length > 0) {
                        await this.actor.addItemsFromCompendium('item', item, additionalEntitiesToAdd, selectedChoice.items);
                    }
                    if (selectedChoice.feats && selectedChoice.feats.length > 0) {
                        await this.actor.addItemsFromCompendium('feat', item, additionalEntitiesToAdd, selectedChoice.feats);
                    }
                    if (selectedChoice.payload && selectedChoice.payload !== "") {
                        item.setPayload(selectedChoice.payload);

                    }
                }
            });
        }

    }

    async addClassFeats(item, additionalEntitiesToAdd) {
        let feats = item.data.data.feats.feats;
        let nonPrestigeClasses = this.actor.getNonPrestigeClasses();
        if (nonPrestigeClasses.length === 0) {
            await this.actor.addItemsFromCompendium('ability', item, additionalEntitiesToAdd, await feats.map(feat => `Bonus Feat (${this.actor.cleanItemName(feat)})`));
            let newVar = await this.actor.addItemsFromCompendium('feat', item, additionalEntitiesToAdd, await feats.map(feat => this.actor.cleanItemName(feat)))

            let featString = newVar.notificationMessage;

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
        } else if (this._isFirstLevelOfClass(item.data.name)) {
            let options = "";
            for (let feat of feats) {
                options += `<option value="${feat}">${feat}</option>`
            }

            await Dialog.prompt({
                title: "Select a Starting feat from this class",
                content: `<p>Select a Starting feat from this class</p>
                        <div><select id='feat'>${options}</select> 
                        </div>`,
                callback: async (html) => {
                    let feat = html.find("#feat")[0].value;
                    await this.actor.addItemsFromCompendium('ability', item, additionalEntitiesToAdd, `Bonus Feat (${this.actor.cleanItemName(feat)})`)
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
        const dataset = element.dataset;

        if (dataset.roll) {
            let rolls = [dataset.roll];
            if (dataset.roll.includes(",")) {
                rolls = dataset.roll.split(",");
            }
            for (let rollStr of rolls) {
                let roll = new Roll(rollStr, this.actor.data.data);
                let label = dataset.label ? `Rolling ${dataset.label}` : '';
                roll = roll.roll();

                if (dataset.name) {
                    let updateCandidate = this.actor;
                    if (dataset.item) {
                        updateCandidate = this.actor.getOwnedItem(dataset.item);
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

    _onOpenCompendium(event) {
        event.preventDefault();
        const a = event.currentTarget;
        const target = a.dataset.actionTarget;
//TODO change this when compendiums are part of the game system
        let newVar = game.packs.get(target);
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
        const item = this.actor.getOwnedItem(li.dataset.itemId);
        item.sheet.render(true);
    }

    /**
     * Handle deleting an existing Owned Item for the Actor
     * @param {Event} event   The originating click event
     * @private
     */
    _onItemDelete(event) {
        event.preventDefault();

        const button = event.currentTarget;
        if (button.disabled) return;

        const li = event.currentTarget.closest(".item");
        if (keyboard.isDown("Shift")) {
            this.actor.deleteOwnedItem(li.dataset.itemId);
        } else {
            button.disabled = true;

            const item = this.actor.items.find((o) => o._id === li.dataset.itemId);
            const msg = `Are you sure you want to delete ${item.name}`;
            Dialog.confirm({
                title: `Are you sure you want to delete ${item.name}`,
                content: msg,
                yes: () => {
                    this.actor.deleteOwnedItem(li.dataset.itemId);
                    button.disabled = false;
                },
                no: () => (button.disabled = false),
            });
        }
    }


    _isFirstLevelOfClass(name) {
        let item = this.actor.items.find(i => i.name === name);
        return item === null;
    }

    _formatPrerequisites(failureList) {
        let format = "<ul>";
        for (let fail of failureList) {
            format = format + "<li>" + fail.message + "</li>";
        }
        return format + "</ul>";
    }


    //TODO clean this shit up
    _meetsClassPrereqs(prerequisites) {
        let failureList = [];
        for (let [key, value] of Object.entries(prerequisites.prerequisites)) {
            value = value.trim();
            key = key.trim();
            if (key.toLowerCase() === 'trained skills') {
                this.checkTrainedSkills(value, failureList, key);
            } else if (key.toLowerCase() === 'minimum level') {
                if (this.actor.data.prerequisites.charLevel < parseInt(value)) {
                    failureList.push({fail: true, message: `<b>${key}:</b> ${value}`});
                }
            } else if (key.toLowerCase() === 'base attack bonus') {
                if (this.actor.data.prerequisites.bab < parseInt(value)) {
                    failureList.push({fail: true, message: `<b>${key}:</b> ${value}`});
                }
            } else if (key.toLowerCase() === 'species') {
                if (this.actor.data.prerequisites.species === value.toLowerCase) {
                    failureList.push({fail: true, message: `<b>${key}:</b> ${value}`});
                }
            } else if (key.toLowerCase() === 'force techniques') {
                let result = /at least (\w*)/.exec(value.toLowerCase());
                if (result != null) {
                    if (this.actor.data.prerequisites.techniques.length < this._fromOrdinal(result[1])) {
                        failureList.push({fail: true, message: `<b>${key}:</b> ${value}`});
                    }
                }
            } else if (key.toLowerCase() === 'force powers') {
                if (!this.actor.data.prerequisites.powers.includes(value.trim().toLowerCase())) {
                    failureList.push({fail: true, message: `<b>${key}:</b> ${value}`});
                }
            } else if (key.toLowerCase() === 'droid systems') {
                if (!this.actor.data.prerequisites.equippedItems.includes(value.trim().toLowerCase())) {
                    failureList.push({fail: true, message: `<b>${key}:</b> ${value}`});
                }
            } else if (key.toLowerCase() === 'feats') {
                this.checkFeats(value, failureList, key);
            } else if (key.toLowerCase() === 'talents' || key.toLowerCase() === 'talent') {
                this.checkTalents(value, failureList, key);
            } else if (key.toLowerCase() === 'special') {
                if (value.toLowerCase() === 'must be a droid.' || value.toLowerCase() === 'must be a droid') {
                    if (!this.actor.data.prerequisites.isDroid) {
                        failureList.push({fail: true, message: `<b>${key}:</b> ${value}`});
                    }
                } else {
                    failureList.push({fail: false, message: `<b>${key}:</b> ${value}`});
                }

            } else {
                console.error("UNIDENTIFIED PREREQ", "[" + key + "]", value);
                failureList.push({fail: true, message: `<b>${key}:</b> ${value} [UNIDENTIFIED]`});
            }
        }
        let doesFail = false;
        for (let fail of failureList) {
            if (fail.fail === true) {
                doesFail = true;
                break;
            }
        }

        return {doesFail: doesFail, failureList: failureList};
    }

    checkTalents(value, failureList, key) {
        let result = /(?:at least|any) (\w*) talent(?:s)? from ([\s\w,]*)(?:\.)?/.exec(value.toLowerCase());
        if (result != null) {
            let talentReq = false;
            let toks = [];
            if (result[2].includes(',')) {
                if (result[2].includes(' or ')) {
                    toks = result[2].split(",");
                } else {
                    console.log(toks);
                }
            } else if (result[2].includes(' or ')) {
                toks = result[2].split(" or ");
            } else {
                toks[0] = result[2];
            }

            for (let tok of toks) {
                tok = /(?: )?(?:or )?(?:either )?(?:the )?([\s\w]*)/.exec(tok)[1];
                if (this.actor.data.prerequisites.talentTrees[tok] >= this._fromOrdinal(result[1])) {
                    talentReq = true;
                }
            }
            if (!talentReq) {
                failureList.push({fail: true, message: `<b>${key}:</b> ${value}`});
            }

        } else {
            let result = /at least (\w*) force talents/.exec(value.toLowerCase());

            if (result != null) {
                if (this.actor.data.prerequisites.forceTalentTreesCount < this._fromOrdinal(result[1])) {
                    failureList.push({fail: true, message: `<b>${key}:</b> ${value}`});
                }
            } else if (!this.actor.data.prerequisites.talents.includes(value.toLowerCase())) {
                failureList.push({fail: true, message: `<b>${key}:</b> ${value}`});
            }
        }
    }

    checkFeats(value, failureList, key) {
        if (value.includes(',')) {
            let toks = value.split(",");
            for (let tok of toks) {
                if (!this._hasFeat(tok)) {
                    failureList.push({fail: true, message: `<b>${key}:</b> ${tok}`});
                }
            }

        } else if (!this.actor.data.prerequisites.feats.includes(value.toLowerCase())) {
            failureList.push({fail: true, message: `<b>${key}:</b> ${value}`});
        }
    }

    checkTrainedSkills(value, failureList, key) {
        let toks = [];
        if (value.includes(', ')) {
            toks = value.split(", ");
        } else if (value.includes(" and ")) {
            toks = value.split(" and ");
        } else {
            toks[0] = value;
        }

        for (let tok of toks) {
            tok = /([\w\s()]*)/.exec(tok)[1].trim();
            if (!this.actor.data.prerequisites.trainedSkills.includes(tok.toLowerCase())) {
                failureList.push({fail: true, message: `<b>${key}:</b> ${tok}`});
            }
        }
    }


    _fromOrdinal(numberWord) {
        let num = numberWord.toLowerCase();
        if (num === 'zero') {
            return 0;
        } else if (num === 'one') {
            return 1;
        } else if (num === 'two') {
            return 2;
        } else if (num === 'three') {
            return 3;
        } else if (num === 'four') {
            return 4;
        } else {
            console.error(`${numberWord} is unrecognized`);
        }
        return undefined;
    }

    _hasFeat(value) {
        if (value.includes(" or ")) {
            let toks = value.split(" or ");
            let hasFeat = false;
            for (let tok of toks) {
                hasFeat = hasFeat || this.actor.data.prerequisites.feats.includes(tok.trim().toLowerCase());
            }
            return hasFeat;
        } else {
            return this.actor.data.prerequisites.feats.includes(value.trim().toLowerCase());
        }
    }

    async _explodeOptions(options) {
        let resolvedOptions = {};
        for (let [key, value] of Object.entries(options)) {
            if (key === 'EXOTIC_WEAPON') {
                for (let weapon of game.generated.exoticWeapons) {
                    resolvedOptions[weapon] = {abilities: [], items: [], payload: weapon};
                }
            } else if (key === 'PROFICIENT_WEAPON') {
                for (let weapon of this.actor.data.proficiency.weapon) {
                    resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                }
            } else if (key === 'FOCUS_WEAPON') {
                for (let weapon of this.actor.data.proficiency.focus) {
                    resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                }
            } else if (key === 'TRAINED_SKILL') {
                for (let weapon of this.actor.data.prerequisites.trainedSkills) {
                    resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                }
            } else if (key === 'FOCUS_SKILL') {
                for (let weapon of this.actor.data.prerequisites.focusSkills) {
                    resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                }
            } else {
                resolvedOptions[key] = value;
            }
        }
        return resolvedOptions;
    }

    async _selectAttributeScores(event, sheet, scores, canReRoll) {
        if (Object.keys(scores).length === 0) {
            let existingValues = sheet.actor.getAttributes();

            scores = {str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8};
            for (let val in existingValues) {
                scores[val] = existingValues[val];
            }
        }

        let data = {
            canReRoll,
            abilities: CONFIG.SWSE.Abilities.droidSkip,
            isDroid: sheet.actor.data.data.isDroid,
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
            no: async (html) => {

            },
            render: (html) => {
                html.find(".movable").each((i, item) => {
                    item.setAttribute("draggable", true);
                    item.addEventListener("dragstart", (ev) => this._onDragStartMovable(ev), false);
                });

                html.find(".container").each((i, item) => {
                    item.addEventListener("drop", (ev) => this._onDragEndMovable(ev), false);
                });

                if (canReRoll) {
                    html.find("#reRoll").each((i, button) => {
                        button.addEventListener("click", (event) => {
                            let rollFormula = CONFIG.SWSE.Abilities.defaultAbilityRoll;
                            html.find(".movable").each((i, item) => {
                                let roll = new Roll(rollFormula).roll();
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

    async _selectAttributesManually(event, sheet) {
        let existingValues = sheet.actor.getAttributes();
        let combined = {};
        for (let val in existingValues) {
            combined[val] = {val: existingValues[val], skip: CONFIG.SWSE.Abilities.droidSkip[val]};
        }

        let data = {
            availablePoints: sheet.getPointBuyTotal(),
            abilityCost: CONFIG.SWSE.Abilities.abilityCost,
            abilities: combined,
            isDroid: sheet.actor.data.data.isDroid
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

    async _selectAttributeLevelBonuses(event, sheet) {
        let level = $(event.currentTarget).data("level");
        let bonus = sheet.actor.getAttributeLevelBonus(level);

        let combined = {};
        for (let val of Object.keys(CONFIG.SWSE.Abilities.droidSkip)) {
            combined[val] = {val: bonus[val], skip: CONFIG.SWSE.Abilities.droidSkip[val]};
        }

        let availableBonuses = [false, false];
        for (let i = 0; i < 2 - Object.values(bonus).filter(b => b !== null).length; i++) {
            availableBonuses[i] = true;
        }

        let data = {
            abilityCost: CONFIG.SWSE.Abilities.abilityCost,
            abilities: combined,
            isDroid: sheet.actor.data.data.isDroid,
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
                    item.addEventListener("dragstart", (ev) => this._onDragStartMovable(ev), false);
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

    async _assignAttributePoints(event, sheet) {
        let existingValues = sheet.actor.getAttributes();
        let combined = {};
        for (let val in existingValues) {
            combined[val] = {val: existingValues[val], skip: CONFIG.SWSE.Abilities.droidSkip[val]};
        }

        let data = {
            availablePoints: sheet.getPointBuyTotal(),
            abilityCost: CONFIG.SWSE.Abilities.abilityCost,
            abilities: combined,
            isDroid: sheet.actor.data.data.isDroid
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
                        if (parseInt(item.innerHTML) > 18 || sheet.getTotal(html) > sheet.getPointBuyTotal()) {
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

    _onDragStartMovable(ev) {
        //ev.dataTransfer.dropEffect = "move";
        ev.dataTransfer.setData("text/plain", ev.target.id);
    }

    _onDragOver(ev) {
        ev.preventDefault();
        ev.dataTransfer.dropEffect = "move";
    }

    _onDragEndMovable(ev) {
        ev.preventDefault();
        // Get the id of the target and add the moved element to the target's DOM
        const data = ev.dataTransfer.getData("text/plain");
        if (ev.target.children.length === 0 && ev.target.classList.contains("container")) {
            ev.target.appendChild(document.getElementById(data));
        }
    }

    _getFeatsFromCategories(categories = []) {
        let feats = [];
        for (let category of categories) {
            let result = /Bonus Feat \(([\w\s()]*)\)/.exec(category);
            if (result) {
                feats.push(result[1])
            }
        }
        return feats;
    }
}
