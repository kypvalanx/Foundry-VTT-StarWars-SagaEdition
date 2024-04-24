export class CompendiumWeb extends Application{
    constructor(...args) {
        super(...args);


    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            template: "systems/swse/templates/compendium/compendium-web.hbs",
            id: null,
            popOut: true,
            width: 300,
            height: "auto",
            classes: ["web"],
            baseApplication: "CompendiumWeb"
        });
    }
    get id() {
        return `${this.options.id}${this._original ? "-popout" : ""}`;
    }

    async getData(options={}) {
        return {
            cssId: this.id,
            cssClass: this.options.classes.join(" "),
            user: game.user
        };
    }
}