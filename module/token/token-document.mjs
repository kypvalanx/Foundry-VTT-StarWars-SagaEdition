import {resolveHealth, resolveShield} from "../actor/health.mjs";

export class SWSETokenDocument extends TokenDocument {
    getBarAttribute(barName, options = {}) {
        /**
         * @type {SWSEActor|null}
         */
        const actor = this.actor;
        if (!actor) return super.getBarAttribute(barName, options);

        // Map custom bars to system fields
        if (barName === "health") {
            let {max, value} = resolveHealth(actor)
            return {
                attribute: "system.health.hp",
                value: value ?? 0,
                max: max ?? 0
            };
        }
        if (barName === "shields") {
            let {max, value} = resolveShield(actor)
            return {
                attribute: "system.shields",
                value: value ?? 0,
                max: max ?? 0
            };
        }

        return super.getBarAttribute(barName, options);
    }
}