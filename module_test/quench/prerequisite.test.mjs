import {withTestActor, getMockEvent} from "./actor/actor-utils.mjs";
import {formatPrerequisites, meetsPrerequisites} from "../../module/prerequisite.mjs";

export async function prerequisiteTests(quench) {
    quench.registerBatch("swse.prerequisites", (context) => {
        const {describe, it, assert, expect} = context;

        describe("Prerequisite Engine", () => {

            describe("Edge cases and bypass options", () => {
                it("should pass when prerequisites are null or empty", () => {
                    const result = meetsPrerequisites({}, null);
                    assert.isFalse(result.doesFail);
                    assert.deepEqual(result.failureList, []);
                });

                it("should fail when target is null or undefined", () => {
                    const result = meetsPrerequisites(null, [{type: "BASE ATTACK BONUS", requirement: "1", text: "BAB +1"}]);
                    assert.isTrue(result.doesFail);
                });

                it("should bypass checks when skipPrerequisite option is provided", () => {
                    const result = meetsPrerequisites({characterLevel: 1}, [{type: "CHARACTER LEVEL", requirement: "5", text: "Level 5"}], {skipPrerequisite: true});
                    assert.isFalse(result.doesFail);
                });

                it("should bypass checks when isUpload is true", () => {
                    const result = meetsPrerequisites({characterLevel: 1}, [{type: "CHARACTER LEVEL", requirement: "5", text: "Level 5"}], {isUpload: true});
                    assert.isFalse(result.doesFail);
                });

                it("should bypass checks when ignorePrerequisites is active during load", () => {
                    const target = {system: {ignorePrerequisites: true}};
                    const result = meetsPrerequisites(target, [{type: "CHARACTER LEVEL", requirement: "5", text: "Level 5"}], {isLoad: true});
                    assert.isFalse(result.doesFail);
                });
            });

            describe("Character Level & Base Attack Bonus", () => {
                it("should validate CHARACTER LEVEL correctly", async () => {
                    await withTestActor(async (actor) => {
                        const prereq = {type: "CHARACTER LEVEL", requirement: "3", text: "Character level 3"};
                        const failResult = meetsPrerequisites(actor, prereq);
                        assert.isTrue(failResult.doesFail);

                        await actor.sheet._onDropItem(getMockEvent(), {name: "Soldier", type: "class"});
                        await actor.sheet._onDropItem(getMockEvent(), {name: "Soldier", type: "class"});
                        await actor.sheet._onDropItem(getMockEvent(), {name: "Soldier", type: "class"});

                        const passResult = meetsPrerequisites(actor, prereq);
                        assert.isFalse(passResult.doesFail);
                    });
                });

                it("should validate BASE ATTACK BONUS correctly", async () => {
                    await withTestActor(async (actor) => {
                        const prereq = {type: "BASE ATTACK BONUS", requirement: "2", text: "BAB +2"};
                        assert.isTrue(meetsPrerequisites(actor, prereq).doesFail);

                        await actor.sheet._onDropItem(getMockEvent(), {name: "Soldier", type: "class"});
                        await actor.sheet._onDropItem(getMockEvent(), {name: "Soldier", type: "class"});

                        assert.isFalse(meetsPrerequisites(actor, prereq).doesFail);
                    });
                });
            });

            describe("Age and Size prerequisites", () => {
                it("should validate AGE boundaries", async () => {
                    await withTestActor(async (actor) => {
                        actor.system.age = 20;
                        const validPrereq = {type: "AGE", low: "18", high: "40", text: "Age 18-40"};
                        assert.isFalse(meetsPrerequisites(actor, validPrereq).doesFail);

                        const tooOldPrereq = {type: "AGE", low: "10", high: "15", text: "Age 10-15"};
                        assert.isTrue(meetsPrerequisites(actor, tooOldPrereq).doesFail);

                        const tooYoungPrereq = {type: "AGE", low: "30", text: "Age 30+"};
                        assert.isTrue(meetsPrerequisites(actor, tooYoungPrereq).doesFail);
                    });
                });

                it("should validate SIZE requirements", async () => {
                    await withTestActor(async (actor) => {
                        const finePrereq = {type: "SIZE", requirement: "Fine", text: "Medium size"};
                        const mediumPrereq = {type: "SIZE", requirement: "Medium", text: "Large size"};

                        // Default actor is Fine
                        assert.isFalse(meetsPrerequisites(actor, finePrereq).doesFail);
                        assert.isTrue(meetsPrerequisites(actor, mediumPrereq).doesFail);
                    });
                });
            });

            describe("Attributes and Dark Side Score", () => {
                it("should validate ATTRIBUTE requirements with space-delimited string (LEGACY)", async () => {
                    await withTestActor(async (actor) => {
                        await actor.setAttributes({str: 14, dex: 10});
                        const strPrereq = {type: "ATTRIBUTE", requirement: "STR 13", text: "Str 13"};
                        const highStrPrereq = {type: "ATTRIBUTE", requirement: "STR 16", text: "Str 16"};

                        assert.isFalse(meetsPrerequisites(actor, strPrereq).doesFail);
                        assert.isTrue(meetsPrerequisites(actor, highStrPrereq).doesFail);
                    });
                });
                it("should validate ATTRIBUTE requirements with space-delimited string", async () => {
                    await withTestActor(async (actor) => {
                        await actor.setAttributes({str: 14, dex: 10});
                        const strPrereq = {type: "ABILITY", requirement: "STR 13", text: "Str 13"};
                        const highStrPrereq = {type: "ABILITY", requirement: "STR 16", text: "Str 16"};

                        assert.isFalse(meetsPrerequisites(actor, strPrereq).doesFail);
                        assert.isTrue(meetsPrerequisites(actor, highStrPrereq).doesFail);
                    });
                });

                it("should validate ATTRIBUTE requirements with colon comparison syntax (LEGACY)", async () => {
                    await withTestActor(async (actor) => {
                        //await actor.setAttributes({str: 14});
                        await actor.addChange({key: "str", value: 14});
                        const greaterPrereq = {type: "ATTRIBUTE", requirement: "str:>13", text: "Str > 13"};
                        const lesserPrereq = {type: "ATTRIBUTE", requirement: "str:<10", text: "Str < 10"};
                        const equalPrereq = {type: "ATTRIBUTE", requirement: "str:=14", text: "Str = 14"};

                        assert.isFalse(meetsPrerequisites(actor, greaterPrereq).doesFail);
                        assert.isTrue(meetsPrerequisites(actor, lesserPrereq).doesFail);
                        assert.isFalse(meetsPrerequisites(actor, equalPrereq).doesFail);
                    });
                });

                it("should validate ATTRIBUTE requirements with colon comparison syntax", async () => {
                    await withTestActor(async (actor) => {
                        //await actor.setAttributes({str: 14});
                        await actor.addChange({key: "str", value: 14});
                        const greaterPrereq = {type: "CHANGE", requirement: "str:>13", text: "Str > 13"};
                        const lesserPrereq = {type: "CHANGE", requirement: "str:<10", text: "Str < 10"};
                        const equalPrereq = {type: "CHANGE", requirement: "str:=14", text: "Str = 14"};

                        assert.isFalse(meetsPrerequisites(actor, greaterPrereq).doesFail);
                        assert.isTrue(meetsPrerequisites(actor, lesserPrereq).doesFail);
                        assert.isFalse(meetsPrerequisites(actor, equalPrereq).doesFail);
                    });
                });

                it("should validate DARK SIDE SCORE", async () => {
                    await withTestActor(async (actor) => {
                        actor.system.darkside = {score: 5};
                        const metPrereq = {type: "DARK SIDE SCORE", requirement: "3", text: "Dark Side Score 3"};
                        const unmetPrereq = {type: "DARK SIDE SCORE", requirement: "8", text: "Dark Side Score 8"};

                        assert.isFalse(meetsPrerequisites(actor, metPrereq).doesFail);
                        assert.isTrue(meetsPrerequisites(actor, unmetPrereq).doesFail);
                    });
                });
            });

            describe("Trained Skills", () => {
                it("should validate TRAINED SKILL requirements", async () => {
                    await withTestActor(async (actor) => {
                        const prereq = {type: "TRAINED SKILL", requirement: "Use the Force", text: "Trained in Use the Force"};
                        assert.isTrue(meetsPrerequisites(actor, prereq).doesFail);

                        //actor.system.skills["Use the Force"] = {label: "Use the Force", trained: true};
                        await actor.safeUpdate({"system.skills.Use the Force.trained": true});

                        assert.isFalse(meetsPrerequisites(actor, prereq).doesFail);
                    });
                });
            });

            describe("Feats, Classes and Talents", () => {
                it("should validate exact FEAT requirements and (any) wildcard", async () => {
                    await withTestActor(async (actor) => {
                        const exactFeatPrereq = {type: "FEAT", requirement: "Point-Blank Shot", text: "Point Blank Shot"};
                        const anyFocusPrereq = {type: "FEAT", requirement: "Weapon Focus (any)", text: "Weapon Focus (any)"};

                        assert.isTrue(meetsPrerequisites(actor, exactFeatPrereq).doesFail);
                        assert.isTrue(meetsPrerequisites(actor, anyFocusPrereq).doesFail);

                        await actor.sheet._onDropItem(getMockEvent(), {name: "Soldier", type: "class"});
                        await actor.sheet._onDropItem(getMockEvent(), {name: "Soldier", type: "class"});
                        //await actor.setAttributes({str:13})
                        await actor.sheet._onDropItem(getMockEvent(), {name: "Point-Blank Shot", type: "feat", answers: ["Soldier Bonus Feats"]});
                        assert.isFalse(meetsPrerequisites(actor, exactFeatPrereq).doesFail);

                        await actor.sheet._onDropItem(getMockEvent(), {name: "Weapon Focus (Pistols)", type: "feat"});
                        assert.isFalse(meetsPrerequisites(actor, anyFocusPrereq).doesFail);
                    });
                });

                it("should validate CLASS prerequisites", async () => {
                    await withTestActor(async (actor) => {
                        const jediPrereq = {type: "CLASS", requirement: "Jedi", text: "Jedi class"};
                        assert.isTrue(meetsPrerequisites(actor, jediPrereq).doesFail);

                        await actor.sheet._onDropItem(getMockEvent(), {name: "Jedi", type: "class"});
                        assert.isFalse(meetsPrerequisites(actor, jediPrereq).doesFail);
                    });
                });

                it("should validate TALENT prerequisites by name, tree, or provider", async () => {
                    await withTestActor(async (actor) => {
                        const talentPrereq = {type: "TALENT", requirement: "Block", text: "Block talent"};
                        assert.isTrue(meetsPrerequisites(actor, talentPrereq).doesFail);


                        await actor.sheet._onDropItem(getMockEvent(), {name: "Jedi", type: "class"});

                        await actor.sheet._onDropItem(getMockEvent(), {
                            name: "Block",
                            type: "talent",
                            answers: ["Jedi Talent Talents"]
                        });
                        assert.isFalse(meetsPrerequisites(actor, talentPrereq).doesFail);

                        const treePrereq = {type: "TALENT", requirement: "Lightsaber Combat Talent Tree", text: "Any Lightsaber Combat talent"};
                        assert.isFalse(meetsPrerequisites(actor, treePrereq).doesFail);
                    });
                });
            });

            describe("Proficiencies and Equipment", () => {
                it("should validate PROFICIENCY requirements", async () => {
                    await withTestActor(async (actor) => {
                        const heavyArmorPrereq = {type: "PROFICIENCY", requirement: "Heavy Armor", text: "Armor Proficiency (Heavy)"};
                        assert.isTrue(meetsPrerequisites(actor, heavyArmorPrereq).doesFail);

                        await actor.addChange({key: "armorProficiency", value: "heavy"});
                        assert.isFalse(meetsPrerequisites(actor, heavyArmorPrereq).doesFail);
                    });
                });

                it("should validate EQUIPPED item requirements", async () => {
                    await withTestActor(async (actor) => {
                        const equippedPrereq = {type: "EQUIPPED", requirement: "Heavy Blaster Pistol", text: "Heavy Blaster Pistol equipped"};
                        assert.isTrue(meetsPrerequisites(actor, equippedPrereq).doesFail);

                        await actor.sheet._onDropItem(getMockEvent(), {
                            name: "Heavy Blaster Pistol",
                            type: "weapon",
                            equip: "equipped"
                        });
                        assert.isFalse(meetsPrerequisites(actor, equippedPrereq).doesFail);
                    });
                });
            });

            describe("Logical Operators (AND, OR, NOT)", () => {
                it("should validate AND logic", async () => {
                    await withTestActor(async (actor) => {
                        await actor.setAttributes({str: 14, dex: 10});
                        const andPrereq = {
                            type: "AND",
                            text: "Str 13 and Dex 13",
                            children: [
                                {type: "ATTRIBUTE", requirement: "STR 13", text: "Str 13"},
                                {type: "ATTRIBUTE", requirement: "DEX 13", text: "Dex 13"}
                            ]
                        };

                        assert.isTrue(meetsPrerequisites(actor, andPrereq).doesFail);

                        await actor.setAttributes({str: 14, dex: 14});
                        assert.isFalse(meetsPrerequisites(actor, andPrereq).doesFail);
                    });
                });

                it("should validate OR logic with count requirements", async () => {
                    await withTestActor(async (actor) => {
                        await actor.setAttributes({str: 14, dex: 10});
                        const orPrereq = {
                            type: "OR",
                            count: 1,
                            text: "Str 13 or Dex 13",
                            children: [
                                {type: "ATTRIBUTE", requirement: "STR 13", text: "Str 13"},
                                {type: "ATTRIBUTE", requirement: "DEX 13", text: "Dex 13"}
                            ]
                        };

                        assert.isFalse(meetsPrerequisites(actor, orPrereq).doesFail);

                        await actor.setAttributes({str: 10, dex: 10});
                        assert.isTrue(meetsPrerequisites(actor, orPrereq).doesFail);
                    });
                });

                it("should validate NOT logic", async () => {
                    await withTestActor(async (actor) => {
                        const notDroidPrereq = {
                            type: "NOT",
                            text: "Not a Droid",
                            child: {type: "SPECIAL", requirement: "is a droid", text: "Is a Droid"}
                        };

                        // Living character is not a droid
                        assert.isFalse(meetsPrerequisites(actor, notDroidPrereq).doesFail);

                        await actor.addChange({key: "isDroid", value: true});
                        assert.isTrue(meetsPrerequisites(actor, notDroidPrereq).doesFail);
                    });
                });
            });

            describe("Special conditions and properties", () => {
                it("should validate SPECIAL 'not a droid' and 'is a droid'", async () => {
                    await withTestActor(async (actor) => {
                        const notDroidPrereq = {type: "SPECIAL", requirement: "not a droid", text: "Not a Droid"};
                        const isDroidPrereq = {type: "SPECIAL", requirement: "is a droid", text: "Is a Droid"};

                        assert.isFalse(meetsPrerequisites(actor, notDroidPrereq).doesFail);
                        assert.isTrue(meetsPrerequisites(actor, isDroidPrereq).doesFail);

                        await actor.addChange({key: "isDroid", value: true});
                        assert.isTrue(meetsPrerequisites(actor, notDroidPrereq).doesFail);
                        assert.isFalse(meetsPrerequisites(actor, isDroidPrereq).doesFail);
                    });
                });

                it("should validate GENDER requirements", async () => {
                    await withTestActor(async (actor) => {
                        await actor.safeUpdate({"system.details.sex": "Female"});
                        const femalePrereq = {type: "GENDER", requirement: "Female", text: "Female"};
                        const malePrereq = {type: "GENDER", requirement: "Male", text: "Male"};

                        assert.isFalse(meetsPrerequisites(actor, femalePrereq).doesFail);
                        assert.isTrue(meetsPrerequisites(actor, malePrereq).doesFail);
                    });
                });
            });

            describe("Formatting Utilities", () => {
                it("should format failures as HTML list correctly", () => {
                    const failures = [
                        {message: "Base Attack Bonus +5"},
                        {message: "all of:", children: [{message: "Str 13"}, {message: "Dex 13"}]}
                    ];
                    const html = formatPrerequisites(failures, "html");
                    assert.include(html, "<ul>");
                    assert.include(html, "<li>Base Attack Bonus +5</li>");
                    assert.include(html, "all of:");
                    assert.include(html, "<li>Str 13</li>");
                });

                it("should format failures as plain text array string", () => {
                    const failures = [{message: "Base Attack Bonus +5"}, {message: "Point Blank Shot"}];
                    const plain = formatPrerequisites(failures, "plain");
                    assert.equal(plain, '["Base Attack Bonus +5","Point Blank Shot",]');
                });
            });

        });
    });
}
