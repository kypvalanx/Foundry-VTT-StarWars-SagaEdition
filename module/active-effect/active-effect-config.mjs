import {onCollapseToggle} from "../common/util.mjs";
import {
    _adjustPropertyBySpan,
    onChangeControl, _onLinkControl,
    onSpanTextInput,
    onToggle
} from "../common/listeners.mjs";

/**
 * Extend the base ActiveEffect entity
 * @extends {ActiveEffectConfig}
 */
export class SWSEActiveEffectConfig extends foundry.applications.sheets.ActiveEffectConfig {
    // get template() {
    //     const path = "systems/swse/templates/active-effect";
    //     console.log(super.template)
    //     return `${path}/active-effect-sheet.hbs`;
    // }
    //
    // /** @override */
    // static get defaultOptions() {
    //     return foundry.utils.mergeObject(super.defaultOptions, {
    //         classes: ["swse", "sheet", "effect"],
    //         closeOnSubmit: false,
    //         submitOnChange:true
    //     });
    // }
    //
    // /** @override */
    // static DEFAULT_OPTIONS = {
    //     classes: ["swse", "sheet", "effect"],
    //     form: {
    //         closeOnSubmit: false,
    //         submitOnChange: true
    //     },
    //     actions: {
    //         // Alternatively, standard buttons can be wired via data-action
    //     }
    // };
    //
    // /** @override */
    // static PARTS = {
    //     sheet: {
    //         template: "systems/swse/templates/active-effect/active-effect-sheet.hbs"
    //     }
    // };
    //
    // getData(options={}) {
    //     let data = super.getData(options);
    //     data.editable = this.isEditable;
    //     data.owner = this.document.parent.isOwner
    //     data.document = this.document;
    //     return data;
    // }
    //
    // activateListeners(html) {
    //     //this.options.submitOnClose = true;
    //     super.activateListeners(html);
    //
    //     html.find(".collapse-toggle").on("click", event => onCollapseToggle(event))
    //
    //     // Everything below here is only needed if the sheet is editable
    //     if (!this.isEditable) return;
    //     html.find("img[data-edit]").click(ev => this._onEditImage(ev));
    //     html.find(".editor-content[data-edit]").each((i, div) => this._activateEditor(div));
    //
    //     // html.find("span.text-box.direct").on("click", (event) => {
    //     //     this._onSpanTextInput(event, null, "text"); // this._adjustItemPropertyBySpan.bind(this)
    //     // });
    //     html.find("[data-action=direct-field]").on("click", (event) => {
    //         onSpanTextInput.call(this, event, _adjustPropertyBySpan.bind(this), "text"); // this._adjustItemPropertyBySpan.bind(this)
    //     });
    //
    //
    //     // html.find("select.direct").on("change", changeSelect.bind(this));
    //     // html.find("input[type=text].direct").on("change", changeText.bind(this));
    //     // html.find("input[type=number].direct").on("change", changeText.bind(this));
    //     // html.find("input[type=checkbox].direct").on("click", changeCheckbox.bind(this));
    //     html.find('[data-action="change-control"]').click(onChangeControl.bind(this));
    //     html.find('[data-action="link-control"]').click(_onLinkControl.bind(this));
    //
    //     html.find(".toggle").on("click", onToggle.bind(this))
    // }
    //
    //
    // _onEditImage(event) {
    //     const attr = event.currentTarget.dataset.edit;
    //     const current = foundry.utils.getProperty(this.document, attr);
    //     const fp = new FilePicker({
    //         type: "image",
    //         current: current,
    //         callback: path => {
    //             event.currentTarget.src = path;
    //             if ( this.options.submitOnChange ) {
    //                 this._onSubmit(event);
    //             }
    //         },
    //         top: this.position.top + 40,
    //         left: this.position.left + 10
    //     });
    //     return fp.browse();
    // }


    //
    // /** @override */
    // async _prepareContext(options = {}) {
    //     const context = await super._prepareContext(options);
    //     context.editable = this.isEditable;
    //     context.owner = this.document.parent ? this.document.parent.isOwner : game.user.isGM;
    //     context.document = this.document;
    //     // In V13 context.data provides document data, or provide context.data for template convenience:
    //     context.data = this.document;
    //     return context;
    // }
    //
    // /** @override */
    // async _onRender(context, options) {
    //     await super._onRender(context, options);
    //     const html = this.element;
    //
    //     // Collapse toggle
    //     html.querySelectorAll(".collapse-toggle").forEach(el => {
    //         el.addEventListener("click", event => onCollapseToggle(event));
    //     });
    //
    //     // Editable actions
    //     if (!this.isEditable) return;
    //
    //     // Image picker click handler
    //     html.querySelectorAll("img[data-edit]").forEach(img => {
    //         img.addEventListener("click", ev => this._onEditImage(ev));
    //     });
    //
    //     // Direct field editing
    //     html.querySelectorAll("[data-action=direct-field]").forEach(el => {
    //         el.addEventListener("click", event => {
    //             onSpanTextInput.call(this, event, _adjustPropertyBySpan.bind(this), "text");
    //         });
    //     });
    //
    //     // Change control
    //     html.querySelectorAll('[data-action="change-control"]').forEach(el => {
    //         el.addEventListener("click", event => onChangeControl.call(this, event));
    //     });
    //
    //     // Link control
    //     html.querySelectorAll('[data-action="link-control"]').forEach(el => {
    //         el.addEventListener("click", event => _onLinkControl.call(this, event));
    //     });
    //
    //     // Toggle buttons
    //     html.querySelectorAll(".toggle").forEach(el => {
    //         el.addEventListener("click", event => onToggle.call(this, event));
    //     });
    // }

    // /**
    //  * Handle editing the active effect icon image
    //  * @param {MouseEvent} event
    //  */
    // async _onEditImage(event) {
    //     const attr = event.currentTarget.dataset.edit;
    //     const current = foundry.utils.getProperty(this.document, attr);
    //     const fp = new foundry.applications.apps.FilePicker.implementation({
    //         type: "image",
    //         current: current,
    //         callback: async path => {
    //             event.currentTarget.src = path;
    //             await this.document.update({ [attr]: path });
    //         },
    //         position: {
    //             top: this.position.top + 40,
    //             left: this.position.left + 10
    //         }
    //     });
    //     return fp.browse();
    // }
}