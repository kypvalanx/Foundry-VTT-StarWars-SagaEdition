import {SWSE} from "../config.js";
import {generateAttackFromWeapon} from "../actor/attack-handler.js";
import {getBonusString, increaseDamageDie, toNumber, extractAttributeValues} from "../util.js";

function getRangeModifier(range, accurate, innacurate) {
    if (range === 'Grenades') {
        range = 'Thrown Weapons'
    }

    let firstHeader = "";
    let secondHeader = "";
    let radioButtons = "";
    let rangeArray = SWSE.Combat.range[range];
    if (rangeArray) {
        for (let [rangeName, rangeIncrement] of Object.entries(rangeArray)) {
            let rangePenaltyElement = SWSE.Combat.rangePenalty[rangeName];
            if (accurate && rangeName === 'short') {
                rangePenaltyElement = 0;
            }
            if (innacurate && rangeName === 'long') {
                continue;
            }
            firstHeader += `<th><div class="swse padding-3 center">${rangeName.titleCase()} (${rangePenaltyElement})</div></th>`;
            secondHeader += `<th><div class="swse padding-3 center">${rangeIncrement.titleCase()}</div></th>`;
            radioButtons += `<td><div class="center swse"><label for="range${rangeName}"></label><input class="modifier center swse attack-modifier" type="radio" id="range_${rangeName}" name="range_selection" value="${rangePenaltyElement}"></div></td>`;
            // console.log(rangeName, rangeIncrement, SWSE.Combat.rangePenalty[rangeName])
        }

    }

    return `<table><thead><tr>${firstHeader}</tr><tr>${secondHeader}</tr></thead><tbody><tr>${radioButtons}</tr></tbody></table>`;
}

function getRateOfFireModifier(ratesOfFire) {
    if (ratesOfFire && ratesOfFire.length > 1) {
        let firstHeader = "";
        let radioButtons = "";
        for (let rateOfFire of ratesOfFire) {
            let modifier = "Autofire" === rateOfFire ? -5 : 0;
            firstHeader += `<th><div class="swse padding-3 center">${rateOfFire} (${modifier})</div></th>`;
            radioButtons += `<td><div class="center swse"><label for="rof_${rateOfFire}"></label><input class="modifier center swse attack-modifier" type="radio" id="rof_${rateOfFire}" name="rof_selection" value="${modifier}"></div></td>`;

        }
        return `<br/><table><thead><tr>${firstHeader}</tr></thead><tbody><tr>${radioButtons}</tr></tbody></table>`;
    }
    return "";
}

function getStun(hasStun) {
    if (hasStun) {
        return `<br/><label for="stun_selection">Stun:</label><input class="modifier center swse attack-modifier" type="checkbox" id="stun_selection" name="stun_selection" value="0">`;
    }
    return "";
}

// noinspection JSClosureCompilerSyntax
/**
 * Extend the basic Item with some very simple modifications.
 * @extends {Item}
 */
export class SWSEItem extends Item {
    constructor(...args) {
        super(...args);
        let {data, parent} = args;
        this.data.data = data;
        this.items = this.items || [];
        this.hasItemOwner = this.hasItemOwner || false;
    }


    static get config() {
        return mergeObject(super.config, {
            baseEntity: Item,
            embeddedEntities: {
                "OwnedItem": "items"
            }
        });
    }

    get name() {
        let itemData = this.data;
        let finalName = itemData.name;
        if (itemData.data?.payload && itemData.data?.payload !== "" && !itemData.name?.includes("(")) {
            finalName = `${finalName} (${itemData.data.payload})`
        }
        for (let mod of this.mods) {
            let prefix = mod.prefix ? mod.prefix + " " : "";
            let suffix = mod.suffix ? " " + mod.suffix : "";
            finalName = `${prefix}${finalName}${suffix}`
        }
        return finalName;
    }

    // get name() {
    //     return this.finalName;
    // }
    get fortitudeDefenseBonus() {
        return toNumber(this.getAttribute('fortitudeDefenseBonus')) - toNumber(this.getStripping("reduceDefensiveMaterial"));
    }

    get reflexDefenseBonus() {
        return toNumber(this.getAttribute('reflexDefenseBonus')) - toNumber(this.getStripping("reduceDefensiveMaterial"));
    }

    get maximumDexterityBonus() {
        return toNumber(this.getAttribute('maximumDexterityBonus')) - toNumber(this.getStripping("reduceJointProtection"));
    }

    get mods() {
        let actor = this.actor;
        if (!actor || !actor.data || !actor.items) {
            return [];
        }

        return this.data.data.items?.map(item => actor.items.get(item._id)) || [];
    }

    get prefix() {
        return this.getAttribute('prefix')?.value;
    }

    get suffix() {
        if (this.mods?.filter(item => item.name === 'Bayonet Ring').length > 0) {
            return `with ${this.name}`
        }
        return this.getAttribute('suffix')?.value;
    }

    get size() {
        if (this.getStripping("makeColossal")?.value) {
            return 'Colossal';
        }
        if (this.getStripping("makeGargantuan")?.value) {
            return 'Gargantuan';
        }
        if (this.getStripping("makeHuge")?.value) {
            return 'Huge';
        }
        if (this.getStripping("makeLarge")?.value) {
            return 'Large';
        }
        if (this.getStripping("makeMedium")?.value) {
            return 'Medium';
        }
        if (this.getStripping("makeSmall")?.value) {
            return 'Small';
        }
        if (this.getStripping("makeTiny")?.value) {
            return 'Tiny';
        }
        return this.data.data.size;
    }

    get armorType() {
        if (this.subType === 'Heavy Armor' || this.getStripping("makeHeavy")?.value) {
            return 'Heavy';
        }
        if (this.subType === 'Medium Armor' || this.getStripping("makeMedium")?.value) {
            return 'Medium';
        }
        return 'Light';
    }

    get subType() {
        return this.data.data.treatedAsSubtype ? this.data.data.treatedAsSubtype : this.data.data.subtype;
    }

    get modSubType() {
        if (this.data.data.items?.filter(item => item.name === 'Bayonet Ring').length > 0) {
            return 'Weapons Upgrade'
        }

        return this.subType;
    }

    get effectiveRange() {
        let resolvedSubtype = this.data.data.treatedAsForRange ? this.data.data.treatedAsForRange : this.data.data.subtype;

        if (this.getStripping("reduceRange")?.value) {
            resolvedSubtype = this.reduceRange(resolvedSubtype);
        }

        return resolvedSubtype;
    }

    get accurate() {
        let specials = this.getAttribute('special')?.value;
        for (let special of specials ? specials : []) {
            if (special.toLowerCase().startsWith('accurate')) {
                return true;
            }
        }

        return false;
    }

    get inaccurate() {
        let specials = this.getAttribute('special')?.value;
        for (let special of specials ? specials : []) {
            if (special.toLowerCase().startsWith('inaccurate')) {
                return true;
            }
        }
        return false;
    }

    // get modes(){
    //     let ratesOfFire = this.modes();
    //     if(!Array.isArray(ratesOfFire)){
    //         ratesOfFire = [ratesOfFire]
    //     }
    //     let filteredROF = [];
    //     let strippedAutofire = this.getStripping("stripAutofire")?.value;
    //     for(let rateOfFire of ratesOfFire) {
    //         if (strippedAutofire) {
    //             if(rateOfFire.value !== 'Autofire') {
    //                 filteredROF.push(rateOfFire.value)
    //             }
    //             }else{
    //             filteredROF.push(rateOfFire.value)
    //         }
    //     }
    //
    //     return filteredROF
    // }

    get damageDie() {
        let damageDie = this.getAttribute('damageDie')[0]?.value;

        if (!damageDie) {
            return "";
        }
        let tok = damageDie.split('d');
        let quantity = parseInt(tok[0]);
        let size = parseInt(tok[1]);

        for (let bonusDamageDie of this.getAttribute('bonusDamageDie')) {
            quantity = quantity + parseInt(bonusDamageDie.value);
        }
        for (let bonusDamageDie of this.getAttribute('bonusDamageDieSize')) {
            size = increaseDamageDie(size, parseInt(bonusDamageDie.value));
        }
        return quantity + "d" + size;
    }

    get stunDamageDie() {
        let damageDie = this.getAttribute('stunDamageDie')[0]?.value;
        if (!damageDie || this.getStripping("stripStun")?.value) {
            return ""
        }
        let tok = damageDie.split('d');
        let quantity = parseInt(tok[0]);
        let size = parseInt(tok[1]);

        for (let bonusDamageDie of this.getAttribute('bonusStunDamageDie')) {
            quantity = quantity + parseInt(bonusDamageDie.value);
        }
        for (let bonusDamageDie of this.getAttribute('bonusStunDamageDieSize')) {
            size = increaseDamageDie(size, parseInt(bonusDamageDie.value));
        }
        return quantity + "d" + size;
    }

    get damageType() {
        let attributes = this.getAttribute('damageType');
        return attributes.map(attribute => attribute.value).join(', ');
    }

    /**
     * Augment the basic Item data model with additional dynamic data.
     */
    async prepareData() {
        super.prepareData();
        this._pendingUpdate = {};
        // Get the Item's data
        const itemData = this.data;
        itemData.finalName = this.name;

        itemData.data.isEquipable = this.type === "weapon" || this.type === "armor";
        itemData.data.isModification = this.type === "upgrade" || this.subType === "weapons and armor accessories";
        itemData.data.isBioPart = this.subType === "Implants" || this.subType === "Bio-Implants" || this.subType === "Cybernetic Devices" || this.subType === "Advanced Cybernetics";
        itemData.data.isDroidPart = this.subType === "Locomotion Systems" || this.subType === "Processor Systems"
            || this.subType === "Appendages" || this.subType === "Droid Accessories (Sensor Systems)"
            || this.subType === "Droid Accessories (Translator Units)" || this.subType === "Droid Accessories (Miscellaneous Systems)"
            || this.subType === "Droid Accessories (Communications Systems)" || this.subType === "Droid Accessories (Droid Stations)"
            || this.subType === "Droid Accessories (Shield Generator Systems)";

        if (this.type === "weapon") this.prepareWeapon(itemData);
        if (this.type === "armor") this.prepareArmor(itemData);

        if (this.type === "feat") this.prepareFeatData(itemData);

        // if(Object.keys(this._pendingUpdate).length>0){
        //     return this.update(this._pendingUpdate);
        // }
    }

    prepareFeatData(itemData) {
        if (itemData.data.categories) {
            itemData.data.bonusFeatCategories = itemData.data.categories.filter(cat => cat.value?.toLowerCase().includes("bonus feats"));
            itemData.data.hasBonusFeatCategories = itemData.data.bonusFeatCategories.length > 0;
        }
    }

    prepareWeapon(itemData) {
        itemData.data.upgradePoints = this.getBaseUpgradePoints(itemData.name);

        itemData.data.stripping = itemData.data.stripping || {};

        this.setStripping('reduceRange', "Reduce Range", this.canReduceRange());

        this.setStripping('stripAutofire', "Strip Autofire", this.canStripAutoFire());

        this.setStripping('stripStun', "Strip Stun", this.canStripStun());
        itemData.data.isBaseExotic = this.isExotic();
        this.setStripping('stripDesign', "Make Exotic", !itemData.data.isBaseExotic);

        let size = itemData.data.size;

        itemData.data.resolvedSize = itemData.data.size;

        this.setStripping('makeTiny', "Make Weapon Tiny", size === 'Diminutive');
        this.setStripping('makeSmall', "Make Weapon Small", size === 'Tiny');
        this.setStripping('makeMedium', "Make Weapon Medium", size === 'Small');
        this.setStripping('makeLarge', "Make Weapon Large", size === 'Medium');
        this.setStripping('makeHuge', "Make Weapon Huge", size === 'Large');
        this.setStripping('makeGargantuan', "Make Weapon Gargantuan", size === 'Huge');
        this.setStripping('makeColossal', "Make Weapon Colossal", size === 'Gargantuan');

        for (let stripped of Object.values(itemData.data.stripping)) {
            itemData.data.upgradePoints += stripped.value ? 1 : 0;
        }

        if (itemData.data.items && itemData.data.items.length > 0) {
            for (let mod of itemData.data.items ? itemData.data.items : []) {
                if (mod.data.upgrade?.pointCost !== undefined) {
                    itemData.data.upgradePoints -= mod.data.upgrade.pointCost;
                }
            }
        }
    }

    setStripping(key, label, enabled, type, low, high) {
        this.data.data.stripping[key] = this.data.data.stripping[key] || {};
        this.data.data.stripping[key].label = label;
        this.data.data.stripping[key].enabled = enabled;
        this.data.data.stripping[key].value = enabled ? (this.data.data.stripping[key].value || (type === 'boolean' ? false : (type === 'number' ? 0 : ""))) : false;
        this.data.data.stripping[key].type = type ? type : "boolean"
        this.data.data.stripping[key].low = low;
        this.data.data.stripping[key].high = high;
        return this.data.data.stripping[key].value;
    }

    getStripping(key) {
        if (this.data.data.stripping) {
            return this.data.data.stripping[key];
        }
        return undefined;
    }

    prepareArmor(itemData) {
        itemData.data.upgradePoints = this.getBaseUpgradePoints(itemData.name);

        itemData.data.stripping = itemData.data.stripping || {};

        let makeMedium = this.setStripping('makeMedium', "Make Armor Medium", itemData.data.subtype === 'Light Armor');
        this.setStripping('makeHeavy', "Make Armor Heavy", itemData.data.subtype === 'Medium Armor' || makeMedium);

        let defensiveMaterial = Math.min(itemData.data.attributes.reflexDefenseBonus?.value ? itemData.data.attributes.reflexDefenseBonus?.value : 0,
            itemData.data.attributes.fortitudeDefenseBonus?.value ? itemData.data.attributes.fortitudeDefenseBonus?.value : 0);

        let jointProtection = itemData.data.attributes.maximumDexterityBonus ? parseInt(itemData.data.attributes.maximumDexterityBonus.value) : 0;

        this.setStripping('reduceDefensiveMaterial', "Reduce Defensive Material", defensiveMaterial > 0, "number", 0, defensiveMaterial);
        this.setStripping('reduceJointProtection', "Reduce Joint Protection", jointProtection > 0, "number", 0, jointProtection);


        for (let stripped of Object.values(itemData.data.stripping)) {
            itemData.data.upgradePoints += toNumber(stripped.value);
        }
        try {
            if (itemData.data.items && itemData.data.items.length > 0) {
                for (let mod of itemData.data.items) {
                    if (mod.data.upgrade?.pointCost !== undefined) {
                        itemData.data.upgradePoints -= mod.data.upgrade.pointCost;
                    }
                }
            }
        } catch (e) {
            console.log("mods may not be initialized", e)
        }
    }

    setTextDescription() {
        let itemData = this.data;
        itemData.data.textDescription = this.stripHTML(itemData.data.description);
    }

    setSourceString() {
        let sourceString = '';

        let itemData = this.data;
        if (itemData.data.supplier) {
            sourceString = `${itemData.data.supplier.type}, ${itemData.data.supplier.name}`;
        }
        this.data.data.sourceString = sourceString;
    }

    setPayload(payload) {
        this.data.data.payload = payload;
        this.crawlPrerequisiteTree(this.data.data.prerequisite, (prerequisite) => {
            if (prerequisite.requirement) {
                prerequisite.requirement = prerequisite.requirement.replace("#payload#", payload);
            }
            if (prerequisite.text) {
                prerequisite.text = prerequisite.text.replace("#payload#", payload);
            }
        })
    }

    /**
     *
     * @param prerequisite
     * @param {function} funct
     */
    crawlPrerequisiteTree(prerequisite, funct) {
        if (!prerequisite) {
            return;
        }
        funct(prerequisite);
        for (let child of prerequisite.children ? prerequisite.children : []) {
            this.crawlPrerequisiteTree(child, funct);
        }
    }

    setPrerequisite(prerequisite) {
        this.data.data.prerequisite = prerequisite;
    }

    setParentItem(parentItem) {
        this.data.data.supplier = {id: parentItem.id, name: parentItem.name, type: parentItem.data.type};
        this.data.data.isSupplied = true;
    }

    stripHTML(str) {
        let parser = new DOMParser();
        let doc = parser.parseFromString(str, 'text/html');
        return doc.body.innerText;
    };

    /**
     *
     * @param {SWSEItem} item
     * @returns {Promise<void>}
     */
    async takeOwnership(item) {
        let items = this.data.data.items;
        items.push(item)
        let filteredItems = [];
        let foundIds = [];

        for (let item of items) {
            if (!foundIds.includes(item._id)) {
                foundIds.push(item._id)
                filteredItems.push(item);
            }
        }


        await this.update({"data.items": [...filteredItems]});
        await item.update({"data.hasItemOwner": true});
    }

    async revokeOwnership(item) {
        let items = this.data.data.items?.filter(i => i._id !== item.data._id);
        await this.update({"data.items": items});
        await item.update({"data.hasItemOwner": false});
    }

    canReduceRange() {
        let subtypes = ["pistols", "rifles", "ranged weapons", "grenades", "heavy weapons", "simple ranged weapons", "thrown"];
        return subtypes.includes(this.data.data.subtype?.toLowerCase()) || subtypes.includes(this.data.data.attributes?.treatedAsForRange?.toLowerCase())
    }


    canStripAutoFire() {
        let ratesOfFire = this.getAttribute('ratesOfFire');
        if (ratesOfFire.length === 0) {
            return false;
        }
        let ss = false;
        let af = false;
        for (let rof of ratesOfFire) {
            if (rof.value.includes("Single-Shot")) {
                ss = true;
            }
            if (rof.value.includes("Autofire")) {
                af = true;
            }
        }
        return af && ss;
        //return this.data.data.attributes.ratesOfFire && this.data.data.attributes.ratesOfFire.value.includes("Single-Shot") && this.data.data.attributes.ratesOfFire.value.includes("Autofire");
    }

    canStripStun() {

        return this.getAttribute('stunDamageDie').length > 0 && this.getAttribute('damageDie').length > 0;
    }

    isExotic() {
        return ['Exotic Ranged Weapons' || 'Exotic Melee Weapons'].includes(this.subType);
    }

    async removeCategory(index) {
        let attacks = this.data.data.weapon.damage.attacks;
        if (!Array.isArray(attacks)) {
            let temp = [];
            for (let attack of Object.values(attacks)) {
                temp.push(attack);
            }
            attacks = temp;
        }
        console.log(attacks);
        attacks.splice(index, 1);
        await this.update({"data.weapon.damage.attacks": attacks});
    }

    async addCategory() {
        let attacks = this.data.data.weapon.damage.attacks;
        if (!Array.isArray(attacks)) {
            let temp = [];
            for (let attack of Object.values(attacks)) {
                temp.push(attack);
            }
            attacks = temp;
        }
        console.log(attacks);
        attacks.push({key: "", value: "", dtype: "String"});
        await this.update({"data.weapon.damage.attacks": attacks});
    }

    getBaseUpgradePoints(ogName) {
        //TODO find power armors and add them here https://swse.fandom.com/wiki/Category:Powered_Armor

        return 1;
    }

    reduceRange(finalWeaponRange) {
        let ranges = ["Melee", "Thrown", "Pistols", "Rifles", "Heavy Weapons"];
        let index = ranges.indexOf(finalWeaponRange === 'Simple Ranged Weapon' ? "Pistols" : (finalWeaponRange === 'Grenades' ? "Thrown" : finalWeaponRange));
        return ranges[index - 1];
    }

    reduceDamage(finalDamage) {
        let dieSize = ["2", "3", "4", "6", "8", "10", "12"];
        let toks = finalDamage.split("d");
        let index = dieSize.indexOf(toks[1]);
        if (index === 0) {
            index = 1;
        }
        toks[1] = dieSize[index - 1];
        return toks[0] + "d" + toks[1];
    }

    /**
     *
     * @param {SWSEActor} actor
     * @returns {Dialog}
     */
    rollItem(actor) {

        if (this.type === "weapon") {
            let attack = generateAttackFromWeapon(this, actor);
            console.log(attack);
            let modifiers = "";
            modifiers += getRangeModifier(this.effectiveRange, this.accurate, this.inaccurate)  //add innacurate and accurate
            modifiers += getRateOfFireModifier(attack.ratesOfFire);
            modifiers += getStun(attack.hasStun)
            let templateType = "attack";
            const template = `systems/swse/templates/chat/${templateType}-card.hbs`;

            let content = `<div class="dialog">${modifiers}<div class="flex flex-row"><button class="roll" id="attack" data-roll="${attack.th}">Attack Roll</button><button class="roll" id="damage" data-roll="${attack.dam}">Damage Roll</button></div></div>`;
            return new Dialog({
                title: 'Attacks',
                content: content,
                buttons: {
                    close: {
                        icon: '<i class="fas fa-check"></i>',
                        label: 'Close'
                    }
                },
                render: html => {
                    html.find("button.roll").on("click", (event) => {
                        let target = $(event.currentTarget);

                        console.log(event.currentTarget.id)
                        let formula = target.data("roll");
                        let parent = target.parents(".dialog")
                        if (event.currentTarget.id === "attack") {
                            let attackMods = parent.find(".attack-modifier")
                            for (let attackMod of attackMods) {
                                if (attackMod.checked) {
                                    formula += getBonusString(attackMod.value);
                                }
                            }

                        } else if (event.currentTarget.id === "damage") {
                            let damageMods = parent.find(".damage-modifier")

                            for (let damageMod of damageMods) {
                                if (damageMod.checked) {
                                    formula += getBonusString(damageMod.value);
                                }
                            }
                        }
                        //target.
                        let name = target.data("name");
                        let modifications = target.data("modifications");
                        let notes = target.data("notes");

                        actor.sendRollToChat(template, formula, modifications, notes, name, actor);
                    });
                }
            })
        }
    }

    static getItemDialogue(attack, actor) {
        let templateType = "attack";
        const template = `systems/swse/templates/chat/${templateType}-card.hbs`;

        let content = `<p><button class="roll" data-roll="${attack.th}" data-name="${attack.name} Attack Roll">${attack.name} Roll Attack</button></p>
                       <p><button class="roll" data-roll="${attack.dam}" data-name="${attack.name} Damage Roll">${attack.name} Roll Damage</button></p>`

        return new Dialog({
            title: 'Attacks',
            content: content,
            buttons: {
                close: {
                    icon: '<i class="fas fa-check"></i>',
                    label: 'Close'
                }
            },
            render: html => {
                html.find("button.roll").on("click", (event) => {
                    let target = $(event.currentTarget);
                    let formula = target.data("roll");
                    let name = target.data("name");
                    let modifications = target.data("modifications");
                    let notes = target.data("notes");

                    actor.sendRollToChat(template, formula, modifications, notes, name, actor);
                });
            }
        })
    }

    setAttribute(attributeIndex, attr) {
        let update = {};
        update.data = {};
        update.data.attributes = {}
        update.data.attributes[attributeIndex] = attr;
        this.update(update);
    }
    setMode(modeIndex, attr) {
        let update = {};
        update.data = {};
        update.data.modes = {}
        update.data.modes[modeIndex] = attr;
        this.update(update);
    }
    setModeAttribute(modeIndex, attributeIndex, attr) {
        let update = {};
        update.data = {};
        update.data.modes = {}
        update.data.modes[modeIndex] = {};
        update.data.modes[modeIndex].attributes = {};
        update.data.modes[modeIndex].attributes[attributeIndex] = attr;
        this.update(update);
    }

    setAttributes(attributes) {
        let update = {};
        update.data = {};
        update.data.attributes = attributes;
        this.update(update);
    }
    setModeAttributes(modeIndex, attributes) {
        let update = {};
        update.data = {};
        update.data.modes = {};
        update.data.modes[modeIndex] = {};
        update.data.modes[modeIndex].attributes = attributes;
        this.update(update);
    }
    setModes(modes) {
        let update = {};
        update.data = {};
        update.data.modes = modes;
        this.update(update);
    }

    /**
     * Checks item for any attributes matching the provided attributeKey.  this includes active modes.
     * @param attributeKey {String}
     * @returns {[]|*[]}
     */
    getAttribute(attributeKey) {
        if (!attributeKey) {
            return [];
        }

        let values = [];

        for (let attribute of Object.values(this.data.data.attributes).filter(attr => attr && attr.key === attributeKey)) {
            values.push(...(extractAttributeValues(attribute, this.data._id)));
        }

        for(let mode of this.getActiveModes()){
            let modeAttributes = Object.values(mode.attributes).filter(attr => attr.key === attributeKey) || [];

            let modeAttributeValues = [];
            for (let attribute of modeAttributes) {
                modeAttributeValues.push(... (extractAttributeValues(attribute, this.data._id)));
            }
            values = this.mergeAttributes(attributeKey, values, modeAttributeValues)
        }

        for(let child of this.data.data.items || []){
            values.push(...this.getAttributesFromItem(child._id, attributeKey))
        }

        return values;
    }

    getActiveModes() {
        return Object.values(this.data.data.modes || [])?.filter(mode => mode && this.data.data.activeModes.includes(mode.name)) || [];
    }

    mergeAttributes(attributeKey, values, modeAttributeValues) {
        //by default mode attributes should overwrite item attributes if they exist.  in the future we may want to modify that behavior based on the attribute key
        if(modeAttributeValues.length > 0){
            return modeAttributeValues;
        }
        return values;
    }

    get modes() {
        if (this.data.data) {
            let modes = Object.values(this.data.data.modes);
            for(let mode of modes.filter(mode => !!mode)){
                mode.isActive = this.data.data.activeModes.includes(mode.name);
            }

            return modes;
        }

        return [];
    }

    // get currentMode() {
    //     return this.data.data.mode;
    // }
    //
    // set currentMode(currentMode) {
    //     let update = {};
    //     update.data = {};
    //     update.data.mode = currentMode;
    //     this.update(update);
    // }

    activateMode(mode){
        let update = {};
        update.data = {};
        update.data.activeModes = this.data.data.activeModes;
        update.data.activeModes.push(mode)
        this.update(update);
    }
    deactivateMode(mode){
        let update = {};
        update.data = {};
        update.data.activeModes = this.data.data.activeModes.filter(activeMode => activeMode.toLowerCase() !==mode.toLowerCase());
        this.update(update);
    }

}
