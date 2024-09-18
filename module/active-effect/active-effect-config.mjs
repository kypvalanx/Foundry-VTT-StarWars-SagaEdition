import {onCollapseToggle} from "../common/util.mjs";
import {
    _adjustPropertyBySpan,
    onChangeControl, _onLinkControl,
    onSpanTextInput,
    changeCheckbox,
    changeText,
    onToggle, changeSelect
} from "../common/listeners.mjs";

/**
 * Extend the base ActiveEffect entity
 * @extends {ActiveEffectConfig}
 */
export class SWSEActiveEffectConfig extends ActiveEffectConfig {
    get template() {
        const path = "systems/swse/templates/active-effect";
        // if (this.object.flags.swse?.itemModifier) {

        console.log(super.template)
            return `${path}/active-effect-sheet.hbs`;
        // }
        //return super.template
    }

    /** @override */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ["swse", "sheet", "effect"],
            closeOnSubmit: false,
            submitOnChange:true
        });
    }
    getData(options={}) {
        let data = super.getData(options);
        data.editable = this.isEditable;
        data.owner = this.document.parent.isOwner
        data.document = this.document;
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
            onSpanTextInput.call(this, event, _adjustPropertyBySpan.bind(this), "text"); // this._adjustItemPropertyBySpan.bind(this)
        });


        // html.find("select.direct").on("change", changeSelect.bind(this));
        // html.find("input[type=text].direct").on("change", changeText.bind(this));
        // html.find("input[type=number].direct").on("change", changeText.bind(this));
        // html.find("input[type=checkbox].direct").on("click", changeCheckbox.bind(this));
        html.find('[data-action="change-control"]').click(onChangeControl.bind(this));
        html.find('[data-action="link-control"]').click(_onLinkControl.bind(this));

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