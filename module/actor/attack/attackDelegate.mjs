import {SimpleCache} from "../../common/simple-cache.mjs";
import {Attack} from "./attack.mjs";
import {getInheritableAttribute} from "../../attribute-helper.mjs";
import {equippedItems, getBonusString, handleAttackSelect} from "../../common/util.mjs";
import {createAttackMacro} from "../../swse.mjs";


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

    get unarmed(){
        return this.attacks.find(a => a.weaponId === "Unarmed Attack")
    }

    /**
     *
     * @param {SWSEActor} actor
     * @returns {Promise<void>}
     */
    generateAttacks(actor) {
        let weaponUuids = actor.equippedWeapons
            .map(item => item.uuid)

        let beastAttackIds = actor.naturalWeapons
            .map(item => item.uuid);

        if (beastAttackIds.length > 0) {
            weaponUuids.push(...beastAttackIds)
        } else {
            weaponUuids.push("Unarmed Attack")
        }

        const actorUUID = actor.uuid;
        let attacks = weaponUuids.map(uuid => Attack.create({actorId: actorUUID, operatorId: actorUUID, weaponId: uuid}));

        let items = actor.getItemsFromRelationships()

        attacks.push(...items.map(item => Attack.create({actorId: actorUUID, weaponId: item.uuid, operatorId: actorUUID, parentId: item.parent?.uuid, options: {}})))
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
                return Attack.create({actorId: vehicle.uuid, weaponId: weapon.uuid, parentId:weapon.parent?.uuid, operatorId:vehicle.crew.crewman(this.getCrewPosition(weapon.system.equipped), undefined).uuid})
            });
    }

    getAttackDetails() {
        let doubleAttack = [];
        let tripleAttack = [];
        let hands = getHands(this.actor);
        let attacksFromDoubleAttack = 0;
        let attacksFromTripleAttack = 0;
        let attacksFromDualWielding = 1;
        let beastAttacks = 0;

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

            let equippedWeapons = equippedItems(this.actor, "weapon")

            if (this.shouldHaveSecondAttackFromWeaponChoice(equippedWeapons)) {
                attacksFromDualWielding = 2;
            }

            const subtypes = equippedWeapons.map(item => item.isExotic ? item.name : item.system.subtype).distinct()

            beastAttacks = equippedWeapons.filter(item => item.type === "beastAttack")

            attacksFromDoubleAttack = doubleAttack.filter(x => subtypes.includes(x)).length > 0 ? 1 : 0;
            attacksFromTripleAttack = tripleAttack.filter(x => subtypes.includes(x)).length > 0 ? 1 : 0;


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


    async getAttackDialogueContent(attackCount, doubleAttack, tripleAttack) {

        let template = await getTemplate("systems/swse/templates/actor/parts/attack/attack-dialogue.hbs")

        const resolvedAttacks = this.attackOptions(doubleAttack, tripleAttack)

        let selectedAttacks = [];
        for(let i =0; i < attackCount; i++){
            selectedAttacks.push(null)
        }

        return template({selectedAttacks, availableAttacks: resolvedAttacks.map(attack => attack.summary)});
    }



    /**
     *
     * @param event
     * @param context
     * @returns {Promise<void>} TODO this should return an ACTIVEATTACK or create a macro for an ACTIVEATTACK
     */
    async createAttackDialog(event, context) {
        await makeAttack(context)
    }
    async getAttacksFromUserSelection() {
        const {doubleAttack, tripleAttack, attackCount} = this.getAttackDetails()

        return await Dialog.wait({        //     title: getAttackWindowTitle(context),
                content: await this.getAttackDialogueContent(attackCount, doubleAttack, tripleAttack),
                buttons: {
                    attack: {
                        label: "Attack",
                        callback: async (html) => {

                            let selects = html.find("select.attack-id");

                            let attackKeys = [];
                            for (const select of selects) {
                                attackKeys.push(select.value)
                            }
                          //  const map = selects.map(select => select.value);
                            return attackKeys
                        }
                    },
                    saveMacro: {
                        label: "Save Macro",
                        callback: async (html) => {
                            let selects = html.find("select.attack-id");

                            let attackKeys = [];
                            let attackNames = [];
                            for (const select of selects) {
                                attackKeys.push(select.value)
                                attackNames.push(select.selectedOptions[0].label)
                            }

                            let data = {
                                attackKeys,
                                actorId: this.actor.id,
                                actorName: this.actor.name,
                                label: `Full Attack: ${attackNames.join(", ")}`
                            };

                            await createAttackMacro(data)
                        }
                    }
                },
                default: "attack",
                render: (html) => {
                    let selects = html.find("select.attack-id");
                    handleAttackSelect(selects)
                    selects.on("change", () => {
                        handleAttackSelect(selects)
                    })
                }
        })
    }

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

function getActiveAttacks(html, dualWeaponModifier, multipleAttackModifiers) {
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
    return attacks;
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
    let damageRoll = `${attack.damageRoll?.formattedFormula}` + getModifiersFromContextAndInputs(options, ".damage-modifier", context.damageMods).map(bonus => `<span title="${bonus.source}">${bonus.value}</span>`).join('');
    let attackRoll = `${attack.attackRoll?.formattedFormula}` + getModifiersFromContextAndInputs(options, ".attack-modifier", context.attackMods).map(bonus => `<span title="${bonus.source}">${bonus.value}</span>`).join('');
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


function modes(sounds) {
    let largest = 0;
    let soundMap = new Map();
    for (let sound of sounds){
        soundMap.set(sound, sound.has(sound) ? soundMap.get(sound) + 1 : 1) ;
        largest = Math.max(largest, soundMap[sound]);
    }

    let response = [];

    for (let entry of soundMap.entries()) {
        if(entry.value === largest){
            response.push(entry.value)
        }
    }

    return response;
}

function getSound(attacks) {
    let sounds = attacks.map(attack => attack.sound).filter(sound => !!sound)
    if(sounds.length > 0){
        let mostCommon = modes(sounds)
        if(mostCommon.length > 0){
            return mostCommon[0];
        }
    }

    return CONFIG.sounds.dice;
}


/**
 * Retrieves a list of attacks based on the provided attack object and data.
 *
 * @param {Object} attack - The attack object containing attack-related properties and methods.
 * @param {Object} data - The data object that may include an array of attacks or attack keys.
 * @return {Promise<Object[]>} A promise that resolves to an array of attack objects.
 */
async function getAttacks(attack, data) {
    let attacks;
    if (data.attacks) {
        attacks = data.attacks?.map(i => i instanceof Attack ? i : Attack.fromJSON(i)) || [];
    }
    if (!attacks || attacks.length === 0) {
        attacks = attack.attacks.filter(a => data.attackKeys.includes(a.attackKey));
    }

    if (!attacks || attacks.length === 0) {
        let attackKeys = await attack.getAttacksFromUserSelection();
        if (!attackKeys) {
            return [];
        }
        attacks = attack.attacks.filter(a => attackKeys.includes(a.attackKey))

    }
    return attacks;
}

/**
 *
 * @param data
 * @param data.actorUUID the UUID of the actor that should make the attack
 * @param data.rollMode
 * @param data.attackKeys {[string]}
 * @param data.changes {[(string, string)]}
 * @return {Promise<abstract.Document|abstract.Document[]|undefined>}
 */
export async function makeAttack(data) {
    const actor = fromUuidSync(data.actorUUID)
    let attacks = await getAttacks(actor.attack, data);

    let attackRows = [];
    let rolls = [];
    let rollOrder = 1;
    let resolvedAttackData = [];
    for (let attack of attacks) {
        let resolvedAttack = await attack.resolve(data.changes)

        rolls.push(resolvedAttack.attack)
        rolls.push(resolvedAttack.damage)
        for (const rangeBreakdownElement of resolvedAttack.rangeBreakdown) {
            rangeBreakdownElement.attack.dice.forEach(die => die.options.rollOrder = rollOrder);
            rangeBreakdownElement.damage.dice.forEach(die => die.options.rollOrder = rollOrder);
            rollOrder++
        }

        attackRows.push(await generateAttackCard([resolvedAttack], attack))
        resolvedAttackData.push(resolvedAttack)
    }

    const content = `${attackRows.join("<br>")}`;

    // if(hands > availableHands){
    //     content = `<div class="warning">${hands} hands used out of a possible ${availableHands}</div><br>` + content;
    // }

    let flavor = attacks[0].name;
    if (attacks.length > 1) {
        flavor = "Full Attack " + flavor;
    }
    const pool = foundry.dice.terms.PoolTerm.fromRolls(rolls);
    let roll = Roll.fromTerms([pool]);

    let flags = {
        swse: {
            context: {
                type: "attack-roll",
                attacks: resolvedAttackData
            }
        }
    };
    //flags.swse.context.targets = targetActors.map(actor => actor.id);

    const chatLog = ui.chat;

    let messageData = {
        flags,
        user: game.user.id,
        speaker: ChatMessage.getSpeaker({actor: attacks[0].actor}),
        flavor: flavor,
        content,
        sound: getSound(attacks),
        roll,
        rolls,
        //type: chatLog?.mode ?? CONST.CHAT_MESSAGE_TYPES.IC
    }

    if (chatLog?.mode === CONST.CHAT_MESSAGE_TYPES.WHISPER) {
        messageData.whisper = chatLog._getWhisperTargets();
    }

    let cls = getDocumentClass("ChatMessage");
    let msg = new cls(messageData);

    // const rollMode = data.rollMode;
    // if (rollMode) msg.applyRollMode(rollMode);
    // {rollMode: rollMode}


    return cls.create(msg);
}
