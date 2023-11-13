
// Hooks.once('ready', async function () {
//     if (document.location.search !== "?test=true") {
//         return;
//     }
//     testSuite()
// })

//test()

import {getFile, processActor} from "../../module/compendium/generation.mjs";

export async function generationTests(quench) {
    console.log("GENERATION TESTS")
    quench.registerBatch("compendium.generation.spotChecks",
        (context)=>{
            const { describe, it, assert, expect, should } = context;
            describe("Generation Spot Checks", ()=>{
                // it("Generate CL0 A9G-Series Archive Droid", async () => {
                //     await testArchiveDroid(context);
                // });
                // it("Generate CL0 AS23 Aerial Survey Droid", ()=>{
                //     testAerialSurveyDroid(context);
                // });
                // it("Generate CL0 ASP Labor Droid", ()=>{
                //     testASPLaborDroid(context);
                // });
                // it("Generate CL0 BD-3000 Luxury Droid", ()=>{
                //     testBD3000LuxuryDroid(context);
                // });
                // it("Generate CL0 Eldewn and Elsae Sarvool", ()=>{
                //     testEldewnandElsaeSarvool(context);
                // });
                // it("Generate CL2 Teek (Character)", ()=>{
                //     testTeek(context);
                // });
                // it("Generate CL4 SpecForce Marine", ()=>{
                //     testSpecForceMarine(context);
                // });
                // it("Generate CL0 Obi-Wan Kenobi, Jedi Spirit", ()=>{
                //     testObiWanKenobiJediSpirit(context);
                // });
                // it("Generate CL9 Veteran Imperial Officer", ()=>{
                //     testVeteranImperialOfficer(context);
                // });
                // it("Generate CL15 Leia Organa Solo, Ex-Chief of State", ()=>{
                //     testLeiaOrganaSoloExChiefOfState(context);
                // });

                it("Generate CL20 Luke Skywalker, Grand Master", ()=>{
                    testLukeSkywalkerjedimaster(context);
                });


                // it("Generate Mandalorian Trooper", (context) => {
                //     return verifyActorImport("systems\\swse\\raw_export\\Units-CL-3.json", "Mandalorian Trooper", context, (context, actor) => {
                //
                //         const { describe, it, assert, expect, should } = context;
                //         context.assert(actor.name === "Veteran Imperial Officer")
                //
                //         context.assert(actor.system.health.value === 50)
                //         context.assert(actor.system.health.max === 50)
                //         context.assert(actor.system.health.override === 50)
                //
                //         context.assert(actor.system.attributeGenerationType === "Manual")
                //         context.assert(actor.system.attributes.str.total === 10)
                //         context.assert(actor.system.attributes.dex.total === 8)
                //         context.assert(actor.system.attributes.con.total === 10)
                //         context.assert(actor.system.attributes.int.total === 14)
                //         context.assert(actor.system.attributes.wis.total === 13)
                //         context.assert(actor.system.attributes.cha.total === 14)
                //
                //         context.assert(actor.warnings.length === 0)
                //         if (actor.warnings.length > 0) {
                //             console.warn(actor.warnings)
                //         }
                //     })
                // });
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

    context.assert(actor.name === "A9G-Series Archive Droid")

    context.assert(actor.system.health.value === 7)
    context.assert(actor.system.health.max === 7)
    context.assert(actor.system.health.override === 7)

    context.assert(actor.system.attributeGenerationType === "Manual")
    context.assert(actor.system.attributes.str.total === "10")
    context.assert(actor.system.attributes.dex.total === "11")
    context.assert(actor.system.attributes.con.total === "-")
    context.assert(actor.system.attributes.int.total === "14")
    context.assert(actor.system.attributes.wis.total === "10")
    context.assert(actor.system.attributes.cha.total === "12")

    context.assert(actor.warnings === "")

    actor.delete()
}
async function testAerialSurveyDroid(context) {
    let actorData = await getActorRawData("systems\\swse\\raw_export\\Units-CL-0.json", "AS23 Aerial Survey Droid")

    let actor = await processActor(actorData);

    context.assert(actor.name === "AS23 Aerial Survey Droid")

    context.assert(actor.system.health.value === 3)
    context.assert(actor.system.health.max === 3)
    context.assert(actor.system.health.override === 3)

    context.assert(actor.system.attributeGenerationType === "Manual")
    context.assert(actor.system.attributes.str.total === "8")
    context.assert(actor.system.attributes.dex.total === "18")
    context.assert(actor.system.attributes.con.total === "-")
    context.assert(actor.system.attributes.int.total === "12")
    context.assert(actor.system.attributes.wis.total === "14")
    context.assert(actor.system.attributes.cha.total === "7")

    context.assert(actor.warnings === "")

    actor.delete()
}
async function testASPLaborDroid(context) {
    let actorData = await getActorRawData("systems\\swse\\raw_export\\Units-CL-0.json", "ASP Labor Droid")

    let actor = await processActor(actorData);

    context.assert(actor.name === "ASP Labor Droid")

    context.assert(actor.system.health.value === 5)
    context.assert(actor.system.health.max === 5)
    context.assert(actor.system.health.override === 5)

    context.assert(actor.system.attributeGenerationType === "Manual")
    context.assert(actor.system.attributes.str.total === "17")
    context.assert(actor.system.attributes.dex.total === "12")
    context.assert(actor.system.attributes.con.total === "-")
    context.assert(actor.system.attributes.int.total === "6")
    context.assert(actor.system.attributes.wis.total === "11")
    context.assert(actor.system.attributes.cha.total === "5")

    context.assert(actor.warnings[0] === "<span>Items from General Feats remaining: 1</span>")
    context.assert(actor.warnings.length === 1)

    actor.delete()
}
async function testBD3000LuxuryDroid(context) {
    let actorData = await getActorRawData("systems\\swse\\raw_export\\Units-CL-0.json", "BD-3000 Luxury Droid")

    let actor = await processActor(actorData);

    context.assert(actor.name === "BD-3000 Luxury Droid")

    context.assert(actor.system.health.value === 2)
    context.assert(actor.system.health.max === 2)
    context.assert(actor.system.health.override === 2)

    context.assert(actor.system.attributeGenerationType === "Manual")
    context.assert(actor.system.attributes.str.total === "8")
    context.assert(actor.system.attributes.dex.total === "13")
    context.assert(actor.system.attributes.con.total === "-")
    context.assert(actor.system.attributes.int.total === "12")
    context.assert(actor.system.attributes.wis.total === "9")
    context.assert(actor.system.attributes.cha.total === "15")

    context.assert(actor.warnings.length === 0)

    actor.delete()
}

async function testEldewnandElsaeSarvool(context) {
    let actorData = await getActorRawData("systems\\swse\\raw_export\\Units-CL-0.json", "Eldewn and Elsae Sarvool")

    let actor = await processActor(actorData);

    context.assert(actor.name === "Eldewn and Elsae Sarvool")

    context.assert(actor.system.health.value === 20)
    context.assert(actor.system.health.max === 20)
    context.assert(actor.system.health.override === 20)

    context.assert(actor.system.attributeGenerationType === "Manual")
    context.assert(actor.system.attributes.str.total === "6")
    context.assert(actor.system.attributes.dex.total === "16")
    context.assert(actor.system.attributes.con.total === "10")
    context.assert(actor.system.attributes.int.total === "12")
    context.assert(actor.system.attributes.wis.total === "14")
    context.assert(actor.system.attributes.cha.total === "16")

    context.assert(actor.warnings.length === 4)
    if(actor.warnings.length > 0){
        console.warn(actor.warnings)
    }

    actor.delete()
}

async function testTeek(context) {
    let actorData = await getActorRawData("systems\\swse\\raw_export\\Units-CL-2.json", "Teek (Character)")

    let actor = await processActor(actorData);

    context.assert(actor.name === "Teek (Character)")

    context.assert(actor.system.health.value === 28)
    context.assert(actor.system.health.max === 28)
    context.assert(actor.system.health.override === 28)

    context.assert(actor.system.attributeGenerationType === "Manual")
    context.assert(actor.system.attributes.str.total === "13")
    context.assert(actor.system.attributes.dex.total === "15")
    context.assert(actor.system.attributes.con.total === "13")
    context.assert(actor.system.attributes.int.total === "12")
    context.assert(actor.system.attributes.wis.total === "12")
    context.assert(actor.system.attributes.cha.total === "9")

    context.assert(actor.warnings.length === 0)
    if(actor.warnings.length > 0){
        console.warn(actor.warnings)
    }

    actor.delete()
}

async function testSpecForceMarine(context) {
    let actorData = await getActorRawData("systems\\swse\\raw_export\\Units-CL-4.json", "SpecForce Marine")

    let actor = await processActor(actorData);

    context.assert(actor.name === "SpecForce Marine")

    context.assert(actor.system.health.value === 41)
    context.assert(actor.system.health.max === 41)
    context.assert(actor.system.health.override === 41)

    context.assert(actor.system.attributeGenerationType === "Manual")
    context.assert(actor.system.attributes.str.total === "11")
    context.assert(actor.system.attributes.dex.total === "14")
    context.assert(actor.system.attributes.con.total === "14")
    context.assert(actor.system.attributes.int.total === "9")
    context.assert(actor.system.attributes.wis.total === "10")
    context.assert(actor.system.attributes.cha.total === "8")

    context.assert(actor.warnings.length === 0)
    if(actor.warnings.length > 0){
        console.warn(actor.warnings)
    }

    actor.delete()
}

async function testVeteranImperialOfficer(context) {
    let actorData = await getActorRawData("systems\\swse\\raw_export\\Units-CL-9.json", "Veteran Imperial Officer")

    let actor = await processActor(actorData);

    context.assert(actor.name === "Veteran Imperial Officer")

    context.assert(actor.system.health.value === 50)
    context.assert(actor.system.health.max === 50)
    context.assert(actor.system.health.override === 50)

    context.assert(actor.system.attributeGenerationType === "Manual")
    context.assert(actor.system.attributes.str.total === 10)
    context.assert(actor.system.attributes.dex.total === 8)
    context.assert(actor.system.attributes.con.total === 10)
    context.assert(actor.system.attributes.int.total === 14)
    context.assert(actor.system.attributes.wis.total === 13)
    context.assert(actor.system.attributes.cha.total === 14)

    context.assert(actor.warnings.length === 0)
    if(actor.warnings.length > 0){
        console.warn(actor.warnings)
    }

    actor.delete()
}

async function testLeiaOrganaSoloExChiefOfState(context) {
    let actorData = await getActorRawData("systems\\swse\\raw_export\\Units-CL-15.json", "Leia Organa Solo, Ex-Chief of State")

    let actor = await processActor(actorData);

    context.assert(actor.name === "Veteran Imperial Officer")

    context.assert(actor.system.health.value === 50)
    context.assert(actor.system.health.max === 50)
    context.assert(actor.system.health.override === 50)

    context.assert(actor.system.attributeGenerationType === "Manual")
    context.assert(actor.system.attributes.str.total === 10)
    context.assert(actor.system.attributes.dex.total === 8)
    context.assert(actor.system.attributes.con.total === 10)
    context.assert(actor.system.attributes.int.total === 14)
    context.assert(actor.system.attributes.wis.total === 13)
    context.assert(actor.system.attributes.cha.total === 14)

    context.assert(actor.warnings.length === 0)
    if(actor.warnings.length > 0){
        console.warn(actor.warnings)
    }

    actor.delete()
}
async function testLukeSkywalkerjedimaster(context) {
    let actorData = await getActorRawData("systems\\swse\\raw_export\\Units-CL-20.json", "Luke Skywalker, Grand Master")

    let actor = await processActor(actorData);

    context.assert(actor.name === "Veteran Imperial Officer")

    context.assert(actor.system.health.value === 50)
    context.assert(actor.system.health.max === 50)
    context.assert(actor.system.health.override === 50)

    context.assert(actor.system.attributeGenerationType === "Manual")
    context.assert(actor.system.attributes.str.total === 10)
    context.assert(actor.system.attributes.dex.total === 8)
    context.assert(actor.system.attributes.con.total === 10)
    context.assert(actor.system.attributes.int.total === 14)
    context.assert(actor.system.attributes.wis.total === 13)
    context.assert(actor.system.attributes.cha.total === 14)

    context.assert(actor.warnings.length === 0)
    if(actor.warnings.length > 0){
        console.warn(actor.warnings)
    }

    actor.delete()
}

async function validate(file, unitName, validationFunction, context) {
    let actorData = await getActorRawData(file, unitName)

    let actor = await processActor(actorData);

    try {
        await validationFunction(context, actor)
    } finally {
        actor.delete()
    }
}

function verifyActorImport(file, unitName, context, validationFunction) {
    return validate(file, unitName, validationFunction, context);
}

async function testObiWanKenobiJediSpirit(context) {
    let actorData = await getActorRawData("systems\\swse\\raw_export\\Units-CL-0.json", "Obi-Wan Kenobi, Jedi Spirit")

    let actor = await processActor(actorData);

    context.assert(actor.name === "Obi-Wan Kenobi, Jedi Spirit")

    context.assert(actor.system.health.value === 0)
    context.assert(actor.system.health.max === 0)
    context.assert(actor.system.health.override === 0)

    context.assert(actor.system.attributeGenerationType === "Manual")
    context.assert(actor.system.attributes.str.total === "-")
    context.assert(actor.system.attributes.dex.total === "-")
    context.assert(actor.system.attributes.con.total === "-")
    context.assert(actor.system.attributes.int.total === "14")
    context.assert(actor.system.attributes.wis.total === "15")
    context.assert(actor.system.attributes.cha.total === "16")

    context.assert(actor.warnings.length === 0)
    if(actor.warnings.length > 0){
        console.warn(actor.warnings)
    }

    actor.delete()
}