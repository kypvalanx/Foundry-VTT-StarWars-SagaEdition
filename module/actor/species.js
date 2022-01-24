    /**
     *
     * @param actor {SWSEActor}
     */
    export function generateSpeciesData(actor) {
        if (!actor.species) {
            return;
        }

        let prerequisites = actor.data.prerequisites;
        prerequisites.species = actor.data.species?.name.toLowerCase();
        prerequisites.isDroid = actor.isDroid
        actor.data.data.attributes.con.skip = actor.isDroid;
    }