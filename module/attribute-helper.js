import {extractAttributeValues, filterItemsByType, reduceArray, toNumber} from "./util.js";
import {SWSEItem} from "./item/item.js";
import {SWSEActor} from "./actor/actor.js";
import {UnarmedAttack} from "./actor/unarmed-attack.js";
import {meetsPrerequisites} from "./prerequisite.js";

function equippedItems(entity) {
    if(entity.items) {
        let equippedIds = entity.data.equippedIds.map(equipped => equipped.id)
        //let values = Object.values(entity.items);
        return entity.items.filter(item => equippedIds.includes(item.id));
    }
    if(entity.data?.items){
        //items attached to items
        return entity.data.items;
    }
    return [];
}

function inheritableItems(entity) {
    let items = entity.items || [];
    let possibleInheritableItems = filterItemsByType(items, ["background", "destiny", "trait", "feat", "talent", "power", "secret", "technique", "affiliation", "regimen", "species", "class", "vehicleBaseType"]);

    let activeTraits = [];
    possibleInheritableItems.push(...equippedItems(entity))
    
    possibleInheritableItems = possibleInheritableItems.map(item => item instanceof SWSEItem ? item.data : item)

    if(!entity.items){
        //this means it's an item, skip validation
        return possibleInheritableItems;
    }

    let shouldRetry = possibleInheritableItems.length > 0;
    while (shouldRetry) {
        shouldRetry = false;
        for (let possible of possibleInheritableItems) {
            if (!meetsPrerequisites(entity, possible.data.prerequisite).doesFail) {
                activeTraits.push(possible);
                shouldRetry = true;
            }
        }
        possibleInheritableItems = possibleInheritableItems.filter(possible => !activeTraits.includes(possible));
    }


    return activeTraits;
}

/**
 *
 * @param data
 * @param data.entity {object}
 * @param data.attributeKey {string}
 * @param data.attributeFilter {function}
 * @param data.itemFilter {function}
 * @param data.duplicates {number}
 * @param data.reduce {string}
 * @returns {*|string|[]|*[]}
 */
export function getInheritableAttribute(data = {}) {
    data.attributeFilter = data.attributeFilter || (() => true);
    data.itemFilter = data.itemFilter || (() => true)


    let values = [];
    if (!data.attributeKey) {
        return [];
    }

    if(Array.isArray(data.attributeKey)){
        for(let subKey of data.attributeKey){
            let subData = JSON.parse(JSON.stringify(data))
            subData.attributeKey = subKey;
            subData.attributeFilter = data.attributeFilter
            values.push(...getInheritableAttribute(subData))
        }
        return values;
    }

    let entity = data.entity;
    if (entity instanceof SWSEActor || entity instanceof SWSEItem || entity instanceof UnarmedAttack) {
        entity = entity.data;
    }

    if (entity.type) {
        let itemAttributes = Object.entries(entity.data?.attributes || entity._source?.data?.attributes|| []).filter(entry => !["str", "dex", "con", "int", "cha", "wis"].includes(entry[0])).map(entry => entry[1]);
        for (let attribute of itemAttributes.filter(attr => attr && attr.key === data.attributeKey)) {
            values.push(...extractAttributeValues(attribute, entity._id, entity.name));
        }
        let names = [];
        for (let item of inheritableItems(entity).filter(data.itemFilter)) {
            names.push(item.name);
            let duplicates = names.filter(name => name === item.name).length;
            values.push(...getInheritableAttribute({
                entity: item,
                attributeKey: data.attributeKey,
                duplicates,
                recursive: true
            }));
        }

        if (entity.type === 'class') {
            let classLevel = data.duplicates || 0;
            if(classLevel > 0) {
                let level = entity.data.levels[classLevel];
                for (let attribute of Object.values(level.data.attributes).filter(attr => attr && attr.key === data.attributeKey)) {
                    values.push(...extractAttributeValues(attribute, entity._id, entity.name));
                }
            }
        }
        values.push(...(extractModeAttributes(entity, Object.values(entity.data?.modes || {}).filter(mode => mode && mode.isActive) || [], data.attributeKey)));

    }

    let filtered = values.filter(data.attributeFilter);

    if(!data.recursive) {
        filtered = filtered.filter(attr => {
            if(attr.parentPrerequisite && meetsPrerequisites(data.parent, attr.parentPrerequisite).doesFail){
                return false;
            }

            return !meetsPrerequisites(entity, attr.prerequisite).doesFail
        });
    }

    let overrides = filtered.filter(attr => attr.override)

    if(overrides.length > 0){
        filtered = overrides;
    }
    return reduceArray(data.reduce, filtered);
}


export function extractModeAttributes(entity, activeModes, attributeKey) {
    let values = [];
    for (let mode of activeModes) {
        for (let attribute of Object.values(mode.attributes).filter(attr => attr.key === attributeKey) || []) {
            values.push(...extractAttributeValues(attribute, entity.data._id, entity.data.name));
        }
        values.push(...extractModeAttributes(entity, Object.values(mode.modes || []).filter(mode => mode && mode.isActive), attributeKey) || []);
    }
    return values;
}