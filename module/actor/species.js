import {filterItemsByType} from "../util.js";

export class SpeciesHandler {
    generateSpeciesData(actor) {
        let actorData = actor.data;
        let speciesList = filterItemsByType(actor.items, "species");
        actorData.species = (speciesList.length > 0 ? speciesList[0] : null);

        if (!actorData.species) {
            return;
        }

        let speciesName = actorData.species.name;

        actorData.data.isDroid = this._isDroid(speciesName);
        let prerequisites = actorData.prerequisites;
        prerequisites.species = actorData.species?.name.toLowerCase();
        prerequisites.isDroid = actorData.data.isDroid;
        actorData.data.attributes.con.skip = actorData.data.isDroid;
    }

    _isDroid(speciesName) {
        return speciesName.toLowerCase().includes("droid");
    }
}