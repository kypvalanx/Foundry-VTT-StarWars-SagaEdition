import {getInheritableAttribute} from "../attribute-helper.js";
//import * as fields from "../data/fields.mjs";

/**
 * Extend the base ActiveEffect entity
 * @extends {ActiveEffect}
 */
export class SWSEActiveEffect extends ActiveEffect {

    async safeUpdate(data={}, context={}) {
        if(this.canUserModify(game.user, 'update')){
            await this.update(data, context);
        }
    }


    get hasDuration(){
        return !this.flags.swse?.itemModifier
    }

    get hasDisable(){
        return !this.flags.swse?.itemModifier
    }

    static async _onCreateDocuments(documents, context) {
        super._onCreateDocuments(documents, context).then(
            game.items.directory.render())
    }
    static async _onDeleteDocuments(documents, context) {
        super._onCreateDocuments(documents, context).then(
            game.items.directory.render())
    }

    get toggles(){
        return this.flags.swse.toggles
    }

    get upgradePoints(){
        return getInheritableAttribute({entity: this, attributeKey:"upgradePointCost", reduce:"SUM"});
    }
}