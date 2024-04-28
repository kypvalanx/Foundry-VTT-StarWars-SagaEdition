const fields = foundry.data.fields;

export class DetailFields {
    static get #commonCharacter() {
        return {
            biography: new fields.HTMLField({
                initial: "",
                label: "Biography",
            }),
            description: new fields.HTMLField({
                initial: "",
                label: "Description",
            }),
            gender: new fields.StringField({
                initial: "",
                label: "Gender",
            }),
            sex: new fields.StringField({
                initial: "",
                label: "Sex",
            }),
            age: new fields.NumberField({
                initial: 0,
                integer: true,
                label: "Age",
            }),
            height: new fields.StringField({
                initial: "",
                label: "Height",
            }),
            weight: new fields.StringField({
                initial: "",
                label: "Weight",
            }),
        };
    }

    static get character() {
        return {
            ...this.#commonCharacter,
            player: new fields.StringField({
                initial: "",
                label: "Player",
            }),
        };
    }

    static get npc() {
        return {
            ...this.#commonCharacter,
            species: new fields.StringField({
                initial: "Human",
                label: "Species",
            }),
            lang: new fields.StringField({
                initial: "",
                label: "Languages",
            }),
            talents: new fields.StringField({
                initial: "",
                label: "Talents",
            }),
            feats: new fields.StringField({
                initial: "",
                label: "Feats",
            }),
            possesses: new fields.StringField({
                initial: "",
                label: "Possessions",
            }),
            systems: new fields.StringField({
                initial: "",
                label: "Systems",
            }),
        };
    }
}

export class DetailFunctions {
    get sex() {
        return this.details.gender ?? this.details.sex;
    }
}
