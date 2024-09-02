import {getInheritableAttribute} from "../attribute-helper.mjs";

export class DarksideDelegate{
    constructor(actor){
        this.actor = actor;
    }

    get score(){
        return parseInt(this.actor.system.darkSideScore);
    }

    get finalScore(){
        let darkSideTaint = getInheritableAttribute({entity: this.actor, attributeKey: "darksideTaint", reduce: "SUM"})
        return this.score + parseInt(darkSideTaint);
    }

    get array(){
        const system = this.actor.system;
        const darksideArray  = [];
        for (let i = 0; i <= system.attributes.wis.total; i++) {
            darksideArray.push({value: i, active: this.score >= i})
        }
        return darksideArray;
    }
}