import {convertOverrideToMode, increaseDieSize, increaseDieType, toNumber} from "../common/util.mjs";
import {sizeArray, uniqueKey} from "../common/constants.mjs";
import {getInheritableAttribute} from "../attribute-helper.mjs";
import {changeSize} from "../actor/size.mjs";
import {SimpleCache} from "../common/simple-cache.mjs";
import {DEFAULT_LEVEL_EFFECT, DEFAULT_MODIFICATION_EFFECT} from "../common/classDefaults.mjs";
import {AmmunitionDelegate} from "./ammunitionDelegate.mjs";

function createChangeFromAttribute(attr) {
    //console.warn(`i don't think this should run ${Object.entries(attr)}`)
    attr.mode = 2;
    return attr;
}

/**
 * Extend the basic Item with some very simple modifications.
 * @extends {Item}
 */
export class SWSEItem extends Item {

    async _preUpdate(changed, options, user) {
        super._preUpdate(changed, options, user);
        changed.system = changed.system || {};
        changed.system.displayName = SWSEItem.buildItemName(this);
        // if(changed.system?.dirty !== false){
        //     changed.system = changed.system || {};
        //     changed.system.dirty = true;
        // }
        //console.log(changed)
    }

    _onUpdateDocuments(){}


    /**
     * Augment the basic Item data model with additional dynamic data.
     */
    prepareData() {
        super.prepareData();
        this.hasItemOwner = this.hasItemOwner || false;

        if(!Array.isArray(this.system.changes)){
            this.system.changes = Object.values(this.system.changes || {})
        } else{
            this.system.changes = this.system.changes || []
        }
        if(this.updateLegacyItem()){
            return;
        }

        this.cache = new SimpleCache();
        if(this.system.displayName){
            this.name = this.system.displayName;
        }

        this.system.quantity = Number.isInteger(this.system.quantity) ? this.system.quantity : 1;

        if (this.type === "vehicleTemplate") this.type = "vehicleBaseType"; //TODO remove vehicle template type after next major release
        if (this.type === "weapon") this.prepareWeapon(this.system);
        if (this.type === "armor") this.prepareArmor(this.system);
        if (this.type === "feat") this.prepareFeatData(this.system);
        if (this.hasAmmunition) {
            this.ammunition = new AmmunitionDelegate(this);
        }
    }

    get hasAmmunition(){
        return getInheritableAttribute({entity: this, attributeKey:"ammo", reduce:"COUNT"}) > 0;
    }

    updateLegacyItem() {
        if(!this.canUserModify(game.user, 'update')){
            return;
        }
        let update = {};
        let activeEffects = [];
        const changes = this.system.changes;

        if (this.system.attributes) {
            for (let change of Object.values(this.system.attributes)) {
                if (change) {
                    changes.push(change);
                }
            }
            update['system.changes'] = changes;
            update['system.attributes'] = null;
        }
        if (this.system.modes) {
            let modes = Array.isArray(this.system.modes) ? this.system.modes : Object.values(this.system.modes || {})
            if(modes){
                update["system.modes"] = null;
            }

            if (modes.length > 0) {
                activeEffects = modes.map(mode => this.createActiveEffectFromMode(mode))
                //this.safeUpdate(data).then(() => this.createEmbeddedDocuments("ActiveEffect", activeEffects))
            }
        }
        this.system.items?.forEach(id => {
            let item = this.parent.items.get(id)
            if (item) {
                this.addItemModificationEffectFromItem(item)
                this.item?.revokeOwnership(item)
            }
        })
        convertOverrideToMode(changes, update);

        let response = false;
        if(Object.keys(update).length>0){
             this.safeUpdate(update)
            response = true
        }
        if(activeEffects && activeEffects.length>0){
            this.createEmbeddedDocuments("ActiveEffect", activeEffects)
            response = true
        }
        return response;
    }

    canUserModify(user, action, data){
        let canModify = super.canUserModify(user, action, data);
        if(canModify){
            if(this.pack){
                let pack = game.packs.get(this.pack)
                if(pack.metadata.packageType === "system"){
                    return false;
                }
            }
        }
        return canModify;
    }

    get changes() {
        const changes = []
        changes.push(...this.system.changes);
        changes.push(...Object.values(this.system.attributes || {}).map(attr => createChangeFromAttribute(attr)))
        return changes;
    }

    updateOrAddChange(change){
        this.system.changes.filter(c => c.key === change.key && c.mode === change.mode)
    }

    get toggles() {
        return this.system.toggles;
    }

    async safeUpdate(data = {}, context = {}) {
        if (this.canUserModify(game.user, 'update') && this._id
            && (!this.parent || (this.parent.canUserModify(game.user, 'update') && game.actors.get(this.parent.id)))) {
            await this.update(data, context);
        }
    }

    get inheritedChanges() {
        return this.getCached("inheritedChanges", () => {
            return getInheritableAttribute({
                entity: this,
                attributeFilter: (attr) => attr.source !== this.id
            });
        })
    }
    get levelsTaken(){
        return this.system.levelsTaken || []
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

    get hasModes(){
        return true;
    }

    get hasLevels() {
        return 'class' === this.type
    }

    get levels(){
        const array = this.effects
            .filter(e => e.flags.swse.isLevel)
            .sort((a,b) => a.flags.swse.level - b.flags.swse.level);
        return array
    }

    level(level){
        return this.levels.find(l => l.flags.swse.level === level)
    }

    addClassLevel(level){
        let changes = [];
        let activeEffect = DEFAULT_LEVEL_EFFECT;
        activeEffect.name = `Level ${level}`;
        activeEffect.level = level;
        activeEffect.changes = changes;
        activeEffect.disabled = true;

        if (this.canUserModify(game.user, 'update')) {
            this.createEmbeddedDocuments("ActiveEffect", [activeEffect]);
        }
    }

    removeClassLevel(level){
        const id = this.levels.find(l => l.flags.swse.level === level || !l.flags.swse.level).id;
        if (this.canUserModify(game.user, 'update')) {
            this.deleteEmbeddedDocuments("ActiveEffect",[id]);
        }
    }

    _onCreate(data, options, userId) {
        super._onCreate(data, options, userId);
        this.prepareData();
    }


    static buildItemName(item) {
        if (!item) {
            return "";
        }
        let id = item._id;
        let finalName = item._source.name;

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

        // if (item.hasAmmunition){
        //     for (const ammo of item.ammunition.current) {
        //         finalName = `${finalName} (${ammo.type} ${ammo.current}/${ammo.capacity})`
        //     }
        // }

        return finalName;
    }

    getCached(key, fn) {
        if(!this.cache){
            return fn();
        }
        return this.cache.getCached(key, fn)
    }

    static addSizeAdjustmentSuffix(itemData, finalName) {
        if (!itemData.document) {
            return finalName;
        }
        let resolvedSizeIndex = this.getResolvedSizeIndexForSizeProvider(itemData);

        if (resolvedSizeIndex) {
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

    // get baseName() {
    //     return this.system.baseName ?? null;
    // }

    // get displayName(){
    //     return SWSEItem.buildItemName(this);
    // }

    get sizeMod() {

        return getInheritableAttribute({
            entity: this,
            attributeKey: "shipSkillModifier",
            reduce: "SUM",
            parent: this.parent

        })
    }

    get levelUpHitPoints() {
        const map = getInheritableAttribute({
            entity: this,
            attributeKey: "levelUpHitPoints",


        }).map(attr => !attr ? null : attr.value);
        return map.length > 0 ? map[0]: 0;
    }

    classLevelHealth(classLevel, characterLevel) {
        if (this.type !== "class") {
            return 0;
        }
        if (!this.canRerollHealth(characterLevel)) {
            return getInheritableAttribute({
                entity: this,
                attributeKey: "firstLevelHitPoints"
            }).map(attr => parseInt(!attr ? "0" : attr.value))[0];
        }
        let attr = getInheritableAttribute({
            entity: this.level(classLevel),
            attributeKey: "rolledHp",
            reduce: "FIRST",
            flags: ["IGNORE_DISABLE"]
        });

        if (!attr || attr.length === 0) {
            return 1;
        }

        let rolledHp = parseInt(attr)

        const inheritableAttribute = getInheritableAttribute({
            entity: this,
            attributeKey: "levelUpHitPoints",
            reduce: "FIRST"
        });
        let max = inheritableAttribute.split("d")[1]
        return rolledHp > max ? max : rolledHp;

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

    canRerollHealth(characterLevel){
        if(characterLevel>1){
            return true;
        }
        const firstLevelHitPoints = getInheritableAttribute({entity: this, attributeKey:"firstLevelHitPoints", reduce:"FIRST"});
        return `${firstLevelHitPoints}`.split("d").length === 2;

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
            return 0;
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
        let size = swseItem.system?.size || swseItem.data?.size || swseItem.data?.data?.size
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

    get finalName() {
        return SWSEItem.buildItemName(this);
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
        let upgradePointCost = getInheritableAttribute({
            entity: this,
            attributeKey: "upgradePointCost", reduce: "SUM"
        });
        system.upgradePoints -= upgradePointCost;
    }

    get upgradePoints(){
        let upgradePoints = this.getBaseUpgradePoints();
        for (let stripped of Object.values(this.system.stripping || {})) {
            upgradePoints += stripped.value ? 1 : 0;
        }
        let upgradePointCost = getInheritableAttribute({
            entity: this,
            attributeKey: "upgradePointCost", reduce: "SUM"
        });
        return upgradePoints - upgradePointCost;
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
        if (!choice) {
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
        if (!modifiers) {
            return;
        }

        let changes = this.system.changes
        let changeIndex = 0;
        while (changes[changeIndex]) {
            changeIndex++;
        }

        for (let modifier of modifiers) {
            let existingChange = Object.values(changes).find(change => change.key === modifier.key);
            if (existingChange && uniqueKey.includes(modifier.key)) {
                existingChange.value = modifier.value;
            } else {
                changes[changeIndex] = modifier;
                changeIndex++;
            }
        }
    }

    addProvidedItems(modifiers) {
        if (!modifiers) {
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
        if (!parent) {
            return;
        }

        if (Array.isArray(parent)) {
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


    _crawlAttributes(system, funct) {
        if (!system) {
            return;
        }
        for (let change of system.changes || []) {
            funct(change)
        }
        if (system.levels) {
            for (let level of Object.values(system.levels) || []) {
                for (let attribute of Object.values(level.attributes) || []) {
                    funct(attribute)
                }
            }
        }
        if (system.modes) {
            for (let mode of Object.values(system.modes) || []) {
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
        if (!prerequisite) {
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

    addChange(attribute) {
        let data = {};
        let changes = this.system.changes
        let chanceIndex = 0;
        while (changes[chanceIndex]) {
            chanceIndex++;
        }

        data.system = {};
        data.system.changes = changes;
        data.system.changes[chanceIndex] = attribute;
        this.safeUpdate(data);
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

    async setAttribute(attribute, value, options = {}) {
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

    setAttributes(attributes, options = {}) {
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
    // setAttribute(attributeIndex, attr) {
    //     let data = {};
    //     data.attributes = {}
    //     data.attributes[attributeIndex] = attr;
    //     this.updateData(data);
    // }
    getProvidedItems(filter) {
        let items = this.system.providedItems;

        if (!!items && !Array.isArray(items)) {
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
        return SWSEItem.getModesFromItem(this);
    }

    static getModesFromItem(item) {
        if (!item) {
            return [];
        }
        return item.effects?.filter(effect => !effect.flags.swse?.itemModifier) || []
    }

    activateMode(mode, type, group, attributes) {
        let modes = this.system.modes;
        let update = {};

        update.system = {};
        this._activateMode(modes, mode, update.system, type, group, attributes);

        this.safeUpdate(update);
    }



    equip(type){

        this.safeUpdate({'system.equipped': type});
    }
    unequip(){

        this.safeUpdate({'system.equipped': null});
    }

    _activateMode(modes, mode, system, type, group, attributes) {
        let modeTokens = mode.split(".");

        system.modes = {};
        if (type === "dynamic") {
            if (modeTokens.length === 1) {
                if (group) {
                    let found = false;
                    let entityKeys = Object.keys(modes);
                    Object.entries(modes || []).filter(entity => entity[1]?.group === group).forEach((entity) => {
                        system.modes[parseInt(entity[0])] = {};
                        const active = entity[1].name === mode;
                        system.modes[parseInt(entity[0])].isActive = active;
                        if (active) {
                            found = true;
                        }
                    })

                    if (!found) {
                        entityKeys.push(-1)
                        let newEntityKey = Math.max(...entityKeys) + 1;
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
                    if (!found) {
                        let newEntityKey = Math.max(...entityKeys) + 1;
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

    addItemModificationEffectFromItem(item) {
        let changes = [];
        changes.push(...Object.values(item.system.attributes || {}))
        changes.push(...item.system.changes)
        //could this be generated from the parent item at load?  would that be slow?
        let activeEffect = DEFAULT_MODIFICATION_EFFECT;
        activeEffect.label = item.name;
        activeEffect.changes = changes;
        activeEffect.icon = item.img;
        activeEffect.origin = item.uuid;
        activeEffect.flags.swse.description = item.system.description;

        if (this.canUserModify(game.user, 'update')) {
            this.createEmbeddedDocuments("ActiveEffect", [activeEffect]);
        }
    }

    createActiveEffectFromMode(mode) {
        return {
            label: mode.name,
            changes: Object.values(mode.attributes),
            group: mode.group,
            disabled: true,
            flags: {
                swse: {
                    itemMode: true
                }
            }
        };
    }

    toObject(source) {
        let o = super.toObject(source);
        let cost = this.system.changes.find(c => !!c && c.key === "cost");
        o.system.cost = (cost) ? cost["value"] : "0";
        return o;
    }
}

export function reduceWeaponRange(range) {
    let ranges = ["Melee", "Thrown", "Pistols", "Rifles", "Heavy Weapons"];
    let index = ranges.indexOf(range === 'Simple Ranged Weapon' ? "Pistols" : (range === 'Grenades' ? "Thrown" : range));
    return ranges[index - 1];
}