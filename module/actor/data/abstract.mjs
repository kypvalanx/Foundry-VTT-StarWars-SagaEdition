/**
 * Data Model variant with some extra methods to support template mix-ins.
 *
 * Here we have opted to create a means to add functions from one class to another. This is to increase code
 * organization and maintainability. This is NOT currently used to merge different data models together.
 */
export default class SystemDataModel extends foundry.abstract.TypeDataModel {
	/** @inheritdoc */
	//   static _enableV10Validation = true;

	/**
	 * System type that this system data model represents (e.g. "character", "npc", "vehicle").
	 * @type {string}
	 */
	static _systemType;

	/* -------------------------------------------- */

	/**
	 * A list of properties that should not be mixed-in to the final type.
	 * @type {Set<string>}
	 * @private
	 */
	// static _immiscible = new Set([
	// 	"length",
	// 	"mixed",
	// 	"name",
	// 	"prototype",
	// 	"cleanData",
	// 	"_cleanData",
	// 	"_initializationOrder",
	// 	"validateJoint",
	// 	"_validateJoint",
	// 	"migrateData",
	// 	"_migrateData",
	// 	"shimData",
	// 	"_shimData",
	// 	"defineSchema",
	// ]);

	/* -------------------------------------------- */
	/*  Data Validation                             */
	/* -------------------------------------------- */

	/** @inheritdoc */
	validate(options = {}) {
		//if ( this.constructor._enableV10Validation === false ) return true;
		return super.validate(options);
	}

	/* -------------------------------------------- */
	/*  Mixins                                      */
	/* -------------------------------------------- */

	/**
	 * Mix multiple templates with the base type.
	 * @param {...*} templates            Template classes to mix.
	 * @returns {typeof SystemDataModel}  Final prepared type.
	 */
	static mixin(...templates) {
		const Base = class extends this {};

		for (const template of templates) {
			// // Take all static methods and fields from template and mix in to base class
			// for ( const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(template)) ) {
			//   if ( this._immiscible.has(key) ) continue;
			//   Object.defineProperty(Base, key, descriptor);
			// }

			// Take all instance methods and fields from template and mix in to base class
			for (const [key, descriptor] of Object.entries(
				Object.getOwnPropertyDescriptors(template.prototype)
			)) {
				if (["constructor"].includes(key)) continue;
				Object.defineProperty(Base.prototype, key, descriptor);
			}
		}

		return Base;
	}
}
