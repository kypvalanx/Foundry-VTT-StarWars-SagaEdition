import {getItemParentId, inheritableItems, reduceArray, toNumber} from "./common/util.mjs";
import {SWSEItem} from "./item/item.mjs";
import {meetsPrerequisites} from "./prerequisite.mjs";
import {ITEM_ONLY_ATTRIBUTES} from "./common/constants.mjs";
import {SWSEActor} from "./actor/actor.mjs";

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
        attribute.source = source;
        attribute.sourceString = sourceString;
        attribute.sourceDescription = sourceDescription;
    }
    return attribute
}


function getChangesFromEmbeddedItems(entity, predicate, embeddedItemOverride) {
    if (!(entity instanceof SWSEActor)) {
        return [];
    }
    let attributes = [];
    let items = !!embeddedItemOverride ? embeddedItemOverride : inheritableItems(entity);
    items = items.filter(i => !!i)
    if (predicate) {
        items = items.filter(predicate)
    }
    for (let item of items) {
        const changesFromDocuments = getChangesFromDocuments({
            entity: item,
            recursive: true,
            parent: entity
        });
        attributes.push(...changesFromDocuments);
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


function getLocalChangesOnDocument(document, flags) {
    const values = !document.isDisabled || flags.includes("IGNORE_DISABLE") ? document.changes || document.system?.changes || document._source?.system?.changes || [] : [];
    return values.filter(v => !!v).map(value => appendSourceMeta(value, document._id, document.name, document.name));
}

//
function getChangesFromActiveEffects(document) {
    if (!document.effects) {
        return [];
    }

    let attributes = []
    for (let effect of document.effects || []) {
        if (isActiveEffect(effect, document)) {
            attributes.push(...extractEffectChange(effect.changes || [], effect))
        }
    }
    return attributes;
}

function isEffectOnEmbeddedItem(document, effect) {
    return document instanceof SWSEActor && effect.origin.includes("Item");
}

function isActiveEffect(effect, document) {
    if (isEffectOnEmbeddedItem(document, effect)){
        return false
    }

    if (effect.flags.swse && effect.flags.swse.isLevel){
        return effect.flags.swse.level <= (document.system.levelsTaken?.length || 0);
    }

    return effect.flags.swse?.itemModifier || effect.disabled === false;
}

function getChangesFromDocument(data) {
    let document = data.entity;
    let fn = () => {
        let allAttributes = [];
        if (!data.skipLocal) {
            allAttributes.push(...getLocalChangesOnDocument(document, data.flags))

        }

        allAttributes.push(...getChangesFromEmbeddedItems(document, data.itemFilter, data.embeddedItemOverride));
        allAttributes.push(...getChangesFromActiveEffects(document));
        return allAttributes;
    };


    return document.getCached ? document.getCached({
        fn: "getChangesFromDocument",
        predicate: data.itemFilter,
        embeddedItemOverride: data.embeddedItemOverride,
        skipLocal: data.skipLocal
    }, fn) : fn();
}
function getChangesFromDocuments(data) {
    if (Array.isArray(data.entity)) {
        let values = [];
        for (let entity of data.entity) {
            values.push(...getChangesFromDocument({
                entity: entity,
                attributeKey: data.attributeKey,
                itemFilter: data.itemFilter,
                recursive: data.recursive
            }))
        }
        return values;
    }
    return getChangesFromDocument(data);
}

/**
 *
 * @param data
 * @param data.entity {object}
 * @param data.attributeKey {string}
 * @param data.attributeFilter {function}
 * @param data.itemFilter {function} filters out child items based on a filter
 * @param data.reduce {string}
 * @param data.recursive {boolean}
 * @returns {*|string|[]|*[]}
 */
export function getInheritableAttribute(data = {}) {
    if (!data.entity) {
        return [];
    }
    let values = getChangesFromDocuments(data);
    // 1. get values
    // 2. ?
    // 3. profit
    // really though we have to filter by attribute key, allow attribute filter,
    // run prerequisites (look at this, it looks like it's done twice?)that order can stay the same
    // i think that overrid needs to move to reduce, the reduce functions just need to acknowledge mode. TODO look at this after coffee
    if (data.attributeKey) {
        let attributeKeyFilter;
        if (Array.isArray(data.attributeKey)) {
            attributeKeyFilter = (attribute) => !!attribute && data.attributeKey.includes(attribute.key);
        } else {
            attributeKeyFilter = (attribute) => !!attribute && data.attributeKey === attribute.key
        }
        values = values.filter(attributeKeyFilter)
    }

    if (data.attributeFilter) {
        if (data.attributeFilter === "ACTOR_INHERITABLE") {
            values = values.filter((attribute) => !!attribute && !ITEM_ONLY_ATTRIBUTES.includes(attribute.key));
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
            .filter(value => !!value && !meetsPrerequisites(data.entity, value.parentPrerequisite).doesFail)
    }

    // let overrides = values.filter(attr => attr && attr.override)
    // if (overrides.length > 0) {
    //     let overriddenKeys = overrides.map(o => o.key);
    //     values = values.filter(value => !overriddenKeys.includes(value.key) || value.override);
    // }
    return reduceArray(data.reduce, values, data.entity);
}

export function extractEffectChange(changes, entity) {
    let values = [];
    for (let attribute of Object.values(changes || {})) {
        values.push(appendSourceMeta(attribute, entity._id, entity.name, entity.name));
    }
    return values;
}