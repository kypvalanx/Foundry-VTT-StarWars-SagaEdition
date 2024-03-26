import {SWSEActor} from "../../module/actor/actor.mjs";

async function withTestActor(param) {
    const actor = await SWSEActor.create({
        name: "New Test Actor",
        type: "character",
        img: "artwork/character-profile.jpg"
    })
    try {
        await param(actor);
    } finally {
        await actor.delete();
    }
}

function getMockEvent() {
    const newVar = {};
    newVar.preventDefault = () => {
    };
    return newVar;
}

function hasItems(assert, items, strings) {
    items = items.map(i => i.name).sort()
    strings = strings.sort()
    assert.sameMembers(items, strings)
}

export async function actorSheetTests(quench) {
    quench.registerBatch("actor.actor-sheet.classes",
        (context) => {
            const {describe, it, assert, expect, should} = context;
            describe("Actor", () => {
                describe("._sheet", () => {
                    describe("._onDropItem", () => {

                        it('should accept a first level of a heroic class and should grant associated feats and traits', async function () {
                            await withTestActor(async actor => {
                                actor.suppressDialog = true
                                await actor.sheet._onDropItem(getMockEvent(), {name: "Jedi", type: "class"})
                                hasItems(assert, actor.items, ["Jedi", "Bonus Feat (Force Sensitivity)", "Bonus Feat (Weapon Proficiency (Lightsabers))", "Bonus Feat (Weapon Proficiency (Simple Weapons))",
                                    "Force Sensitivity", "Weapon Proficiency (Lightsabers)", "Weapon Proficiency (Simple Weapons)"])
                                assert.lengthOf(actor.items, 7)
                            });
                        });

                        it('should accept a 2nd degree droid species and should grant associated feats and traits', async function () {
                            await withTestActor(async actor => {
                                actor.suppressDialog = true
                                await actor.sheet._onDropItem(getMockEvent(), {
                                    name: "2nd-Degree Droid Model",
                                    type: "species",
                                    answers: ["Medium"]
                                })
                                hasItems(assert, actor.items, ["2nd-Degree Droid Model",
                                    "Charisma (-2)",
                                    "Dexterity (+2)",
                                    "Dexterity (+4)",
                                    "Dexterity (+6)",
                                    "Dexterity (+8)",
                                    "Dexterity (-2)",
                                    "Dexterity (-4)",
                                    "Droid Default Appendage Offset",
                                    "Fly Speed (12)",
                                    "Fly Speed (9)",
                                    "Hover Speed (6)",
                                    "Intelligence (+2)",
                                    "Medium",
                                    "Stationary Speed (0)",
                                    "Strength (+16)",
                                    "Strength (+24)",
                                    "Strength (+32)",
                                    "Strength (+8)",
                                    "Strength (-2)",
                                    "Strength (-4)",
                                    "Strength (-6)",
                                    "Strength (-8)",
                                    "Tracked Speed (4)",
                                    "Tracked Speed (6)",
                                    "Tracked Speed (8)",
                                    "Walking Speed (4)",
                                    "Walking Speed (6)",
                                    "Walking Speed (8)",
                                    "Wheeled Speed (10)",
                                    "Wheeled Speed (6)",
                                    "Wheeled Speed (8)"])
                                assert.lengthOf(actor.items, 32)
                                //assert.equal(actor.size, "Medium")
                            });
                        });

                        it('should correctly format damage die rolls on beast actors', async function () {
                            await withTestActor(async actor => {
                                actor.suppressDialog = true
                                await actor.sheet._onDropItem(getMockEvent(), {name: "Beast", type: "class"})
                                await actor.sheet._onDropItem(getMockEvent(), {name: "Claw", type: "beastAttack"})
                                await actor.sheet._onDropItem(getMockEvent(), {name: "Medium", type: "trait"})
                                hasItems(assert, actor.items, ["Beast", "Claw", "Medium"])
                                assert.lengthOf(actor.items, 3)
                                const firstAttack = actor.attack.attacks[0]

                                const renderFormulaHTML = firstAttack.damageRoll.renderFormulaHTML;
                                assert.equal( renderFormulaHTML, "1d4")
                                // assert.equal()
                            });
                        });
                    })
                })
            })
        })
}