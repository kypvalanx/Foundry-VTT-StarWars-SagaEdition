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

        // html.find("span.text-box.direct").on("click", (event) => {
        //     this._onSpanTextInput(event, null, "text"); // this._adjustItemPropertyBySpan.bind(this)
        // });
        html.find("[data-action=direct-field]").on("click", (event) => {
            this._onSpanTextInput(event, this._adjustPropertyBySpan.bind(this), "text"); // this._adjustItemPropertyBySpan.bind(this)
        });
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

    _onSpanTextInput(event, callback = null, type, inputValue) {
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

        let name = el.getAttribute("name");
        if (el.dataset.name) {
            name = el.dataset.name;
        }

        // let item = el.dataset.item;
        // let maxValue;
        // if (name) {
        //     newEl.setAttribute("name", name);
        //
        //     let source = this.actor.data;
        //     if (item) {
        //         source = this.actor.items.get(item);
        //         name = "data." + name; //TODO make this less hacky
        //     }
        //     prevValue = getProperty(source, name);
        //     if (prevValue && typeof prevValue !== "string") prevValue = prevValue.toString();
        //
        //     if (name.endsWith(".value")) {
        //         const maxName = name.replace(/\.value$/, ".max");
        //         maxValue = getProperty(this.actor.data, maxName);
        //     }
        // }
        // newEl.value = prevValue;

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
                // if (allowRelative) {
                //     newEl.value = adjustNumberByStringCommand(parseFloat(prevValue), newEl.value, maxValue);
                // }

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
        //newEl.click()
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