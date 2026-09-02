import {AbilityFields} from "./templates/abilities.mjs";
import {HealthFields} from "./templates/health.mjs";
import {ShieldFields} from "./templates/shields.mjs";
import {DefenseFields} from "./templates/defenses.mjs";

const fields = foundry.data.fields;

export default class CommonActorData {
    static get commonData() {

        return {
            test: new fields.BooleanField({initial: false, label:"this is only true if this was created during testing"}),
            abilities: new fields.SchemaField({
                ...AbilityFields.physical,
                ...AbilityFields.mental,
            }),
            ...AbilityFields.darkside,
            health: new fields.SchemaField({
                ...HealthFields.common,
            }),
            shields: new fields.SchemaField({
                ...ShieldFields.common,
            }),
            toggles: new fields.ObjectField({
                label: "Stored Sheet Toggles",
            }),
            overrides: new fields.ObjectField({
                label: "Stored Sheet Overrides",
            }),
            actorLinks: new fields.ArrayField(new fields.SchemaField({
                id: new fields.DocumentIdField(),
                uuid: new fields.StringField({required: true}),
                position: new fields.StringField({initial: "neutral"}),
                slot: new fields.StringField({
                    nullable: true,
                    initial: null}),
            }), {
                label: "Actor Links",
                initial: []
            }),
            changes: new fields.ArrayField(new fields.SchemaField({
                key: new fields.StringField({required: true}),
                mode: new fields.NumberField({required: true, initial: 2}),
                priority: new fields.NumberField({initial: 1}),
                value: new fields.StringField({})
            })),
            settings: new fields.SchemaField({
                isNPC: new fields.BooleanField({
                    initial: false
                }),
                autoSizeToken: new fields.BooleanField({
                    initial: false
                }),
                allowSheetLighting: new fields.BooleanField({
                    initial: false
                }),
                ignorePrerequisites: new fields.BooleanField({
                    initial: false
                }),
                ignorePrerequisitesOnDrop: new fields.BooleanField({
                    initial: false
                }),
                attributeGeneration: new fields.StringField({
                    initial: "Default",
                    label: "Ability Generation",
                }),
            }),
            defense: new fields.SchemaField({
                ...DefenseFields.character
            })
        };
    }
}
