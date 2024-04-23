import {getInheritableAttribute} from "../../../attribute-helper.mjs";
import {
	equippedItems,
	resolveValueArray,
	toNumber,
} from "../../../common/util.mjs";

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

	get resolvedFort() {
		const system = this;
		const actor = system.parent;
		let fortitudeDefense = system.defense?.fort ?? {};
		let bonuses = [];
		bonuses.push(10); //base

		//+ heroic level
		let heroicLevel = actor.heroicLevel;
		bonuses.push(heroicLevel);

		//+ ability modifier
		let ability = actor.isDroid ? "str" : CONFIG.SWSE.defenses.fort.ability;
		let abilityBonus = system.abilities[ability].mod;
		bonuses.push(abilityBonus);
		fortitudeDefense.abilityBonus = abilityBonus;

		//+ class bonus
		let classBonus =
			getInheritableAttribute({
				entity: actor,
				attributeKey: "classFortitudeDefenseBonus",
				reduce: "MAX",
			}) || 0;
		bonuses.push(classBonus);
		fortitudeDefense.classBonus = classBonus;

		//+ fortitude defense bonus
		let fortitudeDefenseBonus = getInheritableAttribute({
			entity: actor,
			attributeKey: "fortitudeDefenseBonus",
			reduce: ["SUM", "SUMMARY", "MAPPED"],
			attributeFilter: (attr) => !attr.modifier,
		});
		let otherBonus = fortitudeDefenseBonus["SUM"];
		bonuses.push(otherBonus);
		let miscBonusTip = fortitudeDefenseBonus["SUMMARY"];
		let miscBonuses = [];

		//+ equipment bonus
		let equipmentBonus = this._getEquipmentFortBonus(actor);
		bonuses.push(equipmentBonus);

		//+ condition modifier
		miscBonusTip += `Condition: ${system.condition};  `;
		bonuses.push(system.condition);
		fortitudeDefense.miscBonusTip = miscBonusTip;

		//armor/level bonus
		let armorBonus = resolveValueArray([equipmentBonus, heroicLevel]);
		fortitudeDefense.armorBonus = armorBonus;

		//misc bonuses
		miscBonuses.push(system.condition); //twice?
		miscBonuses.push(otherBonus);
		let miscBonus = resolveValueArray(miscBonuses);
		fortitudeDefense.miscBonus = miscBonus;

		//total
		let name = "Fortitude";
		let total = resolveValueArray(bonuses, actor);
		fortitudeDefense.value = system.overrides.fort ?? total;
		actor.setResolvedVariable("@FortDef", total, name, name);
		fortitudeDefense.name = name;
		fortitudeDefense.defenseBlock = true;
		return fortitudeDefense;
	}

	get resolvedWill() {
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
		let ability = CONFIG.SWSE.defenses.will.ability;
		let abilityBonus = actor.system.abilities[ability].mod;
		bonuses.push(abilityBonus);
		willDefense.abilityBonus = abilityBonus;

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
		let miscBonuses = [otherBonus, system.condition];

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
		miscBonusTip += `Condition: ${system.condition};  `;
		willDefense.miscBonusTip = miscBonusTip;

		let miscBonus = resolveValueArray(miscBonuses);
		bonuses.push(miscBonus);
		willDefense.miscBonus = miscBonus;

		let armorBonus = resolveValueArray([heroicLevel]);
		willDefense.armorBonus = armorBonus;

		let total = resolveValueArray(bonuses, actor);
		let name = "Will";
		willDefense.value = system.overrides.will ?? total;
		actor.setResolvedVariable("@WillDef", total, name, name);
		willDefense.name = name;
		willDefense.skip = skip;
		willDefense.defenseBlock = true;
		return willDefense;
	}

	get resolvedRef() {
		const system = this;
		const actor = system.parent;
		let reflexDefense = system.defense?.ref ?? {};
		let bonuses = [];
		bonuses.push(10); //base

		//+ armor/level bonus
		let armorBonus = this.armorBonus;
		bonuses.push(armorBonus);
		reflexDefense.armorBonus = armorBonus;

		//+ ability modifier
		let ability = CONFIG.SWSE.defenses.ref.ability;
		let abilityBonus = Math.min(
			actor.system.abilities[ability].mod,
			this._getEquipmentMaxDexBonus(actor)
		);
		bonuses.push(abilityBonus);
		reflexDefense.abilityBonus = abilityBonus;

		//+ class bonus
		let classBonus =
			getInheritableAttribute({
				entity: actor,
				attributeKey: "classReflexDefenseBonus",
				reduce: "MAX",
			}) || 0;
		bonuses.push(classBonus);
		reflexDefense.classBonus = classBonus;

		//+ reflex defense bonus
		let reflexDefenseBonus = getInheritableAttribute({
			entity: actor,
			attributeKey: "reflexDefenseBonus",
			reduce: ["SUM", "SUMMARY", "MAPPED"],
			attributeFilter: (attr) => !attr.modifier,
		});
		let otherBonus = reflexDefenseBonus["SUM"];
		bonuses.push(otherBonus);
		let miscBonusTip = reflexDefenseBonus["SUMMARY"];

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

		let dodgeBonus = bonusDodgeReflexDefense["SUM"];
		miscBonusTip += bonusDodgeReflexDefense["SUMMARY"];
		miscBonusTip += `Condition: ${system.condition};  `;
		const miscBonuses = [
			otherBonus,
			system.condition,
			dodgeBonus,
			naturalArmorBonus,
		];
		if (
			game.settings.get("swse", "enableEncumbranceByWeight") &&
			actor.weight >= actor.strainCapacity
		) {
			const negativeAbilityBonus = abilityBonus * -1;
			miscBonuses.push(negativeAbilityBonus);
			bonuses.push(negativeAbilityBonus);
			miscBonusTip += `Strained Capacity: ${negativeAbilityBonus};  `;
		}
		reflexDefense.miscBonusTip = miscBonusTip;
		bonuses.push(dodgeBonus);
		bonuses.push(system.condition);
		bonuses.push(naturalArmorBonus);
		let miscBonus = resolveValueArray(miscBonuses);
		reflexDefense.miscBonus = miscBonus;

		let defenseModifiers = [
			this._resolveFFRef(
				actor,
				system.condition,
				abilityBonus,
				armorBonus,
				reflexDefenseBonus,
				classBonus
			),
		];
		reflexDefense.defenseModifiers = defenseModifiers;

		let total = resolveValueArray(bonuses, actor);
		let name = "Reflex";
		reflexDefense.value = system.overrides.ref ?? total;
		actor.setResolvedVariable("@RefDef", total, name, name);

		reflexDefense.name = name;
		reflexDefense.skip = false;
		reflexDefense.defenseBlock = true;

		return reflexDefense;
	}

	_prepareDefenseDerivedData() {
		let system = this;
		const actor = system.parent;
		system.defense = system.defense ?? {};

		//TODO can we filter attributes by proficiency in the get search so we can get rid of some of the complex armor logic?

		system.defense.fort = this.resolvedWill;
		system.defense.will = this.resolvedWill;
		system.defense.ref = this.resolvedRef;
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
				if (armoredDefense) {
					return Math.max(armorBonus, heroicLevel);
				}
			}
			return armorBonus;
		}
		return heroicLevel;
	}

	_resolveFFRef(
		actor,
		conditionBonus,
		abilityBonus,
		armorBonus,
		reflexDefenseBonus,
		classBonus
	) {
		let ffReflexDefense = {};
		let bonuses = [];
		bonuses.push(10); //base

		if (abilityBonus < 0) {
			bonuses.push(abilityBonus);
			ffReflexDefense.abilityBonus = abilityBonus;
		} else ffReflexDefense.abilityBonus = 0;

		bonuses.push(armorBonus);
		ffReflexDefense.armorBonus = armorBonus;

		let otherBonus = reflexDefenseBonus["SUM"];
		let miscBonusTip = reflexDefenseBonus["SUMMARY"];

		bonuses.push(otherBonus);
		bonuses.push(classBonus);
		ffReflexDefense.classBonus = classBonus;
		miscBonusTip += `Condition: ${conditionBonus};  `;
		ffReflexDefense.miscBonusTip = miscBonusTip;
		bonuses.push(conditionBonus);
		let miscBonus = resolveValueArray([otherBonus, conditionBonus]);
		ffReflexDefense.miscBonus = miscBonus;
		let total = resolveValueArray(bonuses, actor);
		let name = "Reflex (Flat-Footed)";

		actor.setResolvedVariable("@RefFFDef", total, name, name);

		let defenseModifiers = actor.system.defense?.reflex?.defenseModifiers;
		if (defenseModifiers) {
			ffReflexDefense = defenseModifiers["reflex (flat-footed)"] || {};
		}
		ffReflexDefense.name = name;
		ffReflexDefense.skip = false;
		ffReflexDefense.defenseBlock = true;

		ffReflexDefense.value = total;
		return ffReflexDefense;
	}

	_resolveDt(system) {
		const actor = system.parent;
		let total = [];

		total.push(system.defense.fort.value);
		total.push(this._getDamageThresholdSizeMod(actor));
		total.push(
			getInheritableAttribute({
				entity: actor,
				attributeKey: "damageThresholdBonus",
				reduce: "SUM",
			})
		);
		total.push(
			...getInheritableAttribute({
				entity: actor,
				attributeKey: "damageThresholdHardenedMultiplier",
				reduce: "NUMERIC_VALUES",
			}).map((value) => "*" + value)
		);

		let damageThreshold = toNumber(resolveValueArray(total, actor));
		return damageThreshold;
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
				`${(value > -1 ? "+" : "") + value} ${
					value < 0 ? "penalty" : "bonus"
				} to their ${defense.titleCase()} Defense to resist ${
					defenseBonus.modifier
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

		return {
			name: armor.name,
			speed: actor.speed,
			refDefense: armor.armorReflexDefenseBonus,
			fortDefense: armor.fortitudeDefenseBonus,
			maxDex: armor.maximumDexterityBonus,
			notes: attributes.join(", "),
			type: armor.armorType,
		};
	}
}
