import {sizeArray} from "../common/constants.mjs";

export function isOversized(actorSize, itemSize) {
    return compareSizes(actorSize, itemSize) > 1;
}

/**
 *
 * @param size1
 * @param size2
 * @returns {number}
 */
export function compareSizes(size1, size2) {
    if (size1?.name) {
        size1 = size1.name
    }
    if (size2?.name) {
        size2 = size2.name
    }

    return sizeArray.indexOf(size2) - sizeArray.indexOf(size1);
}

/**
 *
 * @param size {string|{name:string}}
 * @param modifier {number}
 * @returns {string}
 */
export function changeSize(size, modifier) {
    if (size?.name) {
        size = size.name
    }

    let index = sizeArray.indexOf(size) + modifier;

    if(index<0){
        index=0;
    }
    if(index>=sizeArray.length){
        index=sizeArray.length-1;
    }
    return sizeArray[index];
}
//TODO idk why this is here and not part of item.  i'll look at it later
export function getSize(actor) {
    if(actor.items) {
        for (let item of actor.items || []) {
            if (sizeArray.includes(item.name)) {
                return item.name;
            }
        }
    } else if(actor.stripping){
        let strippings = Object.values(actor.stripping).filter(stripping => stripping.enabled && stripping.value).map(stripping => stripping.label)

        if(strippings.includes("Make Weapon Colossal")){
            return "Colossal";
        }
        if(strippings.includes("Make Weapon Gargantuan")){
            return "Gargantuan";
        }
        if(strippings.includes("Make Weapon Huge")){
            return "Huge";
        }
        if(strippings.includes("Make Weapon Large")){
            return "Large";
        }
        if(strippings.includes("Make Weapon Medium")){
            return "Medium";
        }
        if(strippings.includes("Make Weapon Small")){
            return "Small";
        }
        if(strippings.includes("Make Weapon Tiny")){
            return "Tiny";
        }
    }
    return actor.system.size
}

export function getGridSizeFromSize(size) {
    switch (size) {
        case "Medium":
            return 1;
        case "Large":
            return 2;
        case "Huge":
            return 3;
        case "Gargantuan":
            return 4;
        case "Colossal":
            return 6;
    }
}