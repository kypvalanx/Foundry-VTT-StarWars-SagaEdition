import {getInheritableAttribute} from "../../../attribute-helper.mjs";

const fields = foundry.data.fields;

export class ShieldFields {
	static get common() {
		return {
			shields: new fields.SchemaField({
				value: new fields.NumberField({
					step: 5,
					integer: true,
					min: 0,
					label: "Current Shields",
				}),
				max: new fields.NumberField({
					nullable: true,
					initial: null,
					step: 5,
					integer: true,
					min: 0,
					label: "Maximum Shields",
				}),
			}),
		};
	}
}

export class ShieldFunctions {
	// set shieldValue(shields) {
	// 	let max = this.overrides.shields ?? this.shields.max;
	// 	if (this.shields.value > max) shields = this.shields.max;
	// 	else if (shields > max) return;

	// 	this.parent.safeUpdate({
	// 		"system.shields.value": shields < 0 ? 0 : shields,
	// 	});
	// }

	_prepareShieldsDerivedData() {
		let system = this;
		const actor = system.parent;

		if (!system.overrides.shields) {
			//Shield Rating
			let shieldRating = getInheritableAttribute({
				entity: actor,
				attributeKey: "shieldRating",
				reduce: "SUM",
			});

			//Advanced Shield Rating
			let advancedShieldRating = getInheritableAttribute({
				entity: actor,
				attributeKey: "advancedShieldRating",
				reduce: "MAX",
			});
			//Calculate max shields based on the advanced shield rating and the shield rating
			//TODO make sure the 0 state doesn't activate if a users shields are dropped to 0
			if (advancedShieldRating > 0) {
				if (shieldRating === 0) {
					shieldRating = advancedShieldRating * 2 + 10;
				} else {
					shieldRating = shieldRating + advancedShieldRating;
				}
			}
			system.shields.max = shieldRating;
		} else {
			system.shields.max = system.overrides.shields;
		}

		if (system.shields.value > system.shields.max)
			system.shields.value = system.shields.max;

		//Failure Chance
		let failureChance = getInheritableAttribute({
			entity: actor,
			attributeKey: "shieldFailureChance",
			reduce: "MAX",
		});
		system.shields.failureChance = failureChance;

		//Active
		let active = !!actor.effects.find(
			(effect) =>
				effect.statuses.has("shield") && effect.disabled === false
		);
		system.shields.active = active;
	}
}
