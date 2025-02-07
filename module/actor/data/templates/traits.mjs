import {
	filterItemsByTypes,
	inheritableItems,
	ALPHA_FINAL_NAME,
} from "../../../common/util.mjs";

const fields = foundry.data.fields;

export class TraitsFields {
	static get common() {
		return {
			traits: new fields.SchemaField({
				size: new fields.StringField({
					initial: "Medium",
					blank: false,
					label: "Size",
				}),
				wpnProf: new fields.SchemaField({
					value: new fields.ArrayField(new fields.StringField()),
					custom: new fields.StringField(),
				}),
				armProf: new fields.SchemaField({
					value: new fields.ArrayField(new fields.StringField()),
					custom: new fields.StringField(),
				}),
				trSkills: new fields.SchemaField({
					value: new fields.ArrayField(new fields.StringField()),
					custom: new fields.StringField(),
				}),
			}),
		};
	}
}

export class TraitsFunctions {
	_prepareTraitsDerivedData() {
		let system = this;
		let activeTraits = filterItemsByTypes(
			inheritableItems(system.parent),
			["trait"]
		);
		system.traits = activeTraits.sort(ALPHA_FINAL_NAME);
	}
}
