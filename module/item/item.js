import {generateAttackFromWeapon} from "../actor/attack-handler.js";
import {
    extractAttributeValues,
    getBonusString,
    getRangedAttackMod,
    getRangeModifierBlock,
    increaseDamageDie,
    increaseDieType,
    reduceArray,
    toNumber
} from "../util.js";

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

    get levelUpHitPoints() {
        return this.getInheritableAttributesByKey("levelUpHitPoints").map(attr => attr.value)[0];
    }

    get classLevelHealth() {
        if (this.type !== "class") {
            return 0;
        }
        if (this.actAsFirstLevel) {

            return this.getInheritableAttributesByKey("firstLevelHitPoints").map(attr => parseInt(attr.value))[0];
        }
        let attrs = this.getInheritableAttributesByKey("rolledHp");

        if (attrs.length > 0) {
            let rolledHp = attrs.map(attr => parseInt(attr.value))[0]

            let max = this.getInheritableAttributesByKey("levelUpHitPoints").map(attr => parseInt(attr.value.split("d")[1]))[0]
            return rolledHp > max ? max : rolledHp;
        }

        return 1;
    }

    get actAsFirstLevel() {
        return this.getInheritableAttributesByKey("isFirstLevel", "AND") && this.getInheritableAttributesByKey("isHeroic", "AND");
    }

    get isDoubleWeapon() {
        if (this.type !== 'weapon') {
            return false;
        }
        let damageDie = this.getInheritableAttributesByKey("damageDie");
        return damageDie[0].value.includes("/");
    }

    get availableForFullAttack() {

        if (this.type !== 'weapon') {
            return false;
        }
        return true;
    }

    get fortitudeDefenseBonus() {
        if (this._parentIsProficientWithArmor()) {
            return toNumber(this.getInheritableAttributesByKey('equipmentFortitudeDefenseBonus', "MAX")) - toNumber(this.getStripping("reduceDefensiveMaterial"));
        }
        return 0;
    }

    get armorReflexDefenseBonus() {
        return toNumber(this.getInheritableAttributesByKey('armorReflexDefenseBonus', "MAX")) - toNumber(this.getStripping("reduceDefensiveMaterial"));
    }

    _parentIsProficientWithArmor() {
        return this.parent.getInheritableAttributesByKey("armorProficiency", "VALUES").includes(this.armorType.toLowerCase());
    }

    get maximumDexterityBonus() {
        let maxDexBonuses = this.getInheritableAttributesByKey('maximumDexterityBonus');
        if (maxDexBonuses.length === 0) {
            return undefined;
        }
        return toNumber(maxDexBonuses) - toNumber(this.getStripping("reduceJointProtection"));
    }

    get mods() {
        let actor = this.actor;
        if (!actor || !actor.data || !actor.items) {
            return [];
        }

        return this.data.data.items?.map(item => actor.items.get(item._id)) || [];
    }

    get prefix() {
        return this.getInheritableAttributesByKey('prefix')?.value;
    }

    get suffix() {
        if (this.mods?.filter(item => item.name === 'Bayonet Ring').length > 0) {
            return `with ${this.name}`
        }
        return this.getInheritableAttributesByKey('suffix')?.value;
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
        let armorType = this.getInheritableAttributesByKey("armorType", "VALUES")[0] || this.subType;

        if (armorType === 'Heavy Armor' || this.getStripping("makeHeavy")?.value) {
            return 'Heavy';
        }
        if (armorType === 'Medium Armor' || this.getStripping("makeMedium")?.value) {
            return 'Medium';
        }
        if (armorType === 'Light Armor') {
            return 'Light';
        }
        return 'NA';
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
        let treatedAsForRange = this.getInheritableAttributesByKey("treatedAs", "VALUES")[0];
        let resolvedSubtype = treatedAsForRange ? treatedAsForRange : this.data.data.subtype;

        if (this.getStripping("reduceRange")?.value) {
            resolvedSubtype = this.reduceRange(resolvedSubtype);
        }

        return resolvedSubtype;
    }

    get accurate() {
        let specials = this.getInheritableAttributesByKey('special')?.value;
        for (let special of specials ? specials : []) {
            if (special.toLowerCase().startsWith('accurate')) {
                return true;
            }
        }

        return false;
    }

    get inaccurate() {
        let specials = this.getInheritableAttributesByKey('special')?.value;
        for (let special of specials ? specials : []) {
            if (special.toLowerCase().startsWith('inaccurate')) {
                return true;
            }
        }
        return false;
    }


    get damageDie() {
        let damageDice = this.getInheritableAttributesByKey('damageDie');
        let damageDie = damageDice[damageDice.length - 1]?.value;

        if (!damageDie) {
            return "";
        }
        if (damageDie.includes("/")) {
            damageDie = damageDie.split("/")[0]
        }
        // let tok = damageDie.split('d');
        // let quantity = parseInt(tok[0]);
        // let size = parseInt(tok[1]);

        // for (let bonusDamageDie of this.getInheritableAttributesByKey('bonusDamageDie')) {
        //     quantity = quantity + parseInt(bonusDamageDie.value);
        // }
        for (let bonusDamageDie of this.getInheritableAttributesByKey('bonusDamageDieSize')) {
            damageDie = increaseDamageDie(damageDie, parseInt(bonusDamageDie.value));
        }
        for (let bonusDamageDie of this.getInheritableAttributesByKey('bonusDamageDieType')) {
            damageDie = increaseDieType(damageDie, parseInt(bonusDamageDie.value));
        }
        return damageDie;
    }

    get additionalDamageDice() {
        let attribute = this.getInheritableAttributesByKey('damageDie');
        let damageDie = attribute[attribute.length - 1]?.value;

        if (!damageDie) {
            return "";
        }

        if (!damageDie.includes("/")) {
            return [];
        }
        let damageDice = damageDie.split("/");

        //let bonusDice = this.getInheritableAttributesByKey('bonusDamageDie');
        let bonusSize = this.getInheritableAttributesByKey('bonusDamageDieSize');
        let atks = [];
        for (let die of damageDice) {

            // let tok = die.split('d');
            // let quantity = parseInt(tok[0]);
            // let size = parseInt(tok[1]);

            // for (let bonusDamageDie of bonusDice) {
            //     quantity = quantity + parseInt(bonusDamageDie.value);
            // }
            for (let bonusDamageDie of bonusSize) {
                die = increaseDamageDie(die, parseInt(bonusDamageDie.value));
            }

            atks.push(die);
        }


        return atks.slice(1);
    }

    get stunDamageDie() {
        let damageDie = this.getInheritableAttributesByKey('stunDamageDie')[0]?.value;
        if (!damageDie || this.getStripping("stripStun")?.value) {
            return ""
        }
        // let tok = damageDie.split('d');
        // let quantity = parseInt(tok[0]);
        // let size = parseInt(tok[1]);
        for (let bonusDamageDie of this.getInheritableAttributesByKey('bonusStunDamageDieSize')) {
            damageDie = increaseDamageDie(damageDie, parseInt(bonusDamageDie.value));
        }

        // for (let bonusDamageDie of this.getInheritableAttributesByKey('bonusStunDamageDie')) {
        //     quantity = quantity + parseInt(bonusDamageDie.value);
        // }
        return damageDie;
    }

    get damageType() {
        let attributes = this.getInheritableAttributesByKey('damageType');
        return attributes.map(attribute => attribute.value).join(', ');
    }

    /**
     * Augment the basic Item data model with additional dynamic data.
     */
    prepareData() {
        super.prepareData();
        this._pendingUpdate = {};
        // Get the Item's data
        const itemData = this.data;
        itemData.finalName = this.name;

        if (this.type === "weapon") this.prepareWeapon(itemData);
        if (this.type === "armor") this.prepareArmor(itemData);
        if (this.type === "feat") this.prepareFeatData(itemData);
    }


    get isEquipable() {
        return (this.type === "weapon" || this.type === "armor") && !this.isBioPart && !this.isDroidPart;
    }

    get isModification() {
        return this.type === "upgrade" || this.subType === "weapons and armor accessories";
    }

    get isBioPart() {
        return this.subType === "Implants" || this.subType === "Bio-Implants" || this.subType === "Cybernetic Devices" || this.subType === "Advanced Cybernetics";
    }

    get isDroidPart() {
        return this.subType === "Locomotion Systems" || this.subType === "Processor Systems"
            || this.subType === "Appendages" || this.subType?.startsWith("Droid Accessories")
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

        let defensiveMaterial = Math.min(this.getInheritableAttributesByKey("armorReflexDefenseBonus", "MAX"),
            this.getInheritableAttributesByKey("equipmentFortitudeDefenseBonus", "MAX"));

        let jointProtection = this.getInheritableAttributesByKey("maximumDexterityBonus", "MIN");

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

        if (this.data.data.supplier && this.data.data.supplier.type && this.data.data.supplier.name) {
            sourceString = `${this.data.data.supplier.type}, ${this.data.data.supplier.name}`;
        }
        this.data.data.sourceString = sourceString;
    }

    setPayload(payload) {
        this.data.data.payload = payload;
        this.crawlPrerequisiteTree(this.data.data.prerequisite, (prerequisite) => {
            if (prerequisite.requirement) {
                prerequisite.requirement = prerequisite.requirement.replace(/#payload#/g, payload);
            }
            if (prerequisite.text) {
                prerequisite.text = prerequisite.text.replace(/#payload#/g, payload);
            }
        });
        this._crawlAttributes(this.data.data, (attribute) => {
            if (attribute.value) {
                if (typeof attribute.value === "string") {
                    attribute.value = attribute.value.replace(/#payload#/g, payload);
                } else if (Array.isArray(attribute.value)) {
                    attribute.value = attribute.value.map(val => val.replace(/#payload#/g, payload));
                }
            }
        });
        this._crawlProvidedItems(this.data.data, (providedItem) => {
            if (providedItem.name) {
                    providedItem.name = providedItem.name.replace(/#payload#/g, payload);
            }
        });
        this.data.data.choices = [];
    }


    /**
     *
     * @param parent {SWSEItem}
     */
    setParent(parent) {
        this.crawlPrerequisiteTree(this.data.data.prerequisite, (prerequisite) => {
            if (prerequisite.requirement) {
                prerequisite.requirement = prerequisite.requirement.replace(/#parent#/g, parent.name);
            }
            if (prerequisite.text) {
                prerequisite.text = prerequisite.text.replace(/#parent#/g, parent.name);
            }
        });
        this._crawlAttributes(this.data.data, (attribute) => {
            if (attribute.value) {
                if (typeof attribute.value === "string") {
                    attribute.value = attribute.value.replace("#parent#", parent.name);
                } else if (Array.isArray(attribute.value)) {
                    attribute.value = attribute.value.map(val => val.replace("#parent#", parent.name));
                }
            }
        });
        this.data.data.supplier = {
            id: parent.id,
            name: parent.name,
            type: parent.data.type
        }
    }


    _crawlAttributes(data, funct) {
        if (!data) {
            return;
        }
        for (let attribute of Object.values(data.attributes) || []) {
            funct(attribute)
        }
        if (data.levels) {

            for (let level of Object.values(data.levels) || []) {

                for (let attribute of Object.values(level.attributes) || []) {
                    funct(attribute)
                }
            }
        }
        //funct(data);
        for (let mode of Object.values(data.modes) || []) {
            this._crawlAttributes(mode, funct)
        }

    }

    _crawlProvidedItems(data, funct) {
        if (!data) {
            return;
        }
        for (let attribute of Object.values(data.providedItems) || []) {
            funct(attribute)
        }
        if (data.levels) {

            for (let level of Object.values(data.levels) || []) {

                for (let attribute of Object.values(level.providedItems) || []) {
                    funct(attribute)
                }
            }
        }
        //funct(data);
        for (let mode of Object.values(data.modes) || []) {
            this._crawlProvidedItems(mode, funct)
        }

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

    //TODO MOVE ME
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

    addAttribute(attribute) {
        let data = {};
        let attributes = this.data.data.attributes
        let attributeId = 0;
        while (attributes[cursor]) {
            attributeId++;
        }

        data.attributes = {};
        data.attributes[attributeId] = attribute;
        this.updateData(data);
    }

    canStripAutoFire() {
        let ratesOfFire = this.getInheritableAttributesByKey('ratesOfFire');
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

        return this.getInheritableAttributesByKey('stunDamageDie').length > 0 && this.getInheritableAttributesByKey('damageDie').length > 0;
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
    rollItem(actor, context) {
        // let actor = this.ge
        if (this.type === "weapon" && false) { //hidden but saved for later
            let range = this.effectiveRange;
            let isAccurate = this.accurate;
            let isInaccurate = this.inaccurate;
            let rangedAttackModifier = getRangedAttackMod(range, isAccurate, isInaccurate, actor);

            let attack = generateAttackFromWeapon(this, actor);

            let modifiers = this.getModifierHTML(rangedAttackModifier);
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
                        if (rangedAttackModifier) {
                            formula += getBonusString(rangedAttackModifier);
                        }

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

    static getModifierHTML(rangedAttackModifier, item) {
        let modifiers = [];
        let uniqueId = Math.floor(Math.random() * 50000 + Math.random() * 50000)
        if (isNaN(rangedAttackModifier)) {
            modifiers.push(getRangeModifierBlock(item.effectiveRange, item.accurate, item.inaccurate, uniqueId))
        }

        let attackLabel = document.createElement("label");
        modifiers.push(attackLabel);
        attackLabel.innerText = "Attack Modifier:";

        let attackInput = document.createElement("input");
        attackInput.classList.add("attack-modifier", "suppress-propagation")
        attackInput.dataset.source = "Miscellaneous"
        modifiers.push(attackInput);

        modifiers.push(document.createElement("br"))

        let damageLabel = document.createElement("label");
        damageLabel.innerText = "Damage Modifier:";
        modifiers.push(damageLabel);

        let damageInput = document.createElement("input");
        damageInput.dataset.source = "Miscellaneous"
        damageInput.classList.add("damage-modifier", "suppress-propagation")
        modifiers.push(damageInput);

        return modifiers;
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

    setAttribute(attribute, value) {
        let attributesForUpdate = this.getAttributesForUpdate(attribute);
        if (Object.keys(attributesForUpdate).length > 0) {
            for (let attribute of Object.values(attributesForUpdate)) {
                attribute.value = value;
            }
        } else {
            let nullEntry = Object.entries(this.data.data.attributes).find(entry => entry[1] === null)
            if (nullEntry) {
                attributesForUpdate[nullEntry[0]] = {value: value, key: attribute};
            } else {
                attributesForUpdate[Object.entries(this.data.data.attributes).length] = {value: value, key: attribute};
            }
        }
        this.setAttributes(attributesForUpdate)
    }

    getAttributesForUpdate(attribute) {
        let attributes = {};
        for (let entry of Object.entries(this.data.data.attributes)) {
            if (entry[1]?.key === attribute) {
                attributes[entry[0]] = entry[1];
            }
        }
        return attributes;
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

    updateData(data) {
        let update = {};
        update.data = data;
        this.update(update);
    }


    // setAttribute(attributeIndex, attr) {
    //     let data = {};
    //     data.attributes = {}
    //     data.attributes[attributeIndex] = attr;
    //     this.updateData(data);
    // }


    /**
     * Checks item for any attributes matching the provided attributeKey.  this includes active modes.
     * @param attributeKey {string|[string]}
     * @param reduce
     * @param itemFilter {unused}
     * @param attributeFilter {unused}
     * @returns {[]}
     */
    getInheritableAttributesByKey(attributeKey, reduce, itemFilter, attributeFilter) {
        if (!attributeKey) {
            return [];
        }

        let values = [];

        //add attributes from this item
        for (let attribute of Object.values(this.data.data.attributes).filter(attr => attr && attr.key === attributeKey)) {
            values.push(...extractAttributeValues(attribute, this.data._id, this.data.name));
        }


        if (this.data.type === 'class') {
            let classLevel = this.getClassLevel();
            for (let i = 1; i <= classLevel; i++) {
                let level = this.data.data.levels[i];
                for (let attribute of Object.values(level.data.attributes).filter(attr => attr && attr.key === attributeKey)) {
                    values.push(...extractAttributeValues(attribute, this.data._id, this.data.name));
                }
            }
        }

        //
        values.push(...this.extractModeAttributes(this.getActiveModes(), attributeKey, values));

        for (let child of this.data.data.items || []) {
            values.push(...this.getAttributesFromItem(child._id, attributeKey))
        }

        return reduceArray(reduce, values);
    }

    getProvidedItems(filter) {
        let items = this.data.data.providedItems;
        if (!!filter) {
            return items.filter(filter);
        }
        return items;
    }

    extractModeAttributes(activeModes, attributeKey) {
        let values = [];
        for (let mode of activeModes) {
            for (let attribute of Object.values(mode.attributes).filter(attr => attr.key === attributeKey) || []) {
                values.push(...extractAttributeValues(attribute, this.data._id, this.data.name));
            }
            values.push(...this.extractModeAttributes(Object.values(mode.modes || []).filter(mode => mode && mode.isActive), attributeKey) || []);
        }
        return values;
    }

    getActiveModes() {
        return Object.values(this.data.data?.modes || [])?.filter(mode => mode && mode.isActive) || [];
    }

    get modes() {
        let modes = Object.values(this.data.data.modes).filter(mode => !!mode);

        modes.forEach(mode => mode.modePath = mode.name);
        let activeModes = this.getActiveModes();
        let childModes = this.getChildModes(activeModes, "");

        modes.push(...childModes);

        return modes;
    }

    getChildModes(activeModes, parentModePath) {
        let childModes = [];
        for (let activeMode of activeModes) {
            let values = Object.values(activeMode.modes || []).filter(mode => !!mode);
            let parentModePath1 = parentModePath + (!!parentModePath ? "." : "") + activeMode.name;
            values.forEach(val => val.modePath = parentModePath1 + (!!parentModePath1 ? "." : "") + val.name)
            childModes.push(...values)
            childModes.push(...this.getChildModes(values.filter(mode => !!mode && mode.isActive), parentModePath1))
        }
        return childModes;
    }

    activateMode(mode) {
        let modes = this.data.data.modes;
        let update = {};

        update.data = {};
        this._activateMode(modes, mode, update.data);

        this.update(update);
    }

    _activateMode(modes, mode, data) {
        let modeTokens = mode.split(".");

        data.modes = {};
        if (modeTokens.length === 1) {
            let groups = Object.values(modes || []).filter(m => !!m && m.name === mode).map(m => m.group).filter(g => !!g)

            if (groups.length > 0) {
                groups.forEach(group => {
                    Object.entries(modes || []).filter(entity => entity[1]?.group === group).forEach((entity) => {
                        data.modes[parseInt(entity[0])] = {};
                        data.modes[parseInt(entity[0])].isActive = entity[1].name === mode;
                    })
                })

            } else {
                Object.entries(modes || []).filter(entity => !!entity[1] && entity[1].name === mode).forEach((entity) => {
                    data.modes[parseInt(entity[0])] = {};
                    data.modes[parseInt(entity[0])].isActive = !entity[1].isActive;
                })
            }
        } else {
            let first = modeTokens[0];


            Object.entries(modes || []).filter(entity => entity[1]?.isActive && entity[1]?.name === first).forEach(entity => {
                data.modes = data.modes || {};
                data.modes[parseInt(entity[0])] = data.modes[parseInt(entity[0])] || {};
                this._activateMode(entity[1].modes, modeTokens.slice(1).join("."), data.modes[parseInt(entity[0])])
            })
        }
    }

    deactivateMode(mode) {
        let update = {};
        update.data = {};
        update.data.activeModes = this.data.data.activeModes.filter(activeMode => activeMode.toLowerCase() !== mode.toLowerCase());
        this.update(update);
    }

    getClassLevel() {
        if (this.data.type !== 'class' || !this.parent) {
            return undefined;
        }
        let classLevels = this.parent.classes.filter(clazz => clazz.data.name === this.data.name)

        return classLevels.length;
    }
}

