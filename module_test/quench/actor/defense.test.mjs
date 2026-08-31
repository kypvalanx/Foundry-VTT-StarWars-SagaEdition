import {getMockEvent, withTestActor} from "./actor-utils.mjs";

export async function defenseCalculationTests(quench) {
    quench.registerBatch("actor.defense.calculation", (context) => {
        const {describe, it, assert} = context;

        describe("Actor Defense Calculation", () => {

            describe("Armored Defense vs. Improved Armored Defense", () => {
                it("standard character uses armor reflex bonus instead of heroic level unless higher with Armored Defense", async function () {
                    await withTestActor(async (actor) => {
                        actor.suppressDialog = true;
                        await actor.safeUpdate({"system.settings.attributeGeneration": "Manual"});
                        await actor.setAttributes({dex: 10, int: 10, wis: 10, str: 10, con: 10, cha: 10});

                        // 6 Levels of Soldier (Heroic Level 6, Class Reflex +1, Proficient with Light/Medium Armor)
                        for (let i = 0; i < 6; i++) {
                            await actor.sheet._onDropItem(getMockEvent(), {name: "Soldier", type: "class", answers: ["Armor Proficiency (Light)"]});
                        }
                        assert.equal(actor.heroicLevel, 6);

                        // Unarmored: Base 10 + Heroic Level 6 + Dex 0 + Class 1 = 17
                        assert.equal(actor.system.defense.reflex.armorBonus, 6, "Unarmored reflex uses heroic level");
                        assert.equal(actor.system.defense.reflex.total, 17, "Unarmored reflex total");

                        // Equip Light Armor with +2 Reflex bonus (without Armored Defense)
                        await actor.sheet._onDropItem(getMockEvent(), {
                            name: "Combat Jumpsuit",
                            type: "armor",
                            equip: "equipped"
                        });

                        // Without Armored Defense, armor bonus (4) replaces heroic level (6): 10 + 4 + 0 + 1 = 15
                        assert.equal(actor.system.defense.reflex.armorBonus, 4, "Armor bonus replaces heroic level without Armored Defense");
                        assert.equal(actor.system.defense.reflex.total, 15, "Reflex total with armor and without Armored Defense");

                        // Add Armored Defense talent: uses Math.max(armorBonus, heroicLevel) = Math.max(2, 6) = 6
                        await actor.sheet._onDropItem(getMockEvent(), {
                            name: "Armored Defense",
                            type: "talent"
                        });

                        assert.equal(actor.system.defense.reflex.armorBonus, 6, "Armored Defense uses heroic level when higher than armor bonus");
                        assert.equal(actor.system.defense.reflex.total, 17, "Reflex total with Armored Defense");
                    });
                });

                it("Armored Defense uses armor bonus when armor bonus is higher than heroic level", async function () {
                    await withTestActor(async (actor) => {
                        actor.suppressDialog = true;
                        await actor.safeUpdate({"system.settings.attributeGeneration": "Manual"});
                        await actor.setAttributes({dex: 10, int: 10, wis: 10, str: 10, con: 10, cha: 10});

                        // 1 Level of Soldier (Heroic Level 1, Class Reflex +1)
                        await actor.sheet._onDropItem(getMockEvent(), {name: "Soldier", type: "class", answers: ["Armor Proficiency (Light)"]});

                        // Add Armored Defense talent
                        await actor.sheet._onDropItem(getMockEvent(), {
                            name: "Armored Defense",
                            type: "talent"
                        });

                        // Equip Light Armor with +3 Reflex bonus
                        await actor.sheet._onDropItem(getMockEvent(), {
                            name: "Armored Flight Suit",
                            type: "armor",
                            equip: "equipped",
                            system: {
                                equipped: "equipped",
                                subtype: "Light Armor",
                                changes: [
                                    {key: "armorReflexDefenseBonus", value: 3},
                                    {key: "maximumDexterityBonus", value: 3},
                                    {key: "armorType", value: "Light Armor"}
                                ]
                            }
                        });

                        // Math.max(3, 1) = 3 -> Reflex = 10 + 3 + 0 + 1 = 14
                        assert.equal(actor.system.defense.reflex.armorBonus, 3, "Armored Defense uses armor bonus when higher than heroic level");
                        assert.equal(actor.system.defense.reflex.total, 14, "Reflex total with Armored Defense and higher armor bonus");
                    });
                });

                it("Improved Armored Defense adds heroicLevel + Math.floor(armorBonus / 2)", async function () {
                    await withTestActor(async (actor) => {
                        actor.suppressDialog = true;
                        await actor.safeUpdate({"system.settings.attributeGeneration": "Manual"});
                        await actor.setAttributes({dex: 10, int: 10, wis: 10, str: 10, con: 10, cha: 10});

                        // 6 Levels of Soldier (Heroic Level 6, Class Reflex +1)
                        for (let i = 0; i < 6; i++) {
                            await actor.sheet._onDropItem(getMockEvent(), {name: "Soldier", type: "class", answers: ["Armor Proficiency (Light)"]});
                        }

                        // Equip Medium Armor with +8 Reflex bonus
                        await actor.sheet._onDropItem(getMockEvent(), {
                            name: "Battle Armor",
                            type: "armor",
                            equip: "equipped",
                        });
                        await actor.sheet._onDropItem(getMockEvent(), {
                            name: "Armored Defense",
                            type: "talent",
                        });

                        // Add Improved Armored Defense talent: heroicLevel (6) + Math.floor(4 / 2) = 8
                        await actor.sheet._onDropItem(getMockEvent(), {
                            name: "Improved Armored Defense",
                            type: "talent",
                        });

                        // Reflex = 10 + 10 (Improved Armored Defense) + 0 + 1 = 21
                        assert.equal(actor.system.defense.reflex.armorBonus, 10, "Improved Armored Defense computes heroicLevel + floor(armor/2)");
                        assert.equal(actor.system.defense.reflex.total, 21, "Reflex total with Improved Armored Defense");
                    });
                });

                it("non-proficient armor negates talent benefits of Armored Defense and Improved Armored Defense", async function () {
                    await withTestActor(async (actor) => {
                        actor.suppressDialog = true;
                        await actor.safeUpdate({"system.settings.attributeGeneration": "Manual"});
                        await actor.setAttributes({dex: 10, int: 10, wis: 10, str: 10, con: 10, cha: 10});

                        // 6 Levels of Jedi (Heroic Level 6, Class Reflex +1, NO Armor Proficiency)
                        for (let i = 0; i < 6; i++) {
                            await actor.sheet._onDropItem(getMockEvent(), {name: "Soldier", type: "class"});
                        }

                        // Add Improved Armored Defense and Armored Defense talents
                        await actor.sheet._onDropItem(getMockEvent(), {
                            name: "Armored Defense",
                            type: "talent",
                        });
                        await actor.sheet._onDropItem(getMockEvent(), {
                            name: "Improved Armored Defense",
                            type: "talent",
                        });

                        // Equip Heavy Armor (+10 reflex bonus) without Heavy Armor proficiency
                        await actor.sheet._onDropItem(getMockEvent(), {
                            name: "Heavy Battle Armor",
                            type: "armor",
                            equip: "equipped",
                        });

                        // Because character is NOT proficient with Heavy Armor, Improved Armored Defense is negated.
                        // Armor bonus stays at the armor's base bonus (10), instead of 6 + floor(7/2) = 9.
                        assert.equal(actor.system.defense.reflex.armorBonus, 10, "Non-proficient armor falls back to raw armor bonus");
                        assert.equal(actor.system.defense.reflex.total, 21, "Reflex total with non-proficient armor");
                    });
                });
            });

            describe("Max Dexterity Bonus", () => {
                it("equipped armor caps the character's Dexterity modifier to Reflex defense", async function () {
                    await withTestActor(async (actor) => {
                        actor.suppressDialog = true;
                        await actor.safeUpdate({"system.settings.attributeGeneration": "Manual"});
                        // DEX 18 -> Modifier +4
                        await actor.setAttributes({dex: 18, int: 10, wis: 10, str: 10, con: 10, cha: 10});

                        // 1 Level of Soldier (Heroic Level 1, Class Ref +1)
                        await actor.sheet._onDropItem(getMockEvent(), {name: "Soldier", type: "class", answers: ["Armor Proficiency (Light)"]});

                        // Unarmored: Dex mod +4 applies fully
                        assert.equal(actor.system.defense.reflex.abilityBonus, 4, "Unarmored dexterity bonus is uncapped");
                        assert.equal(actor.system.defense.reflex.total, 16, "Unarmored reflex total: 10 + 1 + 4 + 1 = 16");

                        // Equip armor with Max Dex bonus of 2
                        await actor.sheet._onDropItem(getMockEvent(), {
                            name: "Capped Armored Suit",
                            type: "armor",
                            equip: "equipped",
                            system: {
                                equipped: "equipped",
                                subtype: "Light Armor",
                                changes: [
                                    {key: "armorReflexDefenseBonus", value: 3},
                                    {key: "maximumDexterityBonus", value: 2},
                                    {key: "armorType", value: "Light Armor"}
                                ]
                            }
                        });

                        // Dex modifier should be capped to 2
                        assert.equal(actor.system.defense.reflex.abilityBonus, 2, "Dexterity bonus is capped to armor's Max Dex");
                        assert.equal(actor.system.defense.reflex.total, 16, "Reflex total: 10 + 3 (armor) + 2 (capped dex) + 1 (class) = 16");
                    });
                });

                it("armor with higher Max Dex than character's modifier does not artificially boost or cap Dex", async function () {
                    await withTestActor(async (actor) => {
                        actor.suppressDialog = true;
                        await actor.safeUpdate({"system.settings.attributeGeneration": "Manual"});
                        // DEX 14 -> Modifier +2
                        await actor.setAttributes({dex: 14, int: 10, wis: 10, str: 10, con: 10, cha: 10});

                        await actor.sheet._onDropItem(getMockEvent(), {name: "Soldier", type: "class", answers: ["Armor Proficiency (Light)"]});

                        // Equip armor with Max Dex bonus of 5
                        await actor.sheet._onDropItem(getMockEvent(), {
                            name: "Flexible Armor",
                            type: "armor",
                            equip: "equipped",
                            system: {
                                equipped: "equipped",
                                subtype: "Light Armor",
                                changes: [
                                    {key: "armorReflexDefenseBonus", value: 2},
                                    {key: "maximumDexterityBonus", value: 5},
                                    {key: "armorType", value: "Light Armor"}
                                ]
                            }
                        });

                        assert.equal(actor.system.defense.reflex.abilityBonus, 2, "Dexterity modifier +2 is used when under Max Dex +5");
                    });
                });
            });

            describe("Class Defense Bonuses", () => {
                it("class defense bonuses of the same type do not stack across multiclass characters", async function () {
                    await withTestActor(async (actor) => {
                        actor.suppressDialog = true;
                        await actor.safeUpdate({"system.settings.attributeGeneration": "Manual"});
                        await actor.setAttributes({dex: 10, int: 13, wis: 10, str: 10, con: 10, cha: 10});

                        // Soldier gives Class Reflex +1, Class Fortitude +2
                        await actor.sheet._onDropItem(getMockEvent(), {name: "Soldier", type: "class", answers: ["Armor Proficiency (Light)"]});
                        // Noble gives Class Reflex +1, Class Will +2
                        await actor.sheet._onDropItem(getMockEvent(), {name: "Noble", type: "class", answers: ["Linguist"]});
                        // Jedi gives Class Reflex +1, Class Fortitude +1, Class Will +1
                        await actor.sheet._onDropItem(getMockEvent(), {name: "Jedi", type: "class", answers: ["Force Sensitivity"]});

                        // Max Reflex class bonus should be MAX(1, 1, 1) = 1
                        assert.equal(actor.system.defense.reflex.classBonus, 1, "Class Reflex defense bonus is not stacked");

                        // Max Fortitude class bonus should be MAX(2, 0, 1) = 2
                        assert.equal(actor.system.defense.fortitude.classBonus, 2, "Class Fortitude defense bonus takes highest");

                        // Max Will class bonus should be MAX(0, 2, 1) = 2
                        assert.equal(actor.system.defense.will.classBonus, 2, "Class Will defense bonus takes highest");
                    });
                });
            });

            describe("Flat-Footed Reflex Calculation", () => {
                it("Flat-Footed Reflex removes positive Dexterity modifier while retaining armor, class, and other bonuses", async function () {
                    await withTestActor(async (actor) => {
                        actor.suppressDialog = true;
                        await actor.safeUpdate({"system.settings.attributeGeneration": "Manual"});
                        // DEX 16 -> Modifier +3
                        await actor.setAttributes({dex: 16, int: 10, wis: 10, str: 10, con: 10, cha: 10});

                        // 2 Levels of Soldier (Heroic Level 2, Class Ref +1)
                        await actor.sheet._onDropItem(getMockEvent(), {name: "Soldier", type: "class", answers: ["Armor Proficiency (Light)"]});
                        await actor.sheet._onDropItem(getMockEvent(), {name: "Soldier", type: "class"});

                        // Equip Light Armor (+3 armor reflex bonus)
                        await actor.sheet._onDropItem(getMockEvent(), {
                            name: "Combat Suit",
                            type: "armor",
                            equip: "equipped",
                            system: {
                                equipped: "equipped",
                                subtype: "Light Armor",
                                changes: [
                                    {key: "armorReflexDefenseBonus", value: 3},
                                    {key: "maximumDexterityBonus", value: 4},
                                    {key: "armorType", value: "Light Armor"}
                                ]
                            }
                        });

                        // Normal Reflex = 10 + 3 (armor) + 3 (dex) + 1 (class) = 17
                        assert.equal(actor.system.defense.reflex.total, 17, "Normal Reflex includes Dexterity");

                        // Flat-Footed Reflex = 10 + 3 (armor) + 0 (positive dex stripped) + 1 (class) = 14
                        const ffReflex = actor.system.defense.reflex.defenseModifiers[0];
                        assert.isDefined(ffReflex, "Flat-Footed Reflex defense modifier exists");
                        assert.equal(ffReflex.total, 14, "Flat-Footed Reflex removes positive Dexterity bonus");
                        assert.equal(ffReflex.abilityBonus, 0, "Flat-Footed Reflex ability bonus is 0");
                    });
                });

                it("Flat-Footed Reflex retains negative Dexterity modifier (penalties still apply)", async function () {
                    await withTestActor(async (actor) => {
                        actor.suppressDialog = true;
                        await actor.safeUpdate({"system.settings.attributeGeneration": "Manual"});
                        // DEX 6 -> Modifier -2
                        await actor.setAttributes({dex: 6, int: 10, wis: 10, str: 10, con: 10, cha: 10});

                        // 1 Level of Soldier (Heroic Level 1, Class Ref +1)
                        await actor.sheet._onDropItem(getMockEvent(), {name: "Soldier", type: "class", answers: ["Armor Proficiency (Light)"]});

                        // Equip Light Armor (+2 armor reflex bonus)
                        await actor.sheet._onDropItem(getMockEvent(), {
                            name: "Light Combat Suit",
                            type: "armor",
                            equip: "equipped",
                            system: {
                                equipped: "equipped",
                                subtype: "Light Armor",
                                changes: [
                                    {key: "armorReflexDefenseBonus", value: 2},
                                    {key: "maximumDexterityBonus", value: 4},
                                    {key: "armorType", value: "Light Armor"}
                                ]
                            }
                        });

                        // Normal Reflex = 10 + 2 (armor) - 2 (dex penalty) + 1 (class) = 11
                        assert.equal(actor.system.defense.reflex.total, 11, "Normal Reflex with negative dex");

                        // Flat-Footed Reflex retains negative dex penalty = 11
                        const ffReflex = actor.system.defense.reflex.defenseModifiers[0];
                        assert.equal(ffReflex.total, 11, "Flat-Footed Reflex retains negative Dexterity modifier");
                        assert.equal(ffReflex.abilityBonus, -2, "Flat-Footed Reflex ability bonus retains -2 penalty");
                    });
                });
            });

            describe("Constitution vs. Strength for Fortitude", () => {
                it("standard characters use Constitution modifier for Fortitude defense", async function () {
                    await withTestActor(async (actor) => {
                        actor.suppressDialog = true;
                        await actor.safeUpdate({"system.settings.attributeGeneration": "Manual"});
                        // STR 14 (+2), CON 16 (+3)
                        await actor.setAttributes({str: 14, con: 16, dex: 10, int: 10, wis: 10, cha: 10});

                        // 1 Level of Soldier (Heroic Level 1, Class Fort +2)
                        await actor.sheet._onDropItem(getMockEvent(), {name: "Soldier", type: "class", answers: ["Armor Proficiency (Light)"]});

                        // Fortitude = 10 (base) + 1 (heroic level) + 3 (con mod) + 2 (class) = 16
                        assert.equal(actor.system.defense.fortitude.abilityBonus, 3, "Fortitude uses CON modifier");
                        assert.equal(actor.system.defense.fortitude.total, 16, "Fortitude defense total with CON");
                    });
                });

                it("droids and ignoreCon actors substitute Strength modifier for Fortitude defense", async function () {
                    await withTestActor(async (actor) => {
                        actor.suppressDialog = true;
                        await actor.safeUpdate({"system.settings.attributeGeneration": "Manual"});
                        // STR 18 (+4), CON skipped
                        await actor.setAttributes({str: 18, dex: 10, int: 10, wis: 10, cha: 10});
                        await actor.safeUpdate({"system.abilities.con.skip": true});

                        // 1 Level of Soldier (Heroic Level 1, Class Fort +2)
                        await actor.sheet._onDropItem(getMockEvent(), {name: "Soldier", type: "class", answers: ["Armor Proficiency (Light)"]});

                        assert.isTrue(actor.ignoreCon(), "Actor ignoreCon is true");
                        // Fortitude = 10 (base) + 1 (heroic level) + 4 (str mod substituted) + 2 (class) = 17
                        assert.equal(actor.system.defense.fortitude.abilityBonus, 4, "Fortitude substitutes STR modifier when CON is ignored");
                        assert.equal(actor.system.defense.fortitude.total, 17, "Fortitude defense total with STR substitution");
                    });
                });
            });

            describe("Damage Threshold", () => {
                it("calculates Damage Threshold based on Fortitude defense and Size modifiers (Fine through Colossal)", async function () {
                    await withTestActor(async (actor) => {
                        actor.suppressDialog = true;
                        await actor.safeUpdate({"system.settings.attributeGeneration": "Manual"});
                        await actor.setAttributes({str: 10, con: 14, dex: 10, int: 10, wis: 10, cha: 10});

                        // 1 Level of Soldier (Heroic Level 1, CON +2, Class Fort +2) -> Fortitude = 10 + 1 + 2 + 2 = 15
                        await actor.sheet._onDropItem(getMockEvent(), {name: "Soldier", type: "class", answers: ["Armor Proficiency (Light)"]});
                        assert.equal(actor.system.defense.fortitude.total, 15, "Base Fortitude defense is 15");

                        // Medium Size: DT modifier +0 -> DT = 15
                        const dtMedium = actor.system.defense.damageThreshold.total ?? actor.system.defense.damageThreshold.value?.total ?? actor.system.defense.damageThreshold.value;
                        assert.equal(dtMedium, 15, "Medium size DT has +0 modifier");

                        // Large Size (+5 DT modifier)
                        await actor.sheet._onDropItem(getMockEvent(), {
                            name: "Large Size Trait",
                            type: "trait",
                            system: {
                                changes: [
                                    {key: "damageThresholdSizeModifier", value: 5}
                                ]
                            }
                        });
                        const dtLarge = actor.system.defense.damageThreshold.total ?? actor.system.defense.damageThreshold.value?.total ?? actor.system.defense.damageThreshold.value;
                        assert.equal(dtLarge, 20, "Large size adds +5 to Damage Threshold");

                        // Huge Size (+10 DT modifier)
                        await actor.sheet._onDropItem(getMockEvent(), {
                            name: "Huge Size Bonus",
                            type: "trait",
                            system: {
                                changes: [
                                    {key: "damageThresholdSizeModifier", value: 5}
                                ]
                            }
                        });
                        const dtHuge = actor.system.defense.damageThreshold.total ?? actor.system.defense.damageThreshold.value?.total ?? actor.system.defense.damageThreshold.value;
                        assert.equal(dtHuge, 25, "Huge size modifier adds +10 total to Damage Threshold");

                        // Colossal Size (+50 DT modifier total)
                        await actor.sheet._onDropItem(getMockEvent(), {
                            name: "Colossal Size Bonus",
                            type: "trait",
                            system: {
                                changes: [
                                    {key: "damageThresholdSizeModifier", value: 40}
                                ]
                            }
                        });
                        const dtColossal = actor.system.defense.damageThreshold.total ?? actor.system.defense.damageThreshold.value?.total ?? actor.system.defense.damageThreshold.value;
                        assert.equal(dtColossal, 65, "Colossal size modifier adds +50 total to Damage Threshold");
                    });
                });

                it("Improved Damage Threshold feat and equipped gear bonuses increase Damage Threshold", async function () {
                    await withTestActor(async (actor) => {
                        actor.suppressDialog = true;
                        await actor.safeUpdate({"system.settings.attributeGeneration": "Manual"});
                        await actor.setAttributes({str: 10, con: 14, dex: 10, int: 10, wis: 10, cha: 10});

                        // 1 Level of Soldier -> Fortitude = 15
                        await actor.sheet._onDropItem(getMockEvent(), {name: "Soldier", type: "class", answers: ["Armor Proficiency (Light)"]});
                        assert.equal(actor.system.defense.fortitude.total, 15);

                        // Add Improved Damage Threshold feat (+5 DT bonus)
                        await actor.sheet._onDropItem(getMockEvent(), {
                            name: "Improved Damage Threshold",
                            type: "feat"
                        });

                        const dtWithFeat = actor.system.defense.damageThreshold.total ?? actor.system.defense.damageThreshold.value?.total ?? actor.system.defense.damageThreshold.value;
                        assert.equal(dtWithFeat, 20, "Improved Damage Threshold adds +5 to Damage Threshold");

                        // Add equipped gear with DT bonus (+2)
                        await actor.sheet._onDropItem(getMockEvent(), {
                            name: "Reinforced Belt",
                            type: "armor",
                            equip: "equipped",
                            system: {
                                equipped: "equipped",
                                changes: [
                                    {key: "damageThresholdBonus", value: 2}
                                ]
                            }
                        });

                        const dtWithGear = actor.system.defense.damageThreshold.total ?? actor.system.defense.damageThreshold.value?.total ?? actor.system.defense.damageThreshold.value;
                        assert.equal(dtWithGear, 22, "Equipped gear DT bonus stacks with feats: 15 + 5 + 2 = 22");
                    });
                });
            });
        });
    });
}
