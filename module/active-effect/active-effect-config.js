import {onCollapseToggle, safeInsert} from "../util.js";
import {_adjustPropertyBySpan, _onChangeControl, _onSpanTextInput, onToggle} from "../listeners.js";

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
    /** @override */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ["swse", "sheet", "effect"]
        });
    }
    getData(options={}) {
        let data = super.getData(options);
        data.editable = this.isEditable;
        data.owner = this.document.parent.isOwner
        return data;
    }

    activateListeners(html) {
        //this.options.submitOnClose = true;
        super.activateListeners(html);

        html.find(".collapse-toggle").on("click", event => onCollapseToggle(event))

        // Everything below here is only needed if the sheet is editable
        if (!this.isEditable) return;
        html.find("img[data-edit]").click(ev => this._onEditImage(ev));
        html.find(".editor-content[data-edit]").each((i, div) => this._activateEditor(div));

        // html.find("span.text-box.direct").on("click", (event) => {
        //     this._onSpanTextInput(event, null, "text"); // this._adjustItemPropertyBySpan.bind(this)
        // });
        html.find("[data-action=direct-field]").on("click", (event) => {
            _onSpanTextInput(event, _adjustPropertyBySpan.bind(this), "text"); // this._adjustItemPropertyBySpan.bind(this)
        });

        html.find("input.direct").on("change", (event) => {
            const target = event.target
            const update = safeInsert(this.object, target.name, target.value)

            this.object.safeUpdate(update);
        })
        html.find('[data-action="change-control"]').click(_onChangeControl.bind(this));

        html.find(".toggle").on("click", onToggle.bind(this))
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