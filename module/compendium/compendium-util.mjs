import {SWSEItem} from "../item/item.mjs";

/**
 *
 * @returns {[CompendiumCollection]}
 * @param {string | [string]} item
 */
export function getCompendium(item) {
    if (!item) {
        return [];
    }
    if (Array.isArray(item)) {
        let compendiums = [];

        for (const itemElement of item) {
            compendiums.push(...getCompendium(itemElement))
        }

        return compendiums;
    }

    const packs = [];
    packs.push(...game.packs.filter(p => true));

    let type = null;
    if (typeof item === "string") {
        type = item.toLowerCase();
    } else {
        if (item.pack) {
            return packs.filter(pack => pack.collection.startsWith(item.pack));
        }
        type = item.type.toLowerCase();
    }

    switch (type) {
        case 'item':
            return packs.filter(pack => pack.collection.startsWith("world.") || pack.collection.startsWith("swse.items")
                || pack.collection.startsWith("swse.armor") || pack.collection.startsWith("swse.weapons")
                || pack.collection.startsWith("swse.equipment") || pack.collection.startsWith("swse.hazard")
                || pack.collection.startsWith("swse.implant") || pack.collection.startsWith("swse.droid systems"));
        case 'trait':
            return packs.filter(pack => pack.collection.startsWith("world.") || pack.collection.startsWith("swse.traits"));
        case 'feat':
            return packs.filter(pack => pack.collection.startsWith("world.") || pack.collection.startsWith("swse.feats"));
        case 'species':
            return packs.filter(pack => pack.collection.startsWith("world.") || pack.collection.startsWith("swse.species"));
        case 'talent':
            return packs.filter(pack => pack.collection.startsWith("world.") || pack.collection.startsWith("swse.talents"));
        case 'vehicletemplate':
            return packs.filter(pack => pack.collection.startsWith("world.") || pack.collection.startsWith("swse.vehicle-templates"));
        case 'vehiclebasetype':
            return packs.filter(pack => pack.collection.startsWith("world.") || pack.collection.startsWith("swse.vehicle-base-types"));
        case 'vehiclesystem':
            return packs.filter(pack => pack.collection.startsWith("world.") || pack.collection.startsWith("swse.vehicle-systems"));
        case 'template':
            return packs.filter(pack => pack.collection.startsWith("world.") || pack.collection.startsWith("swse.templates"));
        case 'affiliation':
            return packs.filter(pack => pack.collection.startsWith("world.") || pack.collection.startsWith("swse.affiliations"));
        case 'class':
            return packs.filter(pack => pack.collection.startsWith("world.") || pack.collection.startsWith("swse.classes"));
        case 'forceregimen':
            return packs.filter(pack => pack.collection.startsWith("world.") || pack.collection.startsWith("swse.force-regimens"));
        case 'forcepower':
            return packs.filter(pack => pack.collection.startsWith("world.") || pack.collection.startsWith("swse.force-powers"));
        case 'forcesecret':
            return packs.filter(pack => pack.collection.startsWith("world.") || pack.collection.startsWith("swse.force-secrets"));
        case 'forcetechnique':
            return packs.filter(pack => pack.collection.startsWith("world.") || pack.collection.startsWith("swse.force-techniques"));
        case 'beasttype':
            return packs.filter(pack => pack.collection.startsWith("world.") || pack.collection.startsWith("swse.beast-components"));
        case 'background':
            return packs.filter(pack => pack.collection.startsWith("world.") || pack.collection.startsWith("swse.background"));
        case 'destiny':
            return packs.filter(pack => pack.collection.startsWith("world.") || pack.collection.startsWith("swse.destinies"));
        case 'language':
            return packs.filter(pack => pack.collection.startsWith("world.") || pack.collection.startsWith("swse.languages"));
        case 'weapon':
            return packs.filter(pack => pack.collection.startsWith("world.") || pack.collection.startsWith("swse.weapons"));
        case 'armor':
            return packs.filter(pack => pack.collection.startsWith("world.") || pack.collection.startsWith("swse.armor"));
        case 'beastattack':
            return packs.filter(pack => pack.collection.startsWith("world.") || pack.collection.startsWith("swse.beast-components"));
        case 'upgrade':
            return packs.filter(pack => pack.collection.startsWith("world.") || pack.collection.startsWith("swse.upgrades"));
    }
    return [];
}

export async function getIndexAndPack(item) {

    game.indicesByType = game.indicesByType || {};
    const indicesByType = game.indicesByType;

    let compendiumReference = item.pack || item.type;
    let indices = indicesByType[compendiumReference];
    if (indices) {
        return indices;
    }

    let packs = getCompendium(item);
    if (packs.length === 0) {
        console.error(`${compendiumReference} compendium not defined`)
        return {}
    }
    indices = [];
    for (let pack of packs) {
        let index = await pack.getIndex();
        indices.push({pack, index})
    }
    indicesByType[compendiumReference] = indices;

    return indices;
}


function isFullItem(item) {
    return !!item.system || item instanceof SWSEItem;
}

/**
 *
 * @param item
 * @param {string} item.name
 * @param {string} item.type
 * @param {string} item.uuid
 * @param {boolean} item.duplicate
 * @param {SWSEItem} item.item
 * @returns {Promise<{itemName: (*), payload: undefined, createdItem: boolean, entity: (*|null)}>}
 */
export async function resolveEntity(item) {
    let entity = undefined
    let itemName = undefined
    let payload = undefined

    if(isFullItem(item)){
        entity = item;
        itemName = item.name;

    } else if (item.duplicate) {
        entity = item.item.clone();
        itemName = entity.name;
    } else if (item.uuid) {
        entity = await Item.implementation.fromDropData(item);
        itemName = entity.name;
    } else {
        let indices = await getIndexAndPack(item);
        let response = await getIndexEntryByName(item.name, indices);

        itemName = response.itemName;
        payload = response.payload;
        let lookup = response.lookup;


        let entry = response.entry;
        if (entry && entry._id) {
            entity = await Item.implementation.fromDropData({
                type: 'Item',
                uuid: `Compendium.${lookup.pack.metadata.id}.${entry._id}`
            });
        }
    }

    let createdItem = false;
    if (!entity && item.type === "language") {
        entity = game.items.find(i => i.name === item.name)
        if (!entity) {
            let entities = await SWSEItem.create([item]);
            entity = entities[0];
            createdItem = true;
        }
    }

    const resolvedEntity = entity ? entity.clone() : null;
    return {payload, itemName: itemName || entity?.name, entity: resolvedEntity, createdItem};
}


/**
 * @param {string} item
 * @param {{}} lookups
 */
async function getIndexEntryByName(item, lookups) {
    if (!lookups || lookups.length === 0) {
        return
    }

    let {itemName, payload} = resolveItemNameAndPayload(item);
    let cleanItemName1 = cleanItemName(itemName);

    let entry;
    let currentLookup;

    for (let lookup of lookups) {
        let index = lookup.index;
        entry = await index.find(f => f.name === cleanItemName1);
        if (!entry) {
            let cleanItemName2 = cleanItemName(itemName + " (" + payload + ")");
            entry = await index.find(f => f.name === cleanItemName2);
            if (entry) {
                payload = undefined;
            }
        }
        currentLookup = lookup
        if (entry) break;
    }
    return {entry, payload, itemName, lookup: currentLookup};
}

/**
 * @param {[string]} types
 * @param {[string]} subtypes
 * @return {Map<string, SWSEItem>}
 */
export async function getIndexEntriesByTypes(types = [], subtypes = []) {
    async function fn() {
        const compendiums = getCompendium(types);
        const entries = new Map()
        if (!compendiums || compendiums.length === 0) {
            return entries;
        }

        for (let compendium of compendiums) {
            const ids = compendium.index
                .filter(item => types.includes(item.type))
                .map(item => item._id);

            let items = await compendium.getDocuments({_id__in: ids});

            if (subtypes.length > 0) {
                items = items.filter(item => subtypes.includes(item.system.subtype));
            }

            for (const item of items) {
                entries.set(`${item.type.toUpperCase()}:${item.name}`, item);
            }
        }
        return entries
    }
    if(this && this.getCached){
        return this.getCached(`itemsByType:{types:${types},subtypes${subtypes}`, fn)
    }
    return await fn();
}


export function cleanItemName(feat) {
    return feat.replace("*", "").trim();
}

/**
 *
 * @param item {string}
 // * @param item.name {string}
 // * @param item.type {string}
 * @returns {{itemName, payload: string}}
 */
function resolveItemNameAndPayload(item) {
    let itemName = item;
    let result = /^([\w\s]*) \(([()\-\w\s*:+]*)\)/.exec(itemName);
    let payload = "";
    if (result) {
        itemName = result[1];
        payload = result[2];
    }
    return {itemName, payload};
}