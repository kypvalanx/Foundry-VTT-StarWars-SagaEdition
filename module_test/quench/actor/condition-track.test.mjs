import {getMockEvent, withTestActor} from "./actor-utils.mjs";
import {getInheritableAttribute} from "../../../module/attribute-helper.mjs";

/**
 * @param quench
 */
export async function conditionTrackTests(quench) {
    quench.registerBatch("actor.condition-track",
        (context) => {
            const {describe, it, assert} = context;

            describe("Condition Track & Active Effects", () => {
                describe("Step Progression", () => {
                    it("should start at 0 condition (Normal)", async () => {
                        await withTestActor(async (actor) => {
                            assert.equal(actor.condition, 0);
                        });
                    });

                    it("should step down the track from 0 -> -1 -> -2 -> -5 -> -10 -> OUT", async () => {
                        await withTestActor(async (actor) => {
                            // 0 to -1
                            await actor.reduceCondition(1);
                            assert.equal(actor.condition, -1);

                            // -1 to -2
                            await actor.reduceCondition(1);
                            assert.equal(actor.condition, -2);

                            // -2 to -5
                            await actor.reduceCondition(1);
                            assert.equal(actor.condition, -5);

                            // -5 to -10
                            await actor.reduceCondition(1);
                            assert.equal(actor.condition, -10);

                            // -10 to OUT (Helpless/Unconscious)
                            await actor.reduceCondition(1);
                            assert.equal(actor.condition, "OUT");

                            // Cannot step past OUT
                            await actor.reduceCondition(1);
                            assert.equal(actor.condition, "OUT");
                        });
                    });

                    it("should support moving multiple steps down the track at once", async () => {
                        await withTestActor(async (actor) => {
                            await actor.reduceCondition(2);
                            assert.equal(actor.condition, -2);

                            await actor.reduceCondition(2);
                            assert.equal(actor.condition, -10);

                            await actor.reduceCondition(5);
                            assert.equal(actor.condition, "OUT");
                        });
                    });

                    it("should step up the track when reduceCondition is called with negative numbers", async () => {
                        await withTestActor(async (actor) => {
                            await actor.setGroupedEffect('condition', "-10");
                            assert.equal(actor.condition, -10);

                            // Move up 1 step: -10 -> -5
                            await actor.reduceCondition(-1);
                            assert.equal(actor.condition, -5);

                            // Move up 1 step: -5 -> -2
                            await actor.reduceCondition(-1);
                            assert.equal(actor.condition, -2);

                            // Move up 1 step: -2 -> -1
                            await actor.reduceCondition(-1);
                            assert.equal(actor.condition, -1);

                            // Move up 1 step: -1 -> 0
                            await actor.reduceCondition(-1);
                            assert.equal(actor.condition, 0);

                            // Cannot step above 0
                            await actor.reduceCondition(-1);
                            assert.equal(actor.condition, 0);
                        });
                    });
                });

                describe("Dynamic Penalty Application", () => {
                    it("should apply condition penalties to all defense scores", async () => {
                        await withTestActor(async (actor) => {
                            const baseFort = actor.system.defense.fortitude.total;
                            const baseRef = actor.system.defense.reflex.total;
                            const baseWill = actor.system.defense.will.total;

                            // Move to -1
                            await actor.setGroupedEffect('condition', "-1");
                            assert.equal(actor.system.defense.fortitude.total, baseFort - 1);
                            assert.equal(actor.system.defense.reflex.total, baseRef - 1);
                            assert.equal(actor.system.defense.will.total, baseWill - 1);

                            // Move to -2
                            await actor.setGroupedEffect('condition', "-2");
                            assert.equal(actor.system.defense.fortitude.total, baseFort - 2);
                            assert.equal(actor.system.defense.reflex.total, baseRef - 2);
                            assert.equal(actor.system.defense.will.total, baseWill - 2);

                            // Move to -5
                            await actor.setGroupedEffect('condition', "-5");
                            assert.equal(actor.system.defense.fortitude.total, baseFort - 5);
                            assert.equal(actor.system.defense.reflex.total, baseRef - 5);
                            assert.equal(actor.system.defense.will.total, baseWill - 5);

                            // Move to -10
                            await actor.setGroupedEffect('condition', "-10");
                            assert.equal(actor.system.defense.fortitude.total, baseFort - 10);
                            assert.equal(actor.system.defense.reflex.total, baseRef - 10);
                            assert.equal(actor.system.defense.will.total, baseWill - 10);
                        });
                    });

                    it("should apply condition penalties to skill checks and ability checks", async () => {
                        await withTestActor(async (actor) => {
                            const baseAcrobatics = actor.system.skills.Endurance.value;
                            const baseStrCheck = actor.system.abilities.str.mod;

                            await actor.setGroupedEffect('condition', "-5");

                            // Skill modifier should include condition penalty (-5)
                            assert.equal(actor.system.skills.Endurance.value, baseAcrobatics - 5);

                            // Inheritable condition attribute on actor should reflect the penalty
                            const conditionBonuses = getInheritableAttribute({entity: actor, attributeKey: "condition"});
                            assert.isTrue(conditionBonuses.some(b => `${b.value}` === "-5"));
                        });
                    });

                    it("should apply condition penalties to attack rolls", async () => {
                        await withTestActor(async (actor) => {
                            await actor.setGroupedEffect('condition', "-2");

                            const conditionBonuses = getInheritableAttribute({entity: actor, attributeKey: "condition"});
                            assert.isTrue(conditionBonuses.some(b => `${b.value}` === "-2"));

                            // Verify attack term generation or attack rolls incorporate condition penalty
                            const attackTerms = actor.attack?.unarmed?.attackRoll.terms || [];
                            const conditionTerm = attackTerms.find(term => term.formula === "2[Condition Modifier]");
                            assert.isDefined(conditionTerm, "Unarmed attack terms should include condition modifier");
                        });
                    });
                });

                describe("Damage Threshold Triggers", () => {
                    it("should drop 1 step down the condition track when damage exceeds damage threshold", async () => {
                        await withTestActor(async (actor) => {
                            const dt = actor.system.defense.damageThreshold.total;
                            assert.equal(actor.condition, 0);

                            // Apply damage exceeding DT
                            await actor.applyDamage({
                                damage: dt + 1,
                                damageType: "energy",
                                skipShields: true,
                                skipDamageReduction: true,
                                affectDamageThreshold: true
                            });

                            assert.equal(actor.condition, -1);
                        });
                    });

                    it("should not drop condition when damage does not exceed damage threshold", async () => {
                        await withTestActor(async (actor) => {
                            const dt = actor.system.defense.damageThreshold.total;
                            assert.equal(actor.condition, 0);

                            // Apply damage equal to or lower than DT
                            await actor.applyDamage({
                                damage: dt - 1,
                                damageType: "energy",
                                skipShields: true,
                                skipDamageReduction: true
                            });

                            assert.equal(actor.condition, 0);
                        });
                    });
                });

                describe("Persistent Conditions", () => {
                    it("should allow adding persistent condition effects", async () => {
                        await withTestActor(async (actor) => {
                            // Add persistent condition ActiveEffect
                            const effectData = {
                                label: "Radiation Poisoning",
                                name: "Radiation Poisoning",
                                flags: {
                                    swse: {
                                        persistentCondition: true
                                    }
                                },
                                changes: [{
                                    key: "condition",
                                    value: "-2",
                                    mode: 2
                                }]
                            };

                            const [effect] = await actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
                            assert.isNotNull(effect);
                            assert.isTrue(effect.flags?.swse?.persistentCondition === true);

                            // Verify actor reflects persistent condition in changes
                            const conditionBonuses = getInheritableAttribute({entity: actor, attributeKey: "condition"});
                            assert.isTrue(conditionBonuses.some(b => `${b.value}` === "-2"));
                        });
                    });

                    it("should not clear persistent condition effects with standard condition reset", async () => {
                        await withTestActor(async (actor) => {
                            // Add a persistent condition effect
                            await actor.createEmbeddedDocuments("ActiveEffect", [{
                                label: "Poison Effect",
                                name: "Poison Effect",
                                statuses: ["condition-persistent-poison"],
                                flags: {
                                    swse: {
                                        persistentCondition: true
                                    }
                                },
                                changes: [{
                                    key: "condition",
                                    value: "-1",
                                    mode: 2
                                }]
                            }]);

                            // Regular grouped effect condition reset
                            await actor.setGroupedEffect('condition', "0");

                            // The persistent effect should still be present
                            const persistentEffects = actor.effects.filter(e => e.flags?.swse?.persistentCondition);
                            assert.equal(persistentEffects.length, 1);
                            assert.equal(persistentEffects[0].name, "Poison Effect");
                        });
                    });
                });

                describe("Second Wind & Recovery Actions", () => {
                    it("should allow recovering 1 step up the condition track using standard recovery actions", async () => {
                        await withTestActor(async (actor) => {
                            // Actor is at -2 condition
                            await actor.setGroupedEffect('condition', "-2");
                            assert.equal(actor.condition, -2);

                            // Recover 1 step (simulating 3 swift action recovery)
                            await actor.reduceCondition(-1);
                            assert.equal(actor.condition, -1);

                            // Recover another step
                            await actor.reduceCondition(-1);
                            assert.equal(actor.condition, 0);
                        });
                    });
                });
            });
        }, {displayName: "Condition Track & Active Effects Tests"});
}
