import {getInheritableAttribute} from "../../attribute-helper.mjs";
import {KNOWN_WEIRD_UNITS} from "../../common/constants.mjs";
import {innerJoin, resolveExpression} from "../../common/util.mjs";

import SystemDataModel from "./abstract.mjs";
import CommonActorData from "./commondata.mjs";

import {AbilityFunctions} from "./templates/abilities.mjs";
import {DefenseFunctions} from "./templates/defenses.mjs";
import {DetailFields, DetailFunctions} from "./templates/details.mjs";
import {HealthFunctions} from "./templates/health.mjs";
import {ShieldFunctions} from "./templates/shields.mjs";
import {SkillFields, SkillFunctions} from "./templates/skills.mjs";
import {TraitsFields, TraitsFunctions} from "./templates/traits.mjs";

const fields = foundry.data.fields;
const characterFunctionClasses = [
    AbilityFunctions,
    DefenseFunctions,
    DetailFunctions,
    HealthFunctions,
    ShieldFunctions,
    SkillFunctions,
    TraitsFunctions,
];

export class CharacterDataModel extends SystemDataModel.mixin(...characterFunctionClasses) {
    static _systemType = "character";

    static defineSchema() {
        return {
            ...CommonActorData.commonData,
            ...TraitsFields.character,
            skills: new fields.SchemaField({
                ...SkillFields.character,
            }),
            details: new fields.SchemaField({
                ...DetailFields.character,
            }),
            settings: new fields.SchemaField({
                isNPC: new fields.SchemaField({
                    value: new fields.BooleanField({
                        initial: false,
                        label: "Is NPC",
                    }),
                }),
                ignorePrerequisites: new fields.SchemaField({
                    value: new fields.BooleanField({
                        initial: false,
                        label: "Ignore Prerequisites",
                    }),
                }),
                abilityGeneration: new fields.SchemaField({
                    value: new fields.StringField({
                        initial: "Default",
                        label: "Ability Generation Type",
                    }),
                }),
            }),
            credits: new fields.NumberField({
                initial: 0,
                integer: true,
                min: 0,
                label: "Credits",
            }),
        };
    }

    /**
     * @override
     * This is the final place to manipulate a document's data in a way that is generally
     * accessible within the foundry API. Derived data is the place to calculate modifiers,
     * encumbrance, and all of the other pieces of information you want available.
     *
     * If you have a system data model, you can run type-specific logic here. Keep in mind
     * that you're operating within the system object, so you'll need to call this.parent to
     * access the actual document properties, e.g. this.parent.items to access the items
     * collection.
     */
    prepareDerivedData() {
        //Traits - currently needs to be first for grabbing class level resolved data.
        this._prepareCharacterTraitsDerivedData();

        //Abilities
        this._prepareAbilityDerivedData();

        //Skills
        this._prepareSkillDerivedData();

        //Feats
        let feats = this.parent.resolvedFeats;
        this.feats = feats.activeFeats;
        this.#_manageAutomaticItems(feats.removeFeats).then(() => {});

        //Validate character build choices
        this.#_validateLevelUpOptions();

        //Shields
        this._prepareShieldsDerivedData();

        //Defenses
        this._prepareDefenseDerivedData();

        //Health
        this._prepareHealthDerivedData();

        //Settings
        this.#initializeCharacterSettings();
    }

    #_validateLevelUpOptions() {
        let system = this;
        let actor = system.parent;
        let specificProvided = {};
        let dynamicGroups = {};

        system.availableItems = {};

        //Ability Score level-ups available
        let characterLevel = system.level.value;
        system.availableItems["Ability Score Level Bonus"] =
            (characterLevel - (characterLevel % 4)) / 4;

        system.bonuses = {};
        system.activeFeatures = [];

        //All provided feats, talents, ability score bonuses
        system.#_validateGetProvided(specificProvided, dynamicGroups);

        //All consumed
        system.#_validateGetConsumed();

        //General Feats Available
        system.availableItems["General Feats"] =
            1 +
            Math.floor(characterLevel / 3) +
            (system.availableItems["General Feats"]
                ? system.availableItems["General Feats"]
                : 0);

        //Bonus Talent Trees Available
        let bonusTalentTrees = getInheritableAttribute({
            entity: actor,
            attributeKey: "bonusTalentTree",
            reduce: "VALUES",
        });

        //Talents Available
        let bonusTreeTalents = [];

        system.#_validateAvailableTalents(
            specificProvided,
            bonusTalentTrees,
            bonusTreeTalents
        );

        bonusTreeTalents.forEach((system) => {
            let type = Object.keys(system.availableItems).find((item) =>
                item.includes("Talent")
            );
            system.#_reduceAvailable(type);
        });

        //Feats Available
        system.#_validateAvailableFeats(specificProvided, dynamicGroups);

        //Force Secrets available
        system.#_reduceAvailable(
            "Force Secret",
            actor.itemTypes.forceSecret.length
        );

        //Force Techniques available
        system.#_reduceAvailable(
            "Force Technique",
            actor.itemTypes.forceTechnique.length
        );

        //Force Powers available
        for (let forcePower of actor.itemTypes.forcePower) {
            system.#_reduceAvailable(
                forcePower.system.activeCategory || "Force Powers",
                forcePower.system.quantity,
                "Force Powers"
            );
        }

        //Ability Score level-ups available
        system.remainingLevelUpBonuses =
            system.availableItems["Ability Score Level Bonus"];
    }

    #_validateAvailableFeats(specificProvided, dynamicGroups) {
        let actor = this.parent;
        for (let feat of actor.itemTypes.feat) {
            if (feat.system.supplier.id) {
                continue;
            }
            let type = "General Feats";

            type =
                feat.system.activeCategory ||
                feat.system.bonusFeatCategory ||
                type; //bonusFeatCategory is the old one

            if (!type || type === "General Feats") {
                type = specificProvided[`FEAT:${feat.finalName}`] || type;
            }

            if (!type || type === "General Feats") {
                let bonusFeatCategories = feat.system.possibleProviders.filter(
                    (category) => category !== "General Feats"
                );
                if (bonusFeatCategories && bonusFeatCategories.length === 1) {
                    type = bonusFeatCategories[0];
                } else if (
                    bonusFeatCategories &&
                    bonusFeatCategories.length > 1
                ) {
                    let selection = innerJoin(
                        bonusFeatCategories,
                        Object.keys(this.availableItems)
                    );
                    type = selection[0] || type;
                }
            }

            if (!type || type === "General Feats") {
                for (let entry of Object.entries(dynamicGroups)) {
                    if (entry[1].includes(feat.finalName)) {
                        type = entry[0];
                        break;
                    }
                }
            }

            this.#_reduceAvailable(type, 1, "General Feats");
        }
    }

    #_validateAvailableTalents(
        specificProvided,
        bonusTalentTrees,
        bonusTreeTalents
    ) {
        let system = this;
        let actor = system.parent;
        for (let talent of actor.itemTypes.talent) {
            if (talent.system.supplier?.id) {
                continue;
            }
            let type =
                talent.system.activeCategory || talent.system.talentTreeSource;

            if (!type) {
                type = specificProvided[`TALENT:${talent.finalName}`] || type;
            }

            if (!type) {
                let types = innerJoin(
                    talent.system.possibleProviders,
                    Object.keys(system.availableItems)
                );
                if (types && types.length > 0) {
                    type = types[0];
                }
            }

            if (
                !type &&
                innerJoin(bonusTalentTrees, talent.system.possibleProviders)
                    .length > 0
            ) {
                bonusTreeTalents.push(talent);
                continue;
            }

            system.#_reduceAvailable(type);
        }
    }

    #_validateGetConsumed() {
        let system = this;
        let actor = system.parent;
        for (let consumed of getInheritableAttribute({
            entity: actor,
            attributeKey: "consumes",
            reduce: "VALUES",
        })) {
            let key = consumed;
            let value = 1;
            if (key.includes(":")) {
                let toks = key.split(":");
                key = toks[0];
                if (toks.length === 2) {
                    value = resolveExpression(toks[1], actor);
                }
            }
            system.availableItems = system.availableItems ?? {};
            system.availableItems[key] = system.availableItems[key]
                ? system.availableItems[key] - value
                : 0 - value;
        }
    }

    #_validateGetProvided(specificProvided, dynamicGroups) {
        let system = this;
        let actor = system.parent;
        for (let provided of getInheritableAttribute({
            entity: actor,
            attributeKey: "provides",
        })) {
            let key = provided.value;
            let value = 1;
            if (key.includes(":")) {
                let toks = key.split(":");
                key = toks[0];
                if (toks.length === 2) {
                    value = resolveExpression(toks[1], actor);
                } else if (toks.length === 3) {
                    key = toks[0];
                    value = 1;
                    specificProvided[toks[1] + ":" + toks[2]] = toks[0];
                }
            }

            if (key.endsWith("Starting Feats")) {
                //this means we need to check the source of the provision to figure out what feats are included
                let providingItem = actor.get(provided.source);

                dynamicGroups[key] = actor._explodeFeatNames(
                    getInheritableAttribute({
                        entity: providingItem,
                        attributeKey: "classFeat",
                        reduce: "VALUES",
                    })
                );
            }
            system.availableItems = system.availableItems ?? {};
            system.availableItems[key] = system.availableItems[key]
                ? system.availableItems[key] + value
                : value;
        }
    }

    #_reduceAvailable(type, reduceBy = 1, backupType = null) {
        let system = this;
        let actor = system.parent;

        if (!type && !backupType) {
            if (!KNOWN_WEIRD_UNITS.includes(actor.name)) {
                console.error(
                    "tried to reduce undefined on: " + actor.name,
                    actor
                );
            }
            return;
        }

        //null check
        system.availableItems = system.availableItems ?? {};

        const availableItem = system.availableItems[type] || 0;
        system.availableItems[type] = availableItem - reduceBy;

        if (backupType && system.availableItems[type] < 0) {
            let availableBackup = system.availableItems[backupType] || 0;
            system.availableItems[type] =
                availableBackup + system.availableItems[type];
            system.availableItems[type] = 0;
        }

        if (system.availableItems[type] === 0) {
            delete system.availableItems[type];
        }
        if (system.availableItems[backupType] === 0) {
            delete system.availableItems[backupType];
        }
    }

    async #_manageAutomaticItems(removeFeats) {
        const actor = this.parent;
        let itemIds = Array.from(actor.items.values())
            .flatMap((i) => [i.id, i.flags.core?.sourceId?.split(".")[3]])
            .filter((i) => i !== undefined);

        let removal = [];
        removeFeats.forEach((f) => removal.push(f._id));
        for (let item of actor.items) {
            let itemSystem = item.system;
            if (itemSystem.isSupplied) {
                //console.log(itemIds, itemData.supplier)
                if (
                    !itemIds.includes(itemSystem.supplier.id) ||
                    !itemSystem.supplier
                ) {
                    removal.push(item._id);
                }

                if (
                    item.name === "Precise Shot" &&
                    itemSystem.supplier.name === "Point-Blank Shot" &&
                    !game.settings.get(
                        "swse",
                        "mergePointBlankShotAndPreciseShot"
                    )
                ) {
                    removal.push(item._id);
                }
            }
        }
        if (removal.length > 0) {
            try {
                await actor.deleteEmbeddedDocuments("Item", removal);
            } catch (e) {
                console.log(e);
                //this will be run in to if multiple sessions try to delete teh same item
            }
        }
    }

    #initializeCharacterSettings() {
        const system = this;
        let npcsetting = system.settings.isNPC;
        npcsetting.type = "boolean";
        npcsetting.path = "system.settings.isNPC.value";
        npcsetting.label = "Is NPC";

        let prereqSetting = system.settings.ignorePrerequisites;
        prereqSetting.type = "boolean";
        prereqSetting.path = "system.settings.ignorePrerequisites.value";
        prereqSetting.label = "Ignore Prerequisites";

        let abilitySetting = system.settings.abilityGeneration;
        abilitySetting.type = "select";
        abilitySetting.path = "system.settings.abilityGeneration.value";
        abilitySetting.label = "Ability Generation Type";
        abilitySetting.options = {
            Default: "Default",
            Manual: "Manual",
            Roll: "Roll",
            "Point Buy": "Point Buy",
            "Standard Array": "Standard Array",
        };
    }

    /**
     *
     * There should be no calls to update the database (safeUpdate) within this file.
     * This is here to support the legacy behavior of ability generation
     * TODO: refactor ability generation to be done within the sheet or a new application
     * and remove this.
     */
    setAbilities(abilities) {
        let update = {};
        for (let [key, ability] of Object.entries(abilities)) {
            update[`system.abilities.${key}.base`] = ability;
        }
        this.parent.safeUpdate(update);
    }
}
