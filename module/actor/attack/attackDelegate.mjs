import {SimpleCache} from "../../common/simple-cache.mjs";
import {Attack} from "./attack.mjs";
import {createAttackMacro, getActorFromId} from "../../swse.mjs";
import {getInheritableAttribute} from "../../attribute-helper.mjs";
import {
    adjustDieSize,
    appendNumericTerm,
    equippedItems,
    getBonusString,
    handleAttackSelect,
    resolveValueArray
} from "../../common/util.mjs";


export class AttackDelegate {

    /**
     * @Params
     */
    constructor(actor) {
        this.actor = actor;
        this.cache = new SimpleCache()
    }

    getCached(key, fn) {
        if (!this.cache) {
            return fn();
        }
        return this.cache.getCached(key, fn)
    }

    get attacks(){
        return this.getCached("attacks", () => {
            if (this.actor.type === "character" || this.actor.type === "npc") {
                return this.generateAttacks(this.actor);
            } else {
                return this.generateVehicleAttacks(this.actor);
            }
        })
    }

    /**
     *
     * @param {SWSEActor} actor
     * @returns {Promise<void>}
     */
    generateAttacks(actor) {
        let weaponIds = actor.equippedWeapons
            .map(item => item.id)

        let beastAttackIds = actor.naturalWeapons
            .map(item => item.id);

        if (beastAttackIds.length > 0) {
            weaponIds.push(...beastAttackIds)
        } else {
            weaponIds.push("Unarmed Attack")
        }

        const actorUUID = actor.uuid;
        let attacks = weaponIds.map(id => Attack.create({actorId: actorUUID, operatorId: actorUUID, weaponId: id}));

        let items = actor.getItemsFromRelationships()

        attacks.push(...items.map(item => Attack.create({actorId: actorUUID, weaponId: item.id, operatorId: actorUUID, parentId: item.parent?.id, options: {}})))
        return attacks;
    }

    getCrewPosition(equipmentSlot) {

        if (equipmentSlot === "pilotInstalled") {
            return "Pilot";
        } else if (equipmentSlot.startsWith("gunnerInstalled")) {
            return equipmentSlot.replace("gunnerInstalled", "Gunner")
        } else {
            console.log(equipmentSlot)
        }
        return undefined;
    }

    /**
     *
     * @param {SWSEActor} vehicle
     * @returns {Attack[]}
     */
    generateVehicleAttacks(vehicle) {
        return vehicle.getItemsFromRelationships()
            .map(weapon => {
                return Attack.create({actorId: vehicle.id, weaponId: weapon.id, parentId:weapon.parent?.id, operatorId:vehicle.crewman(this.getCrewPosition(weapon.system.equipped)).id})
            });
    }

    /**
     *
     * @param event
     * @param context
     * @returns {Promise<void>}
     */
     async createAttackDialog(event, context) {
        const attacksFromContext = getAttacksFromContext(context);
        const attackType = context.type === "fullAttack" ? Attack.TYPES.FULL_ATTACK : Attack.TYPES.SINGLE_ATTACK;
        const dualWeaponModifier = this.dualWeaponModifier;
        const multipleAttackModifiers = this.multipleAttackModifiers;
        const {doubleAttack, tripleAttack, attackCount} = this.getAttackDetails(attackType);
        context.availableHands = 2;

        const data = {
            title: getAttackWindowTitle(context),
            content: await this.getAttackDialogueContent(attackCount, attacksFromContext, doubleAttack, tripleAttack),
            buttons: {
                attack: getAttackButton(dualWeaponModifier, context.availableHands, multipleAttackModifiers),
                saveMacro: getSaveMacroButton(dualWeaponModifier, this.actor, multipleAttackModifiers)
            },
            default: "attack",
            render: (html) => {
                let selects = html.find("select.attack-id");
                context.dialog = html;
                this.updateAttackDialog(selects, context, dualWeaponModifier, html, multipleAttackModifiers);
                selects.on("change", () => {
                    this.updateAttackDialog(selects, context, dualWeaponModifier, html, multipleAttackModifiers);
                })
            }
        };

        const options = {
            height: attackCount * 272 + 130,
            classes: ["swse", "dialog"],
            resizable: true,
            popOut: true
        };

        if(data){
            new Dialog(data, options).render(true);
        }
    }

    updateAttackDialog(selects, context, dualWeaponModifier, html, multipleAttackModifiers) {
        handleAttackSelect(selects)
        context.attackMods = getAttackMods(selects, dualWeaponModifier, multipleAttackModifiers);
        context.damageMods = [];
        selects.each((i, div) => populateItemStats(div, context));
    }

    getAttackDetails(attackType) {
        let doubleAttack = [];
        let tripleAttack = [];
        let hands = getHands(this.actor);
        let attacksFromDoubleAttack = 0;
        let attacksFromTripleAttack = 0;
        let attacksFromDualWielding = 1;
        let beastAttacks = 0;

        if (attackType === Attack.TYPES.FULL_ATTACK) {
            doubleAttack = getInheritableAttribute({
                entity: this.actor,
                attributeKey: "doubleAttack",
                reduce: "VALUES"
            });
            tripleAttack = getInheritableAttribute({
                entity: this.actor,
                attributeKey: "tripleAttack",
                reduce: "VALUES"
            });

            //attackCount = this.fullAttackCount;
            let equippedWeapons = equippedItems(this.actor, "weapon")

            if (this.shouldHaveSecondAttackFromWeaponChoice(equippedWeapons)) {
                attacksFromDualWielding = 2;
            }

            const subtypes = equippedWeapons.map(item => item.isExotic ? item.name : item.system.subtype).distinct()

            beastAttacks = equippedWeapons.filter(item => item.type === "beastAttack")

            attacksFromDoubleAttack = doubleAttack.filter(x => subtypes.includes(x)).length > 0 ? 1 : 0;
            attacksFromTripleAttack = tripleAttack.filter(x => subtypes.includes(x)).length > 0 ? 1 : 0;
        }

        const attackCount = this.getAttackCount(attacksFromDualWielding, attacksFromDoubleAttack, attacksFromTripleAttack, beastAttacks);
        return {doubleAttack, tripleAttack, attackCount};
    }

    get dualWeaponModifier() {
        let dualWeaponModifiers = getInheritableAttribute({
            entity: this.actor,
            attributeKey: "dualWeaponModifier",
            reduce: "NUMERIC_VALUES"
        });
        return dualWeaponModifiers.reduce((a, b) => Math.max(a, b), -10)
    }

    get multipleAttackModifiers(){
        return getInheritableAttribute({
            entity: this.actor,
            attributeKey: "multipleAttackModifier"
        })
    }

    shouldHaveSecondAttackFromWeaponChoice(equippedWeapons) {
        return equippedWeapons.length > 1 || equippedWeapons.length === 1 && (equippedWeapons[0].system.quantity > 1 || equippedWeapons[0].isDoubleWeapon);
    }

    getAttackCount(availableWeapons, doubleAttackBonus, tripleAttackBonus, beastAttacks) {
        return Math.max(availableWeapons + doubleAttackBonus + tripleAttackBonus, beastAttacks, 1);
    }

    attackOptions(doubleAttack, tripleAttack) {
        let resolvedAttacks = [];
        let existingWeaponNames = [];
        for (let attack of this.attacks) {
            resolvedAttacks.push(...attack.getPossibleAttacksFromAttacks(existingWeaponNames, doubleAttack, tripleAttack));
        }
        return resolvedAttacks;
    }


    async getAttackDialogueContent(availableAttacks, suppliedAttacks, doubleAttack, tripleAttack) {

        const attacks = [];

        for (let i = 0; i < availableAttacks; i++) {
            attacks.push(suppliedAttacks.length > i ? suppliedAttacks[i].name : "--")
        }

        let template = await getTemplate("systems/swse/templates/actor/parts/attack/attack-dialogue.hbs")

        const resolvedAttacks = this.attackOptions(doubleAttack, tripleAttack)

        return template({selectedAttacks:attacks, availableAttacks: resolvedAttacks.map(attack => attack.summary)});
    }

}



function multiplyNumericTerms(roll, multiplier) {
    let previous;
    for (let term of roll.terms) {
        if (term instanceof foundry.dice.terms.NumericTerm) {
            if (previous && previous.operator !== "*" && previous.operator !== "/") {
                term.number = term.number * multiplier;
            }
        }
        previous = term;
    }
    return Roll.fromTerms(roll.terms);
}

function addMultiplierToDice(roll, multiplier) {
    let terms = [];

    for (let term of roll.terms) {
        terms.push(term);
        if (term instanceof foundry.dice.terms.DiceTerm) {
            terms.push(new foundry.dice.terms.OperatorTerm({operator: '*'}));
            terms.push(new foundry.dice.terms.NumericTerm({number: `${multiplier}`}))
        }
    }

    return Roll.fromTerms(terms
        .filter(term => !!term))
}

function getHands(actor) {
    return 2;
}

function getAttackWindowTitle(context) {
    if (context.type === "fullAttack") {
        return "Full Attack";
    }
    return "Single Attack";
}

function getAttackButton(dualWeaponModifier, availableHands, multipleAttackModifiers) {
    return {
        label: "Attack",
        callback: (html) => {
            let attacks = [];
            let attackBlocks = html.find(".attack.panel");
            let selects = html.find("select.attack-id");
            let attackMods = getAttackMods(selects, dualWeaponModifier, multipleAttackModifiers);
            let damageMods = [];
            for (let attackBlock of attackBlocks) {
                let attackFromBlock = createAttackFromAttackBlock(attackBlock, attackMods, damageMods);
                if (!!attackFromBlock) {
                    attacks.push(attackFromBlock);
                }
            }

            for (const attack of attacks) {
                attack.reduceAmmunition()
            }
            const hands = getHandsFromAttackOptions(html);
            createAttackChatMessage(attacks, undefined, hands, availableHands).then(() => {
            });
        }
    };
}

function getSaveMacroButton(dualWeaponModifier, actor, multipleAttackModifiers) {
    return {
        label: "Save Macro",
        callback: (html) => {
            let attacks = [];
            let attackBlocks = html.find(".attack-block");
            let selects = html.find("select.attack-id")
            let attackMods = getAttackMods(selects, dualWeaponModifier, multipleAttackModifiers);
            let damageMods = [];
            for (let attackBlock of attackBlocks) {
                let attackFromBlock = createAttackFromAttackBlock(attackBlock, attackMods, damageMods);
                if (!!attackFromBlock) {
                    attacks.push(attackFromBlock);
                }
            }
            let data = {};
            data.attacks = attacks;
            data.actorId = actor._id;

            createAttackMacro(data).then(() => {
            });
        }
    };
}

function modifyForFullAttack(doubleAttack, actor, tripleAttack, availableAttacks, dualWeaponModifier) {
    doubleAttack = getInheritableAttribute({
        entity: actor,
        attributeKey: "doubleAttack",
        reduce: "VALUES"
    });
    tripleAttack = getInheritableAttribute({
        entity: actor,
        attributeKey: "tripleAttack",
        reduce: "VALUES"
    });

    //availableAttacks = this.fullAttackCount;
    let items = equippedItems(actor)
    let doubleAttackBonus = 0;
    let tripleAttackBonus = 0;
    let availableWeapons = 0
    let beastAttacks = 0;
    for (let item of items) {
        availableWeapons = Math.min(availableWeapons + (item.isDoubleWeapon ? 2 : 1) + (item.system.quantity > 1 ? 2 : 1), 2);
        //TODO support exotic weapons
        let subtype = item.system.subtype;
        if (doubleAttack.includes(subtype)) {
            doubleAttackBonus = 1;
        }
        if (tripleAttack.includes(subtype)) {
            tripleAttackBonus = 1;
        }
        if (item.type === "beastAttack") {
            beastAttacks++;
        }
    }
    availableAttacks = Math.max(availableWeapons + doubleAttackBonus + tripleAttackBonus, beastAttacks, 1)


    //how many attacks?
    //
    //how many provided attacks from weapons max 2
    //+1 if has double attack and equipped item
    //+1 if has triple attack and equipped item

    let dualWeaponModifiers = getInheritableAttribute({
        entity: actor,
        attributeKey: "dualWeaponModifier",
        reduce: "NUMERIC_VALUES"
    });
    dualWeaponModifier = dualWeaponModifiers.reduce((a, b) => Math.max(a, b), -10)
    return {doubleAttack, tripleAttack, availableAttacks, dualWeaponModifier};
}

function getAttacksFromContext(context) {
    return context.attacks?.map(i => {
        if (i instanceof Attack) {
            return i;
        }
        return Attack.fromJSON(i);
    }) || [];
}

/**
 *
 * @param context {object}
 * @param context.type {string}
 * @param context.attacks {Array.<Attack>}
 * @param context.actor {ActorData}
 * @returns {{buttons: {attack: {callback: buttons.attack.callback, label: string}}, options: {height: number}, title: string, render: ((function(*): Promise<void>)|*), content: string}}
 */
function attackDialogue(context) {

}

/**
 *
 * @param context
 * @param.items
 * @param.actor
 * @returns {Promise<void>}
 */
export async function makeAttack(context) {
    const actorId = context.attacks[0].actorId;
    const actor = getActorFromId(actorId)
    actor.attack.createAttackDialog(null, context);
}

function getAttackMods(selects, dualWeaponModifier, multipleAttackModifiers) {
    let isDoubleAttack = false;
    let isTripleAttack = false;
    let standardAttacks = 0;
    let beastAttacks = 0;
    for (let select of selects) {
        if (select.value === "--") {
            continue;
        }
        let attack = JSON.parse(unescape(select.value));
        let options = attack.options
        if (options.doubleAttack) {
            isDoubleAttack = true;
        }
        if (options.tripleAttack) {
            isTripleAttack = true;
        }
        if (options.standardAttack) {
            standardAttacks++;
        }
        if (options.beastAttack) {
            beastAttacks++;
        }
    }




    let attackMods = []
    if (isDoubleAttack) {
        attackMods.push({value: -5, source: "Double Attack", type: "attack"});
    }
    if (isTripleAttack) {
        attackMods.push({value: -5, source: "Triple Attack", type: "attack"});
    }

    if (standardAttacks > 1 || (standardAttacks > 0 && beastAttacks > 0)) {
        attackMods.push({value: dualWeaponModifier, source: "Dual Weapon", type: "attack"});
    }

    if(multipleAttackModifiers && multipleAttackModifiers.length > 0 && attackMods.length > 0){
        for (const multipleAttackModifier of multipleAttackModifiers) {
            attackMods.push({value: multipleAttackModifier, source: "Attack Modifier", type: "attack"});
        }
    }

    return attackMods
}
function getHandMods(html) {
    let handsMods = []
    const hands = html.find(".hands-modifier");
    for(const hand of hands){
        if(hand.checked){
            handsMods.push({value: hand.value, source: hand.name, type: "hands"});
        }
    }
    return handsMods
}

function hasValidValue(modifier) {
    return modifier.value && (((modifier.type === "radio" || modifier.type === "checkbox") && modifier.checked) || !(modifier.type === "radio" || modifier.type === "checkbox"));
}

function getModifiersFromContextAndInputs(options, inputCriteria, modifiers) {
    let bonuses = [];
    options.find(inputCriteria).each((i, modifier) => {
            if (hasValidValue(modifier)) {
                let bonus
                try {
                    const value = JSON.parse(modifier.value);
                    if (Number.isInteger(value)) {
                        bonus = value;
                    } else {
                        bonus = ".damage-modifier" === inputCriteria ? value["damage"] : value["attack"];
                    }
                } catch (e) {
                        bonus = modifier.value;
                }
                bonuses.push({source: $(modifier).data("source"), value: getBonusString(bonus)});
            }
        }
    )
    for (let attackMod of modifiers || []) {
        bonuses.push({source: attackMod.source, value: getBonusString(attackMod.value)});
    }
    return bonuses;
}

function getHandsFromAttackOptions(options) {
    let hands = 0;
    options.find(".hands-modifier").each((i, option) => {
        if ((option.type === "radio" || option.type === "checkbox") && option.checked) {
            hands += parseInt(option.value);
        }
    })
    return hands;
}

function setAttackPreviewValues(preview, attack, options, context) {

    populateHandsIndicator(context.dialog, context.availableHands)

    preview.empty();
    attack.hands = getHandsFromAttackOptions(options);
    let damageRoll = `${attack.damageRoll?.renderFormulaHTML}` + getModifiersFromContextAndInputs(options, ".damage-modifier", context.damageMods).map(bonus => `<span title="${bonus.source}">${bonus.value}</span>`).join('');
    let attackRoll = `${attack.attackRoll?.renderFormulaHTML}` + getModifiersFromContextAndInputs(options, ".attack-modifier", context.attackMods).map(bonus => `<span title="${bonus.source}">${bonus.value}</span>`).join('');
    preview.append(`<div class="flex flex-col"><div>Attack Roll: <div class="attack-roll flex flex-row">${attackRoll}</div></div><div>Damage Roll: <div class="damage-roll flex flex-row">${damageRoll}</div></div>`)
}

function populateItemStats(html, context) {
    //context.handMods
    let value = html.value || $(html).data("value");

    if (value === "--") {
        return;
    }

    let parent = $(html).parents(".attack");

    let total = parent.children(".attack-total");
    total.empty();
    let attack = Attack.fromJSON(value);

    let options = parent.children(".attack-options")
    options.empty();
    options.append(attack.attackOptionHTML)
    options.find(".attack-modifier").on("change", () => setAttackPreviewValues(total, attack, options, context))
    options.find(".attack-modifier").on("submit", () => setAttackPreviewValues(total, attack, options, context))
    options.find(".damage-modifier").on("change", () => setAttackPreviewValues(total, attack, options, context))
    options.find(".damage-modifier").on("submit", () => setAttackPreviewValues(total, attack, options, context))
    options.find(".hands-modifier").on("click", () => setAttackPreviewValues(total, attack, options, context))

    setAttackPreviewValues(total, attack, options, context);
}


function populateHandsIndicator(html, availableHands) {

    let handMods = getHandMods(html);
    const items = [];
    let usedHands = handMods.reduce((previousValue, currentValue) => {
        const total = previousValue + items.includes(currentValue.source) ? 0 : parseInt(currentValue.value);
        items.push(currentValue.source)
        return total}, 0)
    let total = $(html).find(".handedness-indicator");
    total.empty();
    total.append(`${usedHands}/${availableHands}`)
}

function createAttackFromAttackBlock(attackBlock, attackMods, damageMods) {
    let attackId = $(attackBlock).find(".attack-id")[0]
    let attackValue = attackId.value || $(attackId).data("value");

    if (attackValue === "--") {
        return undefined;
    }
    let attack = Attack.fromJSON(attackValue)

    let attackModifiers = getModifiersFromContextAndInputs($(attackBlock), ".attack-modifier", attackMods);
    attackModifiers.forEach(modifier => modifier.type = 'attack');
    attack.withModifiers(attackModifiers);

    let damageModifiers = getModifiersFromContextAndInputs($(attackBlock), ".damage-modifier", damageMods);
    damageModifiers.forEach(modifier => modifier.type = 'damage');
    attack.withModifiers(damageModifiers);

    // let handednessModifiers = getModifiersFromContextAndInputs($(attackBlock), ".hands-modifier", damageMods);
    // handednessModifiers.forEach(modifier => modifier.type = 'hand');
    // attack.withModifiers(handednessModifiers);

    const options = $(attackBlock).find(".attack-options")[0]

    attack.hands = getHandsFromAttackOptions($(options));

    return attack;
}

async function generateAttackCard(resolvedAttacks, attack) {
    let template = await getTemplate("systems/swse/templates/actor/parts/attack/attack-chat-card.hbs")
    return template({
        name: attack.name,
        notes: attack.notesHTML,
        attacks: resolvedAttacks,
        targetsEnabled: game.settings.get("swse", "enableTargetResultsOnAttackCard")
    })
}

function modifyRollForPreMultiplierBonuses(attack, damageRoll) {
    let criticalHitPreMultiplierBonuses = getInheritableAttribute({
        entity: attack.item,
        attributeKey: "criticalHitPreMultiplierBonus"
    })


    for (let criticalHitPreMultiplierBonus of criticalHitPreMultiplierBonuses) {

        let value = resolveValueArray(criticalHitPreMultiplierBonus, attack.actor)

        damageRoll.terms.push(...appendNumericTerm(value, criticalHitPreMultiplierBonus.sourceString))
    }
    return damageRoll;
}

function modifyRollForPostMultiplierBonus(attack, damageRoll) {
    let postMultBonusDie = getInheritableAttribute({
        entity: attack.item,
        attributeKey: "criticalHitPostMultiplierBonusDie",
        reduce: "SUM"
    })
    damageRoll.alter(1, postMultBonusDie)
    return damageRoll;
}

export function crunchyCrit(roll) {
    const terms = [];
    let max = 0;

    for (let term of roll.terms) {
        terms.push(term);
        if (term instanceof foundry.dice.terms.DiceTerm) {
            max += term.faces * term.number
        } else if (term instanceof foundry.dice.terms.NumericTerm){
            max += term.number
        }
    }
    terms.push(new foundry.dice.terms.OperatorTerm({operator:"+"}))
    terms.push(new foundry.dice.terms.NumericTerm({number: max}))

    return Roll.fromTerms(terms
        .filter(term => !!term))
}

export function maxRollCrit(roll) {
    const terms = [];

    for(const term of roll.terms){
        if(term instanceof foundry.dice.terms.DiceTerm){
            terms.push(new foundry.dice.terms.NumericTerm({number: term.number*term.faces, options: {flavor: term.expression}}))
        } else {
            terms.push(term)
        }
    }

    return Roll.fromTerms(terms
        .filter(term => !!term))
}

export function doubleDiceCrit(damageRoll, criticalMultiplier) {
    damageRoll.alter(criticalMultiplier, 0, true)
    return multiplyNumericTerms(damageRoll, criticalMultiplier)
}

export function doubleValueCrit(damageRoll, criticalMultiplier) {
    damageRoll = addMultiplierToDice(damageRoll, criticalMultiplier)
    return multiplyNumericTerms(damageRoll, criticalMultiplier)
}

function modifyRollForCriticalHit(attack, damageRoll) {
    damageRoll = modifyRollForPreMultiplierBonuses(attack, damageRoll);

    const criticalMultiplier = attack.critical;
    switch (game.settings.get("swse", "criticalHitType")) {
        case "Double Dice":
            damageRoll = doubleDiceCrit(damageRoll, criticalMultiplier);
            break;
        case "Crunchy Crit":
            damageRoll = crunchyCrit(damageRoll)
            break;
        case "Max Damage":
            damageRoll = maxRollCrit(damageRoll)
            break;
        default:
            damageRoll = doubleValueCrit(damageRoll, criticalMultiplier);
    }

    damageRoll = modifyRollForPostMultiplierBonus(attack, damageRoll);
    return damageRoll;
}

function modifyRollForCriticalEvenOnAreaAttack(attack, damageRoll) {
    let bonusCriticalDamageDieType = getInheritableAttribute({
        entity: attack.item,
        attributeKey: "bonusCriticalDamageDieType",
        reduce: "SUM"
    })

    if (bonusCriticalDamageDieType) {
        damageRoll = adjustDieSize(damageRoll, bonusCriticalDamageDieType)
    }
    return damageRoll;
}

async function resolveAttack(attack, targetActors) {
    let attackRoll = attack.attackRoll.roll;
    let attackRollResult = await attackRoll.roll();
    let fail = attack.isFailure(attackRollResult);
    let critical = attack.isCritical(attackRollResult);

    let targets = targetActors.map(actor => {
        let reflexDefense = actor.system.defense.reflex.total;
        let isMiss = attack.isMiss(attackRollResult, reflexDefense)
        let targetResult = critical ? "Critical Hit!" : fail ? "Automatic Miss" : isMiss ? "Miss" : "Hit";

        let conditionalDefenses =
            getInheritableAttribute({
                entity: actor,
                attributeKey: ["reflexDefenseBonus"],
                attributeFilter: attr => !!attr.modifier,
                reduce: "VALUES"
            });

        return {
            name: actor.name,
            defense: reflexDefense,
            defenseType: 'Ref',
            highlight: targetResult.includes("Miss") ? "miss" : "hit",
            result: targetResult,
            conditionalDefenses: conditionalDefenses
        }
    })
    let damageRoll = attack.damageRoll.roll;

    if (critical) {
        damageRoll = modifyRollForCriticalEvenOnAreaAttack(attack, damageRoll);
    }


    let ignoreCritical = getInheritableAttribute({
        entity: attack.item,
        attributeKey: "skipCriticalMultiply",
        reduce: "OR"
    })

    if (critical && !ignoreCritical) {
        damageRoll = modifyRollForCriticalHit(attack, damageRoll);
    }

    let damage = await damageRoll.roll();
    let targetIds = targetActors.map(target => target.id);
    return {
        attack: attackRollResult,
        itemId: attack.itemId,
        attackRollFunction: attackRoll.formula,
        damage: damage,
        damageRollFunction: damageRoll.formula,
        damageType: attack.type,
        notes: attack.notes,
        critical,
        fail,
        targets, targetIds
    };
}

export async function createAttackChatMessage(attacks, rollMode, hands, availableHands) {
    let targetTokens = game.user.targets
    let targetActors = [];
    for (let targetToken of targetTokens.values()) {
        let actorId = targetToken.document.actorId
        let actor = game.actors.get(actorId)
        if (actor) {
            targetActors.push(actor)
        }
    }
    let attackRows = [];
    let rolls = [];
    let rollOrder = 1;
    for (let attack of attacks) {
        let resolvedAttack = await resolveAttack(attack, targetActors);
        resolvedAttack.attack.dice.forEach(die => die.options.rollOrder = rollOrder);
        rolls.push(resolvedAttack.attack)
        resolvedAttack.damage.dice.forEach(die => die.options.rollOrder = rollOrder);
        rolls.push(resolvedAttack.damage)
        rollOrder++
        attackRows.push(await generateAttackCard([resolvedAttack], attack))
    }

    let content = `${attackRows.join("<br>")}`;

    if(hands > availableHands){
        content = `<div class="warning">${hands} hands used out of a possible ${availableHands}</div><br>` + content;
    }

    let speaker = ChatMessage.getSpeaker({actor: attacks[0].actor});

    let flavor = attacks[0].name;
    if (attacks.length > 1) {
        flavor = "Full Attack " + flavor;
    }
    const pool = foundry.dice.terms.PoolTerm.fromRolls(rolls);
    let roll = Roll.fromTerms([pool]);

    let flags = {};
    flags.swse = {};
    flags.swse.context = {};
    flags.swse.context.type = "attack-roll";

    let messageData = {
        flags,
        user: game.user.id,
        speaker: speaker,
        flavor: flavor,
        content,
        sound: CONFIG.sounds.dice,
        roll,
        rolls
    }

    let cls = getDocumentClass("ChatMessage");
    let msg = new cls(messageData);

    if (rollMode) msg.applyRollMode(rollMode);

    return cls.create(msg, {rollMode: rollMode});
}