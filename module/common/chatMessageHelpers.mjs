export function buildRollContent(formula, roll, notes = [], itemFlavor) {
    const tooltip = getTooltipSections(roll)
    return `<div class="message-content">
${itemFlavor}
        <div class="dice-roll">
            <div class="dice-result">
                <div class="dice-formula">${formula}</div>
                <div class="dice-tooltip">${tooltip}</div>
                <h4 class="dice-total">${roll.total}</h4>
            </div>
        </div>
        <div>${notes.map(note => `<div>${note}</div>`).join("")}</div>
    </div>`
}

function getTooltipSections(roll) {
    let sections = [];

    for (let term of roll.terms) {
        if (term instanceof foundry.dice.terms.Die) {
            let partFormula = `<span class="part-formula">${term.number}d${term.faces}</span>`
            let partTotal = `<span class="part-total">${term.total}</span>`
            let partHeader = `<header class="part-header flexrow">${partFormula}${partTotal}</header>`
            let diceRolls = [];
            for (let result of term.results) {
                diceRolls.push(`<li class="roll die d20">${result.result}</li>`)
            }

            sections.push(`<section class="tooltip-part"><div class="dice">${partHeader}<ol class="dice-rolls">${diceRolls.join("")}</ol></div></section>`)
        }
    }

    return sections.join("");
}