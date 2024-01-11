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

    _buildDiv(name, modifier, input) {
        const label = document.createElement("label");
        label.for = name
        label.innerHTML = modifier.source

        const div = document.createElement("div");
        div.appendChild(label)
        div.appendChild(input)
        div.classList.add("large", "labeled-input")

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
        const select = true;
        const name = `${this.id}`
        if(select){
            const input = document.createElement("select");
            input.name = name
            input.classList.add(modifier.classes)
            input.dataset.source = modifier.source

            for(const choice of modifier.choices){
                let option = document.createElement("option");
                option.innerHTML = choice.display;
                option.value = choice.value;
                option.selected = choice.isDefault;
                input.add(option)
            }

            return this._buildDiv(name, modifier, input);
        }
        return undefined;
    }

    addChoice(choice) {
        this.choices.push(choice);
    }
}

export class RollModifierChoice{
    constructor(display, value, isDefault) {
        this.display = display;
        this.value = value;
        this.isDefault = isDefault;
    }


}