import {filterItemsByType} from "../util.js";
import {getInheritableAttribute} from "../attribute-helper.js";
import {getEquippedItems} from "./actor.js";

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

    let lightProficiency = armorProficiencies.includes("light");
    let mediumProficiency = armorProficiencies.includes("medium");
    let heavyProficiency = armorProficiencies.includes("heavy");


    mediumProficiency = mediumProficiency && lightProficiency;
    heavyProficiency = heavyProficiency && mediumProficiency;

    let wearingLight = false;
    let wearingMedium = false;
    let wearingHeavy = false;

    for(let armor of filterItemsByType(getEquippedItems(actor), "armor")){
        if('Heavy Armor' === armor.system.subtype){
            wearingHeavy = true;
        }
        if('Medium Armor' === armor.system.subtype){
            wearingMedium = true;
        }
        if('Light Armor' === armor.system.subtype){
            wearingLight = true;
        }
    }

    if(wearingHeavy && !heavyProficiency){
        return -10;
    }

    if(wearingMedium && !mediumProficiency){
        return -5;
    }

    if(wearingLight && !lightProficiency){
        return -2;
    }

    return 0;
}