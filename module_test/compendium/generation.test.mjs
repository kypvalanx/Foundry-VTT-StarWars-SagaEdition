
// Hooks.once('ready', async function () {
//     if (document.location.search !== "?test=true") {
//         return;
//     }
//     testSuite()
// })

//test()

import {getFile, processActor, processItem} from "../../module/compendium/generation.mjs";
import {getResolvedSize} from "../../module/attribute-helper.mjs";
import {sizeArray} from "../../module/common/constants.mjs";

function assertAbilityScores(assert, actor, str, dex, con, int, wis, cha) {
    assert.equal(actor.system.attributeGenerationType, "Manual")
    const attributes = actor.attributes;
    assert.equal(attributes.str.total, str)
    assert.equal(attributes.dex.total, dex)
    assert.equal(attributes.con.total, con)
    assert.equal(attributes.int.total, int)
    assert.equal(attributes.wis.total, wis)
    assert.equal(attributes.cha.total, cha)
}

function assertEquippedItems(assert, actor, expectedItems) {
    let items = actor.equipped.map(i => i.name)
    assert.equal(items.length, expectedItems.length, `expected ${expectedItems.toString()}, actual ${items.toString()}`)
    for (let item of expectedItems) {
        assert.ok(items.includes(item), `couldn't find ${item}`)
    }
}

export async function generationTests(quench) {

    quench.registerBatch("compendium.generation.actors",
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


                it("Generate Rancor Correctly", async function() {
                    this.timeout(10000)
                    let actorData = await getEntityRawData("systems/swse/module_test/resources/rancor.json", "Rancor")

                    let actor = await processActor(actorData);
                    actor.cacheDisabled = true

                    assert.equal(actor.name, "Rancor")

                    assert.equal(actor.system.health.value, 138, "health")
                    assert.equal(actor.system.health.max, 138)
                    assert.equal(actor.system.health.override, 138)

                    assert.equal(actor.defense.fortitude.total, 16)
                    assert.equal(actor.defense.reflex.total, 17, "reflex")
                    assert.equal(actor.defense.will.total, 8)
                    assert.equal(actor.defense.damageThreshold.total, 26, "damage threshold")

                    assert.equal(actor.system.attributeGenerationType, "Manual")
                    assert.equal(actor.system.attributes.str.total, 26)
                    assert.equal(actor.system.attributes.dex.total, 9)
                    assert.equal(actor.system.attributes.con.total, 23)
                    assert.equal(actor.system.attributes.int.total, 2)
                    assert.equal(actor.system.attributes.wis.total, 7)
                    assert.equal(actor.system.attributes.cha.total, 15)

                    actor.delete()
                })

                it("Generate B2-GR-Series Super Battle Droid Correctly", async function() {
                    this.timeout(10000)
                    this.cacheDisabled = true
                    let actorData = await getEntityRawData("systems/swse/module_test/resources/B2-GR-Series_Super_Battle_Droid.json", "B2-GR-Series Super Battle Droid")

                    let actor = await processActor(actorData);

                    assert.equal(actor.name, "B2-GR-Series Super Battle Droid")

                    assert.equal(sizeArray[getResolvedSize(actor)], "Large")

                    assert.equal(actor.system.health.value, 42, "health")
                    assert.equal(actor.system.health.max, 42)
                    assert.equal(actor.system.health.override, 42)

                    assert.equal(actor.defense.fortitude.total, 18)
                    assert.equal(actor.defense.reflex.total, 19, "reflex")
                    assert.equal(actor.defense.will.total, 13)
                    assert.equal(actor.defense.damageThreshold.total, 23, "damage threshold")

                    assert.equal(actor.system.attributeGenerationType, "Manual")
                    assert.equal(actor.system.attributes.str.total, 20)
                    assert.equal(actor.system.attributes.dex.total, 14)
                    assert.equal(actor.system.attributes.con.total, 10)
                    assert.equal(actor.system.attributes.int.total, 10)
                    assert.equal(actor.system.attributes.wis.total, 14)
                    assert.equal(actor.system.attributes.cha.total, 6)

                    assert.includeMembers(actor.items.map(i => i.name), ['Quadanium Plating'])

                    actor.delete()
                })
            });
        },
        {displayName: "GENERATION: ACTOR SPOT CHECKS"});

    quench.registerBatch("compendium.generation.species",
        (context)=>{
            const { describe, it, assert, expect, should } = context;
            describe("Species Verification", ()=>{
                it("Generate Human Species Correctly", async ()=>{
                    let itemData = await getEntityRawData("systems/swse/module_test/resources/Human.json", "Human")

                    let item = await processItem(itemData);

                    assert.equal(item.name, "Human")

                    item.delete();
                })
            });
        },
        {displayName: "GENERATION: SPECIES"})
}

export async function getEntityRawData(file, unitName) {
    let response = await getFile(file);
    const content = await response.json();
    return content.entries.find(entry=> entry.name === unitName);
}

async function testArchiveDroid(context) {
    let actorData = await getEntityRawData("systems\\swse\\raw_export\\Units-CL-0.json", "A9G-Series Archive Droid")

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
    let actorData = await getEntityRawData("systems\\swse\\raw_export\\Units-CL-0.json", "AS23 Aerial Survey Droid")

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
    let actorData = await getEntityRawData("systems\\swse\\raw_export\\Units-CL-0.json", "ASP Labor Droid")

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
    let actorData = await getEntityRawData("systems\\swse\\raw_export\\Units-CL-0.json", "BD-3000 Luxury Droid")

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
    let actorData = await getEntityRawData("systems\\swse\\raw_export\\Units-CL-0.json", "Eldewn and Elsae Sarvool")

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
    let actorData = await getEntityRawData("systems\\swse\\raw_export\\Units-CL-2.json", "Teek (Character)")

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
    let actorData = await getEntityRawData("systems\\swse\\raw_export\\B2-GR-Series_Super_Battle_Droid.json", "SpecForce Marine")

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
    let actorData = await getEntityRawData("systems\\swse\\raw_export\\Units-CL-9.json", "Veteran Imperial Officer")

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
    let actorData = await getEntityRawData("systems\\swse\\raw_export\\Units-CL-15.json", "Leia Organa Solo, Ex-Chief of State")

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
async function validate(file, unitName,context, validationFunction) {
    let actorData = await getEntityRawData(file, unitName)

    let actor = await processActor(actorData);

    try {
        await validationFunction(context, actor)
    } finally {
        actor.delete()
    }
}

function verifyActorImport(file, unitName, context, validationFunction) {
    return validate(file, unitName, context, validationFunction);
}

async function testObiWanKenobiJediSpirit(context) {
    let actorData = await getEntityRawData("systems\\swse\\raw_export\\Units-CL-0.json", "Obi-Wan Kenobi, Jedi Spirit")

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