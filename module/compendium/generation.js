import {SWSEItem} from "../item/item.js";
import {SWSEActor} from "../actor/actor.js";

async function importCompendium(jsonImport, compendiumName, entity, forceRefresh) {
    let response;
    try {
        response = await fetch(jsonImport);
    }catch(e){
        return;
    }

    if(response.status ===404){
        return;
    }
    const content = await response.json();

    let pack = await game.packs.find(p => p.metadata.label === compendiumName);

    let toks = pack?.metadata.name.split("-");
    let version = toks ? toks[toks?.length - 1] : 0;
    if (!pack || (!isNaN(version)? parseInt(version) : 0) < content.version || forceRefresh) {
        if (pack) {
            await pack.deleteCompendium()
        }
    } else {
        return;
    }

    let collection = await CompendiumCollection.createCompendium({label: compendiumName, name: compendiumName.toLowerCase().replace(" ", "-"),type: entity, version: content.version});

   // await new Compendium(collection, {label: compendiumName, entity: entity, version: content.version})
    pack = await game.packs.find(p => p.metadata.label === compendiumName);
    //pack.metadata.version = content.version;

    if (!pack) {
        return;
    }

    console.log(`Generating ${compendiumName}... ${content.entries.length} entries`);
    ui.notifications.info(`Updating ${compendiumName}... ${content.entries.length} entries`);
    let promises = [];
    // for (let i of content.entries) {
    //     await pack.createEntity(i);
    // }

    if('Item' === entity){
        let items = await SWSEItem.create(content.entries);
        for(let item of items) {
            promises.push(collection.importDocument(item));
        }
    } else if('Actor' === entity){
        let actors = await SWSEActor.create(content.entries);
        for(let actor of actors) {
            let providedItems = actor.data.data.providedItems;
            delete actor.data.data.providedItems;

            await actor.addItems(providedItems, null, {skipPrerequisite:true})

            promises.push(collection.importDocument(actor));
        }
    }
        // await pack.createEntity(content.entries);
    Promise.all(promises).then(() => {
        console.log(`Done Generating ${compendiumName}... ${content.entries.length} entries`);
    ui.notifications.info(`Done Updating ${compendiumName}... ${content.entries.length} entries`);
});
}

export const deleteEmptyCompendiums = async function(){
    await game.packs.forEach(p => {
        if(p.index.size === 0){
            p.delete();
        }
    });
}

export const generateCompendiums = async function (forceRefresh = false, type = "Item") {
    console.log("Generating Compendiums...")

    let pack = await game.packs.find(p => p.metadata.label === 'SWSE Abilities');
    if(pack){
        pack.delete();
    }
    pack = await game.packs.find(p => p.metadata.label === 'SWSE Force Traditions');
    if(pack){
        pack.delete();
    }


    if(type.toLowerCase() === "actor") {
        await importCompendium("systems/swse/raw_export/Vehicles.json", 'SWSE Vehicles', "Actor", forceRefresh);
    }
    if(type.toLowerCase() === "item") {
        await importCompendium("systems/swse/raw_export/Traits.json", 'SWSE Traits', "Item", forceRefresh);

        await importCompendium("systems/swse/raw_export/Vehicle Stock Templates.json", 'SWSE Vehicle Templates', "Item", forceRefresh);

        await importCompendium("systems/swse/raw_export/Vehicle Systems.json", 'SWSE Vehicle Systems', "Item", forceRefresh);

        await importCompendium("systems/swse/raw_export/Classes.json", 'SWSE Classes', "Item", forceRefresh);

        await importCompendium("systems/swse/raw_export/Feats.json", 'SWSE Feats', "Item", forceRefresh);

        await importCompendium("systems/swse/raw_export/Force Powers.json", 'SWSE Force Powers', "Item", forceRefresh);

        await importCompendium("systems/swse/raw_export/Force Regimens.json", 'SWSE Force Regimens', "Item", forceRefresh);

        await importCompendium("systems/swse/raw_export/Force Secrets.json", 'SWSE Force Secrets', "Item", forceRefresh);

        await importCompendium("systems/swse/raw_export/Force Techniques.json", 'SWSE Force Techniques', "Item", forceRefresh);

        await importCompendium("systems/swse/raw_export/Affiliations.json", 'SWSE Affiliations', "Item", forceRefresh);

        await importCompendium("systems/swse/raw_export/Items.json", 'SWSE Items', "Item", forceRefresh);

        await importCompendium("systems/swse/raw_export/Species.json", 'SWSE Species', "Item", forceRefresh);

        await importCompendium("systems/swse/raw_export/Talents.json", 'SWSE Talents', "Item", forceRefresh);

        await importCompendium("systems/swse/raw_export/templates.json", 'SWSE Templates', "Item", forceRefresh);
    }
    console.log("End Generation")
}