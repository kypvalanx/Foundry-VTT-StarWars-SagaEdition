import {getInheritableAttribute} from "../attribute-helper.mjs";
import {getDocumentByUuid} from "../common/util.mjs";

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

    _onUpdate(data, options, userId) {
        return super._onUpdate(data, options, userId);
    }


    get target() {
        if ( this.parent instanceof Actor ) return this.parent;
        if ( CONFIG.ActiveEffect.legacyTransferral ) return this.transfer ? null : this.parent;
        return this.transfer ? (this.parent.parent ?? null) : this.parent;
    }


    _onDelete(options, userId) {
        super._onDelete(options, userId);
        for(let link of this.links){
            let doc = this.getSiblingEffectByName(link.name);
            if(doc){
                doc.removeLink(this.name);
            }
        }
    }

    getSiblingEffectByName(name) {
        return this.parent.effects.find(e => e.name === name);
    }

    deleteReciprocalLinks(name){
        let doc = this.getSiblingEffectByName(name);
        //let doc2 = getDocumentByUuid(uuid);
        this.removeLink(name)
        doc.removeLink(this.name)
    }
    async addLinks(that, type){
        switch (type) {
            case "parent":
                await this.addLink("child", that)
                await that.addLink("parent", this)
                break;
            case "child":
                await this.addLink("parent", that)
                await that.addLink("child", this)
                break;
            case "mirror":
                await this.addLink("mirror", that)
                await that.addLink("mirror", this)
                break;
            case "exclusive":
                await this.addLink("exclusive", that)
                await that.addLink("exclusive", this)
                break;
        }
    }

    removeLink(name){
        let links = this.flags.swse?.links || [];
        links = links.filter(link => link.name !== name);
        let data = {"flags.swse.links": links};
        this.safeUpdate(data);
    }

    async addLink(type, effect){
        //let uuid = effect.uuid;
        let links = this.flags.swse?.links || [];
        links = links.filter(link => link.name !== effect.name);
        links.push({type, name:effect.name});
        let data = {"flags.swse.links": links};
        await this.safeUpdate(data);
    }

    disable(disabled, affected = []){
        if(this.disabled === disabled || (affected.includes(this.id))){
            return;
        }
        for(let link of this.links){
            if(link.type === "exclusive" && !disabled){
                let doc = this.getSiblingEffectByName(link.name)
                affected.push(this.id)
                doc.disable(true, affected)
            } else if(link.type === "mirror") {
                let doc = this.getSiblingEffectByName(link.name)
                affected.push(this.id)
                doc.disable(disabled, affected)
            }
        }


        this.safeUpdate({disabled})
    }

    get isDisabled(){
        let disabled = this.disabled;
        for(let link of this.links){
            if(link.type === "parent"){
                let doc = getDocumentByUuid(link.uuid)
                disabled = disabled || doc.disabled
            }
        }
        return disabled
    }

    get isMode(){
        return !this.flags.swse?.itemModifier && !this.flags.swse?.isLevel
    }

    get hasLinks(){
        return this.links.length > 0;
    }

    get links(){
        return this.flags.swse?.links || []
    }

    get hasDuration(){
        return !this.flags.swse?.itemModifier && !this.flags.swse?.isLevel
    }

    get hasDisable(){
        return !this.flags.swse?.itemModifier && !this.flags.swse?.isLevel
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
        return this.flags.swse?.toggles || [];
    }

    get upgradePoints(){
        return getInheritableAttribute({entity: this, attributeKey:"upgradePointCost", reduce:"SUM"});
    }
}