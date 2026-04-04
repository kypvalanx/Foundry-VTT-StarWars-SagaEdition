import {withTestActor} from "../actor-utils.mjs";

/**
 * @param quench
 */
export async function healthFunctionsTests(quench) {
    quench.registerBatch("actor.templates.health-functions",
        (context) => {
            const {describe, it, assert} = context;

            describe("HealthFunctions", () => {
                describe("_prepareHealthDerivedData", () => {
                    it("should calculate health based on classes and constitution modifier", async () => {
                        await withTestActor(async (actor) => {
                            // Mock classes
                            actor.classes = [
                                { classLevelHealth: 10 },
                                { classLevelHealth: 6 }
                            ];
                            // Mock constitution modifier
                            actor.system.abilities.con.mod = 2;

                            actor.system._prepareHealthDerivedData();

                            // 10 (class1) + 2 (con) + 6 (class2) + 2 (con) = 20
                            assert.equal(actor.system.health.max, 20);
                        }, {partialMock: true});
                    });

                    it("should ignore constitution modifier for droids", async () => {
                        await withTestActor(async (actor) => {
                            actor.classes = [
                                { classLevelHealth: 10 }
                            ];
                            actor.system.abilities.con.mod = 2;
                            actor.isDroid = true;

                            actor.system._prepareHealthDerivedData();

                            // 10 (class1) + 0 (con because droid) = 10
                            assert.equal(actor.system.health.max, 10);
                        }, {partialMock: true});
                    });

                    it("should include healthHardenedMultiplier in calculation", async () => {
                        await withTestActor(async (actor) => {
                            actor.classes = [
                                { classLevelHealth: 10 }
                            ];
                            actor.system.abilities.con.mod = 0;

                            // Adding an item with healthHardenedMultiplier attribute
                            await actor.createEmbeddedDocuments("Item", [{
                                name: "Hardened",
                                type: "trait",
                                system: {
                                    changes: {
                                        "0": {
                                            key: "healthHardenedMultiplier",
                                            value: "2"
                                        }
                                    }
                                }
                            }]);

                            actor.system._prepareHealthDerivedData();

                            // 10 (class1) * 2 (multiplier) = 20
                            assert.equal(actor.system.health.max, 20);
                        }, {partialMock: true});
                    });

                    it("should include hitPointEq in calculation", async () => {
                        await withTestActor(async (actor) => {
                            actor.classes = [
                                { classLevelHealth: 10 }
                            ];
                            actor.system.abilities.con.mod = 0;

                            // Adding an item with hitPointEq attribute
                            await actor.createEmbeddedDocuments("Item", [{
                                name: "Bonus HP",
                                type: "trait",
                                system: {
                                    changes: {
                                        "0": {
                                            key: "hitPointEq",
                                            value: "5"
                                        }
                                    }
                                }
                            }]);

                            actor.system._prepareHealthDerivedData();

                            // 10 (class1) + 5 (hitPointEq) = 15
                            assert.equal(actor.system.health.max, 15);
                            assert.equal(actor.system.health.bonusHP, 5);
                        }, {partialMock: true});
                    });
                });

                describe("_prepareSecondWinds", () => {
                    it("should give 1 second wind to heroic actors", async () => {
                        await withTestActor(async (actor) => {
                            actor.isHeroic = true;
                            actor.system._prepareSecondWinds();
                            assert.equal(actor.system.secondWinds, 1);
                        }, {partialMock: true});
                    });

                    it("should give 0 second winds to non-heroic actors", async () => {
                        await withTestActor(async (actor) => {
                            actor.isHeroic = false;
                            actor.system._prepareSecondWinds();
                            assert.equal(actor.system.secondWinds, 0);
                        }, {partialMock: true});
                    });

                    it("should include bonusSecondWind in calculation", async () => {
                        await withTestActor(async (actor) => {
                            actor.isHeroic = true;
                            // Adding an item with bonusSecondWind attribute
                            await actor.createEmbeddedDocuments("Item", [{
                                name: "Extra Second Wind",
                                type: "trait",
                                system: {
                                    changes: [{
                                            key: "bonusSecondWind",
                                            value: "1"
                                        }
                                    ]
                                }
                            }]);

                            //actor.system.

                            actor.system.prepareDerivedData();

                            // 1 (heroic) + 1 (bonusSecondWind) = 2
                            assert.equal(actor.system.secondWinds, 2);
                        }, {partialMock: true});
                    });
                });
            });
        }, {displayName: "HealthFunctions Tests"});
}
