import {getInheritableAttribute} from "../attribute-helper.mjs";

export class SWSETokenDocument extends TokenDocument {
    _onUpdateDescendantDocuments(parent, collection, documents, changes, options, userId) {
        super._onUpdateDescendantDocuments(parent, collection, documents, changes, options, userId);

        this.reset()
        //     this._object.renderFlags.set({redraw: true})
        // canvas.tokens.draw();
    }

    _onUpdate(data, options, userId) {
        super._onUpdate(data, options, userId);
    }

    prepareBaseData(){
        super.prepareBaseData()
        // console.log(this)
        //
        // const auraColor = getInheritableAttribute({attributeKey: "auraColor", entity: this.actor, reduce: "VALUES"})
        //
        // if(this.light.dim === 0 && this.light.bright === 0 && auraColor.length > 0){
        //     this.light.dim = 0.25
        //     this.light.color = "#00FF00";//auraColor[0] //TODO take the average of color to represent overlapping auras
        //     this.light.animation = {type: "torch", speed:2, intensity:2, reverse:false};
        // }
    }
}