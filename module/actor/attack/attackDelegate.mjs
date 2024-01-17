import {SimpleCache} from "../../common/simple-cache.mjs";
import {Attack} from "./attack.mjs";
import {createAttackMacro} from "../../swse.mjs";
import {getInheritableAttribute} from "../../attribute-helper.mjs";
import {
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

        let attacks = weaponIds.map(id => new Attack(actor.id, id, null, actor.parent?.id, {}));

        let items = actor.getAvailableItemsFromRelationships()

        attacks.push(...items.map(item => new Attack(actor.id, item._id, item.parentId, actor.parent?.id, {})))
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
     * @param {SWSEActor} actor
     * @returns {Attack[]}
     */
    generateVehicleAttacks(actor) {
        return actor.getAvailableItemsFromRelationships()
            .filter(item => item.system.subtype && item.system.subtype.toLowerCase() === 'weapon systems' && item.system.equipped)
            .map(weapon => new Attack(actor.crewman(this.getCrewPosition(weapon.system.equipped)).id, weapon._id, weapon.parentId, actor.parent?.id, {}));
    }

    /**
     *
     * @param event
     * @param context
     * @returns {Promise<void>}
     */
     async makeAttack(event, context) {
        const attacksFromContext = getAttacksFromContext(context);
        const attackType = context.type === "fullAttack" ? Attack.TYPES.FULL_ATTACK : Attack.TYPES.SINGLE_ATTACK;
        const dualWeaponModifier = this.dualWeaponModifier;
        const {doubleAttack, tripleAttack, attackCount} = this.getAttackDetails(attackType);
        let blockHeight = 225;
        let height = attackCount * blockHeight + 85

        //{
        //  title: "Test Dialog",
        //  content: "<p>You must choose either Option 1, or Option 2</p>",
        //  buttons: {
        //   one: {
        //    icon: '<i class="fas fa-check"></i>',
        //    label: "Option One",
        //    callback: () => console.log("Chose One")
        //   },
        //   two: {
        //    icon: '<i class="fas fa-times"></i>',
        //    label: "Option Two",
        //    callback: () => console.log("Chose Two")
        //   }
        //  },
        //  default: "two",
        //  render: html => console.log("Register interactivity in the rendered dialog"),
        //  close: html => console.log("This always is logged no matter which option is chosen")
        // }



        const data = {
            title: getAttackWindowTitle(context),
            content: await this.getAttackDialogueContent(attackCount, attacksFromContext, doubleAttack, tripleAttack),
            buttons: {
                attack: getAttackButton(dualWeaponModifier),
                saveMacro: getSaveMacroButton(dualWeaponModifier, this.actor)
            },
            default: "attack",
            render: (html) => {
                let selects = html.find("select.attack-id");
                //selects.on("change", () => handleAttackSelect(selects));
                handleAttackSelect(selects)

                selects.each((i, div) => populateItemStats(div, context));

                selects.on("change", () => {
                    handleAttackSelect(selects)
                    let context = {};
                    context.attackMods = getAttackMods(selects, dualWeaponModifier);
                    context.damageMods = [];
                    html.find(".attack-id").each((i, div) => populateItemStats(div, context));
                })
            }
        };

        const options = {
            height: height,
            classes: ["swse", "dialog"],
            resizable: true,
            popOut: true
        };

        if(data){

            new Dialog(data, options).render(true);
        }
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
        if (term instanceof NumericTerm) {
            if (previous && previous.operator !== "*" && previous.operator !== "/") {
                term.number = term.number * multiplier;
            }
        }
        previous = term;
    }
}

function addMultiplierToDice(roll, multiplier) {
    let terms = [];

    for (let term of roll.terms) {
        terms.push(term);
        if (term instanceof DiceTerm) {
            terms.push(new OperatorTerm({operator: '*'}));
            terms.push(new NumericTerm({number: `${multiplier}`}))
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

function getAttackButton(dualWeaponModifier) {
    return {
        label: "Attack",
        callback: (html) => {
            let attacks = [];
            let attackBlocks = html.find(".attack");
            let selects = html.find(".attack-name");
            let attackMods = getAttackMods(selects, dualWeaponModifier);
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

            createAttackChatMessage(attacks, undefined).then(() => {
            });
        }
    };
}

function getSaveMacroButton(dualWeaponModifier, actor) {
    return {
        label: "Save Macro",
        callback: (html) => {
            let attacks = [];
            let attackBlocks = html.find(".attack-block");
            let selects = html.find("select");
            let attackMods = getAttackMods(selects, dualWeaponModifier);
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
}

function getAttackMods(selects, dualWeaponModifier) {
    let attackMods = []
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


    if (isDoubleAttack) {
        attackMods.push({value: -5, source: "Double Attack"});
    }
    if (isTripleAttack) {
        attackMods.push({value: -5, source: "Triple Attack"});
    }

    if (standardAttacks > 1 || (standardAttacks > 0 && beastAttacks > 0)) {
        attackMods.push({value: dualWeaponModifier, source: "Dual Weapon"});
    }
    attackMods.forEach(attack => attack.type = "attack");
    return attackMods
}

function getModifiersFromContextAndInputs(options, inputCriteria, modifiers) {
    let bonuses = [];
    options.find(inputCriteria).each((i, modifier) => {
            if (((modifier.type === "radio" || modifier.type === "checkbox") && modifier.checked) || !(modifier.type === "radio" || modifier.type === "checkbox")) {
                bonuses.push({source: $(modifier).data("source"), value: getBonusString(modifier.value)});
            }
        }
    )
    for (let attackMod of modifiers || []) {
        bonuses.push({source: attackMod.source, value: getBonusString(attackMod.value)});
    }
    return bonuses;
}

function setAttackPreviewValues(preview, attack, attackConfigOptionFields, context) {
    preview.empty();

    let damageRoll = `${attack.damageRoll?.renderFormulaHTML}` + getModifiersFromContextAndInputs(attackConfigOptionFields, ".damage-modifier", context.damageMods).map(bonus => `<span title="${bonus.source}">${bonus.value}</span>`).join('');
    let attackRoll = `${attack.attackRoll?.renderFormulaHTML}` + getModifiersFromContextAndInputs(attackConfigOptionFields, ".attack-modifier", context.attackMods).map(bonus => `<span title="${bonus.source}">${bonus.value}</span>`).join('');
    preview.append(`<div class="flex flex-col"><div>Attack Roll: <div class="attack-roll flex flex-row">${attackRoll}</div></div><div>Damage Roll: <div class="damage-roll flex flex-row">${damageRoll}</div></div>`)
}

function populateItemStats(html, context) {
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

    setAttackPreviewValues(total, attack, options, context);
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
    let damageModifiers = getModifiersFromContextAndInputs($(attackBlock), ".damage-modifier", damageMods);
    damageModifiers.forEach(modifier => modifier.type = 'damage');

    attack.withModifiers(attackModifiers);
    attack.withModifiers(damageModifiers);

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

function resolveAttack(attack, targetActors) {
    let attackRoll = attack.attackRoll.roll;
    let attackRollResult = attackRoll.roll({async: false});
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


    let ignoreCritical = getInheritableAttribute({
        entity: attack.item,
        attributeKey: "skipCriticalMultiply",
        reduce: "OR"
    })

    let damageRoll = attack.damageRoll.roll;
    if (critical && !ignoreCritical) {
        let criticalHitPreMultiplierBonuses = getInheritableAttribute({
            entity: attack.item,
            attributeKey: "criticalHitPreMultiplierBonus"
        })

        for (let criticalHitPreMultiplierBonus of criticalHitPreMultiplierBonuses) {

            let value = resolveValueArray(criticalHitPreMultiplierBonus, attack.actor)

            damageRoll.terms.push(...appendNumericTerm(value, criticalHitPreMultiplierBonus.sourceString))
        }


        //TODO add a user option to use this kind of multiplication.  RAW the rolled dice values are doubled, not the number of dice
        if (false) {
            damageRoll.alter(2, 0, true)
            multiplyNumericTerms(damageRoll, 2)
        } else {
            damageRoll = addMultiplierToDice(damageRoll, 2)
            multiplyNumericTerms(damageRoll, 2)
        }


        let postMultBonusDie = getInheritableAttribute({
            entity: attack.item,
            attributeKey: "criticalHitPostMultiplierBonusDie",
            reduce: "SUM"
        })
        damageRoll.alter(1, postMultBonusDie)
    }

    let damage = damageRoll.roll({async: false});
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

export async function createAttackChatMessage(attacks, rollMode) {
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
        let resolvedAttack = resolveAttack(attack, targetActors);
        resolvedAttack.attack.dice.forEach(die => die.options.rollOrder = rollOrder);
        rolls.push(resolvedAttack.attack)
        resolvedAttack.damage.dice.forEach(die => die.options.rollOrder = rollOrder);
        rolls.push(resolvedAttack.damage)
        rollOrder++
        attackRows.push(await generateAttackCard([resolvedAttack], attack))
    }

    let content = `${attackRows.join("<br>")}`;

    let speaker = ChatMessage.getSpeaker({actor: attacks[0].actor});

    let flavor = attacks[0].name;
    if (attacks.length > 1) {
        flavor = "Full Attack " + flavor;
    }
    const pool = PoolTerm.fromRolls(rolls);
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
        type: CONST.CHAT_MESSAGE_TYPES.ROLL,
        content,
        sound: CONFIG.sounds.dice,
        roll,
        rolls
    }

    let cls = getDocumentClass("ChatMessage");
    let msg = new cls(messageData);
    if (rollMode) msg.applyRollMode(rollMode);

    return cls.create(msg, {rollMode});
}