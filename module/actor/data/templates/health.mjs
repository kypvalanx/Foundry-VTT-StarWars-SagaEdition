import {getInheritableAttribute} from "../../../attribute-helper.mjs";
import {resolveValueArray} from "../../../common/util.mjs";

const fields = foundry.data.fields;

export class HealthFields {
    static get common() {
        return {
            value: new fields.NumberField({
                initial: 10,
                min: 0,
                integer: true,
                label: "Current HP",
            }),
            max: new fields.NumberField({
                initial: 10,
                min: 0,
                integer: true,
                label: "Maximum HP",
            }),
            bonusHP: new fields.NumberField({
                nullable: true,
                initial: null,
                integer: true,
                min: 0,
                label: "Bonus HP",
            }),
        };
    }
}

export class HealthFunctions {
    _prepareHealthDerivedData() {
        let system = this;
        const actor = system.parent;
        let ignoreCon = actor.isDroid;

        let healthBonuses = [];
        for (let charClass of actor.classes || []) {
            healthBonuses.push(charClass.classLevelHealth);
            healthBonuses.push(ignoreCon ? 0 : system.abilities.con.mod);
        }
        healthBonuses.push(
            ...getInheritableAttribute({
                entity: actor,
                attributeKey: "healthHardenedMultiplier",
                reduce: "NUMERIC_VALUES",
            }).map((value) => "*" + value)
        );

        let traitAttributes = getInheritableAttribute({
            entity: actor,
            attributeKey: "hitPointEq",
        });
        let others = [];
        let multipliers = [];

        for (let item of traitAttributes || []) {
            if (item) {
                others.push(item.value);
                healthBonuses.push(item.value);
                if (
                    item.value &&
                    (item.value.startsWith("*") || item.value.startsWith("/"))
                ) {
                    multipliers.push(item.value);
                }
            }
        }
        let other = resolveValueArray(others, actor);
        let healthMax =
            system.overrides.health ?? resolveValueArray(healthBonuses, actor);

        //Second Winds
        system._prepareSecondWinds();

        //Update totals
        system.health.bonusHP = other;
        if (healthMax !== system.health.max) {
            system.health.max = healthMax;
            this.parent.update({"system.health.max": healthMax});
        }
        system.health.multipliers = multipliers;
    }

    _prepareSecondWinds() {
        let system = this;
        const bonusSecondWind = getInheritableAttribute({
            entity: this,
            attributeKey: "bonusSecondWind",
            reduce: "SUM",
        });
        system.secondWinds = bonusSecondWind + (system.parent.isHeroic ? 1 : 0);
        system.toggles.secondWinds = system.toggles.secondWinds ?? {};
        for (let i = 0; i < system.secondWinds; ++i)
            system.toggles.secondWinds[i] =
                system.toggles.secondWinds[i] ?? false;
    }
}
