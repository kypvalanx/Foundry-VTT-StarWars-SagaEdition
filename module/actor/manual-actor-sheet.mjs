
import {SWSEActorSheet} from "./actor-sheet.mjs";

// noinspection JSClosureCompilerSyntax

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */

export class SWSEManualActorSheet extends SWSEActorSheet {
    get template() {
        const path = "systems/swse/templates/actor/manual";

        let type = this.actor.type;
        if (type === 'character') {
            return `${path}/actor-sheet.hbs`;
        }
        if (type === 'npc') {
            return `${path}/actor-sheet.hbs`;
        }

        return `${path}/actor-sheet.hbs`;
    }
}
