import {SWSEItem} from "../item/item.mjs";
import {SWSEActor} from "../actor/actor.mjs";

function itemType(object) {
    if(object instanceof SWSEItem) {
        return 'item';
    } else     if(object instanceof SWSEActor) {
        return 'actor';
    }
    return 'effect';
}

export function generateAction(object, changes) {
    if(object.type === "weapon"){
        return [{
            id: object.id,
            name: object.name,
            listName: `Item: ${object.name}`,
            encodedValue: `item|${object.id}`
        }]
    }

    if(changes && !Array.isArray(changes)){
        changes = Object.values(changes)
    }

    if (changes?.find(change => change.key === "action")) {
        let type = itemType(object);
        return [{
            id: object.id,
            name: object.name,
            listName: `${type.titleCase}: ${object.name}`,
            encodedValue: `${type}|${object.id}`
        }];
    } else {
        return [];
    }
}