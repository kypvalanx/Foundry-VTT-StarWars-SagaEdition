import {filterItemsByType, getBonusString, getOrdinal, getRangedAttackMod, handleAttackSelect} from "../util.js";
import {SWSE} from "../config.js";
import {formatPrerequisites, meetsPrerequisites} from "../prerequisite.js";
import {generateAttackFromWeapon, generateUnarmedAttack} from "./attack-handler.js";
import {SWSEItem} from "../item/item.js";

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
        // Return a single sheet for all item types.
        //return `${path}/item-sheet.hbs`;
        // Alternatively, you could use the following return statement to do a
        // unique item sheet by type, like `weapon-sheet.html`.

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

        return `${path}/actor-sheet.hbs`;
        //return `${path}/${this.item.data.type}-sheet.html`; //TODO add sheets for each type
    }

    /* -------------------------------------------- */

    /** @override */
    getData(options) {
        const data = super.getData(options);

        return data;
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        // Everything below here is only needed if the sheet is editable
        if (!this.options.editable) return;


        html.find("input.plain").on("change", this._onChangeInput.bind(this));

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

        html.find("input.skill").on("change", async (event) => {
            let data = {};
            data["data.skills." + event.currentTarget.dataset.id + ".trained"] = event.currentTarget.checked;
            await this.actor.update(data);
        })

        // Species controls
        html.find(".species-control").click(this._onSpeciesControl.bind(this));

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

        html.find("div.item-container").each((i, div) => {
            div.addEventListener("drop", (ev) => this._onDrop(ev), false);
        });
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
        html.find("#fullAttack").on("click", () => this.attack(event, {type: "fullAttack"}));

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
        if (keyboard.isDown("Shift")) {
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

    buildAttackDialog(context) {
        let availableAttacks = 1;
        let title = "Single Attack";
        let dualWeaponModifier = -10;
        let doubleAttack = [];
        let tripleAttack = [];
        let hands = 2; //TODO resolve extra hands

        if (context.type === "fullAttack") {
            title = "Full Attack";
            doubleAttack = this.actor.getInheritableAttributesByKey("doubleAttack", null, "VALUES");
            tripleAttack = this.actor.getInheritableAttributesByKey("tripleAttack", null, "VALUES");

            //availableAttacks = this.actor.fullAttackCount;
            let equippedItems = this.actor.getEquippedItems()
            availableAttacks = 0;
            let doubleAttackBonus = 0;
            let tripleAttackBonus = 0;
            let availableWeapons = 0
            for(let item of equippedItems){
                availableWeapons = Math.min(availableWeapons + (item.isDoubleWeapon ? 2 : 1), 2);
                if(doubleAttack.includes(item.data.data.subtype)){
                    doubleAttackBonus = 1;
                }if(tripleAttack.includes(item.data.data.subtype)){
                    tripleAttackBonus = 1;
                }
            }
            availableAttacks = availableWeapons + doubleAttackBonus + tripleAttackBonus


            //how many attacks?
            //
            //how many provided attacks from weapons max 2
            //+1 if has double attack and equipped item
            //+1 if has triple attack and equipped item

            let dualWeaponModifiers = this.actor.getInheritableAttributesByKey("dualWeaponModifier", null, "NUMERIC_VALUES");
            dualWeaponModifier = dualWeaponModifiers.reduce((a, b) => Math.max(a, b), -10)
            console.log(dualWeaponModifier, doubleAttack, tripleAttack)
        }

        let suppliedItems = context.items || [];

        // if (suppliedItems.length > 0) {
        //     availableAttacks = suppliedItems.length;
        // }

        let content = `<p>Select Attacks:</p>`;
        let resolvedAttacks = [];
        if (suppliedItems.length < availableAttacks) {
            //CREATE OPTIONS
            resolvedAttacks = this.getAttackOptions(doubleAttack, tripleAttack, hands);
        }


        let blockHeight = 225;


        for (let i = 0; i < availableAttacks; i++) {
            let item = suppliedItems.length > i ? suppliedItems[i] : undefined;
            let select;
            if (!!item) {
                let attack = this.actor.data.data.attacks.find(o => o.itemId === item || o.name === item)
                select = `<span class="attack-id" data-value="${JSON.stringify(attack).replaceAll("\"", "&quot;")}">${attack.name}</span>`
            } else {
                select = `<select class="attack-id" id="attack-${i}"><option> -- </option>${resolvedAttacks.join("")}</select>`
            }


            let attackBlock = `<div class="attack panel attack-block"><div class="attack-name">${select}</div><div class="attack-options"></div><div class="attack-total"></div></div>`


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
                        for(let attackBlock of attackBlocks){
                            let attackFromBlock = this.getAttackFromBlock(attackBlock);
                            if(!!attackFromBlock) {
                                attacks.push(attackFromBlock);
                            }
                        }

                        this.rollAttacks(attacks);
                    }
                }
            },
            render: async (html) => {
                let selects = html.find("select");
                selects.on("change", e => handleAttackSelect(selects));
                handleAttackSelect(selects)

                let attackIds = html.find(".attack-id");
                attackIds.each((i, div) => this.populateItemStats(div, context));

                attackIds.on("change", e => {
                    let attackIds = html.find(".attack-id");
                    context.attackMods = this.getAttackMods(selects, dualWeaponModifier);
                    context.damageMods = this.getDamageMods(selects, dualWeaponModifier);
                    attackIds.each((i, div) => this.populateItemStats(div, context));
                    this._render();
                })
                this._render();
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
        for (let select of selects) {
            if (select.value === "--") {
                continue;
            }
            let attack = JSON.parse(select.value);
            let mods = attack.mods
            if (mods === "doubleAttack") {
                attackMods.push({value: -5, source: "Double Attack"});
            }
            if (mods === "tripleAttack") {
                attackMods.push({value: -5, source: "Triple Attack"});
            }
            itemIds.push(attack.itemId)
        }
        itemIds = itemIds.filter((value, index, self) => self.indexOf(value) === index)

        if (itemIds.length > 1) {
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
        if (value === "--") {
            return;
        }
        let attack;
        if(typeof value === "string"){
            attack = JSON.parse(value);
        } else {
            attack = value;
        }
        //let attack = JSON.parse(value);
        let itemId = attack.itemId;

        let parent = $(html).parents(".attack");
        let options = parent.children(".attack-options")
        options.empty();
        if (itemId === "Unarmed Attack") {
            let attack = generateUnarmedAttack(this.actor);
            options.append(SWSEItem.getModifierHTML(0))

            options.find(".attack-modifier").on("change", ()=> this.setAttackTotal(attack, total, options, context))
            options.find(".damage-modifier").on("change", ()=> this.setAttackTotal(attack, total, options, context))

            let total = parent.children(".attack-total");
            this.setAttackTotal(attack, total, options, context);
        } else {

            let item = this.actor.items.get(itemId)


            if (item) {
                let rangedAttackModifier = getRangedAttackMod(item.effectiveRange, item.accurate, item.inaccurate, this.actor);

                let attack = generateAttackFromWeapon(item, this.actor);
                options.append(SWSEItem.getModifierHTML(rangedAttackModifier, item))

                options.find(".attack-modifier").on("change", ()=> this.setAttackTotal(attack, total, options, context))
                options.find(".damage-modifier").on("change", ()=> this.setAttackTotal(attack, total, options, context))

                let total = parent.children(".attack-total");
                this.setAttackTotal(attack, total, options, context);
            }
        }

    }

    setAttackTotal(attack, total, options, context) {
        options.children()
        total.empty();
        let damageRoll = `<div>${attack.dam}</div>` + this.getModifiersFromContextAndInputs(options, context.damageMods, ".damage-modifier");
        let attackRoll = `<div>${attack.th}</div>` + this.getModifiersFromContextAndInputs(options, context.attackMods, ".attack-modifier");
        total.append(`<div class="flex flex-row"><div>Attack Roll: <div class="attack-roll">${attackRoll}</div></div> <div class="flex"><div>Damage Roll: <div class="damage-roll">${damageRoll}</div></div></div>`)
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
        for(let bonus of bonuses){
            roll += `<div title="${bonus.source}">${bonus.value}</div>`
        }
        return roll;
    }

    getAttackOptions(doubleAttack, tripleAttack, hands) {
        let attacks = this.actor.data.data.attacks;

        let resolvedAttacks = [];

        //only 2 different weapons can be used
        //double attacks can only be used once first attack is used
        //triple attacks can only be used once doubel attack is used
        let existingWeaponNames = [];
        let id = 1;
        for (let attack of attacks) {
            let source = attack.source;
            if (!source) {
                continue;
            }

            let duplicateCount = existingWeaponNames.filter(name => name === attack.name).length;

            existingWeaponNames.push(attack.name)
            if (duplicateCount > 0) {
                attack.name = attack.name + ` #${duplicateCount + 1}`;
            }

            resolvedAttacks.push(this.createAttackOption(attack, id++))
            let additionalDamageDice = source.additionalDamageDice
            // if (additionalDamageDice.length === 0) {
            //     continue;
            // }
            for (let i = 0; i < additionalDamageDice.length; i++) {
                let additionalDamageDie = additionalDamageDice[i];
                let clonedAttack = JSON.parse(JSON.stringify(attack));
                clonedAttack.dam = additionalDamageDie;
                clonedAttack.name = clonedAttack.name + ` (${getOrdinal(i + 2)} attack)`
                clonedAttack.itemId = clonedAttack.itemId + `#${getOrdinal(i + 2)}`
                resolvedAttacks.push(this.createAttackOption(clonedAttack, id++))
            }

            if (doubleAttack.includes(source.data.data.subtype)) {
                let clonedAttack = JSON.parse(JSON.stringify(attack));
                clonedAttack.name = clonedAttack.name + ` (Double attack)`
                clonedAttack.mods = "doubleAttack";
                resolvedAttacks.push(this.createAttackOption(clonedAttack, id++))
            }
            if (tripleAttack.includes(source.data.data.subtype)) {
                let clonedAttack = JSON.parse(JSON.stringify(attack));
                clonedAttack.name = clonedAttack.name + ` (Triple attack)`
                clonedAttack.mods = "tripleAttack";
                resolvedAttacks.push(this.createAttackOption(clonedAttack, id++))
            }
        }
        return resolvedAttacks;
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
        if (this.actor.data.data.isDroid) {
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


    async _onDropItem(ev, data) {
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
        const item = await Item.implementation.fromDropData(data);

        let entitiesToAdd = [];
        let context = {};

        //only one species allowed
        if (item.data.type === "species") {
            entitiesToAdd.push(...await this.addSpecies(item));
        } else if (item.data.type === "class") {
            entitiesToAdd.push(...await this.addClass(item, context));
        } else if (item.data.type === "feat") {
            entitiesToAdd.push(...await this.addFeat(item));
        } else if (item.data.type === "forceSecret") {
            entitiesToAdd.push(...await this.addForceItem(item, "Force Secrets"));
        } else if (item.data.type === "forceTechnique") {
            entitiesToAdd.push(...await this.addForceItem(item, "Force Techniques"));
        } else if (item.data.type === "forcePower") {
            entitiesToAdd.push(...await this.addForceItem(item, "Force Powers"));
        } else if (item.data.type === "affiliation") {
            entitiesToAdd.push(...await this.addForceItem(item, "Affiliations"));
        } else if (item.data.type === "talent") {
            entitiesToAdd.push(...await this.addTalent(item));
        } else if (item.data.type === "weapon" || item.data.type === "armor" || item.data.type === "equipment" || item.data.type === "template" || item.data.type === "upgrade") {
            entitiesToAdd.push(item.data.toObject(false))
        }
        //await this.activateChoices(item, entitiesToAdd, context);
        await super._onDropItemCreate(entitiesToAdd);
    }


    async addTalent(item) {
        //TODO this should be a tighter system with less regex
        let possibleTalentTrees = new Set();
        let allTreesOnTalent = new Set();
        let optionString = "";

        if (item.data.data.bonusTalentTree === this.actor.getInheritableAttributesByKey('bonusTalentTree')[0]) {
            for (let [id, item] of Object.entries(this.actor.data.availableItems)) {
                if (id.includes("Talent") && !id.includes("Force") && item > 0) {
                    optionString += `<option value="${id}">${id}</option>`
                    possibleTalentTrees.add(id);
                }
            }
        } else {
            for (let talentTree of item.data.data.possibleProviders) {
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

        return await this.checkPrerequisitesAndResolveOptions(item);
    }

    async addForceItem(item, itemType) {
        if (!this.actor.data.availableItems[itemType] && itemType !== 'Affiliations') {
            await Dialog.prompt({
                title: `You can't take any more ${itemType}`,
                content: `You can't take any more ${itemType}`,
                callback: () => {
                }
            });
            return [];
        }
        return await this.checkPrerequisitesAndResolveOptions(item);
    }

    async checkPrerequisitesAndResolveOptions(item) {
        let entitiesToAdd = [item.data.toObject(false)];
        await this.activateChoices(item, entitiesToAdd, {});

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

        if (Array.from(this.actor.items.values())
            .map(i => i.data.finalName)
            .includes(item.data.finalName) && !SWSE.duplicateSkillList.includes(item.data.finalName)) {
            let itemType = item.data.type;
            await Dialog.prompt({
                title: `You already have this ${itemType}`,
                content: `You have already taken the ${item.data.finalName} ${itemType}`,
                callback: () => {
                }
            })
            return [];
        }
        return entitiesToAdd
    }

    async addFeat(item) {
        let possibleFeatTypes = [];

        let optionString = "";
        for (let category of item.data.data.bonusFeatCategories) {
            if (this.actor.data.availableItems[category.category] > 0) {
                possibleFeatTypes.push(category);
                optionString += `<option value="${category}">${category.category}</option>`;
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
                    possibleFeatTypes = [JSON.parse(key)];
                }
            });
        }

        for (let category of item.data.data.categories) {
            if (!category.value.endsWith(" Bonus Feats")) {
                possibleFeatTypes.push(category);
            }
        }

        item.data.data.categories = possibleFeatTypes;

        let items = await this.checkPrerequisitesAndResolveOptions(item);

        if (items.length > 0) {
            items.push(...await this.addOptionalRuleFeats(item));
        }

        return items;
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
        let entities = [];
        let context = {};
        context.isFirstLevel = this.actor.classes.length === 0;
        await this.activateChoices(item, entities, context);
        item.data.data.attributes[Object.keys(item.data.data.attributes).length] = {
            type: "Boolean",
            value: context.isFirstLevel,
            key: "isFirstLevel"
        };
        let mainItem = await super._onDropItemCreate(item.data.toObject(false));

        entities.push(...await this.addClassFeats(item, context));

        entities.forEach(item => item.data.supplier = {
            id: mainItem[0].id,
            name: mainItem[0].name,
            type: mainItem[0].data.type
        })

        return entities;
    }

    async addSpecies(item) {

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
            return [];
        }

        let entities = []
        await this.activateChoices(item, entities, {});
        let mainItem = await super._onDropItemCreate(item.data.toObject(false));

        await this.actor.addItemsFromCompendium('trait', entities, item.getProvidedItems(i => i.type === 'TRAIT'));
        await this.actor.addItemsFromCompendium('feat', entities, item.getProvidedItems(i => i.type === 'FEAT'));
        await this.actor.addItemsFromCompendium('item', entities, item.getProvidedItems(i => i.type === 'ITEM'));

        entities.forEach(item => item.data.supplier = {
            id: mainItem[0].id,
            name: mainItem[0].name,
            type: mainItem[0].data.type
        })
        return entities;

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

    async activateChoices(item, additionalEntitiesToAdd, context) {
        let choices = item.data.data.choices;
        for (let choice of choices ? choices : []) {
            if (choice.isFirstLevel && !context.isFirstLevel) {
                continue;
            }

            let options = await this._explodeOptions(choice.options);

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

            await Dialog.prompt({
                title: greetingString,
                content: content,
                callback: async (html) => {
                    let choice = html.find("#choice")[0];
                    let key = choice?.value;

                    if (!key) {
                        key = choice?.innerText;
                    }
                    let selectedChoice = options[key];
                    if (selectedChoice.providedItems && selectedChoice.providedItems.length > 0) {
                        await this.actor.addItemsFromCompendium('trait', additionalEntitiesToAdd, selectedChoice.providedItems?.filter(i => i.type === 'TRAIT'));
                        await this.actor.addItemsFromCompendium('item', additionalEntitiesToAdd, selectedChoice.providedItems?.filter(i => i.type === 'ITEM'));
                        await this.actor.addItemsFromCompendium('feat', additionalEntitiesToAdd, selectedChoice.providedItems?.filter(i => i.type === 'FEAT'));
                    }
                    if (selectedChoice.payload && selectedChoice.payload !== "") {
                        item.setPayload(selectedChoice.payload);

                    }
                }
            });
        }

    }

    async addClassFeats(item, context) {
        let feats = item.getAttribute("classFeat").map(attr => attr.value);
        if (feats.length === 0) {
            return;
        }
        let additionalEntitiesToAdd = [];
        feats = feats.map(feat => this.actor.cleanItemName(feat))
        if (context.isFirstLevel) {
            await this.actor.addItemsFromCompendium('trait', additionalEntitiesToAdd, await feats.map(feat => `Bonus Feat (${feat})`));
            let newVar = await this.actor.addItemsFromCompendium('feat', additionalEntitiesToAdd, feats)

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
                    await this.actor.addItemsFromCompendium('trait', additionalEntitiesToAdd, `Bonus Feat (${feat})`)
                    await this.actor.addItemsFromCompendium('feat', additionalEntitiesToAdd, feat)
                }
            });
        }
        return additionalEntitiesToAdd;
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
            roll = roll.roll();
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

    async _explodeOptions(options) {
        let resolvedOptions = {};
        for (let [key, value] of Object.entries(options)) {
            if (key === 'AVAILABLE_EXOTIC_WEAPON_PROFICIENCY') {
                for (let weapon of game.generated.exoticWeapons) {
                    if (!this.actor.data.proficiency.weapon.includes(weapon.toLowerCase())) {
                        resolvedOptions[weapon] = {abilities: [], items: [], payload: weapon};
                    }
                }
            } else if (key === 'AVAILABLE_WEAPON_FOCUS') {
                for (let weapon of this.actor.data.proficiency.weapon) {
                    if (!this.actor.data.proficiency.focus.includes(weapon.toLowerCase())) {
                        resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                    }
                }
            } else if (key === 'AVAILABLE_WEAPON_PROFICIENCIES') {
                for (let weapon of ["Simple Weapons", "Pistols", "Rifles", "Lightsabers", "Heavy Weapons", "Advanced Melee Weapons"]) {
                    if (!this.actor.data.proficiency.weapon.includes(weapon.toLowerCase())) {
                        resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                    }
                }
            } else if (key === 'AVAILABLE_SKILL_FOCUS') {
                for (let weapon of this.actor.data.prerequisites.trainedSkills) {
                    if (!this.actor.data.prerequisites.focusSkills.includes(weapon.toLowerCase())) {
                        resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                    }
                }
            } else if (key === 'AVAILABLE_SKILL_MASTERY') {
                for (let weapon of this.actor.data.prerequisites.focusSkills) {
                    if (!this.actor.data.prerequisites.masterSkills.includes(weapon.toLowerCase())) {
                        resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                    }
                }
            } else if (key === 'AVAILABLE_DOUBLE_ATTACK') {
                for (let weapon of this.actor.data.proficiency.weapon) {
                    if (!this.actor.data.proficiency.doubleAttack.includes(weapon.toLowerCase())) {
                        resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                    }
                }
            } else if (key === 'AVAILABLE_TRIPLE_ATTACK') {
                for (let weapon of this.actor.data.proficiency.doubleAttack) {
                    if (!this.actor.data.proficiency.tripleAttack.includes(weapon.toLowerCase())) {
                        resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                    }
                }
            } else if (key === 'AVAILABLE_SAVAGE_ATTACK') {
                for (let weapon of this.actor.data.proficiency.doubleAttack) {
                    if (!this.actor.data.proficiency.savageAttack.includes(weapon.toLowerCase())) {
                        resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                    }
                }
            } else if (key === 'AVAILABLE_RELENTLESS_ATTACK') {
                for (let weapon of this.actor.data.proficiency.doubleAttack) {
                    if (!this.actor.data.proficiency.relentlessAttack.includes(weapon.toLowerCase())) {
                        resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                    }
                }
            } else if (key === 'AVAILABLE_AUTOFIRE_SWEEP') {
                for (let weapon of this.actor.data.proficiency.focus) {
                    if (!this.actor.data.proficiency.autofireSweep.includes(weapon.toLowerCase())) {
                        resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                    }
                }
            } else if (key === 'AVAILABLE_AUTOFIRE_ASSAULT') {
                for (let weapon of this.actor.data.proficiency.focus) {
                    if (!this.actor.data.proficiency.autofireAssault.includes(weapon.toLowerCase())) {
                        resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                    }
                }
            } else if (key === 'AVAILABLE_HALT') {
                for (let weapon of this.actor.data.proficiency.focus) {
                    if (!this.actor.data.proficiency.halt.includes(weapon.toLowerCase())) {
                        resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                    }
                }
            } else if (key === 'AVAILABLE_RETURN_FIRE') {
                for (let weapon of this.actor.data.proficiency.focus) {
                    if (!this.actor.data.proficiency.returnFire.includes(weapon.toLowerCase())) {
                        resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                    }
                }
            } else if (key === 'AVAILABLE_CRITICAL_STRIKE') {
                for (let weapon of this.actor.data.proficiency.focus) {
                    if (!this.actor.data.proficiency.criticalStrike.includes(weapon.toLowerCase())) {
                        resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                    }
                }
            } else {
                resolvedOptions[key] = value;
            }
        }
        return resolvedOptions;
    }

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
        let existingValues = sheet.actor.getAttributeBases();
        let combined = {};
        for (let val of Object.keys(existingValues)) {
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
        for (let i = 0; i < 2 - Object.values(bonus).filter(b => b === 1).length; i++) {
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

        if (item.name === 'Point-Blank Shot') {
            if (game.settings.get('swse', 'mergePointBlankShotAndPreciseShot')) {
                await this.actor.addItemsFromCompendium('feat', items, {
                    category: 'Precise Shot',
                    prerequisite: 'SETTING:mergePointBlankShotAndPreciseShot'
                });
            }
        }

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
        this.attack(ev, {type: "singleAttack", items: [itemId]});
        return undefined;
    }

    async attack(event, context) {
        let options = this.buildAttackDialog(context);
        await new Dialog(options).render(true);
    }

    createAttackOption(attack, id) {
        let attackString = JSON.stringify(attack).replaceAll("\"", "&quot;");
        return `<option id="${id}" data-item-id="${attack.itemId}" value="${attackString}" data-attack="${attackString}">${attack.name}</option>`;
    }

    // methods revolving around attack blocks.  can make this more simplified with an attack object maybe.
    getAttackFromBlock(attackBlock) {
        let attackId = $(attackBlock).find(".attack-id")[0]
        let attackValue = attackId.value || $(attackId).data("value");

        if(attackValue !== "--"){
            let attackJSON = attackValue;
            if(typeof attackJSON === "string"){
                attackJSON = JSON.parse(attackJSON);
            }

            let attack = {};
            let attackRoll = $(attackBlock).find(".attack-roll")[0].innerText.replace(/\n/g, "");
            let damageRoll = $(attackBlock).find(".damage-roll")[0].innerText.replace(/\n/g, "");
            attack.name = attackJSON.name;
            attack.toHit = attackRoll;
            attack.damage = damageRoll;
            return attack;
        }
        return undefined;
    }

    rollAttacks(attacks, rollMode) {
        let cls = getDocumentClass("ChatMessage");

        let attackRows = "";
        let roll;

        for(let attack of attacks){
            let attackRoll = new Roll(attack.toHit).roll();
            roll = attackRoll;
            let damageRoll = new Roll(attack.damage).roll();
            attackRows += `<tr><td>${attack.name}</td><td><a class="inline-roll inline-result" title="${attackRoll.result}">${attackRoll.total}</a></td><td><a class="inline-roll inline-result" title="${damageRoll.result}">${damageRoll.total}</a></td></tr>`
        }

        let content = `<table>
<thead><th>Attack</th><th>To Hit</th><th>Damage</th></thead>
<tbody>${attackRows}</tbody>
</table>`;

        let messageData = {
            user: game.user.id,
            type: CONST.CHAT_MESSAGE_TYPES.ROLL,
            content,
            sound: CONFIG.sounds.dice,
            roll
        }

        let msg = new cls(messageData);
        if ( rollMode ) msg.applyRollMode(rollMode);

        return cls.create(msg.data, { rollMode });
    }
}

