import {convertOverrideToMode, increaseDieSize, increaseDieType, linkEffects, toNumber} from "../common/util.mjs";
import {sizeArray, uniqueKey} from "../common/constants.mjs";
import {getInheritableAttribute} from "../attribute-helper.mjs";
import {changeSize} from "../actor/size.mjs";
import {SimpleCache} from "../common/simple-cache.mjs";
import {DEFAULT_LEVEL_EFFECT, DEFAULT_MODE_EFFECT, DEFAULT_MODIFICATION_EFFECT} from "../common/classDefaults.mjs";
import {AmmunitionDelegate} from "./ammunitionDelegate.mjs";
import {activateChoices} from "../choice/choice.mjs";
import {formatPrerequisites, meetsPrerequisites} from "../prerequisite.mjs";

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


    _onUpdateDescendantDocuments(parent, collection, documents, changes, options, userId) {
        super._onUpdateDescendantDocuments(parent, collection, documents, changes, options, userId);
    }


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
        // if(this.updateLegacyItem()){
        //     return;
        // }

        this.cache = new SimpleCache();
        if(this.system.displayName){
            this.name = this.system.displayName;
        }

        this.system.quantity = Number.isInteger(this.system.quantity) ? this.system.quantity : 1;

        this.ammunition = new AmmunitionDelegate(this);

        if (this.type === "vehicleTemplate") this.type = "vehicleBaseType"; //TODO remove vehicle template type after next major release
        if (this.type === "feat") this.prepareFeatData(this.system);

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

    get itemActions(){
        const actions = [];

        if(this.parent){
            const follower = getInheritableAttribute({entity: this, attributeKey: "follower", reduce: "OR"});

            if(follower){
                let actorFound = false;
                for (const actorLink of this.parent.system.actorLinks) {
                    if(actorLink.slot === this.id){
                        const actor = game.actors.get(actorLink.id)
                        if(actor){
                            actions.push({action:"open-actor", optionString:`data-actor-id="${actor.id}"`, buttonText:`Open ${actor.name}`})
                            actorFound = true;
                        }
                    }
                }
                if(!actorFound){
                    actions.push({action:"create-follower", optionString:`data-item-id="${this.id}"`, buttonText:"Create Follower"})
                }
            }

            const leader = getInheritableAttribute({entity: this, attributeKey: "leader", reduce: "OR"});
            if(leader){
                for (const actorLink of this.parent.system.actorLinks) {
                    if(actorLink.slot === this.id){
                        const actor = game.actors.get(actorLink.id)
                        if(actor){
                            actions.push({action:"open-actor", optionString:`data-actor-id="${actor.id}"`, buttonText:`Open ${actor.name}`})
                        }
                    }
                }
                // if(!actorFound){
                //     actions.push({action:"create-follower", optionString:`data-item-id="${this.id}"`, buttonText:"Create Follower"})
                // }
            }

        }


        return actions;
    }

    get inheritedChanges() {
        return this.getCached("inheritedChanges", () => {
            return getInheritableAttribute({
                entity: this,
                attributeFilter: (attr) => attr.source !== this.id
            });
        })
    }

    get isHomeBrew(){
        return this.getCached("isHomebrew", () => {
            return getInheritableAttribute({
                attributeKey: "isHomebrew",
                entity: this,
                reduce: "OR"
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
        let activeEffect = {...DEFAULT_LEVEL_EFFECT};
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
        return SWSEItem.getItemSize(this);
    }

    get baseSize(){
        return getInheritableAttribute({entity: this, attributeKey: "size", reduce: "FIRST"}) || this.system?.size
    }

    static getItemSize(swseItem) {
        let size =  swseItem.baseSize
        if (swseItem.stripping["makeColossal"]?.value) {
            size = changeSize(size, 1)
        }
        if (swseItem.stripping["makeGargantuan"]?.value) {
            size = changeSize(size, 1)
        }
        if (swseItem.stripping["makeHuge"]?.value) {
            size = changeSize(size, 1)
        }
        if (swseItem.stripping["makeLarge"]?.value) {
            size = changeSize(size, 1)
        }
        if (swseItem.stripping["makeMedium"]?.value) {
            size = changeSize(size, 1)
        }
        if (swseItem.stripping["makeSmall"]?.value) {
            size = changeSize(size, 1)
        }
        if (swseItem.stripping["makeTiny"]?.value) {
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

    get upgradePoints(){
        let upgradePoints = this.getBaseUpgradePoints();
        for (let stripped of Object.values(this.stripping || {})) {
            upgradePoints += stripped.value ? 1 : 0;
        }
        let upgradePointCost = getInheritableAttribute({
            entity: this,
            attributeKey: "upgradePointCost", reduce: "SUM"
        });
        return upgradePoints - upgradePointCost;
    }

    createStripping(key, label, enabled, type, low, high) {
        const stripping = {};
        this.system.stripping = this.system.stripping || {}
        this.system.stripping[key] = this.system.stripping[key] || {};
        stripping.label = label;
        stripping.enabled = enabled;
        stripping.value =
            enabled ? (this.system.stripping[key].value || (type === 'boolean' ? false : (type === 'string' ? "" : 0))) : false;
        stripping.type = type ? type : "boolean"
        stripping.low = low;
        stripping.high = high;
        return stripping;
    }

    getStripping(key) {
        return this.stripping[key];
    }

    get stripping(){
        return this.getCached("stripping", ()=> {
            const strippings = {}
            if (this.type === "armor"){
                let makeMedium = this.createStripping('makeMedium', "Make Armor Medium", this.system.subtype === 'Light Armor');
                strippings['makeMedium'] = makeMedium;
                strippings['makeHeavy'] = this.createStripping('makeHeavy', "Make Armor Heavy", this.system.subtype === 'Medium Armor' || makeMedium.value);
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
                strippings['reduceDefensiveMaterial'] = this.createStripping('reduceDefensiveMaterial', "Reduce Defensive Material", defensiveMaterial > 0, "number", 0, defensiveMaterial);

                let jointProtection = getInheritableAttribute({
                    entity: this,
                    attributeKey: "maximumDexterityBonus",
                    reduce: "MIN",
                });

                strippings['reduceJointProtection'] = this.createStripping('reduceJointProtection', "Reduce Joint Protection", jointProtection > 0, "number", 0, jointProtection);
            } else if (this.type === "weapon"){
                strippings['reduceRange'] = this.createStripping('reduceRange', "Reduce Range", this.canReduceRange);

                strippings['stripAutofire'] = this.createStripping('stripAutofire', "Strip Autofire", this.canStripAutoFire);

                strippings['stripStun'] = this.createStripping('stripStun', "Strip Stun", this.canStripStun);
                strippings['stripDesign'] = this.createStripping('stripDesign', "Make Exotic", !this.isExotic);

                let size = this.baseSize;

                strippings['makeTiny'] = this.createStripping('makeTiny', "Make Weapon Tiny", size === 'Diminutive');
                strippings['makeSmall'] = this.createStripping('makeSmall', "Make Weapon Small", size === 'Tiny');
                strippings['makeMedium'] = this.createStripping('makeMedium', "Make Weapon Medium", size === 'Small');
                strippings['makeLarge'] = this.createStripping('makeLarge', "Make Weapon Large", size === 'Medium');
                strippings['makeHuge'] = this.createStripping('makeHuge', "Make Weapon Huge", size === 'Large');
                strippings['makeGargantuan'] = this.createStripping('makeGargantuan', "Make Weapon Gargantuan", size === 'Huge');
                strippings['makeColossal'] = this.createStripping('makeColossal', "Make Weapon Colossal", size === 'Gargantuan');
            }


            return strippings || {};
        });
    }

    setTextDescription() {
        this.system.textDescription = this.stripHTML(this.system.description);
    }

    handleLegacyData(){
        if((!this.system.changes || this.system.changes.length === 0) && this.system.attributes && this.system.attributes.length > 0){
             this.system.changes = this.system.attributes;
        }
    }
    async handleDroppedItem(droppedItem, options = {}) {
        if(droppedItem.effectUuid && droppedItem.targetEffectUuid){
            linkEffects.call(this, droppedItem.effectUuid, droppedItem.targetEffectUuid);
            return {};
        }

        let item = undefined;
        if(droppedItem.uuid){
            item = await Item.implementation.fromDropData(droppedItem);
        }
        if(!item){
            return {};
        }

        let isItemMod = Object.values(item.system.attributes ? item.system.attributes : []).find(attr => attr.key === "itemMod") || Object.values(item.system.changes).find(attr => attr.key === "itemMod");
        if (!!isItemMod?.value || isItemMod?.value === "true") {
            let meetsPrereqs = meetsPrerequisites(this, item.system.prerequisite)

            if (meetsPrereqs.doesFail) {
                if(!options.silent){
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
                }
                return {success:false};
            }
            await this.addItemModificationEffectFromItem(item, options);

            return {success:true}
            // await this.item.takeOwnership(ownedItem);
        }
        return {success:false};
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

    async setPayload(payload, payloadString) {
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
        await this._crawlAttributes(this, async (attribute) => {
            if(attribute instanceof ActiveEffect){
                await attribute.setPayload(pattern, payload);
            } else {
                if (attribute.value) {
                    attribute.key = attribute.key.replace(regExp, payload);
                    if (Array.isArray(attribute.value)) {
                        attribute.value = attribute.value.map(val => `${val}`.replace(regExp, payload));
                    } else {
                        attribute.value = `${attribute.value}`.replace(regExp, payload);
                    }
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

    addProvidedItems(providedItems) {
        if (!providedItems) {
            return;
        }
        if(typeof this.system.providedItems === "object"){
            this.system.providedItems = Object.values(this.system.providedItems);
        }

        this.system.providedItems = this.system.providedItems || [];
        this.system.providedItems.push(...providedItems)
    }


    get toJSONString(){
        return JSON.stringify(this);
    }

    setGranted(granted){
        this.system.supplier = {
            id: granted,
            name: granted,
            type: granted,
            unlocked: true
        }
    }
    /**
     *
     * @param parent {Object}
     * @param parent.name {String}
     * @param parent.id {String}
     * @param parent.type {String}
     */
    async setParent(parent, unlocked) {
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
        await this._crawlAttributes(this.system, (attribute) => {
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


    async _crawlAttributes(item, funct) {
        if (!item) {
            return;
        }
        for (let change of item.system?.changes || item.changes || []) {
            await funct(change)
        }
        if (item.system?.levels) {
            for (let level of Object.values(item.system.levels) || []) {
                for (let attribute of Object.values(level.attributes) || []) {
                    await funct(attribute)
                }
            }
        }
        if (item.effects) {
            for (let effect of item.effects || []) {
                //this._crawlAttributes(effect, funct)
                await funct(effect)
            }
        }
    }
    _onDeleteDescendantDocuments(parent, collection, documents, ids, options, userId) {
        super._onDeleteDescendantDocuments(parent, collection, documents, ids, options, userId);
        const providedEffectIds = this.effects.filter(effect => ids.includes(effect.flags.swse.providedBy || "") ).map(effect => effect.id)
            this.deleteEmbeddedDocuments("ActiveEffect", providedEffectIds);
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


        await this.safeUpdate({"system.items": [...foundIds]});
        await item.safeUpdate({"system.hasItemOwner": true});
    }

    async revokeOwnership(item) {
        if (!item) {
            return;
        }
        let items = this.items?.filter(i => i._id !== item.data._id);
        await this.safeUpdate({"system.items": items});
        await item.safeUpdate({"system.hasItemOwner": false});
    }

    get canReduceRange() {
        let subtypes = ["pistols", "rifles", "ranged weapons", "grenades", "heavy weapons", "simple ranged weapons", "thrown"];
        const subtype = this.system.subtype?.toLowerCase();
        if(subtypes.includes(subtype)){
            return true;
        }
        const treatedAs = getInheritableAttribute({entity: this, attributeKey: "treatedAs", reduce: "VALUES_TO_LOWERCASE"})
        for(const assumedType of treatedAs) {
            if(subtypes.includes(assumedType)){
                return true;
            }
        }
        return false;
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

    get canStripAutoFire() {
        let ratesOfFire = this.effects.contents.map(c => c.name)
        if (ratesOfFire.length === 0) {
            return false;
        }
        return ratesOfFire.includes("Autofire") && ratesOfFire.includes("Single-Shot");
    }

    get canStripStun() {
        return getInheritableAttribute({
            entity: this,
            attributeKey: 'stunDamage'
        }).length > 0 && getInheritableAttribute({
            entity: this,
            attributeKey: 'damage'
        }).length > 0;
    }

    get isExotic() {
        return ['Exotic Ranged Weapons', 'Exotic Melee Weapons'].includes(this.subType);
    }

    increaseQuantity() {
        let current = this.system.quantity;

        let quantity = current + 1;
        this.safeUpdate({"system.quantity": quantity});
    }

    decreaseQuantity() {

        let current = this.system.quantity;

        let quantity = Math.max(0, current - 1);
        this.safeUpdate({"system.quantity": quantity});
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

    getRollFlavor(roll){
        if (this.type === "forcePower"){
            let description = getInheritableAttribute({entity: this, attributeKey: "forcePowerShortDescription", reduce: "VALUES"}).join(" ");

            if(description){
                let response = `<div>${description}</div>`
                const cumulative = getInheritableAttribute({entity: this, attributeKey: "cumulativeChecks", reduce: "OR"})

                let checks = {};
                getInheritableAttribute({entity: this, attributeKey: "check", reduce: "VALUES"})
                    .forEach(check => {
                        const toks = check.split(":");
                        checks[parseInt(toks[0])] = toks[1]
                    })

                const overcomeChecks = Object.keys(checks).filter(dc => roll >= dc)

                if (overcomeChecks.length > 0) {
                    if(cumulative){
                        for (const overcomeCheck of overcomeChecks) {
                            response.concat(`<div><div><b>DC ${overcomeCheck}</b> ${checks[overcomeCheck]}</div></div>`)
                        }
                    } else {
                        const topCheck = Math.max(...overcomeChecks);
                        response = response.concat(`<div><div><b>DC ${topCheck}</b> ${checks[topCheck]}</div></div>`)
                    }
                }
                return response
            }

            return `<div>${this.system.description}</div>`
        }

        return "";
    }

    static getItemDialogue(attack, actor) {
        let templateType = "attack";
        const template = `systems/swse/templates/chat/${templateType}-card.hbs`;

        let content = `<p><button type="button" class="roll" data-roll="${attack.th}" data-name="${attack.name} Attack Roll">${attack.name} Roll Attack</button></p>
                       <p><button type="button" class="roll" data-roll="${attack.dam}" data-name="${attack.name} Damage Roll">${attack.name} Roll Damage</button></p>`

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



    async addItemModificationEffectFromItem(item, context={}) {
        if (!this.canUserModify(game.user, 'update')) {
            return;
        }
        item.prepareData();
        let choices = await activateChoices(item, context);

        if (!choices.success) {
            return false;
        }
        let changes = [];
        changes.push(...Object.values(item.system.attributes || {}))
        changes.push(...item.system.changes)
        let activeEffect = DEFAULT_MODIFICATION_EFFECT;
        activeEffect.name = item.name;
        activeEffect.changes = changes;
        activeEffect.img = item.img;
        activeEffect.origin = item.uuid;
        activeEffect.flags.swse.description = item.system.description;

        const createdEffect = await this.createEmbeddedDocuments("ActiveEffect", [activeEffect]);

        if (item.effects && item.effects.filter(i => i).length > 0) {
            const effects = []
            item.effects.forEach(effect => {
                let activeEffect = {...DEFAULT_MODE_EFFECT};
                activeEffect.name = effect.name;
                activeEffect.disabled = effect.disabled;
                activeEffect.changes = effect.changes;
                activeEffect.img = effect.img;
                activeEffect.origin = item.uuid;
                activeEffect.origin = createdEffect[0].id
                activeEffect.flags.swse.providedBy = createdEffect[0].id
                activeEffect.flags.swse.description =
                    effect.flags.swse.description || "";
                effects.push(activeEffect);
            })
            await this.createEmbeddedDocuments("ActiveEffect", effects);
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