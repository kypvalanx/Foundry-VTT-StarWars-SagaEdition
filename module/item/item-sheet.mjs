import {formatPrerequisites, meetsPrerequisites} from "../prerequisite.mjs";
/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
import {getParentByHTMLClass, linkEffects, onCollapseToggle, toNumber} from "../common/util.mjs";
import {
    _adjustPropertyBySpan,
    changeCheckbox,
    changeSelect,
    changeText,
    onChangeControl,
    onEffectControl,
    onSpanTextInput,
    onToggle
} from "../common/listeners.mjs";

export class SWSEItemSheet extends ItemSheet {

    /** @override */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ["swse", "sheet", "item"],
            width: 520,
            height: 480,
            tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "summary"},
                {navSelector: ".level-tabs", contentSelector: ".level-body", initial: "1"}]
        });
    }

    /** @override */
    get template() {
        const path = "systems/swse/templates/item";
        return `${path}/item-sheet.hbs`;
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

    /* -------------------------------------------- */

    /** @override */
    setPosition(options = {}) {
        const position = super.setPosition(options);
        const sheetBody = this.element.find(".sheet-body");
        const bodyHeight = position.height - 192;
        sheetBody.css("height", bodyHeight);
        return position;
    }

    /* -------------------------------------------- */

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        html.find('[data-action="to-chat"]').click(this._onToChat.bind(this));

        html.find(".collapse-toggle").on("click", event => onCollapseToggle(event)) //TODO can i remove this?
        // Everything below here is only needed if the sheet is editable
        if (!this.isEditable) return;

        html.find(".toggle").on("click", onToggle.bind(this))
        html.find('.tab').each((i, li) => {
            li.addEventListener("drop", (ev) => this._onDrop(ev));
        });

        // Effect Dragging
        html.find("li.draggable").each((i, li) => {
            if (li.classList.contains("inventory-header")) return;
            li.setAttribute("draggable", true);
            li.addEventListener("dragstart", (ev) => this._onDragStart(ev), false);
        });



        if (this.actor) {
            // Update Inventory Item
            html.find('[data-action="view"]').click(this.actor.sheet._onItemEdit.bind(this.actor.sheet));

            // Delete Inventory Item
            html.find('.item-delete').click(ev => {
                const li = $(ev.currentTarget).parents(".item");
                //let itemToDelete = this.item.items.filter(item => item._id === li.data("itemId"))[0];
                let ownedItem = this.item.actor.items.get(li.data("itemId"));
                this.item.revokeOwnership(ownedItem);
            });
        }

        html.find('[data-action="class-control"]').click(this._onClassControl.bind(this));
        html.find('[data-action="provided-item-control"]').click(this._onProvidedItemControl.bind(this));
        html.find('[data-action="prerequisite-control"]').click(this._onPrerequisiteControl.bind(this));
        html.find('[data-action="modifier-control"]').click(this._onModifierControl.bind(this));
        html.find('[data-action="effect-control"]').click(onEffectControl.bind(this));
        html.find('[data-action="attribute-control"]').click(this._onAttributeControl.bind(this));


        //TODO switch to data action
        html.find('.value-plus').click(ev => {
            let target = $(ev.currentTarget)
            let name = ev.currentTarget.name;
            let toks = name.split('.');
            let cursor = this.object.data;
            for (let tok of toks) {
                cursor = cursor[tok];
            }
            let update = {}
            update[name] = cursor + 1;
            if (typeof target.data("high") === "number") {
                update[name] = Math.min(update[name], target.data("high"));
            }
            this.object.safeUpdate(update);
        });
// TODO switch to data action
        html.find('.value-minus').click(ev => {
            let target = $(ev.currentTarget)
            let name = ev.currentTarget.name;
            let toks = name.split('.');
            let cursor = this.object.data;
            for (let tok of toks) {
                cursor = cursor[tok];
            }
            let update = {}
            update[name] = cursor - 1;
            if (typeof target.data("low") === "number") {
                update[name] = Math.max(update[name], target.data("low"));
            }
            this.object.safeUpdate(update);
        });

        // Add general text box (span) handler
        html.find("span.text-box.direct").on("click", (event) => {
            onSpanTextInput.call(this, event, null, "text"); // this._adjustItemPropertyBySpan.bind(this)
        });
        html.find("[data-action=direct-field]").on("click", (event) => {
            onSpanTextInput.call(this, event, _adjustPropertyBySpan.bind(this), "text"); // this._adjustItemPropertyBySpan.bind(this)
        });


        html.find("select.direct").on("change", changeSelect.bind(this));
        html.find("input[type=text].direct").on("change", changeText.bind(this));
        html.find("input[type=checkbox].direct").on("click", changeCheckbox.bind(this));
        html.find('[data-action="change-control"]').click(onChangeControl.bind(this));
    }


    _onToChat(event) {
        event.preventDefault();
        const a = event.currentTarget;
        const itemId = a.dataset.actionItem;
        const actorId = a.dataset.actorId;
        const actionCompendium = a.dataset.actionCompendium;

        let item;

        if (actorId) {
            let actor = game.data.actors.find(actor => actor._id === actorId);
            item = actor.items.find(item => item._id === itemId);
        } else if (actionCompendium) {
            let compendium = game.packs.find(pack => pack.collection === actionCompendium);
            item = compendium.get(itemId)
        } else {
            item = game.items.get(itemId);
        }

        let name = item.name || item.data.name;
        let description = item.description || item.data?.description || item.data?.data?.description || item.data?._source?.data?.description;

        let content = `${description}`

        let speaker = ChatMessage.getSpeaker({actor: this.object.parent});
        console.log(item)
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


    /** @override */
    _canDragStart(selector) {
        return true;
    }

    /* -------------------------------------------- */
    /** @override */
    _canDragDrop(selector) {
        return true;
    }

    /** @override */
    _onDragStart(event) {
        let dragData = {};
        const li = event.currentTarget;

        // Create drag data
        dragData.itemId = this.item.id;
       // dragData.uuid = li.dataset.uuid

        const owner = this.item.actor;
        if(owner){
            dragData.owner = owner;
            dragData.actorId = owner.id;
            dragData.sceneId = owner.isToken ? canvas.scene?.id : null;
            dragData.tokenId = owner.isToken ? this.actor.token.id : null;
        }

        // Owned Items
        if (li.dataset.itemId) {
            dragData.modId = li.dataset.itemId;
            dragData.type = "Item";
        }

        if(li.dataset.effectId){
            dragData.effectId = li.dataset.effectId
            dragData.effectUuid = li.dataset.uuid
            dragData.type = "ActiveEffect";
        }

        event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
        //super._onDragStart(event);
    }

    /* -------------------------------------------- */
    /** @override */
    async _onDrop(event) {
        if (!this.item.canUserModify(game.user, 'update')) return false;
        // Try to extract the droppedItem
        let droppedItem;
        try {
            droppedItem = JSON.parse(event.dataTransfer.getData("text/plain"));
        } catch (err) {
            console.error(`Parsing error: ${event.dataTransfer.getData("text/plain")}`)
            return false;
        }
        // Try to find any specific area that the item is dropped in
        let effect = getParentByHTMLClass(event, "effect")
        if(effect){
            droppedItem.targetEffectUuid = effect.dataset.uuid;
        }
        await this.handleDroppedItem(droppedItem);
    }

    async handleDroppedItem(droppedItem) {
        //let actor = this.actor;
        let item = undefined;

        // if(actor){
        //     item = actor?.items.get(droppedItem.itemId);
        // }

        if(droppedItem.effectUuid && droppedItem.targetEffectUuid){
            linkEffects.call(this.item, droppedItem.effectUuid, droppedItem.targetEffectUuid);
            return;
        }

        if(droppedItem.uuid){
            item = await Item.implementation.fromDropData(droppedItem);
        }
        if(!item){
            return;
        }

        let isItemMod = Object.values(item.system.attributes ? item.system.attributes : []).find(attr => attr.key === "itemMod") || Object.values(item.system.changes).find(attr => attr.key === "itemMod");
        if (!!isItemMod?.value || isItemMod?.value === "true") {
            let meetsPrereqs = meetsPrerequisites(this.object, item.system.prerequisite)

            if (meetsPrereqs.doesFail) {
                new Dialog({
                    title: "You Don't Meet the Prerequisites!",
                    content: `You do not meet the prerequisites for the ${droppedItem.finalName} class:<br/> ${formatPrerequisites(meetsPrereqs.failureList)}`,
                    buttons: {
                        ok: {
                            icon: '<i class="fas fa-check"></i>',
                            label: 'Ok'
                        }
                    }
                }).render(true);
                return;
            }
            this.item.addItemModificationEffectFromItem(item);
           // await this.item.takeOwnership(ownedItem);
        }
    }



    _canAttach(application) {
        if (!application) {
            return true;
        }
        application = (application + "").trim();

        let hasParens = this.hasParens(application);
        if (hasParens) {
            return this._canAttach(hasParens[1]);
        }

        let ors = this._findZeroDepth(application, " OR ");
        if (ors.length > 0) {
            for (let or of ors) {
                for (let i = or.start; i < or.end; i++) {
                    application = application.substring(0, i) + 'X' + application.substring(i + 1)
                }
            }

            let toks = application.split("XXXX");
            let isTruthy = false;
            for (let tok of toks) {
                isTruthy = isTruthy || this._canAttach(tok)
            }
            return isTruthy;
        }

        let ands = this._findZeroDepth(application, " AND ");
        if (ands.length > 0) {
            for (let or of ors) {
                for (let i = ands.start; i < ands.end; i++) {
                    application = application.substring(0, i) + 'X' + application.substring(i + 1)
                }
            }

            let toks = application.split("XXXXX");
            let isTruthy = true;
            for (let tok of toks) {
                isTruthy = isTruthy && this._canAttach(tok)
            }
            return isTruthy;
        }

        if (application === 'WEAPON') {
            return this.object.data.type === 'weapon';
        }
        if (application === 'ARMOR') {
            return this.object.data.type === 'armor';
        }
        if (application === 'ION') {
            return this.object.data.data.weapon.type === 'Energy (Ion)';
        }
        if (application === 'STUN') {
            return this.object.data.data.weapon.stun?.isAvailable;
        }
        return false;
    }

    hasParens(application) {
        if (!application.startsWith("(")) {
            return false;
        }
        let depth = 0;
        for (let i = 0; i < application.length; i++) {
            let char = application.charAt(i);
            if (char === '(') {
                depth++;
            } else if (char === ')') {
                depth--;
            }
            if (depth === 0) {
                return application.length - 1 === i;
            }

        }

        return false;
    }

    _findZeroDepth(term, search) {
        let found = [];
        let depth = 0;
        for (let i = 0; i < term.length; i++) {
            let char = term.charAt(i);
            if (char === '(') {
                depth++;
            } else if (char === ')') {
                depth--;
            } else if (term.substring(i).startsWith(search) && depth === 0) {
                found.push({start: i, end: i + search.length})
            }
        }
        return found;
    }

    createItemAttribute(attributeId, level, modeId) {
        let content = `<label>Key:
            <input id="key">
            </label>
            <br/>
        <label>Value:
            <input id="value">
            </label>
        `;

        let options = {
            title: "New Attribute",
            content,
            callback: async (html) => {
                let key = html.find("#key")[0].value;
                let value = html.find("#value")[0].value;

                let updateData = {};
                let data = updateData;
                if (level) {
                    updateData.levels = {};
                    updateData.levels[level] = {};
                    updateData.levels[level].data = {};
                    data = updateData.levels[level].data;
                }

                if (modeId !== undefined) {
                    for (let tok of `${modeId}`.split(".")) {
                        data.modes = {};
                        data.modes[tok] = {};
                        data = data.modes[tok];
                    }
                }

                data.attributes = {};
                data.attributes[attributeId] = {key, value};
                this.item.updateData(updateData);
            }
        }

        Dialog.prompt(options);
    }

    createItemMode(modeId, level, parentModeId) {
        let content = `
        <label>Name:</label>
            <input id="name">
        <label>Group:</label>
            <input id="group">
        `;

        let options = {
            title: "New Mode",
            content,
            callback: async (html) => {
                let name = html.find("#name")[0].value;
                let group = html.find("#group")[0].value;

                let updateData = {};
                let data = updateData;
                if (level) {
                    updateData.levels = {};
                    updateData.levels[level] = {};
                    data = updateData.levels[level];
                }

                if (parentModeId !== undefined) {
                    let toks = `${parentModeId}`.split(".");

                    for (let tok of toks) {
                        data.modes = {};
                        data.modes[tok] = {};
                        data = data.modes[tok];
                    }
                }

                data.modes = {};
                data.modes[modeId] = {name, group, attributes: {}};
                this.item.updateData(updateData);
            }
        }

        Dialog.prompt(options);
    }


    _onPrerequisiteControl(event){
        let element = $(event.currentTarget);
        let path = element.data("path");

        let system = this.item.system || this.item._source.system

        for(let tok of path.substring(5).split(".")){
            if(!!system[tok]) {
                system = system[tok];
            }
        }

        let updateData = {};
        switch (element.data("type")){
            case 'remove-this-prerequisite':
                updateData[path] = null;
                break;
            case 'add-child-prerequisite':
                let maxKey = (Math.max(...Object.keys(system).map(k => toNumber(k))) || 0) +1
                let selectedKey = maxKey;
                for(let i = 0; i <=maxKey; i++){
                    if(system[i] === undefined || system[i] === null){
                        selectedKey = i;
                    }
                }
                if(path.endsWith("child")){

                    updateData[`${path}`] = {};
                } else {
                    updateData[`${path}.${selectedKey}`] = {};
                }
                break;
        }
        this.item.safeUpdate(updateData);
    }

    _onModifierControl(event){
        let element = $(event.currentTarget);
        let path = element.data("path");

        let system = this.item.system || this.item._source.system

        for(let tok of path.substring(5).split(".")){
            if(!!system[tok]) {
                system = system[tok];
            }
        }

        let updateData = {};
        switch (element.data("type")){
            case 'remove-this-modifier':
                updateData[path] = null;
                break;
            case 'add-modifier':
                let maxKey = (Math.max(...Object.keys(system).map(k => toNumber(k))) || 0) +1
                let selectedKey = maxKey;
                for(let i = 0; i <=maxKey; i++){
                    if(system[i] === undefined || system[i] === null){
                        selectedKey = i;
                    }
                }
                if(path.endsWith("child")){

                    updateData[`${path}`] = {};
                } else {
                    updateData[`${path}.${selectedKey}`] = {};
                }
                break;
        }
        this.item.safeUpdate(updateData);
    }



    _onAttributeControl(event){
        let element = $(event.currentTarget);
        let level = element.data('level');

        let modeId = element.data('modeId');
        modeId = modeId !== undefined ? `${modeId}` : undefined;

        let attributeId = element.data('attributeId');
        attributeId = attributeId !== undefined ? `${attributeId}` : undefined;

        let type = element.data("type");
        switch (type) {
            case "attribute-add":
            {
                let system = this.item.system;
                if (level) {
                    system = system.levels[level].data;
                }

                if (modeId) {
                    for (let tok of modeId.split(".")) {
                        system = system.modes[tok];
                    }
                }
                let attributes = system.attributes;
                let cursor = 0;
                while (attributes[cursor]) {
                    cursor++;
                }
                this.createItemAttribute(cursor, level, modeId)
            }
            case "remove-attribute": {

                let updateData = {};
                //updateData.system = {};
                let data = updateData //.system;

                if (level) {
                    data.levels = {}
                    data.levels[level] = {}
                    data.levels[level].data = {}
                    data = data.levels[level].data
                }

                if (attributeId) {
                    if(modeId){
                        let modes = modeId.split(".")

                        for (let mode of modes) {
                            data.modes = {};
                            data.modes[mode] = {};
                            data = data.modes[mode];
                        }
                    }

                    data.attributes = {};
                    data.attributes[attributeId] = null;
                } else if (modeId) {
                    let modes = modeId.split(".")

                    let iterations = modes.length;
                    for (let mode of modes) {
                        data.modes = {};
                        if (!--iterations) {
                            data.modes[mode] = null;
                        } else {
                            data.modes[mode] = {};
                            data = data.modes[mode];
                        }
                    }
                }

                this.item.updateData(updateData);
                this.render();
            }
        }
    }

    _onClassControl(event) {
        let element = $(event.currentTarget);

        let highestLevel = this.object.levels.map(c => c.flags.swse.level).reduce((a,b)=> Math.max(a,b),0);
        switch (element.data("type")){
            case "add-level":
                this.object.addClassLevel(highestLevel + 1)
                break;
            case "remove-level":
                this.object.removeClassLevel(highestLevel)
                break;
        }
    }

    _onProvidedItemControl(event) {
        let element = $(event.currentTarget);

        let system = this.item.system || this.item._source.system
        let entityId = element.data("entityId")
        let updateData = {};
        switch (element.data("type")){
            case "delete-item":
                updateData.providedItems = {};
                if(Array.isArray(system.providedItems)){
                    system.providedItems.forEach((item, i) => updateData.providedItems[i] = item)
                }
                updateData.providedItems[entityId] = null;
                break;
            case "add-item":
                // updateData.providedItems = {};
                // if(Array.isArray(system.providedItems)){
                //     system.providedItems.forEach((item, i) => updateData.providedItems[i] = item)
                // }
                // updateData.providedItems[entityId] = null; TODO work on this tomorrow
                break;
        }
        this.item.updateData(updateData);
    }


}
