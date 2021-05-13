import {filterItemsByType} from "../util.js";

export class SpeciesHandler {
    generateSpeciesData(actor) {
        let actorData = actor.data;
        let speciesList = filterItemsByType("species", actorData.items);
        actorData.species = (speciesList.length > 0 ? speciesList[0] : null);

        if (!actorData.species) {
            return;
        }

        let speciesName = actorData.species.name;
        if (speciesName === 'Medical Droid' || speciesName === '1st-Degree Droid Model') {
            actorData.data.bonusTalentTree = "1st-Degree Droid Talent Tree";
        } else if (speciesName === 'Astromech Droid' || speciesName === 'Mechanic Droid' || speciesName === '2nd-Degree Droid Model') {
            actorData.data.bonusTalentTree = "2nd-Degree Droid Talent Tree";
        } else if (speciesName === 'Protocol Droid' || speciesName === 'Service Droid' || speciesName === '3rd-Degree Droid Model') {
            actorData.data.bonusTalentTree = "3rd-Degree Droid Talent Tree";
        } else if (speciesName === 'Battle Droid' || speciesName === 'Probe Droid' || speciesName === '4th-Degree Droid Model') {
            actorData.data.bonusTalentTree = "4th-Degree Droid Talent Tree";
        } else if (speciesName === 'Labor Droid' || speciesName === '5th-Degree Droid Model') {
            actorData.data.bonusTalentTree = "5th-Degree Droid Talent Tree";
        }

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