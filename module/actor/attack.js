export class Attack {
    constructor(
        name,
        attackRoll,
        dam,
        notes,
        range,
        critical,
        type,
        sound,
        itemId,
        actorId,
        modes,
        hasStun,
        source) {
        this.name = name;
        this.th = attackRoll;
        this.dam = dam;
        this.notes = notes;
        this.range = range;
        this.critical = critical;
        this.type = type;
        this.sound = sound;
        this.itemId = itemId;
        this.actorId = actorId;
        this.modes = modes;
        this.hasStun = hasStun;
        this.source = source;

    }

}