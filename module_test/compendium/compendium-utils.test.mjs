import {getCompendium} from "../../module/compendium/compendium-util.mjs";

export async function compendiumUtilTests(quench) {
    quench.registerBatch("compendium-utils",
        (context) => {
            const {describe, it, assert, expect, should} = context;
            describe("getCompendium", () => {
                it("should handle no parameters", ()=>{
                    assert.lengthOf(getCompendium(undefined), 0)
                })

                it("should return many compendiums for items", ()=> {

                    assert.ok(getCompendium("item").length > 1)
                })
            })

            describe("getIndexAndPack", () => {
                // it("should handle no parameters", ()=>{
                //     assert.lengthOf(explodeOptions(), 0)
                // })
                //
                // it("should handle exploding AVAILABLE_LIGHTSABER_CRYSTALS", ()=>{
                //     assert.lengthOf(explodeOptions([{name:"AVAILABLE_LIGHTSABER_CRYSTALS"}]), 0)
                // })
            })

            describe("resolveEntity", () => {
                // it("should handle no parameters", ()=>{
                //     assert.lengthOf(explodeOptions(), 0)
                // })
                //
                // it("should handle exploding AVAILABLE_LIGHTSABER_CRYSTALS", ()=>{
                //     assert.lengthOf(explodeOptions([{name:"AVAILABLE_LIGHTSABER_CRYSTALS"}]), 0)
                // })
            })


        });
}