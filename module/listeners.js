import {SWSEActiveEffect} from "./active-effect/active-effect.js";
import {safeInsert} from "./util.js";

export function _onChangeControl(event) {
    event.preventDefault();

    let element = $(event.currentTarget);
    let type = element.data("action-type")
    const {changes, updatePath} = getChanges.call(this);
    if ('add' === type) {
        let update = {};
        update[updatePath] = changes;
        update[updatePath].push({key: "", value: ""});
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

export function _onSpanTextInput(event, callback = null, type) {
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

export function changeCheckbox(event) {
    let {system, updatePath} = getRoot.call(this);
    const target = event.target
    const type = $(target).data("type");
    const checked = type === "inverse" ? !target.checked : target.checked;
    const update = safeInsert(this.object, `${updatePath}${target.name}`, checked)

    this.object.safeUpdate(update);
}