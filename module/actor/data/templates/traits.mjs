import {
    filterItemsByType,
    inheritableItems,
    ALPHA_FINAL_NAME,
} from "../../../common/util.mjs";

const fields = foundry.data.fields;

export class TraitsFields {
    //Data common for all actors which needs to be persisted in the database
    static #_common() {
        return {
            xp: new fields.StringField({
                initial: "",
                label: "XP",
            }),
            baseAttack: new fields.NumberField({}),
            grapple: new fields.NumberField({}),
        };
    }

    //Data common for all character actors which needs to be persisted in the database
    static #_commonCharacter() {
        return {
            forcePoints: new fields.NumberField({
                initial: 0,
                integer: true,
                min: 0,
                label: "ForcePoints",
            }),
            destinyPoints: new fields.NumberField({
                initial: 0,
                integer: true,
                min: 0,
                label: "DestinyPoints",
            }),
            darkSideScore: new fields.NumberField({
                initial: 0,
                min: 0,
                integer: true,
                label: "Darkside Score",
            }),
        };
    }

    //Data common for all player character actors which needs to be persisted in the database
    static get character() {
        return {
            ...this.#_common(),
            ...this.#_commonCharacter(),
        };
    }

    //Data common for all non-player character actors which need to be persisted in the database
    static get npc() {
        return {
            ...this.#_common(),
            ...this.#_commonCharacter(),
            level: new fields.SchemaField({
                value: new fields.NumberField({
                    initial: 0,
                    min: 0,
                    integer: true,
                    label: "Character Level",
                }),
            }),
            cl: new fields.SchemaField({
                value: new fields.NumberField({
                    initial: 0,
                    min: 0,
                    integer: true,
                    label: "Challenge Level",
                }),
            }),
            speed: new fields.SchemaField({
                base: new fields.NumberField({
                    initial: 6,
                    min: 0,
                    integer: true,
                    label: "Base Speed",
                }),
                swim: new fields.NumberField({
                    initial: 1.5,
                    min: 0,
                    step: 0.1,
                    label: "Swim Speed",
                }),
                climb: new fields.NumberField({
                    initial: 1.5,
                    min: 0,
                    step: 0.1,
                    label: "Climb Speed",
                }),
                fly: new fields.NumberField({
                    nullable: true,
                    initial: null,
                    min: 0,
                    integer: true,
                    label: "Fly Speed",
                }),
                special: new fields.StringField({
                    initial: "",
                    label: "Movement Special",
                }),
            }),
            size: new fields.StringField({
                initial: "Medium",
                blank: false,
                label: "Size",
            }),
            reach: new fields.NumberField({
                initial: 1,
                min: 1,
                integer: true,
                label: "Reach",
            }),
        };
    }
}

export class TraitsFunctions {
    _prepareCharacterTraitsDerivedData() {
        let system = this;
        let actor = this.parent;
        let classData = actor.resolvedClassData;

        system.level = system.level ?? {};
        system.level.value = classData.level;
        system.classSummary = classData.classSummary;
        system.classLevel = classData.classLevels;

        if (
            game.settings.get("swse", "enableEncumbranceByWeight") &&
            actor.weight >= actor.heavyLoad
        ) {
            system.heavyLoad = true;
        } else system.heavyLoad = false;

        let activeTraits = filterItemsByType(inheritableItems(actor), "trait");
        system.traits = activeTraits.sort(ALPHA_FINAL_NAME);
    }

    // _prepareNpcTraitsDerivedData() {
    // 	let system = this;
    // 	let actor = this.parent;
    // 	// No derived trait data for npc characters
    // }
}
