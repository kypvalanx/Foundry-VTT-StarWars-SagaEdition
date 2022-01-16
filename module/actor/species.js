import {filterItemsByType} from "../util.js";

export class SpeciesHandler {
    generateSpeciesData(actor) {
        let actorData = actor.data;
        let speciesList = filterItemsByType(actor.items, "species");
        actor.species = (speciesList.length > 0 ? speciesList[0] : null);

        if (!actorData.species) {
            return;
        }

        let prerequisites = actorData.prerequisites;
        prerequisites.species = actorData.species?.name.toLowerCase();
        prerequisites.isDroid = actor.isDroid
        actorData.data.attributes.con.skip = actor.getInheritableAttributesByKey("isDroid", "OR", null);
    }
}