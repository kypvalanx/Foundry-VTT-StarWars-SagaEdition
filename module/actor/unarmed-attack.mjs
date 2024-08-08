export class UnarmedAttack {
    constructor(actorId) {
        this.actorId = actorId;
    }

    /**
     *
     * @returns {SWSEActor}
     */
    get actor() {
        return game.data.actors.find(actor => actor._id === this.actorId);
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
        return {0: {key: "damageType", value:"Bludgeoning"}}
    }
}