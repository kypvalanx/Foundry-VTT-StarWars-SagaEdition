import {SWSECompendiumBrowser} from "./compendium-browser.js";

export class SWSECompendiumDirectory extends CompendiumDirectory{
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            template: "systems/swse/templates/compendium/compendium.hbs",
        });
    }


    activateListeners(html) {
        super.activateListeners(html);

        html.find('[data-action="compendium"]').click(this._onSelectFilter.bind(this));
    }

    _onSelectFilter(event){
        let element = $(event.currentTarget);
        let filterString = element.data("filter")
        let type = element.data("type")
        let pack = element.data("pack")
        this._onBrowseCompendium({filterString, type, pack});
    }

    _onBrowseCompendium(data={}){
        new SWSECompendiumBrowser(data)._render(true);
    }
}