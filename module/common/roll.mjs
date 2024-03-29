
export class SWSERollWrapper {

    constructor(roll, additionalTerms = []){
        this.roll = roll;
        this.additionalTerms = additionalTerms;
    }

    get renderFormulaHTML(){
        let response = "";
        for(let term of this.roll.terms){
            let expression1 = term.expression;
            let expression = `<span>${expression1}</span>`;
            if(term.options.flavor){
                expression = `<span title="${term.options.flavor}">${expression1}</span>`
            }
            response += expression;
        }
        return response
    }


    get renderWeaponBlockFormulaHTML(){
        let response = "";
        for(let term of this.roll.terms){
            let expression1 = term.expression;
            let expression = `<span>${expression1}</span>`;
            if(term.options.flavor){
                expression = `<span title="${term.options.flavor}">${expression1}</span>`
            }
            if(term instanceof Die){
                for(const additionalTerm of this.additionalTerms){
                    expression += `<span>/</span><span>${additionalTerm.expression}</span>`
                }
            }
            response += expression;
        }
        return response
    }
}