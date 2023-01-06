import {filterItemsByType, getItemParentId, reduceArray, toNumber} from "./util.js";
import {SWSEItem} from "./item/item.js";
import {meetsPrerequisites} from "./prerequisite.js";

function equippedItems(entity) {
    if (entity.items) {
        let equippedIds = entity.equippedIds?.map(equipped => equipped.id) || []
        return entity.items.filter(item => equippedIds.includes(item.id || item._id));
    }
    // if(entity.data?.items){
    //     //items attached to items
    //     return entity.data.items;
    // }
    return [];
}

export function inheritableItems(entity) {
    if (!!entity.system.inheritableItems) {
        return entity.system.inheritableItems;
    }

    let possibleInheritableItems = equippedItems(entity);

    if (entity instanceof SWSEItem) {
        entity.system.inheritableItems = possibleInheritableItems
        return possibleInheritableItems;
    }

    possibleInheritableItems.push(...filterItemsByType(entity.items || [], ["background", "destiny", "trait", "feat", "talent", "power", "secret", "technique", "affiliation", "regimen", "species", "class", "vehicleBaseType", "beastAttack",
        "beastSense",
        "beastType",
        "beastQuality"]));


    entity.system.inheritableItems = [];
    let shouldRetry = possibleInheritableItems.length > 0;
    while (shouldRetry) {
        shouldRetry = false;
        for (let possible of possibleInheritableItems) {
            if (!meetsPrerequisites(entity, possible.system.prerequisite).doesFail) {
                entity.system.inheritableItems.push(possible);
                shouldRetry = true;
            }
        }
        possibleInheritableItems = possibleInheritableItems.filter(possible => !entity.system.inheritableItems.includes(possible));
    }


    return entity.system.inheritableItems;
}

/**
 * appends source meta to a given attribute
 * @param attribute {Object}
 * @param attribute.value {*}
 * @param source {String}
 * @param sourceString {String}
 * @param sourceDescription {String}
 * @returns {value, source, sourceString, sourceDescription}
 */
export function appendSourceMeta(attribute, source, sourceString, sourceDescription) {
    if(attribute){
        attribute.source = source;
        attribute.sourceString = sourceString;
        attribute.sourceDescription = sourceDescription;
    }
    return attribute
}

function getAttributesFromClassLevel(entity, classLevel) {
    let attributes = [];
    if (classLevel > 0) {
        let level = entity.system.levels[classLevel];
        for (let attribute of Object.values(level.data?.attributes)) {
            attributes.push(appendSourceMeta(attribute, entity._id, entity.name, `${entity.name} level ${classLevel}`));
        }
    }
    return attributes;
}

function getAttributesFromEmbeddedItems(entity, predicate) {
    let attributes = [];
    let names = {};
    let items = inheritableItems(entity);
    if (predicate) {
        items = items.filter(predicate)
    }
    for (let item of items) {
        let duplicates = (names[item.name] || 0) + 1;
        names[item.name] = duplicates;
        attributes.push(...getInheritableAttribute({
            entity: item,
            duplicates,
            recursive: true,
            parent: entity
        }));
    }
    return attributes;
}

export function getResolvedSize(entity, options) {
    if (entity.document && entity.document instanceof SWSEItem) {
        entity = entity.document.parent;
    }
    if(entity.system.resolvedSize){
        return entity.system.resolvedSize;
    }
    let sizeIndex = toNumber(getInheritableAttribute({entity, attributeKey: "sizeIndex", reduce: "MAX", recursive: true}))
    let sizeBonus = toNumber(getInheritableAttribute({entity, attributeKey: "sizeBonus", reduce: "SUM", recursive: true}))


    let damageThresholdEffectiveSize = toNumber(getInheritableAttribute({
        entity,
        attributeKey: "damageThresholdEffectiveSize",
        reduce: "SUM", recursive: true
    }))
    let miscBonus = (["damageThresholdSizeModifier"].includes(options.attributeKey) ? damageThresholdEffectiveSize : 0);
    entity.system.resolvedSize = sizeIndex + sizeBonus + miscBonus;
    return entity.system.resolvedSize;
}



function getAttributesFromDocument(data) {
    let document = data.entity;

    let fn = () => {
        let allAttributes = [];
        if (document.type !== 'class') {
            allAttributes.push(...Object.values(document.system?.attributes || document._source?.system?.attributes || {}))
        } else {
            let classLevel = data.duplicates || 0;
            if(classLevel < 2)
            {
                allAttributes.push(...Object.values(document.system?.attributes || document._source?.system?.attributes || {}))
            }
                allAttributes.push(...getAttributesFromClassLevel(document, classLevel))

        }

        allAttributes.push(...getAttributesFromEmbeddedItems(document, data.itemFilter))

        if (document.system?.modes) {
            allAttributes.push(...extractModeAttributes(document, Object.values(document.system.modes).filter(mode => mode && mode.isActive) || []));
        }

        if (document.effects) {
            document.effects.filter(effect => effect.disabled === false)
                .forEach(effect => allAttributes.push(...extractEffectChange(effect.changes || [], effect)))
        }

        let attributeMap = new Map();
        for (const attribute of allAttributes) {
            if(!attribute || !attribute.key){
                continue;
            }
            if(!attributeMap.has(attribute.key)){
                attributeMap.set(attribute.key, []);
            }
            attributeMap.get(attribute.key).push(attribute);
        }
        return attributeMap;
    };
    let unfilteredAttributes = document.getCached ? document.getCached({fn: "getAttributesFromDocument", duplicates: data.duplicates, itemFilter:data.itemFilter}, fn) : fn();


    let values = [];
    if (data.attributeKey && Array.isArray(data.attributeKey)) {
        for(let key in data.attributeKey){
            values.push(...(unfilteredAttributes.get(key)|| []))
        }
        //values.push(...unfilteredAttributes.filter(attr => attr && attr.key === data.attributeKey));
    }else if (data.attributeKey) {
        values.push(...(unfilteredAttributes.get(data.attributeKey) || []));
    } else {
        for(let value of unfilteredAttributes.values()){
            values.push(...(value || []))
        }
        //values.push(...unfilteredAttributes.filter(attr => attr && attr.key));
    }
    return values.map(value => appendSourceMeta(value, document._id, document.name, document.name));
}

function functionString(fn) {
    if(fn){
        return fn.toLocaleString();
    }
}

function getCachedAttributesFromDocument(data) {
    let key = {
        fn: "getCachedAttributesFromDocument",
        attributeKey: data.attributeKey,
        itemFilter: functionString(data.itemFilter),
        attributeFilter: functionString(data.attributeFilter),
        duplicates: data.duplicates
    };
    if(data.entity.getCached){
        return data.entity.getCached(key, () => getAttributesFromDocument(data))
    }
    return getAttributesFromDocument(data);
}

function getInheritableValues(data) {
    let values = [];
    if (Array.isArray(data.entity)) {
        for (let entity of data.entity) {
            values.push(...getInheritableValues({
                entity: entity,
                attributeKey: data.attributeKey,
                itemFilter: data.itemFilter,
                duplicates: data.duplicates,
                recursive: data.recursive
            }))
        }
    } else {
        return getCachedAttributesFromDocument(data);
    }
    return values;
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
 * @param data.recursive {boolean}
 * @returns {*|string|[]|*[]}
 */
export function getInheritableAttribute(data = {}) {
    if (!data.entity) {
        return [];
    }
    let values = getInheritableValues(data);


    if (!data.recursive && data.parent) {
        values = values.filter(attr => {
            let parent = data.parent;

            if (!parent) {
                let parentId = getItemParentId(attr.source)
                parent = game.actors?.get(parentId) || game.data.actors.find(actor => actor._id === parentId)
            }
            if (attr.parentPrerequisite && meetsPrerequisites(parent, attr.parentPrerequisite, {attributeKey: data.attributeKey}).doesFail) {
                return false;
            }

            return !meetsPrerequisites(data.entity, attr.prerequisite).doesFail
        });
    }

    if(data.entity.type === "character" || data.entity.type === "npc"){
        values = values.filter(value => !meetsPrerequisites(data.entity, value.parentPrerequisite).doesFail);
    }

    if (data.attributeFilter) {

        values = values.filter(data.attributeFilter);
    }


    let overrides = values.filter(attr =>  attr && attr.override)

    if (overrides.length > 0) {
        values = overrides;
    }
    return reduceArray(data.reduce, values, data.entity);
}

//TODO evaluate if we want to add attributes to a custom event class rather than using changes
export function extractEffectChange(changes, entity) {
    let values = [];
    for (let attribute of Object.values(changes || {})) {
        values.push(appendSourceMeta(attribute, entity._id, entity.label, entity.label));
    }
    return values;
}

export function extractModeAttributes(entity, activeModes) {
    let values = [];
    for (let mode of activeModes) {
        for(let attribute of Object.values(mode.attributes)){
            values.push(appendSourceMeta(attribute, entity._id, entity.name, entity.system.description));
        }
        values.push(...extractModeAttributes(entity, Object.values(mode.modes || {}).filter(mode => mode && mode.isActive) || []));
    }
    return values;
}