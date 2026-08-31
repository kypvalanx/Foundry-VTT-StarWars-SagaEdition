import {withTestActor} from "./actor/actor-utils.mjs";

export async function migrationTests(quench) {
    quench.registerBatch("swse.migration", (context) => {
        const {describe, it, assert, expect} = context;

        describe("actor migration", () => {
            it("should migrate actor data from V12", async () => {
                await withTestActor((actor) => {

                    assert.equal(actor.name, "V12 Test")

                    assert.equal(actor.system.abilities.str.value, 12)
                    assert.equal(actor.system.abilities.dex.value, 13)
                    assert.equal(actor.system.abilities.con.value, 14)
                    assert.equal(actor.system.abilities.int.value, 15)
                    assert.equal(actor.system.abilities.wis.value, 11)
                    assert.equal(actor.system.abilities.cha.value, 10)

                    //will be null if using certain skill arrays
                    if(actor.system.skills.Climb){
                        assert.equal(actor.system.skills.Climb.trained, true)
                    }
                    assert.equal(actor.system.skills.Endurance.trained, true)
                    assert.equal(actor.system.skills.Initiative.trained, false)


                }, {
                    export: {
                        path: "systems/swse/module_test/resources/V12_human.json",
                        name: "V12 Test"
                    }
                })
            })
        })

    });
}
