import {getItemParentId, inheritableItems, reduceArray, toNumber} from "./util.js";
import {SWSEItem} from "./item/item.js";
import {meetsPrerequisites} from "./prerequisite.js";
import {ITEM_ONLY_ATTRIBUTES} from "./constants.js";

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
    if (attribute) {
        attribute.source = attribute.source || source;
        attribute.sourceString = attribute.sourceString || sourceString;
        attribute.sourceDescription = attribute.sourceDescription || sourceDescription;
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

function getAttributesFromEmbeddedItems(entity, predicate, embeddedItemOverride) {
    let attributes = [];
    let names = {};
    let items = !!embeddedItemOverride ? embeddedItemOverride : inheritableItems(entity);
    items = items.filter(i => !!i)
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

export function getResolvedSize(entity, options = {}) {
    if (entity.document && entity.document instanceof SWSEItem) {
        entity = entity.document.parent;
    }

    const fn = () => {

        let sizeIndex = toNumber(getInheritableAttribute({
            entity,
            attributeKey: "sizeIndex",
            reduce: "MAX",
            recursive: true
        }))
        let sizeBonus = toNumber(getInheritableAttribute({
            entity,
            attributeKey: "sizeBonus",
            reduce: "SUM",
            recursive: true
        }))


        let damageThresholdEffectiveSize = toNumber(getInheritableAttribute({
            entity,
            attributeKey: "damageThresholdEffectiveSize",
            reduce: "SUM", recursive: true
        }))
        let miscBonus = (["damageThresholdSizeModifier"].includes(options.attributeKey) ? damageThresholdEffectiveSize : 0);
        return sizeIndex + sizeBonus + miscBonus;
    }
    return entity.getCache ? entity.getCache("resolvedSize", fn) : fn()

}


function getLocalChangesOnDocument(document) {
    const values = document.system?.changes || document._source?.system?.changes || [];
    return values.map(value => appendSourceMeta(value, document._id, document.name, document.name));
}

function getChangesFromActiveEffects(document) {
    let attributes = []
    if (document.effects) {
        function isItemModifier(effect) {
            return effect.flags.swse?.itemModifier;
        }

        for (let effect of document.effects?.values() || []) {
            if (isItemModifier(effect) || effect.disabled === false) {
                attributes.push(...extractEffectChange(effect.changes || [], effect))
            }
        }
    }
    return attributes;
}



function getChangesFromDocument(data) {
    let document = data.entity;
    let fn = () => {
        let allAttributes = [];
        if(!data.skipLocal){
            if (document.type !== 'class') {
                allAttributes.push(...getLocalChangesOnDocument(document))
            } else {
                let classLevel = data.duplicates || 0;
                if (classLevel < 2) {
                    allAttributes.push(...getLocalChangesOnDocument(document))
                }
                allAttributes.push(...getAttributesFromClassLevel(document, classLevel))
            }
        }

        allAttributes.push(...getAttributesFromEmbeddedItems(document, data.predicate, data.embeddedItemOverride));
        allAttributes.push(...getChangesFromActiveEffects(document));
        return allAttributes;
    };
    return document.getCached ? document.getCached({
        fn: "getChangesFromDocument",
        duplicates: data.duplicates,
        predicate: data.predicate,
        embeddedItemOverride: data.embeddedItemOverride,
        skipLocal: data.skipLocal
    }, fn) : fn();
}

function functionString(fn) {
    if (fn) {
        return fn.toLocaleString();
    }
}

function getChangesFromDocuments(data) {
    if (Array.isArray(data.entity)) {
        let values = [];
        for (let entity of data.entity) {
            values.push(...getChangesFromDocument({
                entity: entity,
                attributeKey: data.attributeKey,
                itemFilter: data.itemFilter,
                duplicates: data.duplicates,
                recursive: data.recursive
            }))
        }
        return values;
    }
    return getChangesFromDocument(data);
}


function mapAttributesByType(allAttributes) {
    let attributeMap = new Map();
    for (const attribute of allAttributes) {
        if (!attribute || !attribute.key) {
            continue;
        }
        if (!attributeMap.has(attribute.key)) {
            attributeMap.set(attribute.key, []);
        }
        attributeMap.get(attribute.key).push(attribute);
    }
    return attributeMap;
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
    let values = getChangesFromDocuments(data);

    if(data.attributeKey){
        let attributeKeyFilter;
        if(Array.isArray(data.attributeKey)){
            attributeKeyFilter = (attribute) => data.attributeKey.includes(attribute.key);
        } else {
            attributeKeyFilter = (attribute) => data.attributeKey === attribute.key
        }
        values = values.filter(attributeKeyFilter)
    }

    if (data.attributeFilter) {
        if(data.attributeFilter === "ACTOR_INHERITABLE"){
            values = values.filter((attribute) => !ITEM_ONLY_ATTRIBUTES.includes(attribute.key));
        } else {
            values = values.filter(data.attributeFilter);
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

            return !meetsPrerequisites(data.entity, attr.prerequisite).doesFail
        });
    }

    if (data.entity.type === "character" || data.entity.type === "npc") {
        values = values
            .filter(value => !meetsPrerequisites(data.entity, value.parentPrerequisite).doesFail)
    }

    let overrides = values.filter(attr => attr && attr.override)

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
        for (let attribute of Object.values(mode.attributes || {})) {
            values.push(appendSourceMeta(attribute, entity._id, entity.name, entity.system.description));
        }
        values.push(...extractModeAttributes(entity, Object.values(mode.modes || {}).filter(mode => mode && mode.isActive) || []));
    }
    return values;
}