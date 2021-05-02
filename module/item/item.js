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
    async prepareData() {
        super.prepareData();
        this._pendingUpdate = {};
        // Get the Item's data
        const itemData = this.data;
        const actorData = this.actor ? this.actor.data : {};
        const data = itemData.data;
        
        this.resolveItemName(itemData);


        //let textDescription = this.stripHTML(data.description);
        //data.textDescription = textDescription;
        // if(data.textDescription !== textDescription){
        //
        //     this._pendingUpdate['data.textDescription'] = textDescription;
        //     //return this.update({'data.textDescription': textDescription});
        // }

        
        
        if (this.type === "weapon" || this.type === "armor") this.prepareWeaponOrArmor(itemData);

        if (this.type === "feat") {
            this.prepareFeatData(itemData);
        }

        if(Object.keys(this._pendingUpdate).length>0){
            return this.update(this._pendingUpdate);
        }
    }

    prepareFeatData(itemData) {
        if (itemData.data.categories) {
            itemData.data.bonusFeatCategories = itemData.data.categories.filter(cat => cat.toLowerCase().includes("bonus feats"));
            itemData.data.hasBonusFeatCategories = itemData.data.bonusFeatCategories.length > 0;
        }
    }

    prepareWeaponOrArmor(itemData) {
        itemData.data.upgradePoints = this.getBaseUpgradePoints(itemData.name);
        if (this.type === "weapon") {
            if (!itemData.data.weapon.stripping) {
                itemData.data.weapon.stripping = {};
            }
            let weapon = itemData.data.weapon;
            let stripping = itemData.data.weapon.stripping;
            stripping.canReduceRange = this.canReduceRange();
            stripping.canStripAutofire = this.canStripAutoFire();
            stripping.canStripStun = weapon.stun && weapon.stun.isAvailable && !weapon.stun.isOnly;
            itemData.data.weapon.isBaseExotic = this.isExotic();
            stripping.canStripDesign = !itemData.data.weapon.isBaseExotic;

            let finalWeaponRange = weapon.weaponType;
            if (weapon.treatedAsForRange) {
                finalWeaponRange = weapon.treatedAsForRange;
            }
            if (stripping.range) {
                finalWeaponRange = this.reduceRange(finalWeaponRange);
            }
            weapon.finalWeaponRange = finalWeaponRange;

            if (weapon.damage && weapon.damage.attacks && weapon.damage.attacks.length > 0) {
                weapon.damage.finalDamage = weapon.damage.attacks[0].value;
            }
            if (weapon.stun && weapon.stun.isAvailable && !weapon.stripping.stun) {
                weapon.finalStun = weapon.damage?.finalDamage;
                if (weapon.stun.dieEquation) {
                    weapon.finalStun = weapon.stun.dieEquation;
                }
            }
            if (stripping.damage) {
                if (weapon.damage.finalDamage) {
                    weapon.damage.finalDamage = this.reduceDamage(weapon.damage.finalDamage);
                }
                if (weapon.finalStun) {
                    weapon.finalStun = this.reduceDamage(weapon.finalStun);
                }
            }

            let ratesOfFire = weapon.ratesOfFire;
            if (ratesOfFire) {
                if (weapon.stripping.autofire) {
                    ratesOfFire = ratesOfFire.filter(rate => rate !== 'Autofire');
                }

                weapon.finalRatesOfFire = ratesOfFire.join(", ");
            }

            let size = itemData.data.size;
            let finalSize = size;

            //TODO i'd like this to deactivate checkboxes that are invisible, when they become visible again they maintain state.  number of points are correct
            stripping.canMakeTiny = size === 'Diminutive';// || stripping.makeDiminutive;
            stripping.makeTiny = stripping.canMakeTiny ? stripping.makeTiny : false;
            finalSize = stripping.makeTiny ? 'Tiny' : finalSize;
            stripping.canMakeSmall = size === 'Tiny' || stripping.makeTiny;
            stripping.makeSmall = stripping.canMakeSmall ? stripping.makeSmall : false;
            finalSize = stripping.makeSmall ? 'Small' : finalSize;
            stripping.canMakeMedium = size === 'Small' || stripping.makeSmall;
            stripping.makeMedium = stripping.canMakeMedium ? stripping.makeMedium : false;
            finalSize = stripping.makeMedium ? 'Medium' : finalSize;
            stripping.canMakeLarge = size === 'Medium' || stripping.makeMedium;
            stripping.makeLarge = stripping.canMakeLarge ? stripping.makeLarge : false;
            finalSize = stripping.makeLarge ? 'Large' : finalSize;
            stripping.canMakeHuge = size === 'Large' || stripping.makeLarge;
            stripping.makeHuge = stripping.canMakeHuge ? stripping.makeHuge : false;
            finalSize = stripping.makeHuge ? 'Huge' : finalSize;
            stripping.canMakeGargantuan = size === 'Huge' || stripping.makeHuge;
            stripping.makeGargantuan = stripping.canMakeGargantuan ? stripping.makeGargantuan : false;
            finalSize = stripping.makeGargantuan ? 'Gargantuan' : finalSize;
            stripping.canMakeColossal = size === 'Gargantuan' || stripping.makeGargantuan;
            stripping.makeColossal = stripping.canMakeColossal ? stripping.makeColossal : false;
            finalSize = stripping.makeGargantuan ? 'Colossal' : finalSize;


            itemData.data.finalSize = finalSize;

            itemData.data.upgradePoints += stripping.damage ? 1 : 0;
            itemData.data.upgradePoints += stripping.range ? 1 : 0;
            itemData.data.upgradePoints += stripping.design ? 1 : 0;
            itemData.data.upgradePoints += stripping.stun ? 1 : 0;
            itemData.data.upgradePoints += stripping.makeTiny ? 1 : 0;
            itemData.data.upgradePoints += stripping.makeSmall ? 1 : 0;
            itemData.data.upgradePoints += stripping.makeMedium ? 1 : 0;
            itemData.data.upgradePoints += stripping.makeLarge ? 1 : 0;
            itemData.data.upgradePoints += stripping.makeHuge ? 1 : 0;
            itemData.data.upgradePoints += stripping.makeGargantuan ? 1 : 0;
            itemData.data.upgradePoints += stripping.makeColossal ? 1 : 0;
        } else if (this.type === "armor") {
            if (!itemData.data.armor.stripping) {
                itemData.data.armor.stripping = {};
            }
            let stripping = itemData.data.armor.stripping;
            //itemData.data.armor.reflexBonus, itemData.data.armor.fortitudeBonus

            stripping.canMakeMedium = itemData.data.armor.type === 'Light Armor'; //if is light
            stripping.canMakeHeavy = itemData.data.armor.type === 'Medium Armor' || stripping.makeMedium; //if is medium or made medium
            stripping.defensiveMaterial = Math.min(itemData.data.armor.reflexBonus ? itemData.data.armor.reflexBonus : 0,
                itemData.data.armor.fortitudeBonus ? itemData.data.armor.fortitudeBonus : 0); //min(fort/reflex)
            stripping.canReduceDefensiveMaterial = stripping.defensiveMaterial > 0;
            stripping.reduceDefensiveMaterial = Math.max(Math.min(stripping.reduceDefensiveMaterial || 0, stripping.defensiveMaterial), 0);
            stripping.jointProtection = itemData.data.armor.maxDexterity ? itemData.data.armor.maxDexterity : 0
            stripping.canReduceJointProtection = stripping.jointProtection > 0;
            stripping.reduceJointProtection = Math.max(stripping.reduceJointProtection || 0, 0);

            itemData.data.upgradePoints += stripping.makeMedium ? 1 : 0;
            itemData.data.upgradePoints += stripping.makeHeavy ? 1 : 0;
            itemData.data.upgradePoints += stripping.reduceJointProtection;
            itemData.data.upgradePoints += stripping.reduceDefensiveMaterial;

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

        //TODO
    }

    resolveItemName(itemData) {
        let finalName = itemData.name;
        if (itemData.data.payload && itemData.data.payload !== "" && !itemData.name.includes("(")) {
            finalName = `${finalName} (${itemData.data.payload})`
        }
        for (let mod of this.data.data.items ? this.data.data.items : []) {
            let prefix = mod.data.attributes.prefix ? mod.data.attributes.prefix + " " : "";
            let suffix = mod.data.attributes.suffix ? " " + mod.data.attributes.suffix : "";
            finalName = `${prefix}${finalName}${suffix}`
        }
        if(finalName !== itemData.data.finalName) {
            this._pendingUpdate['data.finalName'] = finalName;
        }
    }

    setPayload(payload) {
        this.data.data.payload = payload;
        this.data.data.prerequisites = this.data.data.prerequisites.map(prereq => prereq.replace("#payload#", payload))
    }

    stripHTML(str) {
        let parser = new DOMParser();
        let doc = parser.parseFromString(str, 'text/html');
        return doc.body.innerText;
    };

    async takeOwnership(item) {
        let items = this.data.data.items;
        items.push(item)
        await this.update({"data.items": [...new Set(items)]});
        await item.update({"data.hasItemOwner": true});
    }

    async revokeOwnership(item) {
        let items = this.data.data.items.filter(i => i._id !== item.data._id);
        await this.update({"data.items": items});
        await item.update({"data.hasItemOwner": false});
    }

    canReduceRange() {
        for (const category of this.data.data.categories) {
            if (["pistols", "rifles", "ranged weapons", "grenades", "heavy weapons", "simple ranged weapons", "thrown"].includes(category.toLowerCase())) {
                return true;
            }
        }
        //console.log(this.data.data.weapon.treatedAsForRange)
        return ["pistols", "rifles", "ranged weapons", "grenades", "heavy weapons", "simple ranged weapons", "thrown"].includes(this.data.data.weapon.treatedAsForRange?.toLowerCase())
    }


    canStripAutoFire() {
        return this.data.data.weapon.ratesOfFire && this.data.data.weapon.ratesOfFire.includes("Single-Shot") && this.data.data.weapon.ratesOfFire.includes("Autofire");
    }

    isExotic() {
        return ['Exotic Ranged Weapons' || 'Exotic Melee Weapons'].includes(this.data.data.weapon.weaponType);
    }


    async removeAttack(index) {
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

    async addAttack() {
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
}
