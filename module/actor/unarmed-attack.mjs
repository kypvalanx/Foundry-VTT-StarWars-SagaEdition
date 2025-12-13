import {getInheritableAttribute} from "../attribute-helper.mjs";

export class UnarmedAttack {
    constructor(actor) {
        /**
         * Represents the current actor instance associated with the Unarmed Attack.
         */
        this.actor = actor;
    }

    get name() {
        return "Unarmed Attack";
    }

    get system(){
        return this;
    }

    get subtype() {
        return "Simple Melee Weapons";
    }

    get type() {
        return "weapon";
    }

    get stripping() {
        return {}
    }

    get isUnarmed() {
        return true;
    }

    get changes() {
        let changes = getInheritableAttribute(
            {
                entity: this.actor,
                attributeKey: "droidUnarmedDamage"
            }
        )
        changes.push({"key": "damageType", "value": "Bludgeoning"})
        changes.push({"key": "unarmedDamageScalable", "value": "1d4"})
        return changes;
    }

    get parent() {
        return this.actor;
    }
}