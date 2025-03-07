import {DROID_COST_FACTOR, SIZE_CARRY_CAPACITY_MODIFIER, sizeArray} from "../common/constants.mjs";
import {getInheritableAttribute, getResolvedSize} from "../attribute-helper.mjs";
import {resolveWeight} from "../common/util.mjs";

export class WeightDelegate {
    constructor(actor) {
        this.actor = actor;
    }

    get carriedWeight() {
        return this.actor.getCached("carriedWeight", () => {
            const resolvedSize = sizeArray[getResolvedSize(this.actor)];
            let costFactor = DROID_COST_FACTOR[resolvedSize]
            let sum = 0;
            for (let item of this.actor.items.values()) {
                let weight = getInheritableAttribute({entity: item, attributeKey: "weight", reduce: "SUM"})
                if (isNaN(weight)) {
                    weight = 0;
                }
                sum += resolveWeight(weight, item.system.quantity, costFactor, this.actor)
            }
            return sum;
        })
    }


    #applyStandardCarryCapacityModifiers(number) {
        const multipliers = getInheritableAttribute({entity: this.actor, attributeKey: "carryCapacityMultiplier", reduce: "VALUES"})

        for (const multiplier of multipliers) {
            const toks = multiplier.split(":")
            for (let tok of toks) {
                if(tok.startsWith("min")){
                    let min = tok.split(" ")[1];
                    number = Math.min(number, min)
                } else {
                    number = number * tok;
                }
            }
        }

        return number * SIZE_CARRY_CAPACITY_MODIFIER[sizeArray[getResolvedSize(this.actor)]]
    }
    get heavyLoad() {
        return this.#applyStandardCarryCapacityModifiers(Math.pow(this.actor.attributes.str.total * 0.5, 2))

    }

    get strainCapacity() {
        return this.#applyStandardCarryCapacityModifiers(Math.pow(this.actor.attributes.str.total, 2) * 0.5)
    }

    get maximumCapacity() {
        return this.#applyStandardCarryCapacityModifiers(Math.pow(this.actor.attributes.str.total, 2))
    }
}