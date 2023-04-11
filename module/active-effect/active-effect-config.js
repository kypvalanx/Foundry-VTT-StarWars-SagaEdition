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
    getData(options={}) {
        let data = super.getData(options);
        data.editable = this.isEditable;
        data.owner = this.document.parent.isOwner
        return data;
    }

    activateListeners(html) {
        this.options.submitOnClose = true;
        super.activateListeners(html);

        if ( this.isEditable) html.find("img[data-edit]").click(ev => this._onEditImage(ev));
        html.find(".editor-content[data-edit]").each((i, div) => this._activateEditor(div));
    }

    _onEditImage(event) {
        const attr = event.currentTarget.dataset.edit;
        const current = foundry.utils.getProperty(this.object, attr);
        const fp = new FilePicker({
            type: "image",
            current: current,
            callback: path => {
                event.currentTarget.src = path;
                if ( this.options.submitOnChange ) {
                    this._onSubmit(event);
                }
            },
            top: this.position.top + 40,
            left: this.position.left + 10
        });
        return fp.browse();
    }
}