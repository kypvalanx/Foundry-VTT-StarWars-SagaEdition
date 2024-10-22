import {getMockEvent, hasItems, withTestActor} from "../../actor/actor-sheet.test.mjs";


export async function poltgotBasicTests(quench) {

    quench.registerBatch("module.polygot.basic",
        (context)=>{
            const { describe, it, assert, expect, should } = context;
            describe("Polygot Module", ()=>{
                it("Generate Rancor Correctly", async ()=>{
                    await withTestActor(async actor => {
                        actor.suppressDialog = true
                        await actor.sheet._onDropItem(getMockEvent(), {name: "Basic", type: "language"})
                        hasItems(assert, actor.items, ["Basic"])

                    })
                })
            });
        }
        //, {displayName: "GENERATION: ACTOR SPOT CHECKS"}
    );

}
