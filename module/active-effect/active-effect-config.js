import {onCollapseToggle, onToggle, safeInsert} from "../util.js";

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
            this._onSpanTextInput(event, this._adjustPropertyBySpan.bind(this), "text"); // this._adjustItemPropertyBySpan.bind(this)
        });

        html.find("input.direct").on("change", (event) => {
            const target = event.target
            const update = safeInsert(this.object, target.name, target.value)

            this.object.safeUpdate(update);
        })
        html.find('[data-action="change-control"]').click(this._onChangeControl.bind(this));

        html.find(".toggle").on("click", onToggle.bind(this))
    }



    _onChangeControl(event) {
        event.preventDefault();

        let element = $(event.currentTarget);
        let type = element.data("action-type")
        if ('add' === type) {
            let update = {};
            update['changes'] = this.object.changes;
            update['changes'].push({key:"", value:""});
            this.object.safeUpdate(update);
        }
        if ('delete' === type) {
            let index = element.data("index")
            let update = {};
            update['changes'] = [];
            for (let i = 0; i < this.object.changes.length; i++) {
                if(index !== i){
                    update['changes'].push(this.object.changes[i]);
                }
            }
            this.object.safeUpdate(update);
        }
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

    _onSpanTextInput(event, callback = null, type) {
        const el = event.currentTarget;
        const parent = el.parentElement;

        // Replace span element with an input (text) element
        const newEl = document.createElement(`INPUT`);
        newEl.type = type;
        if(el.dataset){
            for(let attr of Object.keys(el.dataset)){
                newEl.dataset[attr] = el.dataset[attr];
            }
        }

        // Set value of new input element
        let prevValue = el.innerText;
        if (el.classList.contains("placeholder")) prevValue = "";

        let editableValue = el.dataset.editableValue;

        newEl.value = editableValue || prevValue;

        // Toggle classes
        const forbiddenClasses = ["placeholder", "direct", "allow-relative"];
        for (let cls of el.classList) {
            if (!forbiddenClasses.includes(cls)) newEl.classList.add(cls);
        }

        // Replace span with input element
        //const allowRelative = el.classList.contains("allow-relative");
        parent.replaceChild(newEl, el);
        let changed = false;
        if (callback) {
            newEl.addEventListener("change", (...args) => {
                changed = true;

                if (newEl.value === prevValue) {
                    this._render();
                } else {
                    callback.call(this, ...args);
                }
            });
        }
        newEl.addEventListener("focusout", () => {
            if (!changed) {
                this._render();
            }
        });


        newEl.addEventListener("keypress", (event) => {
            if (event.code === 'Enter' || event.code === 'NumpadEnter') {
                event.stopPropagation();
                if (!changed) {
                    this._render();
                }
            }
        });

        // Select text inside new element
        newEl.focus();
        newEl.select();
    }

    _adjustPropertyBySpan(event) {
        event.preventDefault();
        const el = event.currentTarget;

        const value = el.tagName.toUpperCase() === "INPUT" ? el.value : el.innerText;

        let name = el.getAttribute("name");
        if (el.dataset.name) {
            name = el.dataset.name;
        }

        if (name) {
            let updateTarget = this.object;
            let data = {};
            data[name] = value;
            updateTarget.safeUpdate(data);
        }

        // Update on lose focus
        if (event.originalEvent instanceof MouseEvent) {
            if (!this._submitQueued) {
                $(el).one("mouseleave", (event) => {
                    this._onSubmit(event, {preventClose:true});
                });
            }
        } else this._onSubmit(event, {preventClose:true});
    }
}