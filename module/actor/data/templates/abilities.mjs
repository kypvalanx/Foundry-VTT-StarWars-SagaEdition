import {getInheritableAttribute} from "../../../attribute-helper.mjs";
import {getLongKey, resolveValueArray} from "../../../common/util.mjs";

const fields = foundry.data.fields;

export class AbilityFields {
    static #abilityProperties(ability) {
        return new fields.SchemaField({
            value: new fields.NumberField({
                initial: 10,
                integer: true,
                min: 0,
                label: `${ability} Score`,
            }),
            base: new fields.NumberField({
                nullable: true,
                initial: 10,
                integer: true,
                min: 0,
                label: `${ability} Base`,
            }),
            customBonus: new fields.NumberField({
                initial: 0,
                integer: true,
                label: `${ability} Custom`,
            }),
        });
    }

    static get physical() {
        return {
            str: this.#abilityProperties("Strength"),
            dex: this.#abilityProperties("Dexterity"),
            con: this.#abilityProperties("Constitution"),
        };
    }

    static get mental() {
        return {
            int: this.#abilityProperties("Intelligence"),
            wis: this.#abilityProperties("Wisdom"),
            cha: this.#abilityProperties("Charisma"),
        };
    }
}
export class AbilityFunctions {
    _prepareAbilityDerivedData() {
        let actor = this.parent;
        let abilityGenType = this.settings.abilityGeneration?.value;

        // Loop through ability scores, and add their modifiers to our sheet output.
        for (let [key, ability] of Object.entries(this.abilities)) {
            if (abilityGenType !== "Manual") {
                let longKey = getLongKey(key);
                if (!longKey) continue;

                let bonuses = getInheritableAttribute({
                    entity: actor,
                    attributeKey: `${longKey}Bonus`,
                    reduce: "VALUES",
                });

                ability.bonus = resolveValueArray(bonuses, actor);
            }

            if (ability.base === null) {
                // for certain actors: droids, vehicles
                // set to 10 for no bonuses
                ability.value = 10;
            }
            // Assign the end total. Base is the manual number in case of 'Manual'
            else ability.value = ability.base + (ability.bonus ?? 0);

            // Calculate the modifier using d20 rules.
            ability.mod = Math.floor(
                (ability.value + ability.customBonus - 10) / 2
            );

            // Prepare the roll data
            let totalModifiers = ability.mod + (this.health.condition ?? 0);
            let label = CONFIG.SWSE.abilities[key].label;

            let rollLabel = label;
            actor.setResolvedVariable(
                "@" + key.toUpperCase() + "ROLL",
                "1d20" + (totalModifiers ? " + " : " - ") + totalModifiers,
                rollLabel,
                rollLabel
            );
            rollLabel = label + " Modifer";
            actor.setResolvedVariable(
                "@" + key.toUpperCase() + "MOD",
                totalModifiers,
                rollLabel,
                rollLabel
            );
            rollLabel = label + " Score";
            actor.setResolvedVariable(
                "@" + key.toUpperCase() + "SCORE",
                ability.value,
                rollLabel,
                rollLabel
            );
        }
    }
}
