
export class SWSERollWrapper {

    constructor(roll){
        this.roll = roll;
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
}