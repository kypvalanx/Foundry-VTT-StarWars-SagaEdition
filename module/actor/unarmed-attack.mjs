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
        return [{key: "damageType", value:"Bludgeoning"}, {"key": "unarmedDamageScalable", "value": "1d4"}]
    }

    get parent() {
        return this.actor;
    }
}