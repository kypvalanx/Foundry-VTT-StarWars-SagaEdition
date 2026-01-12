import {equippedItems, filterItemsByTypes} from "../common/util.mjs";
import {getInheritableAttribute} from "../attribute-helper.mjs";

/**
 *
 * @param actor {SWSEActor}
 * @returns {number}
 */
export function generateArmorCheckPenalties(actor) {
    let armorProficiencies = getInheritableAttribute({
        entity: actor,
        attributeKey: "armorProficiency",
        reduce: "VALUES"
    });

    let actsAs = getInheritableAttribute({
        entity: actor,
        attributeKey: "actsAs",
        reduce: "VALUES"
    })

    let lightProficiency = armorProficiencies.includes("light");
    let mediumProficiency = armorProficiencies.includes("medium");
    let heavyProficiency = armorProficiencies.includes("heavy");


    mediumProficiency = mediumProficiency && lightProficiency;
    heavyProficiency = heavyProficiency && mediumProficiency;

    let wearingLight = false;
    let wearingMedium = false;
    let wearingHeavy = false;

    /**
     *
     * @type {(string)[]}
     */
    const armorItems = filterItemsByTypes(equippedItems(actor), ["armor"]).map(a => a.system.subtype);
    armorItems.push(...actsAs)
    for(let armor of armorItems){
        if('Heavy Armor' === armor){
            wearingHeavy = true;
        }
        if('Medium Armor' === armor){
            wearingMedium = true;
        }
        if('Light Armor' === armor){
            wearingLight = true;
        }
    }

    let energyShieldArmorTypes = getInheritableAttribute({
        entity: actor,
        attributeKey: "energyShieldArmorType",
        reduce: "VALUES"
    })

    if((wearingHeavy && !heavyProficiency) || energyShieldArmorTypes.includes("Heavy Armor")){
        return -10;
    }

    if((wearingMedium && !mediumProficiency)||energyShieldArmorTypes.includes("Medium Armor")){
        return -5;
    }

    if((wearingLight && !lightProficiency)||energyShieldArmorTypes.includes("Light Armor")){
        return -2;
    }

    return 0;
}