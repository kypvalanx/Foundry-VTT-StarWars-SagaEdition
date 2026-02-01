import {SWSEActorSheet} from "./base-sheet.mjs";

// noinspection JSClosureCompilerSyntax

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {SWSEActorSheet}
 */

export class SWSENpcSheet extends SWSEActorSheet {
    constructor(...args) {
        super(...args);

        this.sheetEditState = false;
    }

    /** @override */
    static get defaultOptions() {

        return mergeObject(super.defaultOptions, {
            classes: ["swse", "sheet", "actor", "npc"],
        });
    }

    /* -------------------------------------------- */

    /** @override */
    getData(options) {
        // Retrieve the data structure from the base sheet. You can inspect or log
        // the context variable to see the structure, but some key properties for
        // sheets are the actor object, the data object, whether or not it's
        // editable, the items array, and the effects array.
        const context = super.getData(options);

        context.isEditable = this.sheetEditState;

        this._prepareNpcActorSheetData(context);

        return context;
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        // Everything below here is only needed if the sheet is editable
        if (!this.isEditable) return;

        html.find(".sheetedit").on("click", async (event) =>
            this._setSheetEdit()
        );

        //roll parsing
        // html.find("div.rollable").each((i, div) => {
        //     div.addEventListener("click", (ev) => this._onActivateItem(ev), false);
        // });
    }

    /** @inheritdoc */
    async _updateObject(event, formData) {
        return super._updateObject(event, formData);
    }

    /* -------------------------------------------- */

    _setSheetEdit() {
        this.sheetEditState = !this.sheetEditState;
        this.render();
    }

    _prepareNpcActorSheetData(context) {
        this.rollMode = context.system.settings.WhisperRollsToGM.value ? 'gmroll' : 'publicroll';

    }
}
