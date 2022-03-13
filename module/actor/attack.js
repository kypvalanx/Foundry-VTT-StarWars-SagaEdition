export class Attack {
    // constructor(
    //     name,
    //     attackRoll,
    //     dam,
    //     notes,
    //     range,
    //     critical,
    //     type,
    //     sound,
    //     itemId,
    //     actorId,
    //     modes,
    //     hasStun,
    //     source) {
    //     this.name = name;
    //     this.th = attackRoll;
    //     this.dam = dam;
    //     this.notes = notes;
    //     this.range = range;
    //     this.critical = critical;
    //     this.type = type;
    //     this.sound = sound;
    //     this.itemId = itemId;
    //     this.actorId = actorId;
    //     this.modes = modes;
    //     this.hasStun = hasStun;
    //     this.source = source;
    //
    // }
    /**
     *
     * @param data
     * @param data.name {string}
     * @param data.attackRoll {string}
     * @param data.damage {string}
     * @param data.notes {string}
     * @param data.range {string}
     * @param data.critical {string}
     * @param data.type {string}
     * @param data.sound {string}
     * @param data.itemId {string}
     * @param data.actorId {string}
     * @param data.modes {string}
     * @param data.source {string}
     * @param data.hasStun {string}
     */
    constructor(data={}){
        this.name = data.name;
        this.th = data.attackRoll;
        this.attackRollBreakdown = data.attackRollBreakDown;
        this.dam = data.damage;
        this.notes = data.notes;
        this.range = data.range;
        this.critical = data.critical;
        this.type = data.type;
        this.sound = data.sound;
        this.itemId = data.itemId;
        this.actorId = data.actorId;
        this.modes = data.modes;
        this.hasStun = data.hasStun;
        this.source = data.source;
        this.provider = data.provider;
    }

}