import {SWSEItem} from "../item/item.js";
import {SWSEActor} from "../actor/actor.js";

async function importCompendium(jsonImport, compendiumName, entity, forceRefresh) {
    let response;
    try {
        response = await fetch(jsonImport);
    } catch (e) {
        return;
    }

    if (response.status === 404) {
        return;
    }
    const content = await response.json();

    let pack = await game.packs.get(`world.${compendiumName.toLowerCase()}`);

    let toks = pack?.metadata.name.split("-");
    let version = toks ? toks[toks?.length - 1] : 0;
    if (!pack || (!isNaN(version) ? parseInt(version) : 0) < content.version || forceRefresh) {
        if (pack) {
            await pack.deleteCompendium()
        }
    } else {
        return;
    }

    let collection = await CompendiumCollection.createCompendium({
        label: compendiumName.toLowerCase(),
        name: compendiumName.toLowerCase(),
        type: entity,
        version: content.version
    });

    // await new Compendium(collection, {label: compendiumName, entity: entity, version: content.version})
    pack = await game.packs.get(`world.${compendiumName.toLowerCase()}`);
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

    if ('Item' === entity) {
        let items = await SWSEItem.create(content.entries);
        for (let item of items) {
            promises.push(collection.importDocument(item));
        }
    } else if ('Actor' === entity) {
        // let actors = await SWSEActor.create(content.entries);
        // for(let actor of actors) {
        //     let choiceAnswers = [];
        //     choiceAnswers.push(actor.data.data.size);
        //
        //     let providedItems = actor.data.data.providedItems;
        //     delete actor.data.data.providedItems;
        //
        //     await actor.addItems(providedItems, null, {skipPrerequisite:true, generalAnswers:choiceAnswers});
        //
        //     await collection.importDocument(actor);
        // }

        for (let actorData of content.entries) {


            let actors = await SWSEActor.create([actorData]);
            for (let actor of actors) {
                let choiceAnswers = [];
                choiceAnswers.push(actor.system.size);

                let providedItems = actor.system.providedItems;
                delete actor.system.providedItems;

                actor.skipPrepare = true;

                await actor.addItems(providedItems, null, {
                    skipPrerequisite: true,
                    generalAnswers: choiceAnswers,
                    isUpload: true,
                    suppressWarnings: true
                });

                actor.skipPrepare = false;

                actor.prepareData();
                await collection.importDocument(actor);


            }
        }
    }
    // await pack.createEntity(content.entries);
    //Promise.all(promises).then(() => {
    console.log(`Done Generating ${compendiumName}... ${content.entries.length} entries`);
    ui.notifications.info(`Done Updating ${compendiumName}... ${content.entries.length} entries`);
//});
}

export const deleteEmptyCompendiums = async function () {
    await game.packs.forEach(p => {
        if (p.index.size === 0) {
            p.delete();
        }
    });
}

export const generateCompendiums = async function (forceRefresh = false, type = "Item") {
    console.log("Generating Compendiums...")

    let pack = await game.packs.find(p => p.metadata.label === 'SWSE Abilities');
    if (pack) {
        pack.delete();
    }
    pack = await game.packs.find(p => p.metadata.label === 'SWSE Force Traditions');
    if (pack) {
        pack.delete();
    }


    if (type.toLowerCase() === "actor") {
        await importCompendium("systems/swse/raw_export/Vehicles.json", 'Vehicles', "Actor", forceRefresh);

        for(let i = 0; i < 21; i++){
            await importCompendium(`systems/swse/raw_export/Units CL ${i}.json`, `Units CL ${i}`, "Actor", forceRefresh);
        }
    }
    if (type.toLowerCase() === "item") {
        await importCompendium("systems/swse/raw_export/Traits.json", 'Traits', "Item", forceRefresh);

        await importCompendium("systems/swse/raw_export/Destiny.json", 'Destiny', "Item", forceRefresh);

        await importCompendium("systems/swse/raw_export/Background.json", 'Background', "Item", forceRefresh);

        await importCompendium("systems/swse/raw_export/Vehicle Base Types.json", 'Vehicle Base Types', "Item", forceRefresh);

        await importCompendium("systems/swse/raw_export/Vehicle Systems.json", 'Vehicle Systems', "Item", forceRefresh);

        await importCompendium("systems/swse/raw_export/Classes.json", 'Classes', "Item", forceRefresh);

        await importCompendium("systems/swse/raw_export/Feats.json", 'Feats', "Item", forceRefresh);

        await importCompendium("systems/swse/raw_export/Force Powers.json", 'Force Powers', "Item", forceRefresh);

        await importCompendium("systems/swse/raw_export/Force Regimens.json", 'Force Regimens', "Item", forceRefresh);

        await importCompendium("systems/swse/raw_export/Force Secrets.json", 'Force Secrets', "Item", forceRefresh);

        await importCompendium("systems/swse/raw_export/Force Techniques.json", 'Force Techniques', "Item", forceRefresh);

        await importCompendium("systems/swse/raw_export/Affiliations.json", 'Affiliations', "Item", forceRefresh);

        await importCompendium("systems/swse/raw_export/Items.json", 'Items', "Item", forceRefresh);

        await importCompendium("systems/swse/raw_export/Species.json", 'Species', "Item", forceRefresh);

        await importCompendium("systems/swse/raw_export/Talents.json", 'Talents', "Item", forceRefresh);

        await importCompendium("systems/swse/raw_export/templates.json", 'Templates', "Item", forceRefresh);

        await importCompendium("systems/swse/raw_export/beast components.json", 'Beast Components', "Item", forceRefresh);

        await importCompendium("systems/swse/raw_export/languages.json", 'Languages', "Item", forceRefresh);
    }
    console.log("End Generation")
}