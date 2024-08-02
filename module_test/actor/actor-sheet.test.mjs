import {SWSEActor} from "../../module/actor/actor.mjs";
import {getAvailableTrainedSkillCount} from "../../module/actor/skill-handler.mjs";
import {SWSERollWrapper} from "../../module/common/roll.mjs";
import {getDiceTermsFromString} from "../../module/actor/attack/attack.mjs";

export async function withTestActor(param, options= {}) {
    const name = "New Test Actor DELETE ME";
    const actor = await SWSEActor.create({
        name: name,
        type: "character",
        img: "artwork/character-profile.jpg"
    })
    try {
        await param(actor);
    } finally {
        await actor.delete();
        game.actors.forEach(a => {if(a.name === name){
            a.delete()
        }})
    }
}



export async function withTestVehicle(param, options= {}) {
    const name = "New Test Actor DELETE ME";
    const actor = await SWSEActor.create({
        name: name,
        type: "vehicle",
        img: "artwork/character-profile.jpg"
    })
    try {
        await param(actor);
    } finally {
        await actor.delete();
        game.actors.forEach(a => {if(a.name === name){
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

export function hasItems(assert, items, strings) {
    items = items.map(i => i.name).sort()
    strings = strings.sort()
    assert.sameMembers(items, strings)
}

export async function actorSheetTests(quench) {
    quench.registerBatch("actor.actor-sheet.character",
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

                                actor.prepareData()
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

                        it('should allow skill focus to be selected for knowledges', async function () {
                            await withTestActor(async actor => {
                                actor.suppressDialog = true
                                await actor.sheet._onDropItem(getMockEvent(), {name: "Scoundrel", type: "class"})

                                const update = {};
                                update[`system.skills.knowledge (bureaucracy).trained`] = true;

                                await actor.safeUpdate(update);

                                await actor.sheet._onDropItem(getMockEvent(), {name: "Skill Focus", type: "feat",
                                    answers: ["Knowledge (Bureaucracy)"]})

                                hasItems(assert, actor.items, [  "Bonus Feat (Point-Blank Shot)",
                                    "Bonus Feat (Weapon Proficiency (Pistols))",
                                    "Bonus Feat (Weapon Proficiency (Simple Weapons))",
                                    "Point-Blank Shot",
                                    "Scoundrel",
                                    "Skill Focus (Knowledge (Bureaucracy))",
                                    "Weapon Proficiency (Pistols)",
                                    "Weapon Proficiency (Simple Weapons)"])
                            });
                        });

                        it('should be able to take the prestige class Imperial Knight', async function () {
                            await withTestActor(async actor => {
                                actor.suppressDialog = true
                                await actor.sheet._onDropItem(getMockEvent(), {name: "Jedi", type: "class"})
                                await actor.sheet._onDropItem(getMockEvent(), {name: "Jedi", type: "class"})
                                await actor.sheet._onDropItem(getMockEvent(), {name: "Jedi", type: "class"})
                                await actor.sheet._onDropItem(getMockEvent(), {name: "Jedi", type: "class"})
                                await actor.sheet._onDropItem(getMockEvent(), {name: "Jedi", type: "class"})
                                await actor.sheet._onDropItem(getMockEvent(), {name: "Jedi", type: "class"})
                                await actor.sheet._onDropItem(getMockEvent(), {name: "Jedi", type: "class"})

                                const update = {};
                                update[`system.skills.use the force.trained`] = true;
                                await actor.safeUpdate(update);
                                await actor.sheet._onDropItem(getMockEvent(), {name: "Armor Proficiency (Light)", type: "feat"})
                                await actor.sheet._onDropItem(getMockEvent(), {name: "Armor Proficiency (Medium)", type: "feat"})

                                await actor.sheet._onDropItem(getMockEvent(), {name: "Imperial Knight", type: "class"})

                            });
                        });

                        it('adding a lightsaber with a blue Ilum Crystal should reflect that in the ignite effect', async function () {
                            await withTestActor(async actor => {
                                actor.suppressDialog = true
                                await actor.sheet._onDropItem(getMockEvent(), {name: "Lightsaber", type: "weapon", answers:["Ilum Crystal", "blue"]})


                                hasItems(assert, actor.items, [  "Lightsaber"])

                                const lightsaber = actor.items.find(item => item.name === "Lightsaber")

                                assert.equal(lightsaber.effects.find(effect => effect.name === "Ignite").changes.find(c => c.key === "auraColor").value, "blue")

                            });
                        });

                        it('adding a lightsaber with a red Synthetic Crystal should reflect that in the ignite effect', async function () {
                            await withTestActor(async actor => {
                                actor.suppressDialog = true
                                await actor.sheet._onDropItem(getMockEvent(), {name: "Lightsaber", type: "weapon", answers:["Standard Synthetic Crystal", "red"]})


                                hasItems(assert, actor.items, [  "Lightsaber"])

                                const lightsaber = actor.items.find(item => item.name === "Lightsaber")

                                assert.equal(lightsaber.effects.find(effect => effect.name === "Ignite").changes.find(c => c.key === "auraColor").value, "red")

                            });
                        });

                        it('should accept a first level of a heroic class and should grant associated feats and traits', async function () {
                            await withTestActor(async actor => {
                                actor.suppressDialog = true
                                await actor.sheet._onDropItem(getMockEvent(), {name: "Jedi", type: "class"})
                                hasItems(assert, actor.items, ["Jedi", "Bonus Feat (Force Sensitivity)", "Bonus Feat (Weapon Proficiency (Lightsabers))", "Bonus Feat (Weapon Proficiency (Simple Weapons))",
                                    "Force Sensitivity", "Weapon Proficiency (Lightsabers)", "Weapon Proficiency (Simple Weapons)"])
                                assert.lengthOf(actor.items, 7)
                            });
                        });

                        it('should accept multiple applications of talents that can be taken multiple times', async function () {
                            await withTestActor(async actor => {
                                actor.suppressDialog = true
                                await actor.sheet._onDropItem(getMockEvent(), {name: "Scoundrel", type: "class"})
                                await actor.sheet._onDropItem(getMockEvent(), {name: "Scoundrel", type: "class"})
                                await actor.sheet._onDropItem(getMockEvent(), {name: "Scoundrel", type: "class"})
                                await actor.sheet._onDropItem(getMockEvent(), {name: "Sneak Attack", type: "talent"})
                                await actor.sheet._onDropItem(getMockEvent(), {name: "Sneak Attack", type: "talent"})

                                hasItems(assert, actor.items, [
                                    "Bonus Feat (Point-Blank Shot)",
                                    "Bonus Feat (Weapon Proficiency (Pistols))",
                                    "Bonus Feat (Weapon Proficiency (Simple Weapons))",
                                    "Point-Blank Shot",
                                    "Scoundrel",
                                    "Sneak Attack",
                                    "Sneak Attack",
                                    "Weapon Proficiency (Pistols)",
                                    "Weapon Proficiency (Simple Weapons)"])
                                assert.lengthOf(actor.items, 9)
                            });
                        });



                        it('should resolve beast attacks correctly', async function () {
                            await withTestActor(async actor => {
                                actor.suppressDialog = true
                                await actor.sheet._onDropItem(getMockEvent(), {name: "Beast", type: "class"})
                                await actor.sheet._onDropItem(getMockEvent(), {name: "Medium", type: "trait"})
                                await actor.sheet._onDropItem(getMockEvent(), {name: "Bite", type: "beastAttack"})

                                let attacks = actor.attack.attacks

                                assert.equal(attacks.length, 1)

                                let attack = attacks[0];


                                assert.equal(attack.damageRoll.roll._formula, "1d6")
                            });
                        });
                    })
                })
            })

            describe("SWSERollWrapper", () => {
                describe(".renderWeaponBlockFormulaHTML", () => {
                    it("should correctly print single die rolls", () => {
                        const terms = [];
                        terms.push(new foundry.dice.terms.Die({number: 3, faces: 8}))
                        terms.push(new foundry.dice.terms.OperatorTerm({operator: "+"}))
                        terms.push(new foundry.dice.terms.NumericTerm({number: 9}))

                        const roll = Roll.fromTerms(terms);

                        assert.equal( new SWSERollWrapper(roll).renderWeaponBlockFormulaHTML, '<span>3d8</span><span> + </span><span>9</span>')
                    })

                    it("should correctly print single die rolls", () => {
                        const terms = [];
                        terms.push(new foundry.dice.terms.Die({number: 3, faces: 8}))
                        terms.push(new foundry.dice.terms.OperatorTerm({operator: "+"}))
                        terms.push(new foundry.dice.terms.NumericTerm({number: 9}))

                        const roll = Roll.fromTerms(terms);

                        const additionalTerms = [];
                        additionalTerms.push(new foundry.dice.terms.Die({number: 2, faces: 8}))
                        additionalTerms.push(new foundry.dice.terms.Die({number: 1, faces: 4}))


                        assert.equal( new SWSERollWrapper(roll, additionalTerms).renderWeaponBlockFormulaHTML, '<span>3d8</span><span>/</span><span>2d8</span><span>/</span><span>1d4</span><span> + </span><span>9</span>')
                    })
                })
            })

            describe("attack", () => {
                describe("getDiceTermsFromString", () => {
                    it("should handle a simple single die", ()=>{
                        const {dice, additionalTerms} = getDiceTermsFromString("1d20")
                        assert.equal(dice[0].faces, 20)
                        assert.equal(dice[0].number, 1)
                    })

                    it("should handle a double weapon die", ()=>{
                        const {dice, additionalTerms} = getDiceTermsFromString("3d8/4d6")
                        assert.equal(dice[0].faces, 8)
                        assert.equal(dice[0].number, 3)

                        assert.lengthOf(additionalTerms, 1);
                        assert.equal(additionalTerms[0].faces, 6)
                        assert.equal(additionalTerms[0].number, 4)
                    })
                    it("should handle zero gracefully", ()=>{
                        const {dice, additionalTerms} = getDiceTermsFromString(0)

                        assert.lengthOf(additionalTerms, 0);
                        assert.lengthOf(dice, 0);
                    })
                })
            })

        })
}