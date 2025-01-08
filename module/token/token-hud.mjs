export class SWSETokenHud extends TokenHUD {
    _getStatusEffectChoices() {
        const choices = super._getStatusEffectChoices();

        this.actor.additionalStatusEffectChoices.forEach(c => choices[c.id] = c);

        return choices;
    }
}