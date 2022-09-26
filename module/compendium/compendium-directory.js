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
        //html.find('[data-action="compendium"]').click(SWSECompendiumDirectory.viewCompendiumItemsByFilter.bind(this));
    }

    _contextMenu(html) {
        ContextMenu.create(this, html, ".compendium-filter", this._getEntryContextOptions());
    }

    static viewCompendiumItemsByFilter(event){
        let element = $(event.currentTarget);
        let filterString = element.data("filter")
        let type = element.data("type")
        let pack = element.data("pack")

        if(game.settings.get("swse", "enableAdvancedCompendium")) {
            new SWSECompendiumBrowser({filterString, type, pack})._render(true);
        } else {
            let packName
            if(pack){
                packName = pack.split(".")[1]
            }
            if(!packName && filterString){
                packName = filterString.split(":")[1].split(/(?=[A-Z])/).join(" ").toLowerCase()
            }

            let found = game.packs.find(p => p.metadata.name.includes(packName));
            if(found){

                found.render(true);
            } else {
                console.warn("could not find appropriate pack " + packName)
            }
        }
    }
}