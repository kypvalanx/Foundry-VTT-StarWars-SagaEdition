import {getMockEvent, withTestActor} from "./actor-utils.mjs";

export async function healthTests(quench) {
    quench.registerBatch("actor.actor-sheet.health",
        (context) => {

            const {describe, it, assert, expect, should} = context;

            describe("actor.actor-sheet.health", () => {
                it("should ignore negative con modifier when resolving health", async () => {
                    await withTestActor(async (actor) => {
                        actor.suppressDialog = true

                        await actor.setAttributes({con:6})
                        await actor.sheet._onDropItem(getMockEvent(), {name: "Soldier", type: "class"})
                        await actor.sheet._onDropItem(getMockEvent(), {name: "Soldier", type: "class"})
                        await actor.sheet._onDropItem(getMockEvent(), {name: "Soldier", type: "class"})

                        assert.equal(actor.health.max, 32)
                    })
                })
            })
        })
}