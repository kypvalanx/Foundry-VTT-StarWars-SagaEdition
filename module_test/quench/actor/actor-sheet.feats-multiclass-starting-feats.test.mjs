import {getMockEvent, withTestActor} from "./actor-utils.mjs";

export async function featMulticlassTests(quench) {
    quench.registerBatch("actor.classes",
        (context) => {
            const {describe, it, assert, expect, should} = context;
            
            describe("Classes", ()=>{
                describe("Multiclassing", async () => {
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

                describe("Adding a class", async () =>{
                    it("soldier class should add available items based on level added", async () =>{
                        await withTestActor(async (actor) => {
                            assert.equal(1, actor.availableItems["General Feats"])

                            await actor.sheet._onDropItem(getMockEvent(), {name: "Soldier", type: "class"})
                            assert.equal(1, actor.availableItems["Soldier Talent Trees"])

                            await actor.sheet._onDropItem(getMockEvent(), {name: "Soldier", type: "class"})

                            assert.equal(1, actor.availableItems["Soldier Bonus Feats"])
                            //console.log(actor.availableItems)
                        })
                    })
                    it("scoundrel class should add available items based on level added", async () =>{
                        await withTestActor(async (actor) => {
                            assert.equal(1, actor.availableItems["General Feats"])

                            await actor.sheet._onDropItem(getMockEvent(), {name: "Scoundrel", type: "class"})
                            assert.equal(1, actor.availableItems["Scoundrel Talent Trees"])

                            await actor.sheet._onDropItem(getMockEvent(), {name: "Scoundrel", type: "class"})

                            assert.equal(1, actor.availableItems["Scoundrel Bonus Feats"])

                            await actor.sheet._onDropItem(getMockEvent(), {name: "Scoundrel", type: "class"})
                            assert.equal(2, actor.availableItems["Scoundrel Talent Trees"])

                            await actor.sheet._onDropItem(getMockEvent(), {name: "Scoundrel", type: "class"})

                            assert.equal(2, actor.availableItems["Scoundrel Bonus Feats"])

                            await actor.sheet._onDropItem(getMockEvent(), {name: "Scoundrel", type: "class"})
                            assert.equal(3, actor.availableItems["Scoundrel Talent Trees"])

                            await actor.sheet._onDropItem(getMockEvent(), {name: "Scoundrel", type: "class"})

                            assert.equal(3, actor.availableItems["Scoundrel Bonus Feats"])

                            await actor.sheet._onDropItem(getMockEvent(), {name: "Scoundrel", type: "class"})
                            assert.equal(4, actor.availableItems["Scoundrel Talent Trees"])

                            await actor.sheet._onDropItem(getMockEvent(), {name: "Scoundrel", type: "class"})

                            assert.equal(4, actor.availableItems["Scoundrel Bonus Feats"])

                            await actor.sheet._onDropItem(getMockEvent(), {name: "Scoundrel", type: "class"})
                            assert.equal(5, actor.availableItems["Scoundrel Talent Trees"])

                            await actor.sheet._onDropItem(getMockEvent(), {name: "Scoundrel", type: "class"})

                            assert.equal(5, actor.availableItems["Scoundrel Bonus Feats"])

                            await actor.sheet._onDropItem(getMockEvent(), {name: "Scoundrel", type: "class"})
                            assert.equal(6, actor.availableItems["Scoundrel Talent Trees"])

                            await actor.sheet._onDropItem(getMockEvent(), {name: "Scoundrel", type: "class"})

                            assert.equal(6, actor.availableItems["Scoundrel Bonus Feats"])

                            await actor.sheet._onDropItem(getMockEvent(), {name: "Scoundrel", type: "class"})
                            assert.equal(7, actor.availableItems["Scoundrel Talent Trees"])

                            await actor.sheet._onDropItem(getMockEvent(), {name: "Scoundrel", type: "class"})

                            assert.equal(7, actor.availableItems["Scoundrel Bonus Feats"])

                            await actor.sheet._onDropItem(getMockEvent(), {name: "Scoundrel", type: "class"})
                            assert.equal(8, actor.availableItems["Scoundrel Talent Trees"])

                            await actor.sheet._onDropItem(getMockEvent(), {name: "Scoundrel", type: "class"})

                            assert.equal(8, actor.availableItems["Scoundrel Bonus Feats"])

                            await actor.sheet._onDropItem(getMockEvent(), {name: "Scoundrel", type: "class"})
                            assert.equal(9, actor.availableItems["Scoundrel Talent Trees"])

                            await actor.sheet._onDropItem(getMockEvent(), {name: "Scoundrel", type: "class"})

                            assert.equal(9, actor.availableItems["Scoundrel Bonus Feats"])

                            await actor.sheet._onDropItem(getMockEvent(), {name: "Scoundrel", type: "class"})
                            assert.equal(10, actor.availableItems["Scoundrel Talent Trees"])

                            await actor.sheet._onDropItem(getMockEvent(), {name: "Scoundrel", type: "class"})

                            assert.equal(10, actor.availableItems["Scoundrel Bonus Feats"])
                            //console.log(actor.availableItems)
                        })
                    })
                })
            })
        })}