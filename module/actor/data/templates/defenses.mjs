import {getInheritableAttribute} from "../../../attribute-helper.mjs";
import {equippedItems, resolveValueArray, toNumber} from "../../../common/util.mjs";

const fields = foundry.data.fields;

export class DefenseFields {
    //data scheme for npcs
    static get npc() {
        return {
            ref: new fields.SchemaField({
                value: new fields.NumberField({
                    initial: 10,
                    integer: true,
                    min: 0,
                    label: `Reflex Defense`,
                }),
            }),
            fort: new fields.SchemaField({
                value: new fields.NumberField({
                    initial: 10,
                    integer: true,
                    min: 0,
                    label: `Fortitude Defense`,
                }),
            }),
            will: new fields.SchemaField({
                value: new fields.NumberField({
                    initial: 10,
                    integer: true,
                    min: 0,
                    label: `Will Defense`,
                }),
            }),
            reff: new fields.SchemaField({
                value: new fields.NumberField({
                    initial: 10,
                    integer: true,
                    min: 0,
                    label: `Reflex flat-footed Defense`,
                }),
            }),
            special: new fields.StringField({
                initial: "",
                label: "Defense Special",
            }),
            dr: new fields.NumberField({
                initial: 0,
                integer: true,
                min: 0,
                label: `Damage Reduction`,
            }),
        };
    }

    static get character() {
        return {
            damageThreshold:  new fields.SchemaField({
                misc: new fields.NumberField({
                    initial: 0,
                    integer: true,
                    label: `Misc Damage Threshold`,
                })
            }),
        }
    }
}
export class DefenseFunctions {
    get armorBonus() {
        let actor = this.parent;
        let armorReflexDefenseBonus = this.armorReflexDefenseBonus || 0;

        if (["vehicle", "npc-vehicle"].includes(actor.type)) {
            if (actor.pilot) {
                let armorBonus = actor.pilot.items.filter(
                    (i) =>
                        i.type === "class" &&
                        Object.values(i.system.attributes).find(
                            (a) => a.key === "isHeroic"
                        ).value
                ).length;
                return Math.max(armorBonus, armorReflexDefenseBonus);
            } else {
                return armorReflexDefenseBonus;
            }
        } else {
            return this._selectRefBonus(
                actor,
                actor.heroicLevel,
                armorReflexDefenseBonus
            );
        }
    }

    get armorReflexDefenseBonus() {
        let bonuses = equippedItems(this.parent, "armor")
            .map((i) => i.armorReflexDefenseBonus)
            .filter((bonus) => !!bonus);

        if (bonuses.length === 0) {
            return undefined;
        }
        return Math.max(...bonuses);
    }

    resolvedFort(condition) {
        const actor = this.parent;
        let fortitudeDefense = this.defense?.fortitude ?? {};

        /** @type {{value: number, type: string}[]} */
        let bonuses = [];
        bonuses.push({value: 10, type: "Base"});

        //+ heroic level
        let heroicLevel = actor.heroicLevel;
        bonuses.push({value: heroicLevel, type: "Armor"});

        //+ equipment bonus
        let equipmentBonus = this._getEquipmentFortBonus(actor);
        bonuses.push({value: equipmentBonus, type: "Armor"});

        //+ ability modifier
        let ability = actor.isDroid || actor.ignoreCon()?
            CONFIG.SWSE.Defense.defense.fortitude.droidAbility :
            CONFIG.SWSE.Defense.defense.fortitude.ability;
        let abilityBonus = actor.system.abilities[ability].mod;
        bonuses.push({value: abilityBonus, type: "Ability"});

        //+ class bonus
        let classBonus =
            getInheritableAttribute({
                entity: actor,
                attributeKey: "classFortitudeDefenseBonus",
                reduce: "MAX",
            }) || 0;
        bonuses.push({value: classBonus, type: "Class"});

        //+ fortitude defense bonus
        let fortitudeDefenseBonus = getInheritableAttribute({
            entity: actor,
            attributeKey: "fortitudeDefenseBonus",
            reduce: ["SUM", "SUMMARY", "MAPPED"],
            attributeFilter: (attr) => !attr.modifier,
        });
        bonuses.push({value: fortitudeDefenseBonus["SUM"], type: "Miscellaneous"});

        //+ condition modifier
        bonuses.push({value: condition, type: "Condition"});


        //total
        let name = "Fortitude";
        let total = this.overrides.fort ?? resolveValueArray(bonuses, actor);

        actor.setResolvedVariable("@FortDef", total, name, name);
        fortitudeDefense.name = name;
        fortitudeDefense.defenseBlock = true;

        this.applyBonuses(fortitudeDefense, total, bonuses);
        return fortitudeDefense;
    }

     resolvedWill(condition) {
        const system = this;
        const actor = system.parent;
        const skip = ["vehicle", "npc-vehicle"].includes(actor.type);
        let willDefense = system.defense?.will ?? {};
        let bonuses = [];
        bonuses.push(10); //base

        //+ heroic level
        let heroicLevel = actor.heroicLevel;
        bonuses.push(heroicLevel);

        //+ ability modifier
        let ability = actor.isDroid ?
            CONFIG.SWSE.Defense.defense.will.droidAbility :
            CONFIG.SWSE.Defense.defense.will.ability;
        let abilityBonus = actor.system.abilities[ability]?.mod ?? 0;
        bonuses.push(abilityBonus);
        willDefense.abilityBonus = abilityBonus;

        bonuses.push(...this.implantInterference(actor))
        //+ class bonus
        let classBonus =
            getInheritableAttribute({
                entity: actor,
                attributeKey: "classWillDefenseBonus",
                reduce: "MAX",
            }) || 0;
        bonuses.push(classBonus);
        willDefense.classBonus = classBonus;

        //+ will defense bonus
        let willDefenseBonus = getInheritableAttribute({
            entity: actor,
            attributeKey: "willDefenseBonus",
            reduce: ["SUM", "SUMMARY", "MAPPED"],
            attributeFilter: (attr) => !attr.modifier,
        });

        let otherBonus = willDefenseBonus["SUM"];
        let miscBonusTip = willDefenseBonus["SUMMARY"];
        let miscBonuses = [otherBonus, condition];

        for (let val of getInheritableAttribute({
            entity: actor,
            attributeKey: "applyBonusTo",
            reduce: "VALUES",
        })) {
            if (val.toLowerCase().endsWith(":will")) {
                let toks = val.split(":");
                let attributeKey = toks[0];

                if (attributeKey === "equipmentFortitudeDefenseBonus") {
                    let equipmentFortBonus = this._getEquipmentFortBonus(actor);
                    miscBonuses.push(equipmentFortBonus);
                    miscBonusTip +=
                        "Equipment Fort Bonus: " + equipmentFortBonus;
                } else {
                    let inheritableAttribute = getInheritableAttribute({
                        entity: actor,
                        attributeKey: attributeKey,
                        reduce: ["SUM", "SUMMARY", "MAPPED"],

                        attributeFilter: (attr) => !attr.modifier,
                    });

                    miscBonuses.push(inheritableAttribute["SUM"]);
                    miscBonusTip += inheritableAttribute["SUMMARY"];
                }
            }
        }
        miscBonusTip += `Condition: ${condition};  `;
        willDefense.miscBonusTip = miscBonusTip;

        let miscBonus = resolveValueArray(miscBonuses);
        bonuses.push(miscBonus);
        willDefense.miscBonus = miscBonus;

        let armorBonus = resolveValueArray([heroicLevel]);
        willDefense.armorBonus = armorBonus;

        let total = system.overrides.will ?? resolveValueArray(bonuses, actor);
        let name = "Will";
        willDefense.value = total;
        willDefense.total = total;
        actor.setResolvedVariable("@WillDef", total, name, name);
        willDefense.name = name;
        willDefense.skip = skip;
        willDefense.defenseBlock = true;
        return willDefense;
    }

     implantInterference(actor) {
        let disruption = getInheritableAttribute({
            entity: actor,
            attributeKey: "implantDisruption",
            reduce: "OR"
        })
        let training = getInheritableAttribute({
            entity: actor,
            attributeKey: "implantTraining",
            reduce: "OR"
        })

        if(disruption && !training){
            return [-2]
        }

        return [];
    }

    resolvedRef(condition) {
        const system = this;
        const actor = system.parent;
        let reflexDefense = system.defense?.ref ?? {};

        /** @type {{value: number, type: string}[]} */
        let bonuses = [];
        bonuses.push({value: 10, type: "Base"});

        //+ armor/level bonus
        let armorBonus = this.armorBonus;
        bonuses.push({value: armorBonus, type: "Armor"});

        //+ ability modifier
        let ability = actor.isDroid ?
            CONFIG.SWSE.Defense.defense.reflex.droidAbility :
            CONFIG.SWSE.Defense.defense.reflex.ability;
        let abilityBonus = Math.min(
            actor.system.abilities[ability].mod,
            this._getEquipmentMaxDexBonus(actor)
        );
        bonuses.push({value: abilityBonus, type: "Ability"});

        //+ class bonus
        let classBonus =
            getInheritableAttribute({
                entity: actor,
                attributeKey: "classReflexDefenseBonus",
                reduce: "MAX",
            }) || 0;
        bonuses.push({value: classBonus, type: "Class"});

        //+ reflex defense bonus
        let reflexDefenseBonus = getInheritableAttribute({
            entity: actor,
            attributeKey: "reflexDefenseBonus",
            reduce: ["SUM", "SUMMARY", "MAPPED"],
            attributeFilter: (attr) => !attr.modifier,
        });
        let otherBonus = reflexDefenseBonus["SUM"];
        bonuses.push({value: otherBonus, type: "Miscellaneous"});

        let naturalArmorBonus = getInheritableAttribute({
            entity: actor,
            attributeKey: "naturalArmorReflexDefenseBonus",
            reduce: "SUM",
            attributeFilter: (attr) => !attr.modifier,
        });

        let bonusDodgeReflexDefense = getInheritableAttribute({
            entity: actor,
            attributeKey: "bonusDodgeReflexDefense",
            reduce: ["SUM", "SUMMARY", "MAPPED"],
            attributeFilter: (attr) => !attr.modifier,
        });

        if (
            game.settings.get("swse", "enableEncumbranceByWeight") &&
            actor.weight >= actor.strainCapacity
        ) {
            const negativeAbilityBonus = abilityBonus * -1;
            bonuses.push({value: negativeAbilityBonus, type: "Encumbrance"});
            //miscBonusTip += `Strained Capacity: ${negativeAbilityBonus};  `;
        }
        bonuses.push({value: bonusDodgeReflexDefense["SUM"], type: "Dodge"});
        bonuses.push({value: condition, type: "Condition"});
        bonuses.push({value: naturalArmorBonus, type: "Natural"});

        reflexDefense.defenseModifiers = [
            this._resolveFFRef(
                actor,
                bonuses,
                reflexDefense.defenseModifiers
            ),
        ];

        let total = system.overrides.ref ?? resolveValueArray(bonuses, actor);
        let name = "Reflex";
        reflexDefense.value = total;
        reflexDefense.total = total;
        actor.setResolvedVariable("@RefDef", total, name, name);

        reflexDefense.name = name;
        reflexDefense.skip = false;
        reflexDefense.defenseBlock = true;

        this.applyBonuses(reflexDefense, total, bonuses)

        return reflexDefense;
    }

     applyBonuses(defense, total, bonuses) {
        defense.total = defense.override ? defense.override : total;
        defense.abilityBonus = bonuses.find(b => b.type === "Ability")?.value || 0;
        defense.armorBonus = bonuses.find(b => b.type === "Armor")?.value || 0;
        defense.classBonus = bonuses.find(b => b.type === "Class")?.value || 0;
        const miscBonus = bonuses.filter(b => !(b.type === "Ability" || b.type === "Armor" || b.type === "Class" || b.type === "Base"));
        defense.miscBonus = miscBonus.reduce((acc, obj) => acc + obj.value, 0);
        defense.miscBonusTip = miscBonus.map(b => `${b.type} ${b.value > -1 ? "Bonus" : "Modifier"}: ${b.value}`).join("\n");
    }

    _prepareDefenseDerivedData() {
        let system = this;
        const actor = system.parent;
        system.defense = system.defense ?? {};

        let condition = getInheritableAttribute({
            entity: actor,
            attributeKey: "condition",
            reduce: "FIRST"
        }) || "0"

        condition = condition === "OUT" ?  "0" : condition;

        //TODO can we filter attributes by proficiency in the get search so we can get rid of some of the complex armor logic?

        system.defense.fortitude = this.resolvedFort(condition);
        system.defense.will = this.resolvedWill(condition);
        system.defense.reflex = this.resolvedRef(condition);
        system.defense.damageThreshold = this._resolveDt(system);
        system.defense.situationalBonuses = this._getSituationalBonuses(actor);
        system.defense.damageReduction = getInheritableAttribute({
            entity: actor,
            attributeKey: "damageReduction",
            reduce: "SUM",
        });

        let armors = [];

        for (const armor of actor.itemTypes.armor.filter(
            (item) => item.system.equipped
        )) {
            armors.push(this.generateArmorBlock(actor, armor));
        }
        system.armors = armors;
    }

    _getEquipmentMaxDexBonus(actor) {
        let equipped = actor.itemTypes.armor.filter(
            (item) => item.equipped === "equipped"
        );
        let bonus = 1000;

        for (let item of equipped) {
            let maximumDexterityBonus = item.maximumDexterityBonus;
            if (!isNaN(maximumDexterityBonus)) {
                bonus = Math.min(bonus, maximumDexterityBonus);
            }
        }

        return bonus;
    }

    _getEquipmentFortBonus(actor) {
        let equipped = actor.items.filter((item) => item.system.equipped);
        let bonus = 0;

        for (let item of equipped) {
            if (item.fortitudeDefenseBonus) {
                bonus = Math.max(bonus, item.fortitudeDefenseBonus);
            }
        }

        return bonus;
    }

    _selectRefBonus(actor, heroicLevel, armorBonus) {
        if (armorBonus) {
            let proficientWithEquipped = true;

            for (const armor of actor.itemTypes.armor.filter(
                (item) => item.system.equipped
            )) {
                if (!armor._parentIsProficientWithArmor()) {
                    proficientWithEquipped = false;
                }
            }

            if (proficientWithEquipped) {
                let improvedArmoredDefense = getInheritableAttribute({
                    entity: actor,
                    attributeKey: "improvedArmoredDefense",
                    reduce: "OR",
                });
                if (improvedArmoredDefense) {
                    return Math.max(
                        armorBonus,
                        heroicLevel + Math.floor(armorBonus / 2)
                    );
                }

                let armoredDefense = getInheritableAttribute({
                    entity: actor,
                    attributeKey: "armoredDefense",
                    reduce: "OR",
                });
                if (armoredDefense || actor.isFollower) {
                    return Math.max(armorBonus, heroicLevel);
                }
            }
            return armorBonus;
        }
        return heroicLevel;
    }

    _resolveFFRef(
        actor, bonuses, defenseModifiers
    ) {
        bonuses = JSON.parse(JSON.stringify(bonuses));

        bonuses = bonuses.filter(b => !((b.type === "Ability" && b.value > -1) || b.type === "Encumbrance"));

        let total = resolveValueArray(bonuses, actor);
        let name = 'Reflex (Flat-Footed)';

        actor.setResolvedVariable("@RefFFDef", total, name, name);

        let ffReflexDefense =  {};
        if(defenseModifiers){
            ffReflexDefense = defenseModifiers['reflex (flat-footed)'] || {};
        }

        this.applyBonuses(ffReflexDefense, total, bonuses)
        ffReflexDefense.name = name;
        ffReflexDefense.skip = false;
        ffReflexDefense.defenseBlock = true;
        return ffReflexDefense
    }

    _resolveDt(system) {
        const actor = system.parent;
        let bonuses = [];
        const damageThreshold = system.defense.damageThreshold;

        bonuses.push(system.defense.fortitude.value);
        bonuses.push(this._getDamageThresholdSizeMod(actor));
        bonuses.push(
            getInheritableAttribute({
                entity: actor,
                attributeKey: "damageThresholdBonus",
                reduce: "SUM",
            })
        );
        bonuses.push(
            ...getInheritableAttribute({
                entity: actor,
                attributeKey: "damageThresholdHardenedMultiplier",
                reduce: "NUMERIC_VALUES",
            }).map((value) => "*" + value)
        );
        bonuses.push(damageThreshold.misc)

        let total = resolveValueArray(bonuses, actor);
        damageThreshold.total = total
        damageThreshold.value = total

        return damageThreshold
    }

    _getDamageThresholdSizeMod(actor) {
        let attributes = actor.getTraitAttributesByKey(
            "damageThresholdSizeModifier"
        );
        let total = [];

        for (let attribute of attributes) {
            total.push(attribute);
        }

        return toNumber(resolveValueArray(total, actor));
    }

    _getSituationalBonuses(actor) {
        let defenseBonuses = getInheritableAttribute({
            entity: actor,
            attributeKey: [
                "fortitudeDefenseBonus",
                "reflexDefenseBonus",
                "willDefenseBonus",
            ],
            attributeFilter: (attr) => !!attr.modifier,
        });

        let situational = [];
        for (let defenseBonus of defenseBonuses) {
            let value = toNumber(defenseBonus.value);
            let defense = defenseBonus.key.replace("DefenseBonus", "");
            situational.push(
                `${(value > -1 ? "+" : "") + value} ${value < 0 ? "penalty" : "bonus"
                } to their ${defense.titleCase()} Defense to resist ${defenseBonus.modifier
                }`
            );
        }

        let immunities = getInheritableAttribute({
            entity: actor,
            attributeKey: "immunity",
        });

        for (let immunity of immunities) {
            situational.push(`Immunity: ${immunity.value}`);
        }

        return situational;
    }

    generateArmorBlock(actor, armor) {
        let attributes = getInheritableAttribute({
            entity: armor,
            attributeKey: "special",
            reduce: "VALUES",


        });
        if (!armor._parentIsProficientWithArmor()) {
            attributes.push("(Not Proficient)");
        }
        const notes = attributes.join(", ");
        return {
            name: armor.name,
            refDefense: armor.armorReflexDefenseBonus,
            fortDefense: armor.fortitudeDefenseBonus,
            maxDex: armor.maximumDexterityBonus,
            notes: notes,
            subtype: armor.armorType,
            notesHTML: notes,
            notesText: notes,
            modes : armor.modes
        };
    }
}
