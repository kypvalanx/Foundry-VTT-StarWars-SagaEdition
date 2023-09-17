import {SWSEItem} from "../item/item.mjs";
import {SWSEActor} from "../actor/actor.mjs";

async function processActor(actorData) {
    let actors = await SWSEActor.create([actorData]);
    if (!(actors && actors.length === 1)) {
        return;
    }
    let actor = actors[0];
    let choiceAnswers = [];
    choiceAnswers.push(actor.system.size);
    let providedItems = actor.system.providedItems;
    delete actor.system.providedItems;
    actor.prepareData();
    actor.skipPrepare = true;
    await actor.addItems(providedItems, null, {
        skipPrerequisite: true,
        generalAnswers: choiceAnswers,
        isUpload: true,
        suppressWarnings: true
    });
    actor.skipPrepare = false;
    actor.prepareData();
    return actor;
}

async function getFile(jsonImport) {
    //console.log(jsonImport);
    let response;
    try {
        response = await fetch(jsonImport);
    } catch (e) {
        return;
    }

    if (response.status === 404) {
        return;
    }
    return response;
}

async function importCompendium(jsonImport, forceRefresh) {
    let response = await getFile(jsonImport);

    if(!response){
        console.warn("no content");
        return;
    }

    const content = await response.json();



    const compendiumName = content.name.replace(" ", "-");
    const entity = content.type;

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


    if ('Item' === entity) {
        let items = await SWSEItem.create(content.entries);
        for (let item of items) {
            for(let effect of item.effects){
                for(let link of effect.flags.swse.linkData || []){
                    let groupedEffects = item.effects.filter(effect => effect.flags.swse.group === link.group)
                    groupedEffects.forEach(e => e.addLinks(effect, link.type.toLowerCase()))
                    console.log(effect)
                }
                //delete effect.flags.swse.linkData
            }
            await collection.importDocument(item);
            item.delete();
        }
    } else if ('Actor' === entity) {
        for (let actorData of content.entries) {
            const actor = await processActor(actorData);
            if(!actor){
                continue;
            }
            await collection.importDocument(actor);
            if(actor.warnings && actor.warnings.length > 0){
                console.warn(actor, actor.warnings)
            }


            await actor.delete();
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
    let response;
    try {
        response = await fetch("systems/swse/raw_export/manifest.json");
    } catch (e) {
        return;
    }

    if (response.status === 404) {
        return;
    }
    const content = await response.json();

    for (const file of content.files) {
        await importCompendium(file, forceRefresh);
    }
    console.log("End Generation")
}

Hooks.once('ready', async function () {
    if (document.location.search !== "?test=true") {
        return;
    }
testSuite()
})

//test()

function assertEquals(expected, actual) {
    if (expected === actual) {
        //console.log("passed")
    } else {
        console.warn(`expected "${expected}", but got "${actual}"`)
    }
}

async function testSuite() {
    console.log("GENERATION TESTS")
    //testArchiveDroid();
    //testAerialSurveyDroid();
    //testASPLaborDroid();
    //testBD3000LuxuryDroid();
    //testEldewnandElsaeSarvool();
    //testTeek();
    //testSpecForceMarine();
    testObiWanKenobiJediSpirit();
}

async function getActorRawData(file, unitName) {
    let response = await getFile(file);
    const content = await response.json();
    return content.entries.find(entry=> entry.name === unitName);
}

async function testArchiveDroid() {
    let actorData = await getActorRawData("systems\\swse\\raw_export\\Units-CL-0.json", "A9G-Series Archive Droid")

    let actor = await processActor(actorData);

    assertEquals("A9G-Series Archive Droid", actor.name)

    assertEquals(7, actor.system.health.value)
    assertEquals(7, actor.system.health.max)
    assertEquals(7, actor.system.health.override)

    assertEquals("Manual", actor.system.attributeGenerationType)
    assertEquals("10", actor.system.attributes.str.total)
    assertEquals("11", actor.system.attributes.dex.total)
    assertEquals("-", actor.system.attributes.con.total)
    assertEquals("14", actor.system.attributes.int.total)
    assertEquals("10", actor.system.attributes.wis.total)
    assertEquals("12", actor.system.attributes.cha.total)

    assertEquals("", actor.warnings)

    actor.delete()
}
async function testAerialSurveyDroid() {
    let actorData = await getActorRawData("systems\\swse\\raw_export\\Units-CL-0.json", "AS23 Aerial Survey Droid")

    let actor = await processActor(actorData);

    assertEquals("AS23 Aerial Survey Droid", actor.name)

    assertEquals(3, actor.system.health.value)
    assertEquals(3, actor.system.health.max)
    assertEquals(3, actor.system.health.override)

    assertEquals("Manual", actor.system.attributeGenerationType)
    assertEquals("8", actor.system.attributes.str.total)
    assertEquals("18", actor.system.attributes.dex.total)
    assertEquals("-", actor.system.attributes.con.total)
    assertEquals("12", actor.system.attributes.int.total)
    assertEquals("14", actor.system.attributes.wis.total)
    assertEquals("7", actor.system.attributes.cha.total)

    assertEquals("", actor.warnings)

    actor.delete()
}
async function testASPLaborDroid() {
    let actorData = await getActorRawData("systems\\swse\\raw_export\\Units-CL-0.json", "ASP Labor Droid")

    let actor = await processActor(actorData);

    assertEquals("ASP Labor Droid", actor.name)

    assertEquals(5, actor.system.health.value)
    assertEquals(5, actor.system.health.max)
    assertEquals(5, actor.system.health.override)

    assertEquals("Manual", actor.system.attributeGenerationType)
    assertEquals("17", actor.system.attributes.str.total)
    assertEquals("12", actor.system.attributes.dex.total)
    assertEquals("-", actor.system.attributes.con.total)
    assertEquals("6", actor.system.attributes.int.total)
    assertEquals("11", actor.system.attributes.wis.total)
    assertEquals("5", actor.system.attributes.cha.total)

    assertEquals("<span>Items from General Feats remaining: 1</span>", actor.warnings[0])
    assertEquals(1, actor.warnings.length)

    actor.delete()
}
async function testBD3000LuxuryDroid() {
    let actorData = await getActorRawData("systems\\swse\\raw_export\\Units-CL-0.json", "BD-3000 Luxury Droid")

    let actor = await processActor(actorData);

    assertEquals("BD-3000 Luxury Droid", actor.name)

    assertEquals(2, actor.system.health.value)
    assertEquals(2, actor.system.health.max)
    assertEquals(2, actor.system.health.override)

    assertEquals("Manual", actor.system.attributeGenerationType)
    assertEquals("8", actor.system.attributes.str.total)
    assertEquals("13", actor.system.attributes.dex.total)
    assertEquals("-", actor.system.attributes.con.total)
    assertEquals("12", actor.system.attributes.int.total)
    assertEquals("9", actor.system.attributes.wis.total)
    assertEquals("15", actor.system.attributes.cha.total)

    assertEquals(0, actor.warnings.length)

    actor.delete()
}

async function testEldewnandElsaeSarvool() {
    let actorData = await getActorRawData("systems\\swse\\raw_export\\Units-CL-0.json", "Eldewn and Elsae Sarvool")

    let actor = await processActor(actorData);

    assertEquals("Eldewn and Elsae Sarvool", actor.name)

    assertEquals(20, actor.system.health.value)
    assertEquals(20, actor.system.health.max)
    assertEquals(20, actor.system.health.override)

    assertEquals("Manual", actor.system.attributeGenerationType)
    assertEquals("6", actor.system.attributes.str.total)
    assertEquals("16", actor.system.attributes.dex.total)
    assertEquals("10", actor.system.attributes.con.total)
    assertEquals("12", actor.system.attributes.int.total)
    assertEquals("14", actor.system.attributes.wis.total)
    assertEquals("16", actor.system.attributes.cha.total)

    assertEquals(4, actor.warnings.length)
    if(actor.warnings.length > 0){
        console.warn(actor.warnings)
    }

    actor.delete()
}

async function testTeek() {
    let actorData = await getActorRawData("systems\\swse\\raw_export\\Units-CL-2.json", "Teek (Character)")

    let actor = await processActor(actorData);

    assertEquals("Teek (Character)", actor.name)

    assertEquals(28, actor.system.health.value)
    assertEquals(28, actor.system.health.max)
    assertEquals(28, actor.system.health.override)

    assertEquals("Manual", actor.system.attributeGenerationType)
    assertEquals("13", actor.system.attributes.str.total)
    assertEquals("15", actor.system.attributes.dex.total)
    assertEquals("13", actor.system.attributes.con.total)
    assertEquals("12", actor.system.attributes.int.total)
    assertEquals("12", actor.system.attributes.wis.total)
    assertEquals("9", actor.system.attributes.cha.total)

    assertEquals(0, actor.warnings.length)
    if(actor.warnings.length > 0){
        console.warn(actor.warnings)
    }

    actor.delete()
}

async function testSpecForceMarine() {
    let actorData = await getActorRawData("systems\\swse\\raw_export\\Units-CL-4.json", "SpecForce Marine")

    let actor = await processActor(actorData);

    assertEquals("SpecForce Marine", actor.name)

    assertEquals(41, actor.system.health.value)
    assertEquals(41, actor.system.health.max)
    assertEquals(41, actor.system.health.override)

    assertEquals("Manual", actor.system.attributeGenerationType)
    assertEquals("11", actor.system.attributes.str.total)
    assertEquals("14", actor.system.attributes.dex.total)
    assertEquals("14", actor.system.attributes.con.total)
    assertEquals("9", actor.system.attributes.int.total)
    assertEquals("10", actor.system.attributes.wis.total)
    assertEquals("8", actor.system.attributes.cha.total)

    assertEquals(0, actor.warnings.length)
    if(actor.warnings.length > 0){
        console.warn(actor.warnings)
    }

    actor.delete()
}

async function testObiWanKenobiJediSpirit() {
    let actorData = await getActorRawData("systems\\swse\\raw_export\\Units-CL-0.json", "Obi-Wan Kenobi, Jedi Spirit")

    let actor = await processActor(actorData);

    assertEquals("Obi-Wan Kenobi, Jedi Spirit", actor.name)

    assertEquals(0, actor.system.health.value)
    assertEquals(0, actor.system.health.max)
    assertEquals(0, actor.system.health.override)

    assertEquals("Manual", actor.system.attributeGenerationType)
    assertEquals("-", actor.system.attributes.str.total)
    assertEquals("-", actor.system.attributes.dex.total)
    assertEquals("-", actor.system.attributes.con.total)
    assertEquals("14", actor.system.attributes.int.total)
    assertEquals("15", actor.system.attributes.wis.total)
    assertEquals("16", actor.system.attributes.cha.total)

    assertEquals(0, actor.warnings.length)
    if(actor.warnings.length > 0){
        console.warn(actor.warnings)
    }

    //actor.delete()
}

async function waitForUser(fn) {
    console.log("waiting for user")
    while (!game.model) // define the condition as you like
        await new Promise(resolve => setTimeout(resolve, 1000));

    console.log("done waiting for user")

    // if (!!game.model) {
    //     fn();
    // } else {
    //     setTimeout(() => {
    //         console.log("ping");
    //         waitForUser(fn)
    //     }, 250);
    // }
}