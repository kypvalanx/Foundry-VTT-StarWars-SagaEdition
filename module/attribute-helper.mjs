import {inheritableItems, reduceArray, toNumber} from "./common/util.mjs";
import {SWSEItem} from "./item/item.mjs";
import {meetsPrerequisites} from "./prerequisite.mjs";
import {
    ITEM_ONLY_ATTRIBUTES,
    SCALABLE_CHANGES,
    sizeArray,
    UNINHERITABLE_AMMO_CHANGES,
    WEAPON_INCLUSION_LIST
} from "./common/constants.mjs";
import {SWSEActor} from "./actor/actor.mjs";
import {SWSEActiveEffect} from "./active-effect/active-effect.mjs";
import {UnarmedAttack} from "./actor/unarmed-attack.mjs";

/**
 * appends source meta to a given attribute
 * @param attribute {Object}
 * @param source {String}
 * @param sourceString {String} 
 * @param sourceDescription {String}
 * @returns {Object}
 */
export function appendSourceMeta(attribute, source, sourceString, sourceDescription) {
    // Return null if attribute is null/undefined
    if (!attribute) {
        return null;
    }
    
    // Ensure attribute is an object
    if (typeof attribute !== 'object') {
        attribute = { value: attribute };
    }
    
    // Create a deep copy
    attribute = JSON.parse(JSON.stringify(attribute));
    
    // Add metadata properties if they don't exist
    attribute.source = attribute.source || source;
    attribute.sourceString = attribute.sourceString || sourceString;
    attribute.sourceDescription = attribute.sourceDescription || sourceDescription;
    
    return attribute;
}

/**
 *  get changes from items on an actor
 * @param entity {SWSEActor}
 * @param embeddedItemOverride {[SWSEItem]}
 * @param itemFilter {Function}
 * @return {*[]}
 */
function getChangesFromEmbeddedItems(entity, itemFilter, embeddedItemOverride) {
    if (!(entity instanceof SWSEActor)) {
        return [];
    }

    let items = !!embeddedItemOverride ? embeddedItemOverride : inheritableItems(entity);
    items = items.filter(i => !!i)
    if (itemFilter) {
        items = items.filter(itemFilter)
    }

    let changes = [];
    for (let item of items) {
        const changesFromDocuments = getChangesFromDocument({
            entity: item,
            flags: ["REQUESTED_BY_ACTOR"],
            recursive: true,
            parent: entity
        });
        changes.push(...changesFromDocuments);
    }
    return changes;
}

export function getResolvedSize(entity, options = {}) {
    if (entity && entity.document && entity.document instanceof SWSEItem) {
        entity = entity.document.parent;
    } else if((entity instanceof SWSEItem || entity instanceof UnarmedAttack) && entity.parent) {
        return getResolvedSize(entity.parent, {flags: ["REQUESTED_BY_ACTOR"]});
    }

    const fn = () => {
        let flags = !options.flags ? [] : [...options.flags];
        if(!flags.includes("RECURSIVE")) {
            flags.push("RECURSIVE");
        }
        if(!flags.includes("SKIP_SIZE")) {
            flags.push("SKIP_SIZE");
        }
        let size_values = getInheritableAttribute({
            entity,
            changes: options.changes,
            attributeKey: ["sizeIndex", "sizeBonus", "size"],
            recursive: true,
            skipSize: true,
            flags: flags
        })

        let sizeIndex = 0;
        let sizeBonus = 0;
        for (const sizeValue of size_values) {
            if(sizeValue.key === "sizeBonus" || (sizeValue.key === "size" && (sizeValue.value.startsWith("+") || sizeValue.value.startsWith("-")))) {
                sizeBonus += parseInt(sizeValue.value, 10);
            } else {
                if(sizeArray.indexOf(sizeValue.value)> -1) {
                    sizeIndex = Math.max( sizeIndex, sizeArray.indexOf(sizeValue.value));
                } else if (!isNaN(sizeValue.value)){
                    sizeIndex = Math.max( sizeIndex, parseInt(sizeValue.value));
                }
            }
        }
        let miscBonus = 0;
        if("damageThresholdSizeModifier" === options.attributeKey){
            miscBonus = toNumber(getInheritableAttribute({
                entity,
                changes: options.changes,
                attributeKey: "damageThresholdEffectiveSize",
                reduce: "SUM", recursive: true,
                skipSize: true,
                flags: flags
            })) ;
        }

        return sizeIndex + sizeBonus + miscBonus;
    }

    let variation = "damageThresholdSizeModifier" === options.attributeKey ? "damageThresholdSizeModifier" : "";

    return entity && entity.getCache ? entity.getCache("resolvedSize" + variation, fn) : fn()

}

/**
 * This provides filters based on doc type, flags, etc
 */
function getLocalChangesFilter(document, flags = []) {
    if(flags.includes("REQUESTED_BY_ACTOR")) {
        if(document.type === "weapon"){
            return (c => WEAPON_INCLUSION_LIST.includes(c.key))
        }
    }

    return (v => !!v);
}

function getLocalChangesOnDocument(document, flags) {
    let values;
    if (!isActiveDocument(document, flags)) {
        return [];
    }

    values = document.changes || document.system?.changes || document._source?.system?.changes || [];

    if (!Array.isArray(values)) {
        values = Object.values(values)
    }

    values.push(...(document.defaultChanges || []))

    values = values.filter(v => !!v);

    values = values.filter(getLocalChangesFilter(document, flags));

    //Ignore all changes on old size traits except the actual size
    //TODO build cleanup script and remove
    if(sizeArray.includes(document.name)){
        let sizeValues = values.filter(v => v.key === "size" || v.key === "sizeIndex" || v.key === "sizeBonus"|| v.key.endsWith("Scalable"))

        if(sizeValues.length > 0){
            values = sizeValues;
        }
    }


    return values.map(value => appendSourceMeta(value, document._id, document.name, document.name));
}

function isActiveDocument(effect, flags = []) {
    if (effect.flags?.swse && effect.flags?.swse.isLevel) {
        const classItem = getClassItemFromClassLevel(effect);
        return effect.flags.swse.level <= (classItem?.system.levelsTaken?.length || 0);
    }

    if(!(effect instanceof SWSEActiveEffect)) {
        return true;
    }

    return effect.flags?.swse?.itemModifier || effect.disabled === false || flags?.includes("IGNORE_DISABLE");
}


/**
 *
 * @param document {SWSEItem|SWSEActor}
 * @param recursive {boolean}
 * @return {*[]}
 */
function getChangesFromActiveEffects(document, recursive) {
    if (!document.effects) {//|| recursive) {
        return [];
    }

    let attributes = []
    for (let effect of document.effects || []) {
        attributes.push(...(getLocalChangesOnDocument(effect)))
    }
    return attributes;
}


function getClassItemFromClassLevel(effect) {
    if (effect.parent instanceof SWSEItem) {
        return effect.parent
    }
    const split = effect.origin.split(".");
    return effect.parent.items.get(split[split.length - 1]);
}


function getChangesFromLoadedAmmunition(document) {
    if (!document.ammunition?.hasAmmunition) {
        return [];
    }

    let changes = [];
    Object.values(document.ammunition.ammunition)
        .forEach(ammo => {
            if (!(typeof ammo === 'object' && Array.isArray(ammo.queue) && ammo.queue[0])) {
                return;
            }
            let item = document.parent.items.get(ammo.queue[0])
            if (item) {
                changes.push(...item.changes
                    .filter(change => !UNINHERITABLE_AMMO_CHANGES.includes(change.key)))
            }
        })

    return changes;
}


function getChangesFromSize(entity, changes) {
    const options = {changes: changes};
    let size = getResolvedSize(entity, options)

    if (!isNaN(size)) {
        size = sizeArray[size];
    }

    const resolvedChanges = [];

    resolvedChanges.push(...changes.filter(change => !change.key.toLowerCase().endsWith("scalable")))

    for (const scalableChange of changes.filter(change => change.key.toLowerCase().endsWith("scalable"))) {
        resolvedChanges.push(...SCALABLE_CHANGES[scalableChange.key][scalableChange.value][size]);
    }

    return resolvedChanges;
}

function getChangesFromDocument( data) {
   let document = data.entity;
    let fn = () => {
        let changes = [];
        if (!data.skipLocal) {
            changes.push(...getLocalChangesOnDocument(document, data.flags))
        }

        changes.push(...getChangesFromEmbeddedItems(document, data.itemFilter, data.embeddedItemOverride));
        changes.push(...getChangesFromActiveEffects(document, data.recursive));
        changes.push(...getChangesFromLoadedAmmunition(document))

        return changes;
    };

    return document.getCached ? document.getCached({
        fn: "getChangesFromDocument",
        predicate: data.itemFilter,
        embeddedItemOverride: data.embeddedItemOverride,
        skipLocal: data.skipLocal,
        recursive: data.recursive,
        flags: data.flags,
    }, fn) : fn();
}

function getChangesFromDocuments(data) {
    if (Array.isArray(data.entity)) {
        let values = [];
        for (let e of data.entity) {
            values.push(...getChangesFromDocument( {
                itemFilter: data.itemFilter,
                recursive: data.recursive,
                embeddedItemOverride: data.embeddedItemOverride,
                entity: e
            }))
        }
        return values;
    }
    return getChangesFromDocument( data);
}

function getValues(values, data, entities) {
    return values.filter(attr => {
        let parent = data.parent || entities[attr.source]?.parent;

        if (!parent) {
            return true;
        }
        if (attr.parentPrerequisite && meetsPrerequisites(parent, attr.parentPrerequisite, {
            attributeKey: data.attributeKey,
            isLoad: true
        }).doesFail) {
            return false;
        }

        return !meetsPrerequisites(data.entity, attr.prerequisite, {isLoad: true}).doesFail
    });
}

function containsScalableAttributes(changeKey) {
    if(!Array.isArray(changeKey))
    {
        changeKey = [changeKey];
    }

    const scalableChangeKeys = Object.keys(SCALABLE_CHANGES).map(c => c.substring(0, c.length-8));
    for (const changeKeyElement of changeKey.filter(c => !!c)) {
        if(changeKeyElement.endsWith("Scalable"))return true;

        if(scalableChangeKeys.includes(changeKeyElement)) return true;

    }

    return false;
}

function shouldAddressScalable(values, changeKey, data) {
    if (values.length === 0) return false;
    if (!containsScalableAttributes(changeKey)) return false;
    if (data.flags && data.flags.includes("SKIP_SIZE")) return false;
    return (data.entity instanceof SWSEItem || data.entity instanceof UnarmedAttack) && data.entity.parent || data.entity instanceof SWSEActor;
}

/**
 *
 * @param data
 * @param data.entity {object}
 * @param data.attributeKey {string}
 * @param [data.attributeFilter] {function|string}
 * @param [data.itemFilter] {function} filters out child items based on a filter
 * @param [data.reduce] {string}
 * @param [data.recursive] {boolean}
 * @returns {*|string|[]|*[]}
 */
export function getInheritableAttribute(data = {}) {
    if ((!data.entity || data.entity.length === 0) && !data.changes) {
        return [];
    }
    let values = []
    const changeKey = data.attributeKey;
    if (data.changes) {
        values.push(...data.changes);
    }
    if (data.entity) {
        values.push(...getChangesFromDocuments(data));
        if(shouldAddressScalable(values, changeKey, data)) {
            values = getChangesFromSize(data.entity, values);
        }
    }
    // 1. get values
    // 2. ?
    // 3. profit
    // really though we have to filter by attribute key, allow attribute filter,
    // run prerequisites (look at this, it looks like it's done twice?)that order can stay the same
    // i think that overrid needs to move to reduce, the reduce functions just need to acknowledge mode. TODO look at this after coffee

    if (changeKey) {
        let attributeKeyFilter = Array.isArray(changeKey) ?
            (change) => change && changeKey.includes(change.key) :
            (change) => change && changeKey === change.key;
        values = values.filter(attributeKeyFilter)
    }

    if (data.attributeFilter) {
        if (data.attributeFilter === "ACTOR_INHERITABLE") {
            values = values.filter((attribute) => !!attribute && !ITEM_ONLY_ATTRIBUTES.includes(attribute.key));
        } else {
            values = values.filter(data.attributeFilter);
        }
    }


    if (data.entity) {
        const entities = {};
        for (let e of Array.isArray(data.entity) ? data.entity : [data.entity]) {
            entities[e.id] = e;
        }

        if (!data.recursive) {
            values = getValues(values, data, entities);
        }
    }


    if (data.entity && (data.entity.type === "character" || data.entity.type === "npc")) {
        values = values
            .filter(value => !!value && !meetsPrerequisites(data.entity, value.parentPrerequisite, {isLoad: true}).doesFail)
    }

    return reduceArray(data.reduce, JSON.parse(JSON.stringify(values)), data.entity);
}