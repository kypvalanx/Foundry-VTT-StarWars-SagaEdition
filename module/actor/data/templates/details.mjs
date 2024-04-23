const fields = foundry.data.fields;

export class DetailFields {
	static get common() {
		return {
			details: new fields.SchemaField({
				biography: new fields.HTMLField(),
				description: new fields.HTMLField(),
				species: new fields.StringField({
					required: true,
					initial: "",
					label: "Species",
				}),
				gender: new fields.StringField({
					initial: "",
					label: "Gender",
				}),
				sex: new fields.StringField({
					initial: "",
					label: "Sex",
				}),
				age: new fields.NumberField({
					initial: 0,
					integer: true,
					label: "Age",
				}),
				height: new fields.StringField({
					initial: "",
					label: "Height",
				}),
				weight: new fields.StringField({
					initial: "",
					label: "Weight",
				}),
				cl: new fields.NumberField({
					initial: 0,
					min: 0,
					integer: true,
					label: "Cl",
				}),
				player: new fields.StringField({
					initial: "",
					label: "Player",
				}),
				origClass: new fields.StringField({
					initial: "",
					label: "Original Class",
				}),
			}),
		};
	}
}

export class DetailFunctions {
	get sex() {
		return this.details.gender ?? this.details.sex;
	}
}
