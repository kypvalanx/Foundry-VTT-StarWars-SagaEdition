import {getMockEvent, withTestActor} from "./actor-utils.mjs";


export async function actorSheetAbilitiesTests(quench) {
    quench.registerBatch("actor.actor-sheet.abilities",
        (context) => {
            const {describe, it, assert, expect, should} = context;
            describe("Actor", () => {
                describe("Abilities", () => {

                    it('in manual abilities mode changing a base ability changes its modifier', async function () {
                        await withTestActor(async actor => {
                            actor.suppressDialog = true
                            await actor.safeUpdate({"system.settings.attributeGeneration": "Manual"});

                            await actor.safeUpdate({"system.abilities.str.base": 14});
                            assert.equal(actor.system.abilities.str.value, 14);
                            assert.equal(actor.system.abilities.str.mod, 2);

                            await actor.safeUpdate({"system.abilities.str.base": 18});
                            assert.equal(actor.system.abilities.str.value, 18);
                            assert.equal(actor.system.abilities.str.mod, 4);
                        });
                    });

                    it('in semi-manual abilities mode changing a base ability changes its modifier', async function () {
                        await withTestActor(async actor => {
                            actor.suppressDialog = true
                            await actor.safeUpdate({"system.settings.attributeGeneration": "Semi-Manual"});

                            await actor.safeUpdate({"system.abilities.str.base": 14});
                            assert.equal(actor.system.abilities.str.value, 14);
                            assert.equal(actor.system.abilities.str.mod, 2);

                            await actor.safeUpdate({"system.abilities.str.base": 18});
                            assert.equal(actor.system.abilities.str.value, 18);
                            assert.equal(actor.system.abilities.str.mod, 4);
                        });
                    });

                    it('in semi-manual abilities mode adding a species adjusts the abilities value', async function () {
                        await withTestActor(async actor => {
                            actor.suppressDialog = true
                            await actor.safeUpdate({"system.settings.attributeGeneration": "Semi-Manual"});
                            await actor.safeUpdate({"system.abilities.str.base": 10});

                            assert.equal(actor.system.abilities.str.value, 10);

                            // Drop a species that has a STR bonus. 
                            await actor.sheet._onDropItem(getMockEvent(), {
                                name: "Human", 
                                type: "species", 
                                system: {
                                    changes: [
                                        {key: "strengthBonus", value: 2}
                                    ]
                                }
                            })

                            assert.equal(actor.system.abilities.str.value, 12);
                            assert.equal(actor.system.abilities.str.mod, 1);
                        });
                    });
                })
            })

        })
}