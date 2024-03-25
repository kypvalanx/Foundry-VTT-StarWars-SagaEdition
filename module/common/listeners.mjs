import {SWSEActiveEffect} from "../active-effect/active-effect.mjs";
import {addBlankMode, addBlankModificationEffect, getDocumentByUuid, safeInsert} from "./util.mjs";

export function onChangeControl(event) {
    event.preventDefault();

    let element = $(event.currentTarget);
    let type = element.data("action-type")
    const {changes, updatePath} = getChanges.call(this);
    if ('add' === type) {
        let update = {};
        update[updatePath] = changes;
        update[updatePath].push({key: "", mode:2, value: ""});
        this.object.safeUpdate(update);
    }
    if ('delete' === type) {
        let index = element.data("index")
        let update = {};
        update[updatePath] = [];
        for (let i = 0; i < changes.length; i++) {
            if (index !== i) {
                update[updatePath].push(changes[i]);
            }
        }
        this.object.safeUpdate(update);
    }
}

export function _onLinkControl(event) {
    event.preventDefault();

    let element = $(event.currentTarget);
    let type = element.data("action-type")
    if ('delete' === type) {
        let name = element.data("name")
        this.object.deleteReciprocalLinks(name)

    }
}

export function onEffectControl(event){
    event.stopPropagation();
    let element = $(event.currentTarget);
    let effectId = element.data("effectId");
    let effectUuid = element.data("effectUuid");

    let doc;
    let parentDoc;
    if(effectUuid){
        doc = getDocumentByUuid(effectUuid);
        let toks = effectUuid.split(".");
        effectId = toks[toks.length-1]
        parentDoc = doc.parent;
    } else {
        parentDoc = this.object;
        doc = this.object.effects.get(effectId)
    }

    switch (element.data("type")){
        case 'view':
            doc.sheet.render(true);
            break;
        case 'delete':
            parentDoc.deleteEmbeddedDocuments("ActiveEffect", [effectId]);
            break;
        case 'disable':
            toggleEffectDisabled.call(parentDoc, effectId, !event.currentTarget.checked)
            break;
        case "add-modification":
            addBlankModificationEffect.call(parentDoc);
            break;
        case "add-mode":
            addBlankMode.call(parentDoc);
            break;
    }
}

function toggleEffectDisabled(effectId, disabled) {
    this.effects.get(effectId).disable(disabled)
}


export function _adjustPropertyBySpan(event) {
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
                this._onSubmit(event, {preventClose: true});
            });
        }
    } else this._onSubmit(event, {preventClose: true});
}

export function onSpanTextInput(event, callback = null, type) {
    const el = event.currentTarget;
    const parent = el.parentElement;

    // Replace span element with an input (text) element
    const newEl = document.createElement(`INPUT`);
    newEl.type = type;
    if (el.dataset) {
        for (let attr of Object.keys(el.dataset)) {
            newEl.dataset[attr] = el.dataset[attr];
        }
    }

    // Set value of new input element
    let prevValue = el.innerText;
    if (el.classList.contains("placeholder")) prevValue = "";

    newEl.value = el.dataset.editableValue || prevValue;

    // Toggle classes
    const forbiddenClasses = ["placeholder", "direct", "allow-relative"];
    for (let cls of el.classList) {
        if (!forbiddenClasses.includes(cls)) newEl.classList.add(cls);
    }

    // Replace span with input element
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
        newEl.addEventListener("keyup", (...args) => {
            let event = args[0];
            if (['Enter', 'NumpadEnter'].includes(event.code)) {
                changed = true;

                if (newEl.value === prevValue) {
                    this._render();
                } else {
                    callback.call(this, ...args);
                }
            }
        });
    }
    //newEl.addEventListener("focusout", _onFocusOut.bind(this));
   // newEl.addEventListener("keyup", _onEnter.bind(this));

    // Select text inside new element
    newEl.focus();
    newEl.select();
}

function _onEnter(event, changed)  {
    if (event.code === 'Enter' || event.code === 'NumpadEnter') {
        event.stopPropagation();
        if (!changed) {
            let data = {}
            data[event.currentTarget.dataset.name] = event.currentTarget.value
            this.document.safeUpdate(data);
            this._render()
        }

    }
}

function _onFocusOut(event, changed)  {
    event.stopPropagation();
    if (!changed) {
        let data = {}
        data[event.currentTarget.dataset.name] = event.currentTarget.value
        this.document.safeUpdate(data);
        this._render()
    }

}

export function onToggle(event) {
    event.stopPropagation();
    const target = $(event.currentTarget)
    let toggleId = target.data("toggleId")
    let data = {};
    const {system, updatePath} = getSystem.call(this);

    let toggles = system.toggles || {};
    data[`${updatePath}.toggles.${toggleId}`] = !(toggles[toggleId] || false)

    this.object.safeUpdate(data);
}

function getChanges() {
    if (this.object instanceof SWSEActiveEffect) {
        return {changes: this.object.changes || [], updatePath: 'changes'}
    }
    return {changes: this.object.system.changes || [], updatePath: 'system.changes'}
}

function getSystem() {
    if (this.object instanceof SWSEActiveEffect) {
        return {system: this.object.flags.swse, updatePath: 'flags.swse'}
    }
    return {system: this.object.system, updatePath: 'system'}
}

function getRoot() {
    if (this.object instanceof SWSEActiveEffect) {
        return {root: this.object, updatePath: ''}
    }
    return {root: this.object.system, updatePath: 'system.'}
}

export function changeText(event) {
    let {system, updatePath} = getRoot.call(this);
    const target = event.target
    const update = safeInsert(this.object, `${updatePath}${target.name}`, target.value)

    this.object.safeUpdate(update);
}

export function changeSelect(event) {
    let {system, updatePath} = getRoot.call(this);
    const target = event.target
    const update = safeInsert(this.object, `${updatePath}${target.name}`, target.value)

    this.object.safeUpdate(update);
}

export function uniqueSelection(selects) {
    const selectedValues = [];
    for(const select of selects){
        if(!select.value || select.value === "--"){
            continue;
        }
        selectedValues.push( select.value);
    }

    for (const select of selects){
        for (const option of select.options){

            option.disabled = select.value !== option.value && selectedValues.includes(option.value);
        }
    }
}

export function initializeUniqueSelection(selects) {
    const selected = [];
    for (const select of selects) {
        for (const o of select.options) {
            if (!selected.includes(o.value)) {
                o.selected = true;
                break;
            }
        }
        selected.push(select.value)
    }
    uniqueSelection(selects)
}

export function changeCheckbox(event) {
    let {system, updatePath} = getRoot.call(this);
    const target = event.target
    const type = $(target).data("type");
    const checked = type === "inverse" ? !target.checked : target.checked;
    const update = safeInsert(this.object, `${updatePath}${target.name}`, checked)

    this.object.safeUpdate(update);
}