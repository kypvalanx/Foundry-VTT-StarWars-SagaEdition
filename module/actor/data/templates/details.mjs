const fields = foundry.data.fields;

export class DetailFields {
    static migrateData(source) {
        if(source.details.sex === null) {
            source.details.sex = source.sex;
            source.sex = null;
        }

        if(source.details.gender === null) {
            source.details.gender = source.gender;
            source.gender = null;
        }

        if(source.details.age === null) {
            source.details.age = source.age;
            source.age = null;
        }

        if(source.details.experience === null) {
            source.details.experience = source.experience;
            source.experience = null;
        }

        if(source.details.height === null) {
            source.details.height = source.height;
            source.height = null;
        }

        if(source.details.weight === null) {
            source.details.weight = source.weight;
            source.weight = null;
        }

        if(source.details.cl === null) {
            source.details.cl = source.cl;
            source.cl = null;
        }

        super.migrateData(source);
    }


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
            experience: new fields.NumberField({
                initial: 0,
                integer: true,
                label: "XP",
            }),
            cl: new fields.StringField({
                initial: "",
                label: "CL",
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
//?? what is this?  npcs don't have these fields

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
