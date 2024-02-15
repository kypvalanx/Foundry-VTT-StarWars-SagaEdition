export class RollModifier{
    /**
     *
     * @param type
     * @param roll
     * @param CSSClasses
     * @param source
     * @param {RollModifierChoice[]} choices
     */
    constructor(type, roll, source, CSSClasses = [], choices = []) {
        this.type = type;
        this.roll = roll;
        this.CSSClasses = CSSClasses;
        this.source = source;
        this.choices = choices;
    }

    static createOption(roll, source) {
        return new RollModifier("option", roll, source);
    }
    static createRadio(roll, source) {
        return new RollModifier("radio", roll, source);
    }
    static createTextModifier(roll, source) {
        return new RollModifier("text", roll, source);
    }

    /**
     *
     * @returns {string[]}
     */
    get classes(){
        let classes = []
        classes.push(...this.CSSClasses);
        classes.push(this.roll === "attack" ? "attack-modifier" : "damage-modifier");
        return classes;
    }

    get HTMLBlock(){
        if (this.type === "text" || this.type === "number") {
            return this.createTextModifierHTML(this)
        } else if (this.type === "option") {
            return this.createOptionModifierHTML(this)
        } else if (this.type === "radio") {
            return this.createRadioModifierHTML(this)
        }
    }
    /**
     *
     * @param {RollModifier} modifier
     * @returns {HTMLDivElement}
     */
    createTextModifierHTML(modifier) {
        const name = `${this.id}`
        let input = document.createElement("input");
        input.classList.add(modifier.classes)
        input.dataset.source = modifier.source
        input.type = modifier.type;
        input.name = name;
        return this._buildDiv(name, modifier, input);
    }

    _buildDiv(name, modifier, input, classes, isHorizontal) {
        if(!Array.isArray(input)){
            input = [input]
        }

        const label = document.createElement("label");
        label.for = name
        label.innerHTML = modifier.source

        const div = document.createElement("div");
        div.appendChild(label)
        for (const inputElement of input) {
            div.appendChild(inputElement)
        }
        if(classes){
            if(!Array.isArray(classes)){
                classes = [classes]
            }
            for (const classesKey of classes) {

                div.classList.add(classesKey)
            }
        }

        div.classList.add("large", isHorizontal ? "labeled-input-row" : "labeled-input")

        const wrapper = document.createElement("div");
        wrapper.appendChild(div)
        return wrapper;
    }

    /**
     *
     * @param {RollModifier} modifier
     * @returns {HTMLDivElement}
     */
    createOptionModifierHTML(modifier) {
        const name = `${this.id}`
        const input = document.createElement("select");
        input.name = name
        input.classList.add(modifier.classes)
        input.dataset.source = modifier.source
        for (const choice of modifier.choices) {
            let option = document.createElement("option");
            option.innerHTML = choice.display;
            option.value = choice.value;
            option.selected = choice.isDefault;
            input.add(option)
        }
        return this._buildDiv(name, modifier, input);
    }    /**
     *
     * @param {RollModifier} modifier
     * @returns {HTMLDivElement}
     */
    createRadioModifierHTML(modifier) {
        const name = `${this.id}`
        const inputs = [];
        let i = 0;
        for (const choice of modifier.choices) {
            const id = name + "_" + i
            const radio = document.createElement("input");
            radio.id = id;
            radio.name = name;
            radio.type = "radio"
            radio.innerHTML = choice.display;
            radio.value = choice.value;
            radio.defaultChecked = choice.isDefault;
            const label = document.createElement("label");
            label.for = id;
            label.innerHTML = choice.display;

            const div = document.createElement("div");
            div.appendChild(radio);
            div.appendChild(label);
            inputs.push(div)
            i++
        }
        return this._buildDiv(name, modifier, inputs, ["flex", "flex-row"], true);
    }

    addChoice(choice) {
        this.choices.push(choice);
    }

    hasChoices() {
        return this.choices.length > 0;
    }
}

export class RollModifierChoice{
    constructor(display, value, isDefault) {
        this.display = display;
        this.value = value;
        this.isDefault = isDefault;
    }

}