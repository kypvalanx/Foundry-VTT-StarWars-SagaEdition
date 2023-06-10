    /**
     *
     * @param actor {SWSEActor}
     */
    export function generateSpeciesData(actor) {
        if (!actor.species) {
            return;
        }
        actor.system.attributes.con.skip = actor.isDroid;
    }