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

    console.log(`${compendiumName}`);
    ui.notifications.info(`Updating ${compendiumName}... ${content.entries.length} entries`);
    for (let i of content.entries) {
        let entity = await pack.createEntity(i);
        entity.update({});
        console.log(`${entity.name} added to ${pack.metadata.label}`);
    }
}

export const generateCompendiums = async function () {
    console.log("Generating Compendiums...")

    await importCompendium("systems/swse/raw_export/Abilities.json", 'SWSE Abilities', "Item");

    await importCompendium("systems/swse/raw_export/Classes.json", 'SWSE Classes', "Item");

    await importCompendium("systems/swse/raw_export/Feats.json", 'SWSE Feats', "Item");

    await importCompendium("systems/swse/raw_export/Force Powers.json", 'SWSE Force Powers', "Item");

    await importCompendium("systems/swse/raw_export/Force Regimens.json", 'SWSE Force Regimens', "Item");

    await importCompendium("systems/swse/raw_export/Force Secrets.json", 'SWSE Force Secrets', "Item");

    await importCompendium("systems/swse/raw_export/Force Techniques.json", 'SWSE Force Techniques', "Item");

    await importCompendium("systems/swse/raw_export/Force Traditions.json", 'SWSE Force Traditions', "Item");

    await importCompendium("systems/swse/raw_export/Items.json", 'SWSE Items', "Item");

    await importCompendium("systems/swse/raw_export/Species.json", 'SWSE Species', "Item");

    await importCompendium("systems/swse/raw_export/Talents.json", 'SWSE Talents', "Item");

    await importCompendium("systems/swse/raw_export/templates.json", 'SWSE Templates', "Item");

    console.log("End Generation")
}