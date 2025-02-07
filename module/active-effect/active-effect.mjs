import {getInheritableAttribute} from "../attribute-helper.mjs";
import {getDocumentByUuid} from "../common/util.mjs";
import {generateAction} from "../action/generate-action.mjs";

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

    async setPayload(pattern, payload) {
        let regExp = new RegExp(pattern, "g");
        for(const change of this.changes){
            if (change.value) {
                change.key = change.key.replace(regExp, payload);
                if (Array.isArray(change.value)) {
                    change.value = change.value.map(val => `${val}`.replace(regExp, payload));
                } else {
                    change.value = `${change.value}`.replace(regExp, payload);
                }
            }
        }


        if(!this.pack){
            let data = {"changes" : this.changes};
            await this.safeUpdate(data);
        }
    }

    get target() {
        if ( this.parent instanceof Actor ) return this.parent;
        if ( CONFIG.ActiveEffect.legacyTransferral ) return this.transfer ? null : this.parent;
        return this.transfer ? (this.parent.parent ?? null) : this.parent;
    }
    get transfer(){
        const inheritableAttribute = this.changes.find(change => change.key === "transfer")
        return inheritableAttribute?.value === "true"
    }

    set transfer(value) {
        //console.warn("attempted to modify transfer");
    }

    get actions(){
        let actions = [];
        actions.push(...generateAction(this, this.changes))
        return actions;
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
        if(this === that){
            return;
        }

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

    disable(disabled = true, affected = []){
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
        return this.flags?.swse?.links || []
    }

    get hasDuration(){
        return !this.flags?.swse?.itemModifier && !this.flags.swse?.isLevel
    }

    get hasDisable(){
        return !this.flags?.swse?.itemModifier && !this.flags.swse?.isLevel
    }

    get hideFromActor(){
        return false;
    }

    /**
     *  should this appear as an effect on an actors Mode page?  levels should be used for stats but hidden here.
     * @return {boolean}
     */
    get isActorLevelEffect(){
        return !this.flags.swse?.isLevel;
    }

    static async _onCreateOperation(documents, context) {
        super._onCreateOperation(documents, context).then(
            game.items.directory.render())
    }
    static async _onDeleteDocuments(documents, context) {
        super._onDeleteDocuments(documents, context).then(
            game.items.directory.render())
    }

    get toggles(){
        return this.flags.swse?.toggles || [];
    }

    get upgradePoints(){
        return getInheritableAttribute({entity: this, attributeKey:"upgradePointCost", reduce:"SUM"});
    }
}