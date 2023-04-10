/**
 * Extend the base ActiveEffect entity
 * @extends {ActiveEffectConfig}
 */
export class SWSEActiveEffectConfig extends ActiveEffectConfig {
    get template() {
        const path = "systems/swse/templates/active-effect";
        if (this.object.flags.swse?.itemModifier) {
            return `${path}/modifier-active-effect-sheet.hbs`;
        }
        return super.template
    }

    activateListeners(html) {
        this.options.submitOnClose = true;
        super.activateListeners(html);

    }
}