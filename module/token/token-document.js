import {getInheritableAttribute, getResolvedSize} from "../attribute-helper.mjs";
import {COLORS, sizeArray} from "../common/constants.mjs";


function mergeColor(colors) {
    if(colors.length === 0){
        return "#000000"
    }

    let reds = 0;
    let blues = 0;
    let greens = 0;
    if(colors.length > 0){
        for (const color of colors) {
            reds += parseInt(color.substring(1,3), 16)
            blues += parseInt(color.substring(3,5), 16)
            greens += parseInt(color.substring(5), 16)
        }
        reds = Math.round(reds/colors.length);
        blues = Math.round(blues/colors.length);
        greens = Math.round(greens/colors.length);
    }

    return `#${reds.toString(16).padStart(2,'0')}${blues.toString(16).padStart(2,'0')}${greens.toString(16).padStart(2,'0')}`;
}

function adjust(target, updates) {
    for (const [key, value] of Object.entries(updates)) {
        target[key] = value;
    }
}

export class SWSETokenDocument extends TokenDocument {

    SWSETokenDocument(){
        console.log("SWSETokenDocument");
    }

    getAuras() {
        const token = {};
        //token.light = {};
        let auraColors = getInheritableAttribute({attributeKey: "auraColor", entity: this.actor, reduce: "VALUES"})

        auraColors = auraColors.filter(color => !!color).map(color => {
            if(color.startsWith("#")){
                return color;
            }
            return COLORS[color];
        }).filter(color => !!color)

            const auraLuminosity = getInheritableAttribute({attributeKey: "auraLuminosity", entity: this.actor, reduce: "SUM"})
            token['light.luminosity'] = auraLuminosity || 0.30 + auraColors.length * 0.10

            const auraBright = getInheritableAttribute({attributeKey: "auraBright", entity: this.actor, reduce: "SUM"})
            token['light.bright'] = auraBright || 0.20 + auraColors.length * 0.10

            const auraDim = getInheritableAttribute({attributeKey: "auraDim", entity: this.actor, reduce: "SUM"})
            token['light.dim'] = auraDim || 0.50 + auraColors.length * 0.20

            token['light.color'] = mergeColor(auraColors);

            // const auraAnimationType = getInheritableAttribute({attributeKey: "auraAnimationType", entity: this.actor, reduce: "FIRST"})
            // if(auraAnimationType){
            //     const auraAnimationSpeed = getInheritableAttribute({attributeKey: "auraAnimationSpeed", entity: this.actor, reduce: "FIRST"})
            //     const auraAnimationIntensity = getInheritableAttribute({attributeKey: "auraAnimationIntensity", entity: this.actor, reduce: "FIRST"})
            //     token.animation = {type: auraAnimationType, speed:auraAnimationSpeed, intensity:auraAnimationIntensity, reverse:false};
            // }
        return token;
    }
}