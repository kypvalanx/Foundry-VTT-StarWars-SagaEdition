import {SWSEActor} from "../../module/actor/actor.mjs";
import {getAvailableTrainedSkillCount} from "../../module/actor/skill-handler.mjs";

async function withTestActor(param) {
    const actor = await SWSEActor.create({
        name: "New Test Actor DELETE ME",
        type: "character",
        img: "artwork/character-profile.jpg"
    })
    try {
        await param(actor);
    } finally {
        await actor.delete();
        game.actors.forEach(a => {if(a.name === "New Test Actor DELETE ME"){
          a.delete()
        }})
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
                                assert.equal( renderFormulaHTML, '<span>1d4</span>')
                                // assert.equal()
                            });
                        });

                        it('should only take trained skills from first level class', async function () {
                            await withTestActor(async actor => {
                                actor.suppressDialog = true
                                await actor.setAttributes({int:18})
                                await actor.sheet._onDropItem(getMockEvent(), {name: "Scoundrel", type: "class"})
                                await actor.sheet._onDropItem(getMockEvent(), {name: "Jedi", type: "class",
                                    answers: ["Force Sensitivity"]})
                                await actor.sheet._onDropItem(getMockEvent(), {name: "Soldier", type: "class", answers: ["Armor Proficiency (Light)"]})
                                hasItems(assert, actor.items, [  "Bonus Feat (Point-Blank Shot)",
                                    "Bonus Feat (Weapon Proficiency (Pistols))",
                                    "Bonus Feat (Weapon Proficiency (Simple Weapons))",
                                    "Jedi",
                                    "Point-Blank Shot",
                                    "Scoundrel",
                                    "Soldier",
                                    "Weapon Proficiency (Pistols)",
                                    "Weapon Proficiency (Simple Weapons)"])
                                assert.lengthOf(actor.items, 9)
                                const availableTrainedSkills = await getAvailableTrainedSkillCount(actor)
                                assert.equal(availableTrainedSkills, 8);
                            });
                        });

                        it('carried weight should ignore non numeric terms that cannot be converted into numeric terms', async function () {
                            await withTestActor(async actor => {
                                actor.suppressDialog = true
                                await actor.setAttributes({int:18})
                                await actor.sheet._onDropItem(getMockEvent(), {name: "Blaster Pistol", type: "weapon"})
                                hasItems(assert, actor.items, [  "Blaster Pistol"])
                                const item = actor.items.find(i => i.name === "Blaster Pistol");

                                SWSEActor.updateOrAddChange(item, "weight", "THING");

                                assert.equal(actor.carriedWeight, 0);
                            });
                        });
                    })
                })
            })
        })
}