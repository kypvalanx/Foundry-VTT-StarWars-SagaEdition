const fields = foundry.data.fields;

export class AttributeFields {
	static get common() {
		return {
			attributes: new fields.SchemaField({
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
					special: new fields.StringField(),
				}),
				darkSideScore: new fields.NumberField({
					initial: 0,
					min: 0,
					integer: true,
					label: "Darkside Score",
				}),
			}),
			toggles: new fields.ObjectField({
				label: "Stored Sheet Toggles",
			}),
			overrides: new fields.ObjectField({
				label: "Stored Sheet Overrides",
			}),
		};
	}
}

export class AttributeFunctions {
	_prepareAttributesDerivedData() {
		let system = this;
		let actor = this.parent;
		let classData = actor.resolvedClassData;

		system.attributes.level.value = classData.level;
		if (actor.type === "character") {
			system.attributes.cl.value = classData.level;
		}

		system.classSummary = classData.classSummary;
		system.classLevel = classData.classLevels;

		if (
			actor.type === "character" &&
			game.settings.get("swse", "enableEncumbranceByWeight") &&
			actor.weight >= actor.heavyLoad
		) {
			system.attributes.heavyLoad = true;
		} else system.attributes.heavyLoad = false;
	}
}
