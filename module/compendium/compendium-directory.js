import {SWSECompendiumBrowser} from "./compendium-browser.js";

export class SWSECompendiumDirectory extends CompendiumDirectory{
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            template: "systems/swse/templates/compendium/compendium.hbs",
        });
    }


    activateListeners(html) {
        super.activateListeners(html);

        html.find('[data-action="compendium"]').click(SWSECompendiumDirectory.viewCompendiumItemsByFilter.bind(this));
    }

    static viewCompendiumItemsByFilter(event){
        let element = $(event.currentTarget);
        let filterString = element.data("filter")
        let type = element.data("type")
        let pack = element.data("pack")
        new SWSECompendiumBrowser({filterString, type, pack})._render(true);
    }
}