import {skills} from "../common/constants.mjs";
import {getInheritableAttribute} from "../attribute-helper.mjs";
import {toNumber} from "../common/util.mjs";

export const crewPositions = ['Pilot', 'Copilot', 'Gunner', 'Commander', 'System Operator', 'Engineer'];
export const crewSlotResolution = {
    'Pilot': (crew) => (crew > 0) ? 1 : 0,
    'Copilot': (crew) => (crew > 1) ? 1 : 0,
    'Commander': (crew) => (crew > 2) ? 1 : 0,
    'System Operator': (crew) => (crew > 2) ? 1 : 0,
    'Engineer': (crew) => (crew > 2) ? 1 : 0,
};
export const crewQuality = {
    "Untrained": {"Attack Bonus": -5, "Check Modifier": 0, "CL Modifier": -1},
    "Normal": {"Attack Bonus": 0, "Check Modifier": 5, "CL Modifier": 0},
    "Skilled": {"Attack Bonus": 2, "Check Modifier": 6, "CL Modifier": 1},
    "Expert": {"Attack Bonus": 5, "Check Modifier": 8, "CL Modifier": 2},
    "Ace": {"Attack Bonus": 10, "Check Modifier": 12, "CL Modifier": 4}
};

export class CrewDelegate {
    constructor(actor) {
        this.actor = actor;
    }

    get members() {
        return this.actor.system.crew;
    }

    get crewCount() {
        return this.actor.system.vehicle?.crew || 0;
    }

    get hasAstromechSlot() {
        let providedSlots = getInheritableAttribute({
            entity: this.actor,
            attributeKey: "providesSlot",
            reduce: "VALUES"
        });
        return providedSlots.includes("Astromech Droid");
    }

    get hasCrew() {
        if (!["vehicle", "npc-vehicle"].includes(this.actor.type)) {
            return false;
        }
        return 0 < this.actor.system.crew.length
    }

    get slots(){
        return this.actor.getCached("slots", () => {
            let crewSlots = []

            let coverValues = getInheritableAttribute({
                entity: this.actor,
                attributeKey: "cover",
                reduce: "VALUES"
            })

            let coverMap = {};
            for (let coverValue of coverValues) {
                if (coverValue.includes(":")) {
                    let toks = coverValue.split(":");
                    coverMap[toks[1] || "default"] = toks[0];
                } else {
                    coverMap["default"] = coverValue;
                }
            }

            let slots = getInheritableAttribute({
                entity: this.actor,
                attributeKey: "providesSlot",
                reduce: "VALUES"
            });

            crewPositions.forEach(position => {

                let count = "Gunner" === position ? this.actor.gunnerPositions.length : crewSlotResolution[position](this.actor.crew.crewCount);
                for (let i = 0; i < count; i++) {
                    slots.push(position)
                }
            });

            let slotCount = {};

            slots.forEach(position => {
                const numericSlot = slotCount[position] || 0;
                slotCount[position] = numericSlot + 1;
                let slotId = `${position}${numericSlot}`


                let crewMember = this.actor.actorLinks.find(crewMember => crewMember.position === position && crewMember.slot === numericSlot);


                this.actor.system.crewCover = this.actor.system.crewCover || {}

                let positionCover = this.actor.system.crewCover[slotId] || this.actor.system.crewCover[position] || coverMap[position] || coverMap["default"];

                crewSlots.push(this.getSlot(crewMember, position, positionCover, numericSlot));
            })


            // crewPositions.forEach(position => {
            //     let crewMember = this.system.crew.filter(crewMember => crewMember.position === position);
            //     let positionCover;
            //
            //     if (this.system.crewCover) {
            //         positionCover = this.system.crewCover[position]
            //     }
            //     positionCover = positionCover || coverMap[position] || coverMap["default"];
            //
            //     if (position === 'Gunner') {
            //         crewSlots.push(...this.resolveSlots(crewMember, position, positionCover, this.gunnerPositions.map(gp => gp.numericId)));
            //     } else {
            //         let crewSlot = crewSlotResolution[position];
            //         if (crewSlot) {
            //             crewSlots.push(...this.resolveSlots( crewMember, position, positionCover, range(0, crewSlot(this.crew) - 1)));
            //         }
            //     }
            // });
            //
            // for (let position of providedSlots.filter(notEmpty).filter(unique)) {
            //     let count = providedSlots.filter(s => s === position).length
            //     let positionCover;
            //
            //     if (this.system.crewCover) {
            //         positionCover = this.system.crewCover[position]
            //     }
            //
            //     if (!positionCover) {
            //         positionCover = coverMap[position];
            //     }
            //     if (!positionCover) {
            //         positionCover = coverMap["default"];
            //     }
            //     //this.system.crewCount += ` plus ${count} ${position} slot${count > 1 ? "s" : ""}`
            //     crewSlots.push(...this.resolveSlots(this.system.crew.filter(crewMember => crewMember.position === position), position, positionCover, count -1));
            // }
            return crewSlots;
        })
    }

    get hasCrewQuality() {
        return this.actor.getCached("hasCrewQuality", () => {
            const quality = this.quality;
            return quality !== undefined && quality !== null;
        });
    }

    get quality(){
        return this.actor.getCached("crew_Quality", () => {
            let crewQuality;
            if (!this.actor.system.crew.quality || this.actor.system.crew.quality.quality === undefined) {
                let quality = getInheritableAttribute({
                    entity: this.actor,
                    attributeKey: "crewQuality",
                    reduce: "FIRST"
                });
                if (quality) {
                    crewQuality = {quality: quality.titleCase()}
                }
            }
            return crewQuality;
        })
    }

    crewman(position, slot) {
        if (position.startsWith("Gunner") && position !== "Gunner") {
            slot = toNumber(position.slice(6, position.length))
            position = "Gunner"
        }
        switch (position.titleCase()) {
            case "Pilot":
                return this.#crewman("Pilot", "Astromech Droid");
            case "Copilot":
                return this.#crewman("Copilot", "Astromech Droid");
            case "Commander":
                return this.#crewman("Commander", "Copilot", "Astromech Droid");
            case "Engineer":
                return this.#crewman("Engineer", "Astromech Droid");
            case "Astromech Droid":
                return this.#crewman("Astromech Droid");
            case "Systems Operator":
            case "SystemsOperator":
                return this.#crewman("Systems Operator", "Astromech Droid");
            case "Gunner":
                return this.gunner(slot)
        }
        return getCrewByQuality(this.actor.system.crew.quality().quality);
    }

    #crewman(position, backup, third) {
        let crewman = this.actor.actorLinks.find(l => l.position === position)
        if (!crewman && (!!backup || !!third)) {
            crewman = this.#crewman(position, third);
        }
        if (!crewman) {
            crewman = getCrewByQuality(this.actor.system.crewQuality.quality);
            if (position === "Astromech Droid" && this.actor.system.hasAstromech && this.hasAstromechSlot) {
                crewman.system.skills['mechanics'].value = 13;
                crewman.system.skills['use computer'].value = 13;
            }
        }
        return crewman;
    }

    gunner (index){
        let actor = this.actor.actorLinks.find(c => c.position === 'Gunner' && c.slot === (index || 0))

        if (!actor) {
            actor = getCrewByQuality(this.actor.system.crew.quality().quality);
        }

        return actor;
    }

    getSlot(crew, type, cover, numericSlot){
        let slot = {
            slotNumber: numericSlot,
            type: type,
            cover: cover,
            slotName: type === "Gunner" ? `Gunner ${numericSlot} Slot` : `${type} Slot`
        };
        if (crew) {
            let actor = game.data.actors.find(actor => actor._id === crew.id);
            slot.id = crew.id;
            slot.uuid = crew.uuid;
            slot.img = actor?.img;
            slot.name = actor?.name;
        }
        return slot
    }
}

/**
 * Retrieves crew quality details by provided quality identifier.
 *
 * @param {string} quality The quality identifier for the crew. It determines the base attack bonus and skill modifiers.
 * @return {Object} An object containing crew details including base attack bonus, system skills, items, and name.
 *                  The `baseAttackBonus` is the attack bonus for the crew, `system.skills` includes resolved skill
 *                  values, `items` is an empty array, and `name` is the provided quality identifier.
 */
export function getCrewByQuality(quality) {
    let attackBonus = 0;
    let checkModifier = 0;
    //let cLModifier = 0;
    if (quality && quality !== "-") {
        attackBonus = crewQuality[quality.titleCase()]["Attack Bonus"];
        checkModifier = crewQuality[quality.titleCase()]["Check Modifier"];
        //cLModifier = crewQuality[quality.titleCase()]["CL Modifier"];
    }
    let resolvedSkills = {}
    skills().forEach(s => resolvedSkills[s.toLowerCase()] = {value: checkModifier})
    return {
        baseAttackBonus: attackBonus,
        system: {
            skills: resolvedSkills
        },
        items: [],
        name: quality
    }
}