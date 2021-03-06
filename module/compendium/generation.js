async function importCompendium(jsonImport, compendiumName, entity, forceRefresh) {
    let response;
    try {
        response = await fetch(jsonImport);
    }catch(e){
        return;
    }
    const content = await response.json();
    let importPack = false;

    let pack = await game.packs.find(p => p.metadata.label === compendiumName);
    if (!pack || (pack.metadata.version? pack.metadata.version : 0) < content.version || forceRefresh) {
        importPack = true;
        if (pack) {
            await pack.delete()
        }
    }

    if (!importPack) {
        return;
    }


    await Compendium.create({label: compendiumName, entity: entity, version: content.version})
    pack = await game.packs.find(p => p.metadata.label === compendiumName);
    pack.metadata.version = content.version;

    if (!pack) {
        return;
    }

    console.log(`Generating ${compendiumName}... ${content.entries.length} entries`);
    ui.notifications.info(`Updating ${compendiumName}... ${content.entries.length} entries`);
    let promises = [];
    // for (let i of content.entries) {
    //     await pack.createEntity(i);
    // }
         await pack.createEntity(content.entries);
//     Promise.all(promises).then(values => {
        console.log(`Done Generating ${compendiumName}... ${content.entries.length} entries`);
    ui.notifications.info(`Done Updating ${compendiumName}... ${content.entries.length} entries`);
// });
}

export const generateCompendiums = async function (forceRefresh = false) {
    console.log("Generating Compendiums...")

    let pack = await game.packs.find(p => p.metadata.label === 'SWSE Abilities');
    if(pack){
        pack.delete();
    }


    await importCompendium("systems/swse/raw_export/Traits.json", 'SWSE Traits', "Item", forceRefresh);

    await importCompendium("systems/swse/raw_export/Classes.json", 'SWSE Classes', "Item", forceRefresh);

    await importCompendium("systems/swse/raw_export/Feats.json", 'SWSE Feats', "Item", forceRefresh);

    await importCompendium("systems/swse/raw_export/Force Powers.json", 'SWSE Force Powers', "Item", forceRefresh);

    await importCompendium("systems/swse/raw_export/Force Regimens.json", 'SWSE Force Regimens', "Item", forceRefresh);

    await importCompendium("systems/swse/raw_export/Force Secrets.json", 'SWSE Force Secrets', "Item", forceRefresh);

    await importCompendium("systems/swse/raw_export/Force Techniques.json", 'SWSE Force Techniques', "Item", forceRefresh);

    await importCompendium("systems/swse/raw_export/Force Traditions.json", 'SWSE Force Traditions', "Item", forceRefresh);

    await importCompendium("systems/swse/raw_export/Items.json", 'SWSE Items', "Item", forceRefresh);

    await importCompendium("systems/swse/raw_export/Species.json", 'SWSE Species', "Item", forceRefresh);

    await importCompendium("systems/swse/raw_export/Talents.json", 'SWSE Talents', "Item", forceRefresh);

    await importCompendium("systems/swse/raw_export/templates.json", 'SWSE Templates', "Item", forceRefresh);

    console.log("End Generation")
}