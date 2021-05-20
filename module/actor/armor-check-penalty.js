import {filterItemsByType} from "../util.js";

/**
 *
 * @param actor {SWSEActor}
 * @returns {number}
 */
export function generateArmorCheckPenalties(actor) {
    let lightProficiency = false;
    let mediumProficiency = false;
    let heavyProficiency = false;

    for(let feat of filterItemsByType(actor.items.values(), "feat")){
        if('Armor Proficiency (Light)' === feat.finalName){
            lightProficiency = true;
        }
        if('Armor Proficiency (Medium)' === feat.finalName){
            mediumProficiency = true;
        }
        if('Armor Proficiency (Heavy)' === feat.finalName){
            heavyProficiency = true;
        }
    }

    mediumProficiency = mediumProficiency && lightProficiency;
    heavyProficiency = heavyProficiency && lightProficiency;

    let wearingLight = false;
    let wearingMedium = false;
    let wearingHeavy = false;

    for(let armor of filterItemsByType(actor.items.values(), "armor")){
        if(actor.data.data.equippedIds.includes(armor._id)) {
            console.log('ARMOR', armor)
            if('Heavy Armor' === armor.data.data.armor.type || armor.data.data.armor.stripping.makeHeavy){
                wearingHeavy = true;
            }
            if('Medium Armor' === armor.data.data.armor.type || (armor.data.data.armor.stripping.makeMedium && !armor.data.data.armor.stripping.makeHeavy)){
                wearingMedium = true;
            }
            if('Light Armor' === armor.data.data.armor.type){
                wearingLight = true;
            }
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