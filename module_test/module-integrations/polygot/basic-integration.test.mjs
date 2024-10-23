import {getMockEvent, hasItems, withTestActor} from "../../actor/actor-sheet.test.mjs";


export async function poltgotBasicTests(quench) {
    if(!game.modules.has("polyglot")){
        console.log("polyglot not found, skipping....")
        return;
    }
    quench.registerBatch("module.polygot.basic",
        (context)=>{
            const { describe, it, assert, expect, should } = context;
            describe("Polygot Module", ()=>{



                it("should treat a language as known when it is on an actor sheet", async ()=>{
                    await withTestActor(async actor => {
                        actor.suppressDialog = true
                        await actor.sheet._onDropItem(getMockEvent(), {name: "Basic", type: "language"})
                        hasItems(assert, actor.items, ["Basic"])
                        const [known_languages, literate_languages] = game.polyglot.LanguageProvider.getUserLanguages(actor)
                        assert.includeMembers(Array.from(known_languages), ["Basic"]);
                    })
                })
            });
        }
        //, {displayName: "GENERATION: ACTOR SPOT CHECKS"}
    );

}
