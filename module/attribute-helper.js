import {extractAttributeValues, filterItemsByType, getItemParentId, reduceArray, toNumber} from "./util.js";
import {SWSEItem} from "./item/item.js";
import {SWSEActor} from "./actor/actor.js";
import {UnarmedAttack} from "./actor/unarmed-attack.js";
import {meetsPrerequisites} from "./prerequisite.js";

function equippedItems(entity) {
    if(entity.items) {
        let equippedIds = entity.data.equippedIds.map(equipped => equipped.id)
        //let values = Object.values(entity.items);
        return entity.items.filter(item => equippedIds.includes(item.id || item._id));
    }
    if(entity.data?.items){
        //items attached to items
        return entity.data.items;
    }
    return [];
}

function inheritableItems(entity, attributeKey) {
    let items = entity.items || [];
    let possibleInheritableItems = filterItemsByType(items, ["background", "destiny", "trait", "feat", "talent", "power", "secret", "technique", "affiliation", "regimen", "species", "class", "vehicleBaseType", "beastAttack",
        "beastSense",
        "beastType",
        "beastQuality"]);

    let activeTraits = [];
    possibleInheritableItems.push(...equippedItems(entity))
    
    possibleInheritableItems = possibleInheritableItems
        .map(item => item instanceof SWSEItem ? item.data : item)
    
    if(attributeKey){
        possibleInheritableItems = possibleInheritableItems
            .filter(item => {
                let attrs = Object.values(item.data.attributes);
                for(let level of Object.values(item.data?.levels || {})){
                    attrs.push(...Object.values(level.data.attributes))
                }
                for(let entity of item.data.items || []){
                    let inheritableAttribute = getInheritableAttribute({entity, attributeKey});
                    attrs.push(...inheritableAttribute)
                }
                return attrs.map(attr => !!attr ? attr.key : "").includes(attributeKey) //||
                    //Object.values(item.data)
            })
    }

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

function getAttributesFromClass(data, entity) {
    let vals = [];
    let classLevel = data.duplicates || 0;
    if (classLevel > 0) {
        let level = entity.data.levels[classLevel];
        for (let attribute of Object.values(level.data.attributes).filter(attr => attr && attr.key === data.attributeKey)) {
            vals.push(...extractAttributeValues(attribute, entity._id, entity.name, entity.data.description));
        }
    }
    return vals;
}

function getAttributesFromEmbeddedItems(entity, data) {
    let vals = [];
    let names = [];
    let it = inheritableItems(entity, data.attributeKey).filter(data.itemFilter);
    for (let item of it) {
        names.push(item.name);
        let duplicates = names.filter(name => name === item.name).length;
        vals.push(...getInheritableAttribute({
            entity: item,
            attributeKey: data.attributeKey,
            duplicates,
            recursive: true,
            parent: entity
        }));
    }
    return vals;
}

export function getResolvedSize(entity, options) {
    if(entity.document && entity.document instanceof SWSEItem){
        entity = entity.document.parent;
    }
    let sizeIndex = toNumber(getInheritableAttribute({entity, attributeKey: "sizeIndex", reduce:"MAX"}))
    let sizeBonus = toNumber(getInheritableAttribute({entity, attributeKey: "sizeBonus", reduce:"SUM"}))


    let damageThresholdEffectiveSize = toNumber(getInheritableAttribute({entity, attributeKey: "damageThresholdEffectiveSize", reduce:"SUM"}))
    let miscBonus = (["damageThresholdSizeModifier"].includes(options.attributeKey) ? damageThresholdEffectiveSize : 0);

    return sizeIndex + sizeBonus + miscBonus;
}


/**
 *
 * @param data
 * @param data.entity {object}
 * @param data.attributeKey {string}
 * @param data.attributeFilter {function}
 * @param data.itemFilter {function} filters out child items based on a filter
 * @param data.duplicates {number}
 * @param data.reduce {string}
 * @returns {*|string|[]|*[]}
 */
export function getInheritableAttribute(data = {}) {
    data.attributeFilter = data.attributeFilter || (() => true);
    data.itemFilter = data.itemFilter || (() => true)

    if(!data.attributeKey || !data.entity) {
        return [];
    }

    let values = [];
    if(Array.isArray(data.attributeKey)){
        for(let subKey of data.attributeKey){
            let subData = JSON.parse(JSON.stringify(data))
            subData.attributeKey = subKey;
            subData.attributeFilter = data.attributeFilter
            subData.itemFilter = data.itemFilter
            delete subData.reduce
            values.push(...getInheritableAttribute(subData))
        }

    }  else if(Array.isArray(data.entity)){
        for(let entity of data.entity){
            let subData = JSON.parse(JSON.stringify(data))
            subData.entity = entity;
            subData.attributeFilter = data.attributeFilter
            subData.itemFilter = data.itemFilter
            delete subData.reduce
            values.push(...getInheritableAttribute(subData))
        }

    } else {

        let entity = data.entity;
        if (entity instanceof SWSEActor || entity instanceof SWSEItem || entity instanceof UnarmedAttack) {
            entity = entity.data;
        }

        if(!entity){
            return values;
        }

        if (entity.type) {
            let itemAttributes = Object.entries(entity.data?.attributes || entity._source?.data?.attributes || []).filter(entry => !["str", "dex", "con", "int", "cha", "wis"].includes(entry[0])).map(entry => entry[1]);
            for (let attribute of itemAttributes.filter(attr => attr && attr.key === data.attributeKey)) {
                values.push(...extractAttributeValues(attribute, entity._id, entity.name, entity.data?.description || entity._source?.data.description));
            }
            values.push(...(getAttributesFromEmbeddedItems(entity, data)))

            if (entity.type === 'class') {
                values.push(... (getAttributesFromClass(data, entity)))
            }
            values.push(...(extractModeAttributes(entity, Object.values(entity.data?.modes || {}).filter(mode => mode && mode.isActive) || [], data.attributeKey)));

        }

        if(entity.effects){
            entity.effects.filter(effect => effect.data?.disabled !== false || effect.disabled !== false).forEach(e =>  values.push(...extractEffectChange(e.data?.changes || e.changes || [], data.attributeKey, e)))
        }


        if(!data.recursive || data.parent) {
            values = values.filter(attr => {
                let parent = data.parent;

                if(!parent) {
                    let parentId = getItemParentId(attr.source)
                    parent = game.actors?.get(parentId) || game.data.actors.find(actor => actor._id === parentId)
                }
                if(attr.parentPrerequisite && meetsPrerequisites(parent, attr.parentPrerequisite, {attributeKey: data.attributeKey}).doesFail){
                    return false;
                }

                return !meetsPrerequisites(entity, attr.prerequisite).doesFail
            });
        }
    }

    values = values.filter(data.attributeFilter);


    let overrides = values.filter(attr => attr.override)

    if(overrides.length > 0){
        values = overrides;
    }
    return reduceArray(data.reduce, values);
}

//TODO evaluate if we want to add attributes to a custom event class rather than using changes
export function extractEffectChange(changes, attributeKey, entity) {
    let values = [];
        for (let attribute of Object.values(changes).filter(attr => attr.key === attributeKey) || []) {
            values.push(...extractAttributeValues(attribute, entity.data?._id || entity._id, entity.data?.label || entity.label, entity.data.description || entity.data.data.description));
        }

    return values;
}

export function extractModeAttributes(entity, activeModes, attributeKey) {
    let values = [];
    for (let mode of activeModes) {
        for (let attribute of Object.values(mode.attributes).filter(attr => attr && attr.key === attributeKey) || []) {
            values.push(...extractAttributeValues(attribute, entity.data._id, entity.data.name, entity.data.data?.description ||entity.data?.description));
        }
        values.push(...extractModeAttributes(entity, Object.values(mode.modes || []).filter(mode => mode && mode.isActive), attributeKey) || []);
    }
    return values;
}