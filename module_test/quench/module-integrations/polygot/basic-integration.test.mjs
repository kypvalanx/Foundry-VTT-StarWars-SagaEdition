import {getMockEvent, hasItems, withTestActor} from "../../actor/actor-utils.mjs";


export async function poltgotBasicTests(quench) {
    if(!game.modules.has("polyglot")){
        console.log("polyglot not found, skipping....")
        return;
    }
    quench.registerBatch("module.polygot.basic",
        (context)=>{
            const { describe, it, assert, expect, should } = context;
            describe("Polygot Module", ()=>{

                if(!game.polyglot) return;

                it("should treat a language as known when it is on an actor sheet", async ()=>{
                    await withTestActor(async actor => {
                        actor.suppressDialog = true
                        await actor.sheet._onDropItem(getMockEvent(), {name: "Basic", type: "language"})

                        const [known_languages, literate_languages] = game.polyglot.LanguageProvider.getUserLanguages(actor)
                        assert.includeMembers(Array.from(known_languages), ["Basic"]);
                    })
                })
                it("should limit spoken languages due to maySpeak Tag", async ()=>{
                    await withTestActor(async actor => {
                        actor.suppressDialog = true
                        await actor.sheet._onDropItem(getMockEvent(), {name: "Basic", type: "language"})
                        await actor.sheet._onDropItem(getMockEvent(), {name: "Shyriiwook", type: "language"})
                        await actor.sheet._onDropItem(getMockEvent(), {name: "Wookiee", type: "species"})

                        const [known_languages, literate_languages] = game.polyglot.LanguageProvider.getUserLanguages(actor)

                        const actual_known_languages = Array.from(known_languages);
                        assert.includeMembers(actual_known_languages, ["Shyriiwook"])
                        assert.notIncludeMembers(actual_known_languages, ["Basic"])

                        const actual_literate_languages = Array.from(literate_languages);
                        assert.includeMembers(actual_literate_languages, ["Basic"])
                        assert.notIncludeMembers(actual_literate_languages, ["Shyriiwook"])
                    })
                })
            });
        }
    );

}
