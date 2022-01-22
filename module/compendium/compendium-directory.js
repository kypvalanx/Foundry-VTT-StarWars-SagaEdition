export class CompendiumDirectorySWSE extends CompendiumDirectory{
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            template: "systems/swse/templates/compendium/compendium.hbs",
        });
    }
}