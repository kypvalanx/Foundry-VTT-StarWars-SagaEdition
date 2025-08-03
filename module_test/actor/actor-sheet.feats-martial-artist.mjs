import {getMockEvent, withTestActor} from "./actor-utils.mjs";


export async function featTests(quench) {
    quench.registerBatch("actor.actor-sheet.feats",
        (context) => {

            const {describe, it, assert, expect, should} = context;
            
            describe("actor.actor-sheet.feats", ()=>{
                describe("Martial Arts Feats", async () => {
                    it("should adjust the unarmed damage die correctly when Martial Arts I is added", async () => {
                        await withTestActor(async (actor) => {
                            actor.suppressDialog = true
                            await actor.sheet._onDropItem(getMockEvent(), {name: "Human", type: "species", answers: ["Human (Default)"]})
                            await actor.sheet._onDropItem(getMockEvent(), {name: "Soldier", type: "class"})
                            await actor.sheet._onDropItem(getMockEvent(), {name: "Soldier", type: "class"})
                            await actor.sheet._onDropItem(getMockEvent(), {name: "Soldier", type: "class"})
                            await actor.sheet._onDropItem(getMockEvent(), {name: "Soldier", type: "class"})
                            await actor.sheet._onDropItem(getMockEvent(), {name: "Soldier", type: "class"})
                            await actor.sheet._onDropItem(getMockEvent(), {name: "Soldier", type: "class"})
                            assert.equal(actor.attack.attacks[0].damageRoll.roll.dice[0].formula, "1d4", "UAE for medium creatures should be 1d4")
                            await actor.sheet._onDropItem(getMockEvent(), {name: "Martial Arts I", type: "feat", answers: ["Soldier Bonus Feats"]})
                            assert.equal(actor.attack.attacks[0].damageRoll.roll.dice[0].formula, "1d6", "UAE for medium creatures with Martial Arts I should be 1d6")
                            await actor.sheet._onDropItem(getMockEvent(), {name: "Martial Arts II", type: "feat", answers: ["Soldier Bonus Feats"]})
                            assert.equal(actor.attack.attacks[0].damageRoll.roll.dice[0].formula, "1d8", "UAE for medium creatures with Martial Arts II should be 1d8")
                            await actor.sheet._onDropItem(getMockEvent(), {name: "Martial Arts III", type: "feat", answers: ["Soldier Bonus Feats"]})
                            assert.equal(actor.attack.attacks[0].damageRoll.roll.dice[0].formula, "1d10", "UAE for medium creatures with Martial Arts III should be 1d10")


                        })
                    })
                    it("should do anything", ()=>{})


                });

            })
        })}