import {UnarmedAttack} from "./unarmed-attack.mjs";
import {getInheritableAttribute} from "../attribute-helper.mjs";
import {compareSizes, getSize} from "./size.mjs";
import {
    canFinesse,
    isLightsaber,
    isRanged,
    isMelee,
    getFocusAttackBonuses,
    getPossibleProficiencies,
    getProficiencyBonus,
    getSpecializationDamageBonuses,
    isFocus
} from "./attack-handler.mjs";
import {generateArmorCheckPenalties} from "./armor-check-penalty.mjs";
import {SWSEActor} from "./actor.mjs";
import {reduceWeaponRange, SWSEItem} from "../item/item.mjs";
import {
    appendNumericTerm,
    appendTerms,
    equippedItems,
    getAttackRange,
    getBonusString,
    getDieFlavor,
    getEntityFromCompendiums,
    getOrdinal,
    getRangeModifierBlock,
    handleAttackSelect,
    increaseDieSize,
    minus,
    mult,
    plus,
    resolveValueArray,
    toNumber,
    toShortAttribute
} from "../common/util.mjs";
import {SWSERollWrapper} from "../common/roll.mjs";
import {createAttackMacro} from "../swse.mjs";

//Broken out because i have no idea if i'm doing this in a way that the roller understands

export class Attack {

    get toJSON() {
        return {
            actorId: this.actorId,
            itemId: this.itemId,
            providerId: this.providerId,
            parentId: this.parentId,
            options: this.options
        };
    }

    get toJSONString() {
        let value = this.toJSON;
        delete value.lazyResolve
        let s = JSON.stringify(value);
        return escape(s);
    }

    static fromJSON(json) {
        if (typeof json === "string") {
            json = JSON.parse(unescape(json));
        }
        if (Array.isArray(json)) {
            let attks = [];
            for (let atk of json) {
                attks.push(new Attack(atk.actorId, atk.itemId, atk.providerId, atk.parentId, atk.options))
            }
            return attks;
        }
        return new Attack(json.actorId, json.itemId, json.providerId, json.parentId, json.options)
    }

    constructor(actorId, itemId, providerId, parentId, options) {
        this.actorId = actorId;
        this.itemId = itemId;
        this.providerId = providerId;
        this.parentId = parentId;
        this.options = options || {};
        this.lazyResolve = new Map();
    }


    getCached(key, fn) {
        if (this.lazyResolve.has(key)) {
            return this.lazyResolve.get(key);
        }
        let resolved = fn();
        this.lazyResolve.set(key, resolved);
        return resolved
    }

    /**
     *
     * @returns {SWSEActor}
     */
    get actor() {
        let fn = () => {
            let find;
            if (this.parentId) {
                let tokens = canvas.tokens.objects?.children || [];
                let token = tokens.find(token => token.id === this.parentId);
                return token.document.actor
            } else if (this.actorId) {
                find = game.actors.get(this.actorId)
                //find = game.data.actors.find(actor => actor._id === this.actorId);
                if (!find) {
                    let values = [...game.packs.values()];
                    for (let pack of values.filter(pack => pack.documentClass.documentName === "Actor")) {
                        find = pack.get(this.actorId)

                        if (find) {
                            break;
                        }
                    }
                }
            } else if (this.providerId) {
                let provider = this.provider;
                let quality = provider?.system?.crewQuality?.quality;
                return SWSEActor.getCrewByQuality(quality);
            }
            return find;
        }

        return this.getCached("getActor", fn)
    }

    /**
     *
     * @returns {ActorData}
     */
    get provider() {
        return this.getActor(this.providerId);
    }

    getActor(actorId) {
        if(!actorId){
            return;
        }
        let find = game.actors.find(actor => actor._id === actorId);
        if (!find) {
            find = getEntityFromCompendiums("Actor", actorId)
        }
        return find;
    }

    /**
     *
     * @returns {SWSEItem}
     */
    get item() {
        let fn = () => {
            let provider = this.provider;
            let actor = !!provider ? provider : this.actor;
            if (!actor) {
                return undefined;
            }

            if ('Unarmed Attack' === this.itemId) {
                return new UnarmedAttack(this.actorId);
            }

            let find = actor.items.get(this.itemId)

            if (!find) {
                find = this.options.items?.get(this.itemId)
            }

            // if (find instanceof SWSEItem) {
            //     return find.system;
            // }
           return find;
        }

        return this.getCached("getItem", fn)
    }

    get isUnarmed() {
        let itemData = this.item;
        return 0 < getInheritableAttribute({
            entity: itemData,
            attributeKey: ['unarmedModifier', 'unarmedBonusDamage']
        }).length || itemData?.isUnarmed
    }

    modifiers(type) {
        let modifiers = this.options?.modifiers || [];
        if (type) {
            modifiers = modifiers.filter(item => item.type === type)
        }
        return modifiers;
    }

    get name() {
        let name = this.item.name;
        return ((this.isUnarmed && 'Unarmed Attack' !== name) ? `Unarmed Attack (${name})` : name) + this.nameModifier;
    }

    get nameModifier() {
        let modifiers = [""];
        if (this.options.duplicateCount > 0) {
            modifiers.push(`#${this.options.duplicateCount + 1}`)
        }
        if (this.options.additionalAttack > 0) {
            modifiers.push(`(${getOrdinal(this.options.additionalAttack + 1)} attack)`)
        }
        if (this.options.doubleAttack) {
            modifiers.push(`(Double Attack)`)
        }
        if (this.options.tripleAttack) {
            modifiers.push(`(Triple Attack)`)
        }
        return modifiers.join(" ");
    }

    get attackRoll() {
        let actor = this.actor;
        let item = this.item;
        let provider = this.provider;

        if (!actor || !item) {
            return;
        }

        let weaponTypes = getPossibleProficiencies(actor, item);
        let attributeMod = this._resolveAttributeModifier(item, actor, weaponTypes);
        let terms = getDiceTermsFromString("1d20");

        if (!!provider) {
            terms.push(...appendNumericTerm(provider.system.attributes.int.mod, "Vehicle Computer Bonus"))

            if (item.position === 'pilot' && actor.system.skills.pilot.trained) {
                terms.push(...appendNumericTerm(2, "Trained Pilot Bonus"))
            }
            ///terms.push(...appendNumericTerm(providerData.condition === "OUT" ? -10 : providerData.condition, "Condition Modifier"));
        }

        terms.push(...appendNumericTerm(actor.baseAttackBonus, "Base Attack Bonus"));

        if (!provider) {

            let conditionBonus = getInheritableAttribute({
                entity: actor,
                attributeKey: "condition",
                reduce: "FIRST"
            })

            if ("OUT" === conditionBonus || !conditionBonus) {
                conditionBonus = "0";
            }

            terms.push(...appendNumericTerm(attributeMod, "Attribute Modifier"));
            terms.push(...getProficiencyBonus(actor, weaponTypes));
            terms.push(...appendNumericTerm(toNumber(conditionBonus), "Condition Modifier"));
            terms.push(...getFocusAttackBonuses(actor, weaponTypes));
        }

        for (let mod of this.modifiers("attack")) {
            terms.push(...appendTerms(mod.value, mod.source))
        }


        terms.push(...appendNumericTerm(generateArmorCheckPenalties(actor), "Armor Check Penalty"));

        //toHitModifiers only apply to the weapon they are on.  a toHitModifier change that is not on a weapon always applies
        getInheritableAttribute({
            entity: [item, actor],
            attributeKey: "toHitModifier",
            parent: !!provider ? provider : actor,
            itemFilter: ((item) => item.type !== 'weapon')
        }).forEach(val => {
            let value = val.value;
            let flavor = val.modifier;
            terms.push(...appendNumericTerm(value, flavor));
        })

        return new SWSERollWrapper(Roll.fromTerms(terms
            .filter(term => !!term)));
    }

    _resolveAttributeModifier(item, actor, weaponTypes) {
        let attributeStats = []
        if (isRanged(item)) {
            attributeStats.push("DEX")
        } else {
            attributeStats.push("STR")
            if (canFinesse(getSize(actor), item, isFocus(actor, weaponTypes))) {
                attributeStats.push(...(getInheritableAttribute({
                    entity: actor,
                    attributeKey: "finesseStat", reduce: "VALUES"
                })));
            }
        }

        return Math.max(...(attributeStats.map(stat => this._getCharacterAttributeModifier(actor, stat))));
    }



    /**
     *
     * @param {SWSEActor} actor
     * @param {string} attributeName
     */
    _getCharacterAttributeModifier(actor, attributeName) {
        let attributes = actor.system.attributes;
        return !attributes ? 0 : attributes[toShortAttribute(attributeName).toLowerCase()].mod;
    }

    get damageRoll() {
        let actor = this.actor
        let item = this.item

        if (!actor || !item) {
            return;
        }

        let terms = [];
        if (this.isUnarmed) {
            terms.push(...resolveUnarmedDamageDie(actor));
            terms.push(...appendNumericTerm(getInheritableAttribute({
                entity: item,
                attributeKey: "unarmedBonusDamage",
                reduce: "SUM"
            }), "Unarmed Bonus Damage"));
        } else {
            let damageDice = getInheritableAttribute({
                entity: item,
                attributeKey: ["damage", "damageDie"],
                reduce: "SUM"
            })
            //let damageDie = damageDice[damageDice.length - 1];
            terms.push(...getDiceTermsFromString(damageDice))
        }

        let halfHeroicLevel = actor?.halfHeroicLevel || 0;
        let beastClassLevels = (actor?.items || []).filter(item => item.type === 'class' && item.name === "Beast")
        let halfBeastLevel = Math.floor(beastClassLevels.length / 2)

        terms.push(...appendNumericTerm(halfHeroicLevel, "Half Heroic Level"));
        if (item.type === 'beastAttack') {
            terms.push(...appendNumericTerm(halfBeastLevel, "Half Beast Level"));
        }
        terms.push(...getInheritableAttribute({
            entity: item,
            attributeKey: "bonusDamage",
            reduce: "VALUES"
        }).map(value => appendNumericTerm(value)).flat());


        for (let mod of this.modifiers("damage")) {
            terms.push(...appendTerms(mod.value, mod.source))
        }

        if (isMelee(item)) {
            let abilityMod = parseInt(actor.system.attributes.str.mod);
            let isTwoHanded = compareSizes(getSize(actor), getSize(item)) === 1;
            let isMySize = compareSizes(getSize(actor), getSize(item)) === 0;

            if(isMySize){
                let grips = getInheritableAttribute({
                    entity: item,
                    attributeKey: "grip",
                    reduce: "VALUES"
                })

                if(grips.includes("two handed")){
                    isTwoHanded = true;
                }
            }

            if(isLightsaber(item))
            {
                let abilitySelect = getInheritableAttribute({
                    entity: actor,
                    attributeKey: "lightsabersDamageStat",
                    reduce: "VALUES"
                })[0]
                if(abilitySelect){
                    abilitySelect = abilitySelect.toLowerCase();
                    const abilities = ["str", "dex", "con", "int", "wis", "cha"];
                    if (abilities.includes(abilitySelect)) {
                        let replaceAbilityMod = parseInt(actor.system.attributes[`${abilitySelect}`].mod);
                        abilityMod = replaceAbilityMod > abilityMod ? replaceAbilityMod: abilityMod;
                    }
                }
            }

            terms.push(...appendNumericTerm(isTwoHanded ? abilityMod * 2 : abilityMod, "Attribute Modifier"))
        }

        let weaponTypes = getPossibleProficiencies(actor, item);
        terms.push(...getSpecializationDamageBonuses(actor, weaponTypes));
        //actorData.


        terms = terms
            .filter(term => !!term);

        terms = terms.length > 0 ? terms : [new NumericTerm({number: 0})]
        let roll = Roll.fromTerms(terms);

        let bonusDamageDice = getInheritableAttribute({
            entity: item,
            attributeKey: "bonusDamageDie",
            reduce: "SUM"
        })
        roll.alter(1, toNumber(bonusDamageDice));

        return new SWSERollWrapper(roll);
    }

    get additionalDamageDice() {
        let actorData = this.actor
        let itemData = this.item

        let damageDice = getInheritableAttribute({
            entity: itemData,
            attributeKey: "damage",
            reduce: "VALUES"
        })
        let damageDie = damageDice[damageDice.length - 1];

        if (!damageDie) {
            return "";
        }

        if (!damageDie.includes("/")) {
            return [];
        }
        let additionalDie = damageDie.split("/");

        //let bonusDice = this.getInheritableAttributesByKey('bonusDamageDie');
        let bonusSize = getInheritableAttribute({
            entity: itemData,
            attributeKey: 'bonusDamageDieSize',
            reduce: "SUM"
        });
        let atks = [];
        for (let die of additionalDie) {
            die = increaseDieSize(die, bonusSize);
            atks.push(die);
        }

        return atks.slice(1);
    }

    get notes() {
        let itemData = this.item;
        let provider = this.provider;
        let notes = getInheritableAttribute({
            entity: itemData,
            attributeKey: 'special'
        })
        let type = this.type;
        if ('Stun' === type) {
            notes.push({href: "https://swse.fandom.com/wiki/Stun_Damage", value: "Stun Damage"})

        }
        if ('Ion' === type) {
            notes.push({href: "https://swse.fandom.com/wiki/Ion_Damage", value: "Ion Damage"})
        }

        if (!!provider) {
            notes.push({value: `Weapon Emplacement on ${provider.name}`})
        }
        return notes;
    }

    get notesHTML() {
        return this.notes.map(note => {
            let value = note.value;
            let href = note.href;

            if (href) {
                value = `<a href="${href}">${value}</a>`
            }

            value = `<span class="note">${value}</span>`

            return value;

        }).join("<span>  </span>");
    }

    get notesText() {
        return this.notes.map(note => note.value).join(", ");
    }

    get range() {
        let item = this.item;
        let treatedAsForRange = getInheritableAttribute({
            entity: item,
            attributeKey: "treatedAs",
            reduce: "FIRST"
        });

        let resolvedSubtype = treatedAsForRange ? treatedAsForRange : item.system.subtype;


        if (getItemStripping(item, "reduceRange")?.value) {
            resolvedSubtype = reduceWeaponRange(resolvedSubtype);
        }

        return resolvedSubtype;
    }

    get rangeDisplay() {
        let multipliers = getInheritableAttribute({
            entity: this.item,
            attributeKey: "rangeMultiplier",
            reduce: "VALUES"
        })

        let range1 = this.range;

        for (let multiplier of multipliers) {
            range1 = range1 + multiplier;
        }

        return range1
    }

    get critical() {
        return "x2" //TODO this is what was currently implemented, but it's clearly not done.  we need a better critical system that this attack object should provide
    }

    get type() {
        let item = this.item;

        if (!item) {
            return;
        }
        let attributes = getInheritableAttribute({
            entity: item,
            attributeKey: 'damageType',
            reduce: "VALUES"
        });

        if (attributes.length === 0 && item.type === "vehicleSystem") {
            attributes.push("Energy");
        }

        return attributes.join(', ');
    }

    get modes() {
        let item = this.item;
        let modes = SWSEItem.getModesFromItem(item);
        //const dynamicModes = this.getDynamicModes(modes.filter(mode=>mode.type ==="dynamic"));
        modes = modes.filter(mode=>!!mode && mode.type !=="dynamic")

        // modes.forEach(mode => {if(!mode.uuid){
        //     mode.uuid = generateUUID(this.actorId, this.itemId, mode._id)
        // }})
        return modes;
    }

    get rangedAttackModifier() {
        return getAttackRange(this.range, this.isAccurate, this.isInaccurate, this.actor)
    }

    get isAccurate() {
        return getInheritableAttribute({
            entity: this.item,
            attributeKey: 'special',
            attributeFilter: attr => attr.value === "accurate"
        }).length > 0
    }

    get isInaccurate() {
        return getInheritableAttribute({
            entity: this.item,
            attributeKey: 'special',
            attributeFilter: attr => attr.value === "inaccurate"
        }).length > 0
    }

    get attackOptionHTML() {
        let attackRange = this.rangedAttackModifier;
        let modifiers = [];
        let uniqueId = Math.floor(Math.random() * 50000 + Math.random() * 50000)
        modifiers.push(getRangeModifierBlock(this.range, this.isAccurate, this.isInaccurate, uniqueId, attackRange))


        let attackLabel = document.createElement("label");
        modifiers.push(attackLabel);
        attackLabel.innerText = "Attack Modifier:";

        let attackInput = document.createElement("input");
        attackInput.classList.add("attack-modifier", "suppress-propagation")
        attackInput.dataset.source = "Miscellaneous"
        modifiers.push(attackInput);

        modifiers.push(document.createElement("br"))

        let damageLabel = document.createElement("label");
        damageLabel.innerText = "Damage Modifier:";
        modifiers.push(damageLabel);

        let damageInput = document.createElement("input");
        damageInput.dataset.source = "Miscellaneous"
        damageInput.classList.add("damage-modifier", "suppress-propagation")
        modifiers.push(damageInput);

        return modifiers;
    }

    isCritical(roll) {
        let term = roll.terms.find(term => term.faces === 20);
        let num = term.results[0].result;
        if (num === 20) {
            return true;
        }
        return getInheritableAttribute({
            entity: this.item,
            attributeKey: 'extendedCriticalHit',
            reduce: "NUMERIC_VALUES"
        }).includes(num);
    }
    isMiss(roll, defense) {
        let term = roll.terms.find(term => term.faces === 20);
        let num = term.results[0].result;
        return num < defense;
    }

    isFailure(roll) {
        let term = roll.terms.find(term => term.faces === 20);
        let num = term.results[0].result;
        if (num === 1) {
            return true;
        }
        return getInheritableAttribute({
            entity: this.item,
            attributeKey: 'extendedCriticalFailure',
            reduce: "NUMERIC_VALUES"
        }).includes(num);
    }

    withModifiers(modifiers) {
        this.options = this.options || {};
        this.options.modifiers = this.options.modifiers || [];

        this.options.modifiers.push(...modifiers);
    }

    clone() {
        return new Attack(this.actorId, this.itemId, this.providerId, this.parentId, JSON.parse(JSON.stringify(this.options)))
    }

    checkExistingDynamicModes(existingModes, newMode){
        const found = existingModes.find(existingMode => existingMode.modePath === newMode.modePath)
        if(found){
            newMode.isActive = found.isActive;
            newMode.attributes = found.attributes;
        }
        return newMode;
    }

    getDynamicModes(existingDynamicModes) {
        let dynamics = [];
        if (isMelee(this.item)) {
            const actor = this.actor;
            let isMySize = compareSizes(getSize(actor), getSize(this.item)) === 0;
            let cannotUseTwoHands = getInheritableAttribute({entity:this.item, attributeKey:"isLightWeapon", reduce: "OR"})
            if(isMySize && !cannotUseTwoHands){
                const handedness = [this.checkExistingDynamicModes(existingDynamicModes, {name:"One-Handed Grip", attributes:{0:{key:"grip", value:"one handed"}}, modePath:"One-Handed Grip", group:"grip", type:"dynamic"}),
                    this.checkExistingDynamicModes(existingDynamicModes, {name:"Two-Handed Grip", attributes:{0:{key:"grip", value:"two handed"}}, modePath:"Two-Handed Grip", group:"grip", type:"dynamic"})];

                if(!handedness[1].isActive){
                    handedness[0].isActive = true
                }

                dynamics.push(...handedness)
            }
            //terms.push(...appendNumericTerm(isTwoHanded ? strMod * 2 : strMod, "Attribute Modifier"))
        }
        return dynamics;
    }
}

function getItemStripping(item, key) {
    if (item && item.system.stripping) {
        return item.system.stripping[key];
    }
    return undefined;
}

function getDiceTermsFromString(dieString) {
    if (!dieString) {
        return [];
    }
    dieString = `${dieString}`
    let dieTerms = dieString
        .replace(/ /g,"")
        .replace(/-/g, " - ")
        .replace(/\+/g, " + ")
        .replace(/x/g, " x ")
        .split(/ /g)

    let dice = [];
    let lastOperator = "";
    for(let dieTerm of dieTerms){
        if (dieTerm === "0") {
            //dice.push(new NumericTerm({number: 0}));
        } else if (!isNaN(dieTerm)) {
            if(lastOperator === "x"){
                dice.push(new NumericTerm({number: toNumber(dieString), options: getDieFlavor("multiplier")}));
            } else {
                dice.push(new NumericTerm({number: toNumber(dieString)}));
            }
            lastOperator = "";
        } else if(dieTerm === "+"){
            dice.push(plus())
            lastOperator = "+"
        } else if(dieTerm === "-"){
            dice.push(minus())
            lastOperator = "-"
        } else if(dieTerm === "x"){
            dice.push(mult())
            lastOperator = "x"
        } else {
            let toks = dieString.split("d")
            dice.push(new Die({number: parseInt(toks[0]), faces: parseInt(toks[1])}));
        }
    }


    return dice;
}

/**
 * TODO move to unarmed attack object
 *
 * Resolves the die to be thrown when making an unarmed attack
 * @param {SWSEActor} actor
 * @returns
 */
function resolveUnarmedDamageDie(actor) {
    let isDroid = getInheritableAttribute({
        entity: actor,
        attributeKey: "isDroid",
        reduce: "OR"
    });
    let damageDie = getInheritableAttribute({
        entity: actor,
        attributeKey: isDroid ? "droidUnarmedDamage" : ["unarmedDamage", "unarmedDamageDie"],
        reduce: "MAX"
    });
    let bonus = getInheritableAttribute({
        entity: actor,
        attributeKey: "bonusUnarmedDamageDieSize",
        reduce: "SUM"
    })
    damageDie = increaseDieSize(damageDie, bonus);
    return getDiceTermsFromString(damageDie);
}

function attackOption(attack, id) {
    let attackString = attack.toJSONString
    return `<option id="${id}" data-item-id="${attack.itemId}" value="${attackString}" data-attack="${attackString}">${attack.name}</option>`;
}

export function attackOptions(attacks, doubleAttack, tripleAttack) {
    let resolvedAttacks = [];

    //only 2 different weapons can be used
    //double attack can only be used once a standard attack is used
    //triple attack can only be used once a double attack is used
    let existingWeaponNames = [];
    let id = 1;
    for (let attack of attacks) {
        let source = attack.item;
        if (!source) {
            continue;
        }

        let quantity = source.system.quantity || 1

        for (let i = 0; i < quantity; i++) {
            let duplicateCount = existingWeaponNames.filter(name => name === attack.name).length;

            existingWeaponNames.push(attack.name)
            if (duplicateCount > 0) {
                attack.options.duplicateCount = duplicateCount;
            }

            let clonedAttack = attack.clone();
            if (source.type === "beastAttack") {
                clonedAttack.options.beastAttack = true;
            } else {
                clonedAttack.options.standardAttack = true;
            }
            resolvedAttacks.push(attackOption(clonedAttack, id++))

            let additionalDamageDice = attack.additionalDamageDice

            for (let i = 0; i < additionalDamageDice.length; i++) {
                let clonedAttack = attack.clone();
                clonedAttack.options.additionalAttack = i + 1;
                clonedAttack.options.standardAttack = true;
                resolvedAttacks.push(attackOption(clonedAttack, id++))
            }

            if (doubleAttack.includes(source.system.subtype)) {
                let clonedAttack = attack.clone();
                clonedAttack.options.doubleAttack = true;
                resolvedAttacks.push(attackOption(clonedAttack, id++))
            }
            if (tripleAttack.includes(source.system.subtype)) {
                let clonedAttack = attack.clone();
                clonedAttack.options.tripleAttack = true;
                resolvedAttacks.push(attackOption(clonedAttack, id++))
            }
        }
    }
    return resolvedAttacks;
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
    if(context.type === "fullAttack"){
        return "Full Attack";
    }
    return "Single Attack";
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
    context.attacks = context.attacks?.map(i => {
        if (i instanceof Attack) {
            return i;
        }
        return Attack.fromJSON(i);
    }) || [];
    let actor = context.actor || context.attacks[0]?.actor;

    if (!actor) {
        return;
    }
    let availableAttacks = 1;
    let title = getAttackWindowTitle(context);
    let dualWeaponModifier = -10;
    let doubleAttack = [];
    let tripleAttack = [];
    let hands = getHands(actor); //TODO resolve extra hands

    if (context.type === "fullAttack") {
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
    }

    let suppliedAttacks = context.attacks || [];

    // if (suppliedAttacks.length > 0) {
    //     availableAttacks = suppliedAttacks.length;
    // }

    let content = `<h3>Select Attacks:</h3><label>Smart Hands Mode<input type="checkbox"></label>`;
    let resolvedAttacks = [];
    if (suppliedAttacks.length < availableAttacks) {
        //CREATE OPTIONS
        resolvedAttacks = attackOptions(actor.system.attacks, doubleAttack, tripleAttack);
    }


    let blockHeight = 225;


    for (let i = 0; i < availableAttacks; i++) {
        let attack = suppliedAttacks.length > i ? suppliedAttacks[i] : undefined;
        let select;
        if (!!attack) {
            select = `<span class="attack-id" data-value="${attack.toJSONString}">${attack.name}</span>`
        } else {
            select = `<select class="attack-id" id="attack-${i}"><option> -- </option>${resolvedAttacks.join("")}</select>`
        }


        let attackBlock = `<div class="attack panel attack-block">
<div class="attack-name">${select}</div>
<div class="attack-options"></div>
<div class="attack-total"></div>
</div>`
        content += attackBlock;

    }

    let height = availableAttacks * blockHeight + 85


    return {
        title,
        content,
        buttons: {
            attack: {
                label: "Attack",
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

                    createAttackChatMessage(attacks, undefined).then(() => {
                    });
                }
            },
            saveMacro: {
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
            }
        },
        render: async (html) => {
            let selects = html.find("select");
            selects.on("change", () => handleAttackSelect(selects));
            handleAttackSelect(selects)

            let attackIds = html.find(".attack-id");
            attackIds.each((i, div) => populateItemStats(div, context));

            attackIds.on("change", () => {
                let context = {};
                context.attackMods = getAttackMods(selects, dualWeaponModifier);
                context.damageMods = [];
                html.find(".attack-id").each((i, div) => populateItemStats(div, context));
            })
        },
        callback: ()=>{},
        options: {
            height
        }
    };
}

/**
 *
 * @param context
 * @param.items
 * @param.actor
 * @returns {Promise<void>}
 */
export async function makeAttack(context) {
    let options = attackDialogue(context);
    await new Dialog(options).render(true);
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

    let parent = $(html).parents(".attack");
    let options = parent.children(".attack-options")
    let total = parent.children(".attack-total");
    total.empty();
    options.empty();

    if (value === "--") {
        return;
    }
    let attack = Attack.fromJSON(value);

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
    return template({name: attack.name, notes: attack.notesHTML, attacks: resolvedAttacks, targetsEnabled: game.settings.get("swse", "enableTargetResultsOnAttackCard")})
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

        return {name: actor.name,
            defense: reflexDefense,
            defenseType: 'Ref',
            highlight: targetResult.includes("Miss") ? "miss" : "hit",
            result: targetResult,
            conditionalDefenses: conditionalDefenses}
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
    for(let targetToken of targetTokens.values()){
        let actorId = targetToken.document.actorId
        let actor = game.actors.get(actorId)
        if(actor){
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


test()

//test()

function assertEquals(expected, actual) {
    if(expected === actual){
        console.log("passed")
    } else {
        console.warn(`expected ${expected}, but got ${actual}`)
    }
}

function test(){
    console.log("running attack tests...");

    assertEquals(`[{"class":"OperatorTerm","options":{},"evaluated":false,"operator":"+"}`+
        `,{"class":"NumericTerm","options":{"flavor":"bonus"},"evaluated":false,"number":1}]`, JSON.stringify(appendTerms(1, "bonus")))

    assertEquals(`[{"class":"OperatorTerm","options":{},"evaluated":false,"operator":"-"}`+
        `,{"class":"NumericTerm","options":{"flavor":"bonus"},"evaluated":false,"number":2}]`, JSON.stringify(appendTerms("-2", "bonus")))

    assertEquals(`[{"class":"OperatorTerm","options":{},"evaluated":false,"operator":"-"}`+
        `,{"class":"Die","options":{"flavor":"bonus"},"evaluated":false,"number":4,"faces":10,"modifiers":[],"results":[]}]`, JSON.stringify(appendTerms("-4d10", "bonus")))

    assertEquals(`[{"class":"OperatorTerm","options":{},"evaluated":false,"operator":"-"}`+
        `,{"class":"Die","options":{"flavor":"bonus"},"evaluated":false,"number":4,"faces":10,"modifiers":[],"results":[]}`+
        `,{"class":"OperatorTerm","options":{},"evaluated":false,"operator":"-"},`+
        `{"class":"Die","options":{"flavor":"bonus"},"evaluated":false,"number":6,"faces":4,"modifiers":[],"results":[]},`+
        `{"class":"OperatorTerm","options":{},"evaluated":false,"operator":"+"},`+
        `{"class":"NumericTerm","options":{"flavor":"bonus"},"evaluated":false,"number":9}]`, JSON.stringify(appendTerms("-4d10-6d4+9", "bonus")))

    assertEquals(`[{"class":"OperatorTerm","options":{},"evaluated":false,"operator":"+"}`+
        `,{"class":"NumericTerm","options":{"flavor":"bomb"},"evaluated":false,"number":1}`+
        `,{"class":"OperatorTerm","options":{},"evaluated":false,"operator":"+"}`+
        `,{"class":"Die","options":{"flavor":"bomb"},"evaluated":false,"number":3,"faces":6,"modifiers":[],"results":[]}]`, JSON.stringify(appendTerms("1+3d6", "bomb")))
}