import {getMockEvent, withTestActor} from "./actor-utils.mjs";


export async function keywordLightsaberDamageStatTests(quench) {
    quench.registerBatch("actor.actor-sheet.keyword.lightsaberdamagestat",
        (context) => {

            const {describe, it, assert, expect, should} = context;
            
            describe("actor.actor-sheet.keyword", ()=>{
                describe("Ataru", async () => {
                    it("should switch the damage stat for lightsabers to dex", async () => {
                        await withTestActor(async (actor) => {
                            actor.suppressDialog = true
                            await actor.sheet._onDropItem(getMockEvent(), {name: "Human", type: "species", answers: ["Human (Default)"]})
                            await actor.sheet._onDropItem(getMockEvent(), {name: "Jedi", type: "class"})
                            await actor.sheet._onDropItem(getMockEvent(), {name: "Jedi", type: "class"})
                            await actor.sheet._onDropItem(getMockEvent(), {name: "Jedi", type: "class"})
                            await actor.sheet._onDropItem(getMockEvent(), {name: "Jedi", type: "class"})
                            await actor.sheet._onDropItem(getMockEvent(), {name: "Jedi", type: "class"})
                            await actor.sheet._onDropItem(getMockEvent(), {name: "Jedi", type: "class"})
                            await actor.sheet._onDropItem(getMockEvent(), {name: "Jedi", type: "class"})

                            const update = {};
                            update[`system.skills.Use the Force.trained`] = true;
                            update[`system.abilities.dex.base`] = 16;
                            await actor.safeUpdate(update);

                            await actor.sheet._onDropItem(getMockEvent(), {name: "Jedi Knight", type: "class"})
                            await actor.sheet._onDropItem(getMockEvent(), {name: "Ataru", type: "talent"})
                            await actor.sheet._onDropItem(getMockEvent(), {name: "Lightsaber", type: "item", equip: "equipped", answers: ["Ilum Crystal"]})

                            actor.prepareData();
                            let rollResult = actor.attack.attacks.find(t => t.weaponId !== "Unarmed Attack").damageRoll

                            assert.equal(rollResult._formula, "2d8 + 4[Half Heroic Level] + 3[Attribute Modifier]");
                        })
                    })
                    it("should do anything", ()=>{})


                });

            })
        })}