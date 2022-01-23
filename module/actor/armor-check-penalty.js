import {filterItemsByType} from "../util.js";

/**
 *
 * @param actor {SWSEActor}
 * @returns {number}
 */
export function generateArmorCheckPenalties(actor) {
    let armorProficiencies = actor.getInheritableAttributesByKey("armorProficiency", "VALUES");

    let lightProficiency = armorProficiencies.includes("light");
    let mediumProficiency = armorProficiencies.includes("medium");
    let heavyProficiency = armorProficiencies.includes("heavy");


    mediumProficiency = mediumProficiency && lightProficiency;
    heavyProficiency = heavyProficiency && mediumProficiency;

    let wearingLight = false;
    let wearingMedium = false;
    let wearingHeavy = false;

    for(let armor of filterItemsByType(actor.getEquippedItems(), "armor")){
        if('Heavy' === armor.armorType){
            wearingHeavy = true;
        }
        if('Medium' === armor.armorType){
            wearingMedium = true;
        }
        if('Light' === armor.armorType){
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