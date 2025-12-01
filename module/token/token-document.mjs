export class SWSETokenDocument extends TokenDocument {
    getBarAttribute(barName, options = {}) {
        this.actor.health;
        this.actor.shields;

        //add this mapping
        //           // Map custom bars to system fields
        //            if (barName === "health") {
        //                return {
        //                    attribute: "system.health.hp",
        //                    value: actor.system.health?.hp?.value ?? 0,
        //                    max: actor.system.health?.hp?.max ?? 0
        //                };
        //            }
        //            if (barName === "shields") {
        //                return {
        //                    attribute: "system.shields",
        //                    value: actor.system.shields?.value ?? 0,
        //                    max: actor.system.shields?.max ?? 0
        //                };
        //            }

        return super.getBarAttribute(barName, options);
    }
}