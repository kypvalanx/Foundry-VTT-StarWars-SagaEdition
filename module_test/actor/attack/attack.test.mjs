import {appendTerms} from "../../../module/common/util.mjs";
import {getMockEvent, hasItems, withTestActor} from "../actor-sheet.test.mjs";

export async function attackTests(quench) {
    quench.registerBatch("attack.appendTerm",
        (context) => {
            const {describe, it, assert, expect, should} = context;
            describe("appendTerm", () => {
                it("should append the term", async () => {
                    assert.equal(`[{"class":"OperatorTerm","options":{},"evaluated":false,"operator":"+"}` +
                        `,{"class":"NumericTerm","options":{"flavor":"bonus"},"evaluated":false,"number":1}]`, JSON.stringify(appendTerms(1, "bonus")))
                })
                it("should append the term", async () => {
                    assert.equal(`[{"class":"OperatorTerm","options":{},"evaluated":false,"operator":"-"}` +
                        `,{"class":"NumericTerm","options":{"flavor":"bonus"},"evaluated":false,"number":2}]`, JSON.stringify(appendTerms("-2", "bonus")))
                })
                it("should append the term", async () => {
                    assert.equal(`[{"class":"OperatorTerm","options":{},"evaluated":false,"operator":"-"}` +
                        `,{"class":"Die","options":{"flavor":"bonus"},"evaluated":false,"number":4,"faces":10,"modifiers":[],"results":[]}]`, JSON.stringify(appendTerms("-4d10", "bonus")))
                })
                it("should append the term", async () => {
                    assert.equal(`[{"class":"OperatorTerm","options":{},"evaluated":false,"operator":"-"}` +
                        `,{"class":"Die","options":{"flavor":"bonus"},"evaluated":false,"number":4,"faces":10,"modifiers":[],"results":[]}` +
                        `,{"class":"OperatorTerm","options":{},"evaluated":false,"operator":"-"},` +
                        `{"class":"Die","options":{"flavor":"bonus"},"evaluated":false,"number":6,"faces":4,"modifiers":[],"results":[]},` +
                        `{"class":"OperatorTerm","options":{},"evaluated":false,"operator":"+"},` +
                        `{"class":"NumericTerm","options":{"flavor":"bonus"},"evaluated":false,"number":9}]`, JSON.stringify(appendTerms("-4d10-6d4+9", "bonus")))
                })
                it("should append the term", async () => {
                    assert.equal(`[{"class":"OperatorTerm","options":{},"evaluated":false,"operator":"+"}` +
                        `,{"class":"NumericTerm","options":{"flavor":"bomb"},"evaluated":false,"number":1}` +
                        `,{"class":"OperatorTerm","options":{},"evaluated":false,"operator":"+"}` +
                        `,{"class":"Die","options":{"flavor":"bomb"},"evaluated":false,"number":3,"faces":6,"modifiers":[],"results":[]}]`, JSON.stringify(appendTerms("1+3d6", "bomb")))
                })
            })
        })
    quench.registerBatch("attack.attackRoll",
        (context) => {
            const {describe, it, assert, expect, should} = context;
            describe("attackRoll", () => {
                it("should not resolve", async () => {
                    await withTestActor(async actor => {
                        actor.suppressDialog = true
                        await actor.sheet._onDropItem(getMockEvent(), {name: "Soldier", type: "class"})
                        await actor.sheet._onDropItem(getMockEvent(), {name: "Soldier", type: "class"})
                        let response = await actor.sheet._onDropItem(getMockEvent(), {name: "Commanding Officer", type: "talent"})
                        let itemId = response[0].id;
                        let follower = await actor.sheet._onCreateFollower(getMockEvent({
                            currentTarget:{dataset: {itemId}},
                            skipRender:true
                        }))

                        hasItems(assert, follower.items, [
                            "Follower",
                            "Weapon Proficiency (Rifles)",
                            "Provides (Armor Proficiency Feat:1)"
                        ])
                    });
                })
            })
        })
}