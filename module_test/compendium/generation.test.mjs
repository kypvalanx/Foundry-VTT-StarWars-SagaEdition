
// Hooks.once('ready', async function () {
//     if (document.location.search !== "?test=true") {
//         return;
//     }
//     testSuite()
// })

//test()

import {getFile, processActor} from "../../module/compendium/generation.mjs";

function assertEquals(context, expected, actual) {
    const { describe, it, assert, expect, should } = context;
    expect(actual).to.equal(expected)
}

export function generationTests(quench) {
    console.log("GENERATION TESTS")
    quench.registerBatch("compendium.generation.spotChecks",
        (context)=>{
            const { describe, it, assert, expect, should } = context;
            describe("Generation Spot Checks", ()=>{
                it("Generate CL0 A9G-Series Archive Droid", ()=>{
                    try{
                        testArchiveDroid(context);
                    }catch (e){
                        assert.fail()
                    }
                });
                it("Generate CL0 AS23 Aerial Survey Droid", ()=>{
                    testAerialSurveyDroid(context);
                });
                it("Generate CL0 ASP Labor Droid", ()=>{
                    testASPLaborDroid(context);
                });
                it("Generate CL0 BD-3000 Luxury Droid", ()=>{
                    testBD3000LuxuryDroid(context);
                });
                it("Generate CL0 Eldewn and Elsae Sarvool", ()=>{
                    testEldewnandElsaeSarvool(context);
                });
                it("Generate CL2 Teek (Character)", ()=>{
                    testTeek(context);
                });
                it("Generate CL4 SpecForce Marine", ()=>{
                    testSpecForceMarine(context);
                });
                it("Generate CL0 Obi-Wan Kenobi, Jedi Spirit", ()=>{
                    testObiWanKenobiJediSpirit(context);
                });
                it("Generate CL9 Veteran Imperial Officer", ()=>{
                    testVeteranImperialOfficer(context);
                });
            })
        },
        {displayName: "GENERATION: ACTOR SPOT CHECKS"})
}

async function getActorRawData(file, unitName) {
    let response = await getFile(file);
    const content = await response.json();
    return content.entries.find(entry=> entry.name === unitName);
}

async function testArchiveDroid(context) {
    let actorData = await getActorRawData("systems\\swse\\raw_export\\Units-CL-0.json", "A9G-Series Archive Droid")

    let actor = await processActor(actorData);

    assertEquals( context, "A9G-Series Archive Droid", actor.name)

    assertEquals( context, 7, actor.system.health.value)
    assertEquals( context, 7, actor.system.health.max)
    assertEquals( context, 7, actor.system.health.override)

    assertEquals( context, "Manual", actor.system.attributeGenerationType)
    assertEquals( context, "10", actor.system.attributes.str.total)
    assertEquals( context, "11", actor.system.attributes.dex.total)
    assertEquals( context, "-", actor.system.attributes.con.total)
    assertEquals( context, "14", actor.system.attributes.int.total)
    assertEquals( context, "10", actor.system.attributes.wis.total)
    assertEquals( context, "12", actor.system.attributes.cha.total)

    assertEquals( context, "", actor.warnings)

    actor.delete()
}
async function testAerialSurveyDroid(context) {
    let actorData = await getActorRawData("systems\\swse\\raw_export\\Units-CL-0.json", "AS23 Aerial Survey Droid")

    let actor = await processActor(actorData);

    assertEquals( context, "AS23 Aerial Survey Droid", actor.name)

    assertEquals( context, 3, actor.system.health.value)
    assertEquals( context, 3, actor.system.health.max)
    assertEquals( context, 3, actor.system.health.override)

    assertEquals( context, "Manual", actor.system.attributeGenerationType)
    assertEquals( context, "8", actor.system.attributes.str.total)
    assertEquals( context, "18", actor.system.attributes.dex.total)
    assertEquals( context, "-", actor.system.attributes.con.total)
    assertEquals( context, "12", actor.system.attributes.int.total)
    assertEquals( context, "14", actor.system.attributes.wis.total)
    assertEquals( context, "7", actor.system.attributes.cha.total)

    assertEquals( context, "", actor.warnings)

    actor.delete()
}
async function testASPLaborDroid(context) {
    let actorData = await getActorRawData("systems\\swse\\raw_export\\Units-CL-0.json", "ASP Labor Droid")

    let actor = await processActor(actorData);

    assertEquals( context, "ASP Labor Droid", actor.name)

    assertEquals( context, 5, actor.system.health.value)
    assertEquals( context, 5, actor.system.health.max)
    assertEquals( context, 5, actor.system.health.override)

    assertEquals( context, "Manual", actor.system.attributeGenerationType)
    assertEquals( context, "17", actor.system.attributes.str.total)
    assertEquals( context, "12", actor.system.attributes.dex.total)
    assertEquals( context, "-", actor.system.attributes.con.total)
    assertEquals( context, "6", actor.system.attributes.int.total)
    assertEquals( context, "11", actor.system.attributes.wis.total)
    assertEquals( context, "5", actor.system.attributes.cha.total)

    assertEquals( context, "<span>Items from General Feats remaining: 1</span>", actor.warnings[0])
    assertEquals( context, 1, actor.warnings.length)

    actor.delete()
}
async function testBD3000LuxuryDroid(context) {
    let actorData = await getActorRawData("systems\\swse\\raw_export\\Units-CL-0.json", "BD-3000 Luxury Droid")

    let actor = await processActor(actorData);

    assertEquals( context, "BD-3000 Luxury Droid", actor.name)

    assertEquals( context, 2, actor.system.health.value)
    assertEquals( context, 2, actor.system.health.max)
    assertEquals( context, 2, actor.system.health.override)

    assertEquals( context, "Manual", actor.system.attributeGenerationType)
    assertEquals( context, "8", actor.system.attributes.str.total)
    assertEquals( context, "13", actor.system.attributes.dex.total)
    assertEquals( context, "-", actor.system.attributes.con.total)
    assertEquals( context, "12", actor.system.attributes.int.total)
    assertEquals( context, "9", actor.system.attributes.wis.total)
    assertEquals( context, "15", actor.system.attributes.cha.total)

    assertEquals( context, 0, actor.warnings.length)

    actor.delete()
}

async function testEldewnandElsaeSarvool(context) {
    let actorData = await getActorRawData("systems\\swse\\raw_export\\Units-CL-0.json", "Eldewn and Elsae Sarvool")

    let actor = await processActor(actorData);

    assertEquals( context, "Eldewn and Elsae Sarvool", actor.name)

    assertEquals( context, 20, actor.system.health.value)
    assertEquals( context, 20, actor.system.health.max)
    assertEquals( context, 20, actor.system.health.override)

    assertEquals( context, "Manual", actor.system.attributeGenerationType)
    assertEquals( context, "6", actor.system.attributes.str.total)
    assertEquals( context, "16", actor.system.attributes.dex.total)
    assertEquals( context, "10", actor.system.attributes.con.total)
    assertEquals( context, "12", actor.system.attributes.int.total)
    assertEquals( context, "14", actor.system.attributes.wis.total)
    assertEquals( context, "16", actor.system.attributes.cha.total)

    assertEquals( context, 4, actor.warnings.length)
    if(actor.warnings.length > 0){
        console.warn(actor.warnings)
    }

    actor.delete()
}

async function testTeek(context) {
    let actorData = await getActorRawData("systems\\swse\\raw_export\\Units-CL-2.json", "Teek (Character)")

    let actor = await processActor(actorData);

    assertEquals( context, "Teek (Character)", actor.name)

    assertEquals( context, 28, actor.system.health.value)
    assertEquals( context, 28, actor.system.health.max)
    assertEquals( context, 28, actor.system.health.override)

    assertEquals( context, "Manual", actor.system.attributeGenerationType)
    assertEquals( context, "13", actor.system.attributes.str.total)
    assertEquals( context, "15", actor.system.attributes.dex.total)
    assertEquals( context, "13", actor.system.attributes.con.total)
    assertEquals( context, "12", actor.system.attributes.int.total)
    assertEquals( context, "12", actor.system.attributes.wis.total)
    assertEquals( context, "9", actor.system.attributes.cha.total)

    assertEquals( context, 0, actor.warnings.length)
    if(actor.warnings.length > 0){
        console.warn(actor.warnings)
    }

    actor.delete()
}

async function testSpecForceMarine(context) {
    let actorData = await getActorRawData("systems\\swse\\raw_export\\Units-CL-4.json", "SpecForce Marine")

    let actor = await processActor(actorData);

    assertEquals( context, "SpecForce Marine", actor.name)

    assertEquals( context, 41, actor.system.health.value)
    assertEquals( context, 41, actor.system.health.max)
    assertEquals( context, 41, actor.system.health.override)

    assertEquals( context, "Manual", actor.system.attributeGenerationType)
    assertEquals( context, "11", actor.system.attributes.str.total)
    assertEquals( context, "14", actor.system.attributes.dex.total)
    assertEquals( context, "14", actor.system.attributes.con.total)
    assertEquals( context, "9", actor.system.attributes.int.total)
    assertEquals( context, "10", actor.system.attributes.wis.total)
    assertEquals( context, "8", actor.system.attributes.cha.total)

    assertEquals( context, 0, actor.warnings.length)
    if(actor.warnings.length > 0){
        console.warn(actor.warnings)
    }

    actor.delete()
}

async function testVeteranImperialOfficer(context) {
    let actorData = await getActorRawData("systems\\swse\\raw_export\\Units-CL-9.json", "Veteran Imperial Officer")

    let actor = await processActor(actorData);

    assertEquals( context, "Veteran Imperial Officer", actor.name)

    assertEquals( context, 50, actor.system.health.value)
    assertEquals( context, 50, actor.system.health.max)
    assertEquals( context, 50, actor.system.health.override)

    assertEquals( context, "Manual", actor.system.attributeGenerationType)
    assertEquals( context, 10, actor.system.attributes.str.total)
    assertEquals( context, 8, actor.system.attributes.dex.total)
    assertEquals( context, 10, actor.system.attributes.con.total)
    assertEquals( context, 14, actor.system.attributes.int.total)
    assertEquals( context, 13, actor.system.attributes.wis.total)
    assertEquals( context, 14, actor.system.attributes.cha.total)

    assertEquals( context, 0, actor.warnings.length)
    if(actor.warnings.length > 0){
        console.warn(actor.warnings)
    }

    actor.delete()
}

async function testObiWanKenobiJediSpirit(context) {
    let actorData = await getActorRawData("systems\\swse\\raw_export\\Units-CL-0.json", "Obi-Wan Kenobi, Jedi Spirit")

    let actor = await processActor(actorData);

    assertEquals( context, "Obi-Wan Kenobi, Jedi Spirit", actor.name)

    assertEquals( context, 0, actor.system.health.value)
    assertEquals( context, 0, actor.system.health.max)
    assertEquals( context, 0, actor.system.health.override)

    assertEquals( context, "Manual", actor.system.attributeGenerationType)
    assertEquals( context, "-", actor.system.attributes.str.total)
    assertEquals( context, "-", actor.system.attributes.dex.total)
    assertEquals( context, "-", actor.system.attributes.con.total)
    assertEquals( context, "14", actor.system.attributes.int.total)
    assertEquals( context, "15", actor.system.attributes.wis.total)
    assertEquals( context, "16", actor.system.attributes.cha.total)

    assertEquals( context, 0, actor.warnings.length)
    if(actor.warnings.length > 0){
        console.warn(actor.warnings)
    }

    actor.delete()
}