import {SWSEActor} from "../actor/actor.mjs";

export class SWSETokenHud extends foundry.applications.hud.TokenHUD {
    _getStatusEffectChoices() {
        const choices = super._getStatusEffectChoices();
        const actor = /** @type {SWSEActor} */ this.actor;
        actor.additionalStatusEffectChoices.forEach(c => choices[c.id] = c);

        return choices;
    }
}