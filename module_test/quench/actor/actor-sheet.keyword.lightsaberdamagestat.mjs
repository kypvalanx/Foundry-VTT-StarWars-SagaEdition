import {getMockEvent, withTestActor} from "./actor-utils.mjs";


export async function actorsheetTalentTests(quench) {
    quench.registerBatch("actor.actor-sheet.talents",
        (context) => {

            const {describe, it, assert, expect, should} = context;
            
            describe("actor.actor-sheet.talents", ()=>{
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

                            //actor.prepareData();
                            let rollResult = actor.attack.attacks.find(t => t.weaponId !== "Unarmed Attack").damageRoll

                            assert.equal(rollResult._formula, "2d8 + 4[Half Heroic Level] + 3[Attribute Modifier]");
                        })
                    })
                    it("should do anything", ()=>{})


                });

            })

            describe("actor.actor-sheet.classes", ()=>{
                describe("Force Adept", async () => {
                    it("should allow adding class", async () => {
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
                            await actor.sheet._onDropItem(getMockEvent(), {name: "Disciplined Strike", type: "talent"})
                            await actor.sheet._onDropItem(getMockEvent(), {name: "Telekinetic Power", type: "talent"})
                            await actor.sheet._onDropItem(getMockEvent(), {name: "Telekinetic Savant", type: "talent"})

                            const update = {};
                            update[`system.skills.Use the Force.trained`] = true;
                            //update[`system.abilities.dex.base`] = 16;
                            await actor.safeUpdate(update);

                            await actor.sheet._onDropItem(getMockEvent(), {name: "Force Adept", type: "class"})

                        })
                    })
                    it("should do anything", ()=>{})


                });

            })
        })}