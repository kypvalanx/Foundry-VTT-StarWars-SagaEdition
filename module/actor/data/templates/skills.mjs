import {getInheritableAttribute} from "../../../attribute-helper.mjs";
import {SWSE} from "../../../common/config.mjs";
import {NEW_LINE, PHYSICAL_SKILLS} from "../../../common/constants.mjs";
import {resolveValueArray, toNumber} from "../../../common/util.mjs";
import {generateArmorCheckPenalties} from "../../armor-check-penalty.mjs";

const fields = foundry.data.fields;

export class SkillFields {
	static #skillProperties(ability, skill) {
		return new fields.SchemaField({
			ability: new fields.StringField({
				initial: ability,
				blank: false,
				label: "Ability Modifier",
			}),
			trained: new fields.BooleanField({
				initial: false,
				label: "Trained",
			}),
			manualBonus: new fields.NumberField({
				initial: 0,
				integer: true,
				label: `${skill} Mod`,
			}),
		});
	}

	static get character() {
		return {
			skills: new fields.SchemaField({
				acro: this.#skillProperties("dex", "Acrobatics"),
				clim: this.#skillProperties("str", "Climb"),
				dece: this.#skillProperties("cha", "Deception"),
				endu: this.#skillProperties("str", "Endurance"),
				ginf: this.#skillProperties("int", "Gather Information"),
				init: this.#skillProperties("dex", "Initiative"),
				jump: this.#skillProperties("str", "Jump"),
				kbur: this.#skillProperties("int", "Knowledge (Bureaucracy)"),
				kgal: this.#skillProperties("int", "Knowledge (Galactic Lore)"),
				klif: this.#skillProperties("int", "Knowledge (Life Sciences)"),
				kphy: this.#skillProperties(
					"int",
					"Knowledge (Physical Sciences)"
				),
				ksoc: this.#skillProperties(
					"int",
					"Knowledge (Social Sciences)"
				),
				ktac: this.#skillProperties("int", "Knowledge (Tactics)"),
				ktec: this.#skillProperties("int", "Knowledge (Technology)"),
				mech: this.#skillProperties("int", "Mechanics"),
				perc: this.#skillProperties("wis", "Perception"),
				pers: this.#skillProperties("cha", "Persuasion"),
				pilo: this.#skillProperties("dex", "Pilot"),
				ride: this.#skillProperties("dex", "Ride"),
				stea: this.#skillProperties("dex", "Stealth"),
				surv: this.#skillProperties("wis", "Survival"),
				swim: this.#skillProperties("str", "Swim"),
				tinj: this.#skillProperties("wis", "Treat Injury"),
				ucom: this.#skillProperties("int", "Use Computer"),
				ufor: this.#skillProperties("cha", "Use The Force"),
			}),
		};
	}
}

export class SkillFunctions {
	get availableTrainedSkillCount() {
		const system = this;
		const actor = system.parent;
		const intBonus = system.abilities.int.mod;
		let classBonus = 0;
		for (let co of actor.itemTypes.class) {
			if (co.levelsTaken.includes(1)) {
				classBonus = getInheritableAttribute({
					entity: co,
					attributeKey: "trainedSkillsFirstLevel",
					reduce: "SUM",
				});
				break;
			}
		}
		let classSkills = Math.max(
			toNumber(resolveValueArray([classBonus, intBonus])),
			1
		);
		let automaticTrainedSkill = getInheritableAttribute({
			entity: actor,
			attributeKey: "automaticTrainedSkill",
			reduce: "VALUES_TO_LOWERCASE",
		}).filter((value) => value === "#payload#").length;
		let otherSkills = getInheritableAttribute({
			entity: actor,
			attributeKey: "trainedSkills",
			reduce: "SUM",
		});
		return toNumber(
			resolveValueArray([classSkills, otherSkills, automaticTrainedSkill])
		);
	}

	get trainedSkills() {
		let result = [];
		for (let skill of Object.values(this.skills)) {
			if (skill.trained) result.push(skill);
		}
		return result;
	}

	get untrainedSkills() {
		let result = [];
		for (let skill of Object.values(this.skills)) {
			if (!skill.trained) result.push(skill);
		}
		return result;
	}

	get focusedSkills() {
		let skillFocuses = getInheritableAttribute({
			entity: this.parent,
			attributeKey: "skillFocus",
			reduce: "VALUES",
		}).map((skill) => (skill || "").toLowerCase());
		return skillFocuses;
	}

	get classSkills() {
		let classSkills = new Set();
		let skills = getInheritableAttribute({
			entity: this.parent,
			attributeKey: "classSkill",
			reduce: "VALUES",
		});

		for (let skill of skills) {
			if (
				[
					"knowledge (all skills, taken individually)",
					"knowledge (all types, taken individually)",
				].includes(skill.toLowerCase())
			) {
				classSkills.add("knowledge (galactic lore)");
				classSkills.add("knowledge (bureaucracy)");
				classSkills.add("knowledge (life sciences)");
				classSkills.add("knowledge (physical sciences)");
				classSkills.add("knowledge (social sciences)");
				classSkills.add("knowledge (tactics)");
				classSkills.add("knowledge (technology)");
			} else {
				classSkills.add(skill.toLowerCase());
			}
		}

		return classSkills;
	}

	_prepareSkillDerivedData() {
		let actor = this.parent;
		let system = this;

		let heavyLoadAffected = system.attributes.heavyLoad;
		let halfCharacterLevel = Math.floor(system.attributes.level.value / 2);

		let classSkills = system.classSkills;
		let automaticTrainedSkill = getInheritableAttribute({
			entity: actor,
			attributeKey: "automaticTrainedSkill",
			reduce: "VALUES_TO_LOWERCASE",
		});
		let skillBonus = getInheritableAttribute({
			entity: actor,
			attributeKey: "skillBonus",
			reduce: "VALUES",
		}).map((skill) => (skill?.replace(" ", "") || "").toLowerCase());
		let untrainedSkillBonuses = getInheritableAttribute({
			entity: actor,
			attributeKey: "untrainedSkillBonus",
			reduce: "VALUES",
		}).map((skill) => (skill || "").toLowerCase());
		let reRollSkills = getInheritableAttribute({
			entity: actor,
			attributeKey: "skillReRoll",
		});
		//Skill Focus
		let skillFocuses = getInheritableAttribute({
			entity: actor,
			attributeKey: "skillFocus",
			reduce: "VALUES",
		}).map((skill) => (skill || "").toLowerCase());

		let acPenalty = generateArmorCheckPenalties(actor);

		//Loop2
		for (let [id, skill] of Object.entries(system.skills)) {
			let key = SWSE.skills[id].name.toLowerCase();
			let dirtyKey = key.toLowerCase().replace(" ", "").trim();
			let bonuses = [];
			let abilityMod = system.abilities[skill.ability].mod;
			let notes = [];

			skill.isClass =
				key === "use the force"
					? actor.isForceSensitive
					: classSkills.has(key);
			if (key === "use the force" && !skill.isClass) {
				skill.hide = true;
			}

			//Skill adjustments
			//----------------------------------------------------------------
			//Level Bonus - Always
			bonuses.push({
				value: halfCharacterLevel,
				description: `Half character level: ${halfCharacterLevel}`,
			});

			//Ability Modifier - Always
			bonuses.push({
				value: abilityMod,
				description: `Ability Mod: ${abilityMod}`,
			});
			skill.abilityBonus = abilityMod;

			//TrainedBonus or 0 - Trained only
			if (automaticTrainedSkill.includes(key)) {
				skill.trained = true;
				skill.locked = true;
				if (!skill.isClass) {
					skill.blockedSkill = true;
				}
			}
			let trainedSkillBonus = skill.trained === true ? 5 : 0;
			bonuses.push({
				value: trainedSkillBonus,
				description: `Trained Skill Bonus: ${trainedSkillBonus}`,
			});

			//UntrainedBonus or 0 - Untrained only
			let untrainedSkillBonus =
				!skill.trained && untrainedSkillBonuses.includes(key) ? 2 : 0;
			bonuses.push({
				value: untrainedSkillBonus,
				description: `Untrained Skill Bonus: ${untrainedSkillBonus}`,
			});
			skill.trainedBonus = trainedSkillBonus + untrainedSkillBonus;

			//Ability Skill Bonus - sneak or perception - only if exists
			let abilitySkillBonus = actor.getAbilitySkillBonus(key);
			bonuses.push({
				value: abilitySkillBonus,
				description: `Ability Skill Modifier: ${abilitySkillBonus}`,
			});

			//Condition modifier - always
			bonuses.push({
				value: system.health?.condition ?? 0,
				description: `Condition Modifier: ${
					system.health?.condition ?? 0
				}`,
			});

			//Armor and Weight penalty - only if exists
			if (PHYSICAL_SKILLS.includes(key)) {
				bonuses.push({
					value: acPenalty,
					description: `Armor Class Penalty: ${acPenalty}`,
				});

				if (heavyLoadAffected) {
					bonuses.push({
						value: -10,
						description: `Heavy Load Penalty: -10`,
					});
				}
			}
			skill.armorPenalty = acPenalty;

			//Skill Focus bonus - Skill Focus only
			let skillFocusBonus = 0;
			if (skillFocuses.includes(key)) {
				skill.focus = true;

				let skillFocusCalculationOption = game.settings.get(
					"swse",
					"skillFocusCalculation"
				);
				if (skillFocusCalculationOption === "charLevelUp") {
					skillFocusBonus = Math.ceil(system.level / 2);
				} else if (skillFocusCalculationOption === "charLevelDown") {
					skillFocusBonus = Math.floor(system.level / 2);
				}
			}
			bonuses.push({
				value: skillFocusBonus,
				description: `Skill Focus Bonus: ${skillFocusBonus}`,
			});
			skill.focusBonus = skillFocusBonus;

			//Other Skill Bonuses from inherited - only if exists
			let miscBonuses = skillBonus
				.filter((bonus) => bonus.startsWith(dirtyKey))
				.map((bonus) => bonus.split(":")[1]);
			let miscBonus = miscBonuses.reduce(
				(prev, curr) => prev + toNumber(curr),
				0
			);
			bonuses.push({
				value: miscBonus,
				description: `Miscellaneous Bonus: ${miscBonus}`,
			});
			skill.miscBonus = miscBonus;

			//Character Sheet adjustment - only if exists
			if (skill.manualBonus) {
				bonuses.push({
					value: skill.manualBonus,
					description: `Manual Bonus: ${skill.manualBonus}`,
				});
			}

			//----------------------------------------------------------------
			//END Skill adjustments

			//Rerolls
			system._addSkillRerollNotes(reRollSkills, key, notes, skill);

			//Final skill calculations
			let nonZeroBonuses = bonuses.filter((bonus) => bonus.value !== 0);

			skill.title = nonZeroBonuses
				.map((bonus) => bonus.description)
				.join(NEW_LINE);

			skill.value = resolveValueArray(
				nonZeroBonuses.map((bonus) => bonus.value)
			);

			//Remaining Skills
			system._prepareRemainingSkills();

			//Roll Data
			system._prepareSkillRollData(key, skill, notes);
		}
	}

	_prepareSkillRollData(key, skill, notes) {
		let system = this;
		let actor = system.parent;
		let variable = `@${system.cleanSkillName(key)}`;
		let label = key.titleCase().replace("Knowledge", "K.");

		actor.resolvedVariables.set(skill.variable, "1d20 + " + skill.value);
		actor.resolvedLabels.set(variable, label);
		actor.resolvedNotes.set(variable, notes);
	}

	_addSkillRerollNotes(reRollSkills, key, notes, skill) {
		let applicableRerolls = reRollSkills.filter(
			(reroll) =>
				reroll.value.toLowerCase() === key ||
				reroll.value.toLowerCase() === "any"
		);
		for (let reroll of applicableRerolls) {
			notes.push(
				`[[/roll 1d20 + ${skill.value}]] ${reroll.sourceDescription}`
			);
		}
	}

	_prepareRemainingSkills() {
		let system = this;
		//Remaining skills is calculated based on the number of trained skills.
		let remainingSkills =
			system.availableTrainedSkillCount - system.trainedSkills.length;
		system.remainingSkills = remainingSkills < 0 ? false : remainingSkills;
		system.tooManySKills =
			remainingSkills < 0 ? Math.abs(remainingSkills) : false;
	}

	cleanSkillName(key) {
		return this.uppercaseFirstLetters(key)
			.replace("Knowledge ", "K")
			.replace("(", "")
			.replace(")", "")
			.replace(" ", "")
			.replace(" ", "");
	}

	uppercaseFirstLetters(s) {
		const words = s.split(" ");

		for (let i = 0; i < words.length; i++) {
			if (words[i][0] === "(") {
				words[i] =
					words[i][0] +
					words[i][1].toUpperCase() +
					words[i].substr(2);
			} else {
				words[i] = words[i][0].toUpperCase() + words[i].substr(1);
			}
		}
		return words.join(" ");
	}
}
