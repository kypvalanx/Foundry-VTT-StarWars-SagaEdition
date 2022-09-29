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
    attribute.source = source;
    attribute.sourceString = sourceString;
    attribute.sourceDescription = sourceDescription;
    return attribute
}

function getAttributesFromClassLevel(entity, classLevel) {
    let attributes = [];
    if (classLevel > 0) {
        let level = entity.system.levels[classLevel];
        for (let attribute of Object.values(level.data.attributes)) {
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
    let sizeIndex = toNumber(getInheritableAttribute({entity, attributeKey: "sizeIndex", reduce: "MAX", recursive: true}))
    let sizeBonus = toNumber(getInheritableAttribute({entity, attributeKey: "sizeBonus", reduce: "SUM", recursive: true}))


    let damageThresholdEffectiveSize = toNumber(getInheritableAttribute({
        entity,
        attributeKey: "damageThresholdEffectiveSize",
        reduce: "SUM", recursive: true
    }))
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
 * @param data.recursive {boolean}
 * @returns {*|string|[]|*[]}
 */
export function getInheritableAttribute(data = {}) {
    let document = data.entity;

    if (!document) {
        return [];
    }
    let values = [];
    if (Array.isArray(data.attributeKey)) {
        for (let subKey of data.attributeKey) {
            values.push(...getInheritableAttribute({
                entity: document,
                attributeKey: subKey,
                itemFilter: data.itemFilter,
                duplicates: data.duplicates,
                recursive: data.recursive
            }))
        }
    } else if (Array.isArray(document)) {
        for (let entity of document) {
            values.push(...getInheritableAttribute({
                entity: entity,
                attributeKey: data.attributeKey,
                itemFilter: data.itemFilter,
                duplicates: data.duplicates,
                recursive: data.recursive
            }))
        }
    } else {


        let unfilteredAttributes = Object.entries(document.system?.attributes || document._source?.system?.attributes || {})
            .filter(entry => !["str", "dex", "con", "int", "cha", "wis"].includes(entry[0]))
            .map(entry => appendSourceMeta(entry[1], entry[1]._id, entry[1].name, entry[1].name));

        if (document.type === 'class') {
            unfilteredAttributes.push(...getAttributesFromClassLevel(document, data.duplicates || 0))
        }

        unfilteredAttributes.push(...getAttributesFromEmbeddedItems(document, data.itemFilter))

        if (document.system?.modes) {
            unfilteredAttributes.push(...extractModeAttributes(document, Object.values(document.system.modes).filter(mode => mode && mode.isActive) || []));
        }


        if (document.effects) {
            document.effects.filter(effect => effect.disabled === false)
                .forEach(effect => unfilteredAttributes.push(...extractEffectChange(effect.changes || [], effect)))
        }
        if(data.attributeKey){
            values.push(...unfilteredAttributes.filter(attr => attr && attr.key === data.attributeKey))
        } else {
            values.push(...unfilteredAttributes)
        }
    }



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

            return !meetsPrerequisites(document, attr.prerequisite).doesFail
        });
    }

    if (data.attributeFilter) {

        values = values.filter(data.attributeFilter);
    }


    let overrides = values.filter(attr => attr.override)

    if (overrides.length > 0) {
        values = overrides;
    }
    return reduceArray(data.reduce, values);
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
        values.push(appendSourceMeta(attribute, entity._id, entity.name, entity.system.description));
        values.push(...extractModeAttributes(entity, Object.values(mode.modes || {}).filter(mode => mode && mode.isActive) || []));
    }
    return values;
}