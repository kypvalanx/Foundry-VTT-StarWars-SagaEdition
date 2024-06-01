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
            classes: new fields.StringField({
                initial: "",
                label: "Classes",
            }),
            senses: new fields.StringField({
                initial: "",
                label: "HP Special",
            }),
            lang: new fields.StringField({
                initial: "",
                label: "Languages",
            }),
            specialHp: new fields.StringField({
                initial: "",
                label: "HP Special",
            }),
            immunities: new fields.StringField({
                initial: "",
                label: "Immunities",
            }),
            weaknesses: new fields.StringField({
                initial: "",
                label: "Weaknesses",
            }),
            fightSpace: new fields.StringField({
                initial: "",
                label: "Fighting Space",
            }),
            atkOptions: new fields.StringField({
                initial: "",
                label: "Attack Actions",
            }),
            specialActions: new fields.StringField({
                initial: "",
                label: "Special Actions",
            }),
            forceP: new fields.StringField({
                initial: "",
                label: "Force Powers",
            }),
            forceS: new fields.StringField({
                initial: "",
                label: "Force Secrets",
            }),
            forceT: new fields.StringField({
                initial: "",
                label: "Force Techniqes",
            }),
            specialQualities: new fields.StringField({
                initial: "",
                label: "Special Qualities",
            }),
            talents: new fields.StringField({
                initial: "",
                label: "Talents",
            }),
            feats: new fields.StringField({
                initial: "",
                label: "Feats",
            }),
            skills: new fields.StringField({
                initial: "",
                label: "Skills",
            }),
            systems: new fields.StringField({
                initial: "",
                label: "Systems",
            }),
            possesses: new fields.StringField({
                initial: "",
                label: "Possessions",
            }),
            notes: new fields.HTMLField({
                initial: "",
                label: "Notes",
            }),
        };
    }
}

export class DetailFunctions {
    get sex() {
        return this.details.gender ?? this.details.sex;
    }
}
