import {increaseDieSize, increaseDieType, toNumber} from "../util.js";
import {sizeArray, uniqueKey} from "../constants.js";
import {getInheritableAttribute} from "../attribute-helper.js";
import {changeSize} from "../actor/size.js";
import {SimpleCache} from "../common/simple-cache.js";

// noinspection JSClosureCompilerSyntax
/**
 * Extend the basic Item with some very simple modifications.
 * @extends {Item}
 */
export class SWSEItem extends Item {
    constructor(...args) {
        super(...args);
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

    /**
     * Augment the basic Item data model with additional dynamic data.
     */
    prepareData() {
        super.prepareData();
        this._pendingUpdate = {};
        // Get the Item's data
        const system = this.system;
        //itemData.finalName = this.name;

        this.cache = new SimpleCache();
        this.items = this.system.items?.map(id => {
            return this.parent.items.get(id)
        }).filter(i => !!i) || []
        system.displayName = SWSEItem.buildItemName(this);

        this.system.quantity = Number.isInteger(this.system.quantity) ? this.system.quantity : 1;

        if (this.type === "vehicleTemplate") this.type = "vehicleBaseType"; //TODO remove vehicle template type after next major release
        if (this.type === "weapon") this.prepareWeapon(system);
        if (this.type === "armor") this.prepareArmor(system);
        if (this.type === "feat") this.prepareFeatData(system);
    }


    async safeUpdate(data={}, context={}) {
        if(this.canUserModify(game.user, 'update')){
            await this.update(data, context);
        }
    }

    get strippable() {
        return ['armor', 'weapon'].includes(this.type)
    }

    get hasPrerequisites() {
        return ['feat', 'talent', 'class', 'trait'].includes(this.type)
    }

    get modifiable() {
        return ['armor', 'weapon'].includes(this.type)
    }

    get hasLevels() {
        return ['class'].includes(this.type)
    }

    _onCreate(data, options, userId) {
        super._onCreate(data, options, userId);
        this.prepareData();
    }

    // get name() {
    //     let itemData = this.data;
    //     return SWSEItem.buildItemName(itemData);
    // }

    static buildItemName(item) {
        if (!item) {
            return "";
        }
        let id = item._id;
        let finalName = item.name;

        finalName = this.addSizeAdjustmentSuffix(item, finalName);


        let modifiers = (item.system?.selectedChoices || []).join(", ");
        if (modifiers) {
            finalName = `${finalName} (${modifiers})`
        }

        let prefix = getInheritableAttribute({
            entity: item,
            attributeKey: "prefix",
            reduce: "VALUES",
            attributeFilter: attr => attr.source !== id
        }).join(" ");

        if (prefix) {
            finalName = `${prefix} ${finalName}`;
        }

        let suffix = getInheritableAttribute({
            entity: item,
            attributeKey: "suffix",
            reduce: "VALUES",
            attributeFilter: attr => attr.source !== id
        }).join(" ");

        if (suffix) {
            finalName = `${finalName} ${suffix}`;
        }

        return finalName;
    }

    getCached(key, fn) {
        return this.cache.getCached(key, fn)
    }

    static addSizeAdjustmentSuffix(itemData, finalName) {
        if (!itemData.document) {
            return finalName;
        }
        let resolvedSizeIndex = this.getResolvedSizeIndexForSizeProvider(itemData);

        if(resolvedSizeIndex) {
            let resolvedSize = sizeArray[resolvedSizeIndex] || sizeArray[0];
            if (resolvedSize !== finalName) {
                finalName = `${finalName} (adjusted to ${resolvedSize})`;
            }
        }

        return finalName;
    }

    static getResolvedSizeIndexForSizeProvider(itemData) {
        let checkIfThisProvidesSize = getInheritableAttribute({
            entity: itemData,
            attributeKey: "sizeIndex",
            reduce: "NUMERIC_VALUES"
        });

        if (checkIfThisProvidesSize.length === 0) {
            return undefined;
        }
        return this.getResolvedSizeIndex(itemData);
    }

    static getResolvedSizeIndex(itemData) {
        let sizeIndex = getInheritableAttribute({
            entity: itemData.document.parent,
            attributeKey: "sizeIndex",
            reduce: "NUMERIC_VALUES"
        });

        sizeIndex = sizeIndex.reduce((a, b) => a + b, 0)

        let sizeBonus = toNumber(getInheritableAttribute({
            entity: itemData.document.parent,
            attributeKey: "sizeBonus",
            reduce: "SUM"
        }))

        return sizeIndex + sizeBonus;
    }

    get baseName() {
        return this.name ?? null;
    }

    get sizeMod() {
        return getInheritableAttribute({
            entity: this,
            attributeKey: "shipSkillModifier",
            reduce: "SUM",


        })
    }

    get levelUpHitPoints() {
        return getInheritableAttribute({
            entity: this,
            attributeKey: "levelUpHitPoints",


        }).map(attr => attr.value)[0];
    }

    get classLevelHealth() {
        if (this.type !== "class") {
            return 0;
        }
        if (this.actAsFirstLevel) {

            return getInheritableAttribute({
                entity: this,
                attributeKey: "firstLevelHitPoints",


            }).map(attr => parseInt(attr.value))[0];
        }
        let attrs = getInheritableAttribute({
            entity: this,
            attributeKey: "rolledHp"
        });

        if (attrs.length > 0) {
            let rolledHp = attrs.map(attr => parseInt(attr.value))[0]

            let max = getInheritableAttribute({
                entity: this,
                attributeKey: "levelUpHitPoints"
            }).map(attr => parseInt(attr.value.split("d")[1]))[0]
            return rolledHp > max ? max : rolledHp;
        }

        return 1;
    }

    get actAsFirstLevel() {
        return getInheritableAttribute({
            entity: this,
            attributeKey: "isFirstLevel",
            reduce: "AND"


        }) && getInheritableAttribute({
            entity: this,
            attributeKey: "isHeroic",
            reduce: "AND"


        });
    }

    get isDoubleWeapon() {
        if (this.type !== 'weapon') {
            return false;
        }
        let damage = getInheritableAttribute({
            entity: this,
            attributeKey: "damage"
        });
        return damage[0]?.value.includes("/");
    }

    get availableForFullAttack() {

        if (this.type !== 'weapon') {
            return false;
        }
        return true;
    }

    get fortitudeDefenseBonus() {
        if (this._parentIsProficientWithArmor()) {
            return toNumber(getInheritableAttribute({
                entity: this,
                attributeKey: 'equipmentFortitudeDefenseBonus',
                reduce: "MAX",


            })) - toNumber(this.getStripping("reduceDefensiveMaterial"));
        }
        return 0;
    }

    get armorReflexDefenseBonus() {
        let ardb = toNumber(getInheritableAttribute({
            entity: this,
            attributeKey: 'armorReflexDefenseBonus',
            reduce: "MAX",


        }));
        let rdm = toNumber(this.getStripping("reduceDefensiveMaterial"));
        return ardb - rdm;
    }

    _parentIsProficientWithArmor() {
        return getInheritableAttribute({
            entity: this.parent,
            attributeKey: "armorProficiency",
            reduce: "VALUES"
        }).includes(this.armorType.toLowerCase());
    }

    get maximumDexterityBonus() {
        let maxDexBonuses = getInheritableAttribute({
            entity: this,
            attributeKey: 'maximumDexterityBonus',


        });
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

        return this.items?.map(item => actor.items.get(item._id)) || [];
    }

    get prefix() {
        return getInheritableAttribute({
            entity: this,
            attributeKey: 'prefix',


        })?.value;
    }

    get suffix() {
        if (this.mods?.filter(item => item.name === 'Bayonet Ring').length > 0) {
            return `with ${this.name}`
        }
        return getInheritableAttribute({
            entity: this,
            attributeKey: 'suffix',


        })?.value;
    }

    get size() {
        let swseItem = this;
        return SWSEItem.getItemSize(swseItem);
    }

    static getItemSize(swseItem) {
        let size = swseItem.data?.size || swseItem.data?.data?.size
        if (SWSEItem.getItemStripping(swseItem, "makeColossal")?.value) {
            size = changeSize(size, 1)
        }
        if (SWSEItem.getItemStripping(swseItem, "makeGargantuan")?.value) {
            size = changeSize(size, 1)
        }
        if (SWSEItem.getItemStripping(swseItem, "makeHuge")?.value) {
            size = changeSize(size, 1)
        }
        if (SWSEItem.getItemStripping(swseItem, "makeLarge")?.value) {
            size = changeSize(size, 1)
        }
        if (SWSEItem.getItemStripping(swseItem, "makeMedium")?.value) {
            size = changeSize(size, 1)
        }
        if (SWSEItem.getItemStripping(swseItem, "makeSmall")?.value) {
            size = changeSize(size, 1)
        }
        if (SWSEItem.getItemStripping(swseItem, "makeTiny")?.value) {
            size = changeSize(size, 1)
        }

        size = changeSize(size, getInheritableAttribute({entity: swseItem, attributeKey: "sizeBonus", reduce: "SUM"}))

        return size;
    }

    get availability() {
        let inheritableAttribute = getInheritableAttribute({
            entity: this,
            attributeKey: "availability",
            reduce: "FIRST"
        });
        if (!inheritableAttribute) {
            return this.system.availability;
        }
        return inheritableAttribute
    }

    get armorType() {
        let armorType = (getInheritableAttribute({
            entity: this,
            attributeKey: "armorType",
            reduce: "VALUES",


        }))[0] || this.subType;

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
        return this.system.treatedAsSubtype ? this.system.treatedAsSubtype : this.system.subtype;
    }

    get modSubType() {
        if (this.items?.filter(item => item.name === 'Bayonet Ring').length > 0) {
            return 'Weapons Upgrade'
        }

        return this.subType;
    }

    get effectiveRange() {
        let treatedAsForRange = (getInheritableAttribute({
            entity: this,
            attributeKey: "treatedAs",
            reduce: "VALUES",


        }))[0];
        let resolvedSubtype = treatedAsForRange ? treatedAsForRange : this.system.subtype;

        if (this.getStripping("reduceRange")?.value) {
            resolvedSubtype = this.reduceRange(resolvedSubtype);
        }

        return resolvedSubtype;
    }

    get accurate() {
        let specials = getInheritableAttribute({
            entity: this,
            attributeKey: 'special'
        })?.value;
        for (let special of specials ? specials : []) {
            if (special.toLowerCase().startsWith('accurate')) {
                return true;
            }
        }

        return false;
    }

    get inaccurate() {
        let specials = getInheritableAttribute({
            entity: this,
            attributeKey: 'special',


        })?.value;
        for (let special of specials ? specials : []) {
            if (special.toLowerCase().startsWith('inaccurate')) {
                return true;
            }
        }
        return false;
    }


    get damageDie() {
        let damageDice = getInheritableAttribute({
            entity: this,
            attributeKey: 'damage'
        });
        let damageDie = damageDice[damageDice.length - 1]?.value;

        if (!damageDie) {
            return "";
        }
        if (damageDie.includes("/")) {
            damageDie = damageDie.split("/")[0]
        }

        for (let bonusDamageDie of getInheritableAttribute({
            entity: this,
            attributeKey: 'bonusDamageDieSize'
        })) {
            damageDie = increaseDieSize(damageDie, parseInt(bonusDamageDie.value));
        }
        for (let bonusDamageDie of getInheritableAttribute({
            entity: this,
            attributeKey: 'bonusDamageDieType',


        })) {
            damageDie = increaseDieType(damageDie, parseInt(bonusDamageDie.value));
        }
        return damageDie;
    }

    get additionalDamageDice() {
        let attribute = getInheritableAttribute({
            entity: this,
            attributeKey: 'damage'
        });
        let damageDie = attribute[attribute.length - 1]?.value;

        if (!damageDie) {
            return "";
        }

        if (!damageDie.includes("/")) {
            return [];
        }
        let damageDice = damageDie.split("/");

        //let bonusDice = this.getInheritableAttributesByKey('bonusDamageDie');
        let bonusSize = getInheritableAttribute({
            entity: this,
            attributeKey: 'bonusDamageDieSize'
        });
        let atks = [];
        for (let die of damageDice) {

            // let tok = die.split('d');
            // let quantity = parseInt(tok[0]);
            // let size = parseInt(tok[1]);

            // for (let bonusDamageDie of bonusDice) {
            //     quantity = quantity + parseInt(bonusDamageDie.value);
            // }
            for (let bonusDamageDie of bonusSize) {
                die = increaseDieSize(die, parseInt(bonusDamageDie.value));
            }

            atks.push(die);
        }


        return atks.slice(1);
    }

    get stunDamageDie() {
        let damageDie = (getInheritableAttribute({
            entity: this,
            attributeKey: 'stunDamage',


        }))[0]?.value;
        if (!damageDie || this.getStripping("stripStun")?.value) {
            return ""
        }
        // let tok = damageDie.split('d');
        // let quantity = parseInt(tok[0]);
        // let size = parseInt(tok[1]);
        for (let bonusDamageDie of getInheritableAttribute({
            entity: this,
            attributeKey: 'bonusStunDamageDieSize',


        })) {
            damageDie = increaseDieSize(damageDie, parseInt(bonusDamageDie.value));
        }

        // for (let bonusDamageDie of this.getInheritableAttributesByKey('bonusStunDamageDie')) {
        //     quantity = quantity + parseInt(bonusDamageDie.value);
        // }
        return damageDie;
    }

    get damageType() {
        let attributes = getInheritableAttribute({
            entity: this,
            attributeKey: 'damageType',


        });
        return attributes.map(attribute => attribute.value).join(', ');
    }

    get finalName(){
        return this.system.displayName;
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
        return this.subType === "Locomotion Systems" || this.subType === "Processor Systems" || this.subType === "Droid Templates"
            || this.subType === "Appendages" || this.subType?.startsWith("Droid Accessories")
    }

    prepareFeatData(system) {
        if (system.categories) {
            system.bonusFeatCategories = system.categories.filter(cat => cat.value?.toLowerCase().includes("bonus feats"));
            system.hasBonusFeatCategories = system.bonusFeatCategories.length > 0;
        }
    }

    prepareWeapon(system) {
        system.upgradePoints = toNumber(this.getBaseUpgradePoints(system.name));

        system.stripping = system.stripping || {};

        this.setStripping('reduceRange', "Reduce Range", this.canReduceRange());

        this.setStripping('stripAutofire', "Strip Autofire", this.canStripAutoFire());

        this.setStripping('stripStun', "Strip Stun", this.canStripStun());
        system.isBaseExotic = this.isExotic();
        this.setStripping('stripDesign', "Make Exotic", !system.isBaseExotic);

        let size = system.size;

        system.resolvedSize = system.size;

        this.setStripping('makeTiny', "Make Weapon Tiny", size === 'Diminutive');
        this.setStripping('makeSmall', "Make Weapon Small", size === 'Tiny');
        this.setStripping('makeMedium', "Make Weapon Medium", size === 'Small');
        this.setStripping('makeLarge', "Make Weapon Large", size === 'Medium');
        this.setStripping('makeHuge', "Make Weapon Huge", size === 'Large');
        this.setStripping('makeGargantuan', "Make Weapon Gargantuan", size === 'Huge');
        this.setStripping('makeColossal', "Make Weapon Colossal", size === 'Gargantuan');

        for (let stripped of Object.values(system.stripping)) {
            system.upgradePoints += stripped.value ? 1 : 0;
        }

        if (system.items && system.items.length > 0) {
            for (let mod of system.items ? system.items : []) {

                let upgradePointCost = getInheritableAttribute({
                    entity: mod,
                    attributeKey: "upgradePointCost"
                });

                if (upgradePointCost !== undefined) {

                    system.upgradePoints -= toNumber(upgradePointCost);
                }
            }
        }
    }

    setStripping(key, label, enabled, type, low, high) {
        this.system.stripping[key] = this.system.stripping[key] || {};
        this.system.stripping[key].label = label;
        this.system.stripping[key].enabled = enabled;
        this.system.stripping[key].value =
            enabled ? (this.system.stripping[key].value || (type === 'boolean' ? false : (type === 'string' ? "" : 0))) : false;
        this.system.stripping[key].type = type ? type : "boolean"
        this.system.stripping[key].low = low;
        this.system.stripping[key].high = high;
        return this.system.stripping[key].value;
    }

    getStripping(key) {
        let swseItem = this;
        return SWSEItem.getItemStripping(swseItem, key);
    }

    static getItemStripping(swseItem, key) {
        let stripping = swseItem.system.stripping;
        if (stripping) {
            return stripping[key];
        }
    }

    prepareArmor(system) {
        system.upgradePoints = this.getBaseUpgradePoints(system.name);

        system.stripping = system.stripping || {};

        let makeMedium = this.setStripping('makeMedium', "Make Armor Medium", system.subtype === 'Light Armor');
        this.setStripping('makeHeavy', "Make Armor Heavy", system.subtype === 'Medium Armor' || makeMedium);

        let defensiveMaterial = Math.min(getInheritableAttribute({
                entity: this,
                attributeKey: "armorReflexDefenseBonus",
                reduce: "MAX",


            }),
            getInheritableAttribute({
                entity: this,
                attributeKey: "equipmentFortitudeDefenseBonus",
                reduce: "MAX",


            }));

        let jointProtection = getInheritableAttribute({
            entity: this,
            attributeKey: "maximumDexterityBonus",
            reduce: "MIN",


        });

        this.setStripping('reduceDefensiveMaterial', "Reduce Defensive Material", defensiveMaterial > 0, "number", 0, defensiveMaterial);
        this.setStripping('reduceJointProtection', "Reduce Joint Protection", jointProtection > 0, "number", 0, jointProtection);


        for (let stripped of Object.values(system.stripping)) {
            system.upgradePoints += toNumber(stripped.value);
        }
        try {
            if (system.items && system.items.length > 0) {
                for (let mod of system.items) {
                    if (mod.system?.upgrade?.pointCost !== undefined) {
                        system.upgradePoints -= mod.system.upgrade.pointCost;
                    }
                }
            }
        } catch (e) {
            console.warn("mods may not be initialized", e)
        }
    }

    setTextDescription() {
        this.system.textDescription = this.stripHTML(this.system.description);
    }

    setSourceString() {
        let sourceString = '';

        let supplier = this.system.supplier;
        if (supplier && supplier.type && supplier.name) {
            sourceString = `${supplier.type}, ${supplier.name}`;
        }
        this.system.sourceString = sourceString;
    }

    setChoice(choice) {
        if(!choice){
            return;
        }
        this.system.selectedChoices = this.system.selectedChoices || [];
        this.system.selectedChoices.push(choice);

        this.system.displayName = SWSEItem.buildItemName(this);
    }

    setPayload(payload, payloadString) {
        let pattern = "#payload#";
        if (payloadString) {
            pattern = `#${payloadString}#`;
            pattern = pattern.replace(/##/g, "#")
        }

        let regExp = new RegExp(pattern, "g");
        this.system.description = this.system.description.replace(regExp, payload)
        this.crawlPrerequisiteTree(this.system.prerequisite, (prerequisite) => {
            if (prerequisite.requirement) {
                prerequisite.requirement = prerequisite.requirement.replace(regExp, payload);
            }
            if (prerequisite.text) {
                prerequisite.text = prerequisite.text.replace(regExp, payload);
            }
        });
        this._crawlAttributes(this.system, (attribute) => {
            if (attribute.value) {
                attribute.key = attribute.key.replace(regExp, payload);
                if (Array.isArray(attribute.value)) {
                    attribute.value = attribute.value.map(val => `${val}`.replace(regExp, payload));
                } else {
                    attribute.value = `${attribute.value}`.replace(regExp, payload);
                }
            }
        });
        this._crawlProvidedItems(this.system, (providedItem) => {
            if (providedItem.name) {
                providedItem.name = providedItem.name.replace(regExp, payload);
            }
        });
        this.system.choices = [];

        this.system.displayName = SWSEItem.buildItemName(this);
    }


    addItemAttributes(modifiers) {
        if(!modifiers){
            return;
        }

        let attributes = this.system.attributes
        let attributeId = 0;
        while (attributes[attributeId]) {
            attributeId++;
        }

        for (let modifier of modifiers) {
            let existingAttribute = Object.values(attributes).find(attribute => attribute.key === modifier.key);
            if (existingAttribute && uniqueKey.includes(modifier.key)) {
                existingAttribute.value = modifier.value;
            } else {
                attributes[attributeId] = modifier;
                attributeId++;
            }
        }
    }

    addProvidedItems(modifiers) {
        if(!modifiers){
            return;
        }
        this.system.providedItems = this.system.providedItems || [];
        this.system.providedItems.push(...modifiers)
    }

    /**
     *
     * @param parent {SWSEItem}
     */
    setParent(parent, unlocked) {
        if(!parent){
            return;
        }

        if(Array.isArray(parent)){
            parent = parent[0];
        }
        this.crawlPrerequisiteTree(this.system.prerequisite, (prerequisite) => {
            if (prerequisite.requirement) {
                prerequisite.requirement = prerequisite.requirement.replace(/#parent#/g, parent.name);
            }
            if (prerequisite.text) {
                prerequisite.text = prerequisite.text.replace(/#parent#/g, parent.name);
            }
        });
        this._crawlAttributes(this.system, (attribute) => {
            if (attribute.value) {
                if (typeof attribute.value === "string") {
                    attribute.value = attribute.value.replace("#parent#", parent.name);
                } else if (Array.isArray(attribute.value)) {
                    attribute.value = attribute.value.map(val => val.replace("#parent#", parent.name));
                }
            }
        });
        this.system.supplier = {
            id: parent.id,
            name: parent.name,
            type: parent.type,
            unlocked
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
        if (data.modes) {
            for (let mode of Object.values(data.modes) || []) {
                this._crawlAttributes(mode, funct)
            }
        }

    }

    _crawlProvidedItems(data, funct) {
        if (!data) {
            return;
        }
        for (let attribute of Object.values(data.providedItems || {})) {
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
        for (let mode of Object.values(data.modes || {})) {
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
        if(!prerequisite){
            return;
        }

        this.system.prerequisite = prerequisite;
    }

    setParentItem(parentItem) {
        this.system.supplier = {id: parentItem.id, name: parentItem.name, type: parentItem.data.type};
        this.system.isSupplied = true;
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
        let items = this.items || [];
        items.push(item)
        //let filteredItems = [];
        let foundIds = [];

        for (let item of items) {
            if (!foundIds.includes(item._id)) {
                foundIds.push(item._id)
                //filteredItems.push(item);
            }
        }


        await this.safeUpdate({"data.items": [...foundIds]});
        await item.safeUpdate({"data.hasItemOwner": true});
    }

    async revokeOwnership(item) {
        if (!item) {
            return;
        }
        let items = this.items?.filter(i => i._id !== item.data._id);
        await this.safeUpdate({"data.items": items});
        await item.safeUpdate({"data.hasItemOwner": false});
    }

    canReduceRange() {
        let subtypes = ["pistols", "rifles", "ranged weapons", "grenades", "heavy weapons", "simple ranged weapons", "thrown"];
        return subtypes.includes(this.system.subtype?.toLowerCase()) || subtypes.includes(this.system.attributes?.treatedAsForRange?.toLowerCase())
    }

    addAttribute(attribute) {
        let data = {};
        let attributes = this.system.attributes
        let attributeId = 0;
        while (attributes[attributeId]) {
            attributeId++;
        }

        data.attributes = {};
        data.attributes[attributeId] = attribute;
        this.updateData(data);
    }

    canStripAutoFire() {
        let ratesOfFire = getInheritableAttribute({
            entity: this,
            attributeKey: 'ratesOfFire'
        });
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
        //return this.system.attributes.ratesOfFire && this.system.attributes.ratesOfFire.value.includes("Single-Shot") && this.system.attributes.ratesOfFire.value.includes("Autofire");
    }

    canStripStun() {
        return getInheritableAttribute({
            entity: this,
            attributeKey: 'stunDamage'
        }).length > 0 && getInheritableAttribute({
            entity: this,
            attributeKey: 'damage'
        }).length > 0;
    }

    isExotic() {
        return ['Exotic Ranged Weapons' || 'Exotic Melee Weapons'].includes(this.subType);
    }

    increaseQuantity() {
        let current = this.system.quantity;

        let quantity = current + 1;
        this.safeUpdate({"data.quantity": quantity});
    }

    decreaseQuantity() {

        let current = this.system.quantity;

        let quantity = Math.max(0, current - 1);
        this.safeUpdate({"data.quantity": quantity});
    }

    toggleUse(key, value) {
        let data = {};
        data[key] = value;
        this.safeUpdate(data);
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

    async setAttribute(attribute, value, options={}) {
        let update = this.getUpdateObjectForUpdatingAttribute(attribute, value);
        return await this.safeUpdate(update, options);
    }

    getUpdateObjectForUpdatingAttribute(attribute, value) {
        let attributesForUpdate = this.getAttributesForUpdate(attribute);
        if (Object.keys(attributesForUpdate).length > 0) {
            for (let attribute of Object.values(attributesForUpdate)) {
                attribute.value = value;
            }
        } else {
            let nullEntry = Object.entries(this.system.attributes).find(entry => entry[1] === null)
            if (nullEntry) {
                attributesForUpdate[nullEntry[0]] = {value: value, key: attribute};
            } else {
                attributesForUpdate[Object.entries(this.system.attributes).length] = {value: value, key: attribute};
            }
        }
        let update = this.buildUpdateObjectForAttributes(attributesForUpdate);
        return update;
    }

    getAttributesForUpdate(attribute) {
        let attributes = {};
        for (let entry of Object.entries(this.system.attributes)) {
            if (entry[1]?.key === attribute) {
                attributes[entry[0]] = entry[1];
            }
        }
        return attributes;
    }

    setAttributes(attributes, options={}) {
        let update = this.buildUpdateObjectForAttributes(attributes);
        return this.safeUpdate(update, options);
    }

    buildUpdateObjectForAttributes(attributes) {
        let update = {};
        update._id = this._id
        update.system = {};
        update.system.attributes = attributes;
        return update;
    }

    setModeAttributes(modeIndex, attributes) {
        let update = {};
        update.system = {};
        update.system.modes = {};
        update.system.modes[modeIndex] = {};
        update.system.modes[modeIndex].attributes = attributes;
        this.safeUpdate(update);
    }

    updateData(data) {
        let update = {};
        update.data = data;
        this.safeUpdate(update);
    }


    // setAttribute(attributeIndex, attr) {
    //     let data = {};
    //     data.attributes = {}
    //     data.attributes[attributeIndex] = attr;
    //     this.updateData(data);
    // }
    getProvidedItems(filter) {
        let items = this.system.providedItems;

        if(!!items && !Array.isArray(items)){
            items = Object.values(items);
        }

        if (!!filter) {
            return items.filter(filter);
        }
        return items || [];
    }
    getModifications(filter) {
        let items = this.system.modifications;

        if(!!items && !Array.isArray(items)){
            items = Object.values(items);
        }

        if (!!filter) {
            return items.filter(filter);
        }
        return items || [];
    }

    static getActiveModesFromItemData(itemData) {
        return Object.values(itemData.system.modes || [])?.filter(mode => mode && mode.isActive) || [];
    }

    get modes() {
        let itemData = this.data;
        return SWSEItem.getModesFromItem(itemData);
    }

    static getModesFromItem(item) {
        if (!item) {
            return [];
        }
        let modes = Object.values(item.system.modes || []).filter(mode => !!mode);

        modes.forEach(mode => mode.modePath = mode.name);
        let activeModes = SWSEItem.getActiveModesFromItemData(item);
        let childModes = SWSEItem.getChildModes(activeModes, "");

        modes.push(...childModes);

        return modes;
    }

    static getChildModes(activeModes, parentModePath) {
        let childModes = [];
        for (let activeMode of activeModes) {
            let values = Object.values(activeMode.modes || []).filter(mode => !!mode);
            let parentModePath1 = parentModePath + (!!parentModePath ? "." : "") + activeMode.name;
            values.forEach(val => val.modePath = parentModePath1 + (!!parentModePath1 ? "." : "") + val.name)
            childModes.push(...values)
            childModes.push(...SWSEItem.getChildModes(values.filter(mode => !!mode && mode.isActive), parentModePath1))
        }
        return childModes;
    }

    activateMode(mode, type, group, attributes) {
        let modes = this.system.modes;
        let update = {};

        update.system = {};
        this._activateMode(modes, mode, update.system, type, group, attributes);

        this.safeUpdate(update);
    }

    _activateMode(modes, mode, system, type, group, attributes) {
        let modeTokens = mode.split(".");

        system.modes = {};
        if(type === "dynamic"){
            if (modeTokens.length === 1) {
                if (group) {
                    let found = false;
                    let entityKeys = Object.keys(modes);
                        Object.entries(modes || []).filter(entity => entity[1]?.group === group).forEach((entity) => {
                            system.modes[parseInt(entity[0])] = {};
                            const active = entity[1].name === mode;
                            system.modes[parseInt(entity[0])].isActive = active;
                            if(active){
                                found = true;
                            }
                        })

                    if(!found){
                        entityKeys.push(-1)
                        let newEntityKey = Math.max(...entityKeys)+1;
                        system.modes[newEntityKey] = {};
                        system.modes[newEntityKey].isActive = true;
                        system.modes[newEntityKey].group = group;
                        system.modes[newEntityKey].type = "dynamic"
                        system.modes[newEntityKey].name = mode;
                        system.modes[newEntityKey].attributes = attributes;
                    }

                } else {
                    let found = false;
                    let entityKeys = [];
                    Object.entries(modes || []).filter(entity => !!entity[1] && entity[1].name === mode).forEach((entity) => {
                        system.modes[parseInt(entity[0])] = {};
                        system.modes[parseInt(entity[0])].isActive = !entity[1].isActive;
                        entityKeys.push(parseInt(entity[0]));
                        found = true
                    })
                    if(!found){
                        let newEntityKey = Math.max(...entityKeys)+1;
                        system.modes[newEntityKey] = {};
                        system.modes[newEntityKey].isActive = true;
                        system.modes[newEntityKey].type = "dynamic"
                        system.modes[newEntityKey].name = mode;
                        system.modes[newEntityKey].attributes = attributes;
                    }
                }
            } else {
                //TODO embeded dynamic modes.  do we need these?

                let first = modeTokens[0];


                Object.entries(modes || []).filter(entity => entity[1]?.isActive && entity[1]?.name === first).forEach(entity => {
                    system.modes = system.modes || {};
                    system.modes[parseInt(entity[0])] = system.modes[parseInt(entity[0])] || {};
                    this._activateMode(entity[1].modes, modeTokens.slice(1).join("."), system.modes[parseInt(entity[0])])
                })
            }
        } else {
            if (modeTokens.length === 1) {
                let groups = Object.values(modes || []).filter(m => !!m && m.name === mode).map(m => m.group).filter(g => !!g)

                if (groups.length > 0) {
                    groups.forEach(group => {
                        Object.entries(modes || []).filter(entity => entity[1]?.group === group).forEach((entity) => {
                            system.modes[parseInt(entity[0])] = {};

                            system.modes[parseInt(entity[0])].isActive = entity[1].name === mode;
                        })
                    })

                } else {
                    Object.entries(modes || []).filter(entity => !!entity[1] && entity[1].name === mode).forEach((entity) => {
                        system.modes[parseInt(entity[0])] = {};
                        system.modes[parseInt(entity[0])].isActive = !entity[1].isActive;
                    })
                }
            } else {
                let first = modeTokens[0];


                Object.entries(modes || []).filter(entity => entity[1]?.isActive && entity[1]?.name === first).forEach(entity => {
                    system.modes = system.modes || {};
                    system.modes[parseInt(entity[0])] = system.modes[parseInt(entity[0])] || {};
                    this._activateMode(entity[1].modes, modeTokens.slice(1).join("."), system.modes[parseInt(entity[0])])
                })
            }
        }
    }

    deactivateMode(mode) {
        let update = {};
        update.data = {};
        update.data.activeModes = this.system.activeModes.filter(activeMode => activeMode.toLowerCase() !== mode.toLowerCase());
        this.safeUpdate(update);
    }

    getClassLevel() {
        if (this.data.type !== 'class' || !this.parent) {
            return undefined;
        }
        let classLevels = this.parent.classes.filter(clazz => clazz.data.name === this.data.name)

        return classLevels.length;
    }
}

export function reduceWeaponRange(range) {
    let ranges = ["Melee", "Thrown", "Pistols", "Rifles", "Heavy Weapons"];
    let index = ranges.indexOf(range === 'Simple Ranged Weapon' ? "Pistols" : (range === 'Grenades' ? "Thrown" : range));
    return ranges[index - 1];
}