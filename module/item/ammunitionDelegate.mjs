import {getInheritableAttribute} from "../attribute-helper.mjs";

export class AmmunitionDelegate {
    constructor(item) {
        this.item = item;
    }

    get current(){
        let expectedAmmunition = getInheritableAttribute({entity: this.item, attributeKey:"ammo"})
        let ammoResponse = [];
        let currentAmmo = this.item.system.ammunition || {};

        for (const expectedAmmunitionElement of expectedAmmunition) {
            let ammunition = AmmunitionDelegate.parseAmmunitionString(expectedAmmunitionElement.value);
            ammunition.key = AmmunitionDelegate.buildAmmoKey(expectedAmmunitionElement)
            ammunition.current = currentAmmo[AmmunitionDelegate.buildAmmoKey(expectedAmmunitionElement)] || 0;
            ammoResponse.push(ammunition);
        }

        return ammoResponse;
    }

    static buildAmmoKey(expectedAmmunitionElement) {
        return expectedAmmunitionElement.source+"#"+expectedAmmunitionElement.value;
    }

    static parseAmmoKey(key) {
        const toks = key.split("#");

        return {source: toks[0], string: toks[1]}
    }

    static parseAmmunitionString(ammoString){
        const toks = ammoString.split(":")
        if(toks.length === 2){
            return {type:toks[0], capacity:toks[1]}
        }

        console.warn("UNKNOWN AMMO STRING", ammoString);
        return {error: "UNKNOWN AMMO STRING", ammoString}
    }

    fire(key, count = 1){
        let currentAmmo = this.item.system.ammunition || {};

        const remainingRounds = currentAmmo[key] || 0;

        if(count > remainingRounds){
            return "NOT ENOUGH AMMO";
        }

        let system = {ammunition:{}}
        system.ammunition[key] = remainingRounds-count;

        this.item.safeUpdate({system});

        return "SUCCESS"
    }
    reload(key){
        let currentAmmo = this.item.system.ammunition || {};

        const parsedKey = AmmunitionDelegate.parseAmmoKey(key);
        let ammo = AmmunitionDelegate.parseAmmunitionString(parsedKey.string)

        let result = this.item.parent.useAmmunition(ammo.type);

        if(result.fail){
            //do something here with a popup
            console.error("INSUFFICIENT AMMO")
            return;
        }

        let system = {ammunition:{}}
        system.ammunition[key] = ammo.capacity;

        this.item.safeUpdate({system});
    }

}