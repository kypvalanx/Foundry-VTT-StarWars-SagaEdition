import {getInheritableAttribute, getResolvedSize} from "../attribute-helper.mjs";
import {COLORS, sizeArray} from "../common/constants.mjs";

function mergeColor(colors) {
    let reds = 0;
    let blues = 0;
    let greens = 0;
    for (const color of colors) {
        reds += parseInt(color.substring(1,3), 16)
        blues += parseInt(color.substring(3,5), 16)
        greens += parseInt(color.substring(5), 16)
    }


    return `#${Math.round(reds/colors.length).toString(16).padStart(2,'0')}${Math.round(blues/colors.length).toString(16).padStart(2,'0')}${Math.round(greens/colors.length).toString(16).padStart(2,'0')}`;
}

export class SWSETokenDocument extends TokenDocument {
    _onUpdateDescendantDocuments(parent, collection, documents, changes, options, userId) {
        super._onUpdateDescendantDocuments(parent, collection, documents, changes, options, userId);

        //this.reset()
        //     this._object.renderFlags.set({redraw: true})
        // canvas.tokens.draw();

        this.reset()
        //this._object.updateLightSource()
    }

    _onUpdate(data, options, userId) {
        super._onUpdate(data, options, userId);
    }

    prepareBaseData(){
        super.prepareBaseData()

        const size = sizeArray[getResolvedSize(this.actor)]
        switch(size) {
            case "Large":
                this.width = 2;
                this.height = 2;
                break;
            case "Huge":
                this.width = 3;
                this.height = 3;
                break;
            case "Gargantuan":
                this.width = 4;
                this.height = 4;
                break;
            case "Colossal":
                this.width = 6;
                this.height = 6;
                break;
        }

        let tokenWidth = getInheritableAttribute({attributeKey: "tokenWidth", entity: this.actor, reduce: "SUM"})
        if(tokenWidth > 0){
            this.width = tokenWidth;
        }

        let tokenHeight = getInheritableAttribute({attributeKey: "tokenHeight", entity: this.actor, reduce: "SUM"})
        if(tokenHeight > 0){
            this.height = tokenHeight;
        }



        let auraColors = getInheritableAttribute({attributeKey: "auraColor", entity: this.actor, reduce: "VALUES"})

        auraColors = auraColors.filter(color => !!color).map(color => {
            if(color.startsWith("#")){
                return color;
            }
            return COLORS[color];
        }).filter(color => !!color)

        if(this.light.dim === 0 && this.light.bright === 0 && auraColors.length > 0){
            const auraLuminosity = getInheritableAttribute({attributeKey: "auraLuminosity", entity: this.actor, reduce: "SUM"})
            this.light.luminosity = auraLuminosity || 0.30 + auraColors.length * 0.10

            const auraBright = getInheritableAttribute({attributeKey: "auraBright", entity: this.actor, reduce: "SUM"})
            this.light.bright = auraBright || 0.20 + auraColors.length * 0.10

            const auraDim = getInheritableAttribute({attributeKey: "auraDim", entity: this.actor, reduce: "SUM"})
            this.light.dim = auraDim || 0.50 + auraColors.length * 0.20

            this.light.color = mergeColor(auraColors);

            const auraAnimationType = getInheritableAttribute({attributeKey: "auraAnimationType", entity: this.actor, reduce: "FIRST"})
            if(auraAnimationType){
                const auraAnimationSpeed = getInheritableAttribute({attributeKey: "auraAnimationSpeed", entity: this.actor, reduce: "FIRST"})
                const auraAnimationIntensity = getInheritableAttribute({attributeKey: "auraAnimationIntensity", entity: this.actor, reduce: "FIRST"})
                this.light.animation = {type: auraAnimationType, speed:auraAnimationSpeed, intensity:auraAnimationIntensity, reverse:false};
            }
        }
    }
}