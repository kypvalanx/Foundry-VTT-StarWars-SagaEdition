import {filterItemsByType} from "../util.mjs";

export class SpeciesHandler {
    generateSpeciesData(actor) {
        let actorData = actor.data;
        let speciesList = filterItemsByType("species", actorData.items);
        actorData.species = (speciesList.length > 0 ? speciesList[0] : null);

        if (!actorData.species) {
            return;
        }
        let bonuses = actorData.species.data.statBonuses;

        if (actorData.species.name.toLowerCase() === 'ruurian') {
            actorData.isRuurian = true;
        } else if (actorData.species.name.toLowerCase() === 'melodie') {
            actorData.isMelodie = true;
        } else if (actorData.species.name === 'Medical Droid' || actorData.species.name === '1st-Degree Droid Model') {
            actorData.data.bonusTalentTree = "1st-Degree Droid Talent Tree";
        } else if (actorData.species.name === 'Astromech Droid' || actorData.species.name === 'Mechanic Droid' || actorData.species.name === '2nd-Degree Droid Model') {
            actorData.data.bonusTalentTree = "2nd-Degree Droid Talent Tree";
        } else if (actorData.species.name === 'Protocol Droid' || actorData.species.name === 'Service Droid' || actorData.species.name === '3rd-Degree Droid Model') {
            actorData.data.bonusTalentTree = "3rd-Degree Droid Talent Tree";
        } else if (actorData.species.name === 'Battle Droid' || actorData.species.name === 'Probe Droid' || actorData.species.name === '4th-Degree Droid Model') {
            actorData.data.bonusTalentTree = "4th-Degree Droid Talent Tree";
        } else if (actorData.species.name === 'Labor Droid' || actorData.species.name === '5th-Degree Droid Model') {
            actorData.data.bonusTalentTree = "5th-Degree Droid Talent Tree";
        }

        if (bonuses != null) {
            if (bonuses.all) {
                this._applySpeciesBonuses(actorData, bonuses.all);
            }
            if (bonuses[actorData.gender]) {
                this._applySpeciesBonuses(actorData, bonuses[actorData.gender]);
            }
            if (bonuses[actorData.age]) {
                this._applySpeciesBonuses(actorData, bonuses[actorData.age]);
            }
        }

        actorData.data.isDroid = this._isDroid(actorData);
        let prerequisites = actorData.prerequisites;
        prerequisites.species = actorData.species?.name.toLowerCase();
        prerequisites.isDroid = actorData.data.isDroid;
        if (actorData.data.isDroid) {
            actorData.data.abilities.con.skip = true;
            let abilities = filterItemsByType("ability", actorData.items);
            //TODO add other sized for NPC droids https://swse.fandom.com/wiki/Droid_Heroes
            let small = abilities.find(ability => ability.name === 'Small');
            if (small) {
                this._applySpeciesBonuses(actorData, {dexterity: 2, strength: -2});
            }
        }
        this._handleAge(actorData);
        this._handleAgeRelatedSpeciesEffects(actorData);
    }

    _isDroid(actorData) {
        if (actorData.species) {
            return actorData.species.name.toLowerCase().includes("droid");
        }
        return false;
    }

    _handleAge(actorData) {
        if (!actorData.species) {
            return;
        }
        actorData.ageGroup = this._getAgeCategory(actorData);
        switch (actorData.ageGroup) {
            case "child":
                actorData.data.abilities.str.ageBonus = -3;
                actorData.data.abilities.con.ageBonus = -3;
                actorData.data.abilities.dex.ageBonus = -1;
                actorData.data.abilities.int.ageBonus = -1;
                actorData.data.abilities.wis.ageBonus = -1;
                actorData.data.abilities.cha.ageBonus = -1;
                actorData.ruurian = "larva";
                actorData.melodie = "youth";
                break;
            case "young adult":
                actorData.data.abilities.str.ageBonus = -1;
                actorData.data.abilities.con.ageBonus = -1;
                actorData.data.abilities.dex.ageBonus = -1;
                actorData.data.abilities.int.ageBonus = -1;
                actorData.data.abilities.wis.ageBonus = -1;
                actorData.data.abilities.cha.ageBonus = -1;
                actorData.ruurian = "larva";
                actorData.melodie = "youth";
                break;
            case "adult":
                actorData.data.abilities.str.ageBonus = 0;
                actorData.data.abilities.con.ageBonus = 0;
                actorData.data.abilities.dex.ageBonus = 0;
                actorData.data.abilities.int.ageBonus = 0;
                actorData.data.abilities.wis.ageBonus = 0;
                actorData.data.abilities.cha.ageBonus = 0;
                actorData.ruurian = "larva";
                actorData.melodie = "adults";
                break;
            case "middle age":
                actorData.data.abilities.str.ageBonus = -1;
                actorData.data.abilities.con.ageBonus = -1;
                actorData.data.abilities.dex.ageBonus = -1;
                actorData.data.abilities.int.ageBonus = 1;
                actorData.data.abilities.wis.ageBonus = 1;
                actorData.data.abilities.cha.ageBonus = 1;
                actorData.ruurian = "chroma-wings";
                actorData.melodie = "adults";
                break;
            case "old":
                actorData.data.abilities.str.ageBonus = -2;
                actorData.data.abilities.con.ageBonus = -2;
                actorData.data.abilities.dex.ageBonus = -2;
                actorData.data.abilities.int.ageBonus = 1;
                actorData.data.abilities.wis.ageBonus = 1;
                actorData.data.abilities.cha.ageBonus = 1;
                actorData.ruurian = "chroma-wings";
                actorData.melodie = "adults";
                break;
            case "venerable":
                actorData.data.abilities.str.ageBonus = -3;
                actorData.data.abilities.con.ageBonus = -3;
                actorData.data.abilities.dex.ageBonus = -3;
                actorData.data.abilities.int.ageBonus = 1;
                actorData.data.abilities.wis.ageBonus = 1;
                actorData.data.abilities.cha.ageBonus = 1;
                actorData.ruurian = "chroma-wings";
                actorData.melodie = "adults";
                break;
        }
    }

    _getAgeCategory(actorData) {
        if (actorData.species.data.ages) {
            let ages = actorData.species.data.ages;
            for (let [age, range] of Object.entries(ages)) {
                if (range.includes("-")) {
                    let toks = range.split("-");
                    if (actorData.age >= parseInt(toks[0]) && actorData.age <= parseInt(toks[1])) {
                        return age;
                    }
                } else if (range.includes("+")) {
                    let toks = range.split("+");
                    if (actorData.age >= parseInt(toks[0])) {
                        return age;
                    }
                }
            }
        }
    }

    _handleAgeRelatedSpeciesEffects(actorData) {
        if (!actorData.species) {
            return;
        }
        let bonuses = actorData.species.data.statBonuses;
        // if (actorData.isRuurian) {
        //     this._applySpeciesBonuses(actorData, bonuses[actorData.ruurian]);
        // }
        // if (actorData.isMelodie) {
        //     this._applySpeciesBonuses(actorData, bonuses[actorData.melodie]);
        // }
    }

    _applySpeciesBonuses(actorData, matrix) {
        if (!matrix) {
            return;
        }

        for (let [key, bonus] of Object.entries(matrix)) {
            actorData.data.attributes[key.substr(0, 3)].speciesBonus = parseInt(bonus)
                + actorData.data.attributes[key.substr(0, 3)].speciesBonus;
        }
    }
}