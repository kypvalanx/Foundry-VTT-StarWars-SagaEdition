async function importCompendium(jsonImport, compendiumName, entity) {
    let response;
    try {
        response = await fetch(jsonImport);
    }catch(e){
        return;
    }
    const content = await response.json();
    let importPack = false;

    let pack = await game.packs.find(p => p.metadata.label === compendiumName);
    if (!pack || (pack.metadata.version? pack.metadata.version : 0) < content.version) {
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
    for (let i of content.entries) {
        promises.push(pack.createEntity(i));
    }
    return Promise.all(promises);
}

export const generateCompendiums = async function () {
    console.log("Generating Compendiums...")

    let pack = await game.packs.find(p => p.metadata.label === 'SWSE Abilities');
    if(pack){
        pack.delete();
    }

    let promises = [];

    promises.push(importCompendium("systems/swse/raw_export/Traits.json", 'SWSE Traits', "Item"));

    promises.push(importCompendium("systems/swse/raw_export/Classes.json", 'SWSE Classes', "Item"));

    promises.push(importCompendium("systems/swse/raw_export/Feats.json", 'SWSE Feats', "Item"));

    promises.push(importCompendium("systems/swse/raw_export/Force Powers.json", 'SWSE Force Powers', "Item"));

    promises.push(importCompendium("systems/swse/raw_export/Force Regimens.json", 'SWSE Force Regimens', "Item"));

    promises.push(importCompendium("systems/swse/raw_export/Force Secrets.json", 'SWSE Force Secrets', "Item"));

    promises.push(importCompendium("systems/swse/raw_export/Force Techniques.json", 'SWSE Force Techniques', "Item"));

    promises.push(importCompendium("systems/swse/raw_export/Force Traditions.json", 'SWSE Force Traditions', "Item"));

    promises.push(importCompendium("systems/swse/raw_export/Items.json", 'SWSE Items', "Item"));

    promises.push(importCompendium("systems/swse/raw_export/Species.json", 'SWSE Species', "Item"));

    promises.push(importCompendium("systems/swse/raw_export/Talents.json", 'SWSE Talents', "Item"));

    promises.push(importCompendium("systems/swse/raw_export/templates.json", 'SWSE Templates', "Item"));

    Promise.all(promises).then((values) =>{
    console.log("End Generation");
    if(values.filter(value => value).length > 0){
        ui.notifications.info(`Compendiums have been update consider refreshing your browser.`);
    }});
}