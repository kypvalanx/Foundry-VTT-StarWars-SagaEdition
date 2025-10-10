import {explodeOptions} from "../../../module/choice/choice.mjs";

export async function choiceTests(quench) {
    quench.registerBatch("choice.choice",
        (context) => {
            const {describe, it, assert, expect, should} = context;
        describe("choice", ()=>{
            describe("explodeOptions", ()=>{
                it("should handle no parameters", async ()=>{
                    assert.lengthOf(await explodeOptions(), 0)
                })

                it("should handle exploding AVAILABLE_LIGHTSABER_CRYSTALS", async () => {
                    assert.lengthOf( await explodeOptions([{name:"AVAILABLE_LIGHTSABER_CRYSTALS"}]), 28)
                })
            })
        })
    });
}