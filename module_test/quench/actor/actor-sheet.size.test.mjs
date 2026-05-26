import {getMockEvent, withTestActor} from "./actor-utils.mjs";


export async function actorSheetSizeTests(quench) {
    quench.registerBatch("actor.actor-sheet.size",
        (context) => {
            const {describe, it, assert, expect, should} = context;
            describe("Actor", () => {
                describe("Size", () => {

                    it('adding a small species should adjust reflex defense, stealth skill, and carry capacity', async function () {
                        await withTestActor(async actor => {
                            actor.suppressDialog = true

                            await actor.safeUpdate({"system.abilities.str.base": 10});

                            const initialReflex = actor.system.defense.reflex.value;
                            const initialStealth = actor.system.skills.Stealth.value;
                            const initialMaxCarryWeight = actor.weight.maximumCapacity
                            const initialStrainCapacity = actor.weight.strainCapacity
                            const initialHeavyLoad = actor.weight.heavyLoad


                            const update = {};
                            update[`system.skills.Survival.trained`] = true;
                            await actor.safeUpdate(update);

                            // Drop Ewok species (Small)
                            // Small size provides: reflexDefenseBonus: 1, stealth: 5 bonus, carry capacity: 0.75 multiplier
                            await actor.sheet._onDropItem(getMockEvent(), {
                                name: "Ewok",
                                type: "species"
                            })

                            assert.equal(actor.size.name, "Small");
                            assert.equal(actor.system.defense.reflex.value, initialReflex + 2);
                            assert.equal(actor.system.skills.Stealth.value, initialStealth + 6);
                            assert.equal(actor.weight.maximumCapacity, 48);
                            assert.equal(actor.weight.strainCapacity, 24);
                            assert.equal(actor.weight.heavyLoad, 12); //(8 * 0.5)^2 * 0.75 = 12
                        });
                    });

                    it('changing size from Medium to Large should decrease reflex defense and stealth skill, and increase carry capacity', async function () {
                        await withTestActor(async actor => {
                            actor.suppressDialog = true

                            await actor.safeUpdate({"system.abilities.str.base": 10});

                            // Apply Large size
                            // Large size provides: reflexDefenseBonus: -1, stealth: -5 bonus, carry capacity: 2 multiplier
                            await actor.sheet._onDropItem(getMockEvent(), {
                                name: "Hutt",
                                type: "species"
                            })

                            assert.equal(actor.size.name, "Large");
                            assert.equal(actor.system.defense.reflex.value, 6);
                            assert.equal(actor.system.skills.Stealth.value, -8);
                            assert.equal(actor.weight.heavyLoad, 72); //(12 * 0.5)^2 * 2 = 72
                        });
                    });
                })
            })

        })
}
