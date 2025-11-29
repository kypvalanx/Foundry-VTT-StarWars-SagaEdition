import {getMockEvent, withTestActor} from "./actor-utils.mjs";

export async function featMulticlassTests(quench) {
    quench.registerBatch("actor.actor-sheet.feats-multiclass-starting-feats",
        (context) => {
            const {describe, it, assert, expect, should} = context;
            
            describe("actor.actor-sheet.feats", ()=>{
                describe("Multiclass Feat Adding", async () => {
                    it("should be able to add a multiclass starting feat without using any general feats", async () => {
                        await withTestActor(async (actor) => {
                            await actor.sheet._onDropItem(getMockEvent(), {name: "Human", type: "species", answers: ["Human (Default)"]})
                            await actor.sheet._onDropItem(getMockEvent(), {name: "Soldier", type: "class"})
                            await actor.sheet._onDropItem(getMockEvent(), {name: "Toughness", type: "feat"})

                            console.log(actor.availableItems)

                            await actor.sheet._onDropItem(getMockEvent(), {name: "Jedi", type: "class", answers: ["Force Sensitivity"]})

                        })
                    })
                    it("should do anything", ()=>{})


                });

            })
        })}