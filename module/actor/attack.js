import {UnarmedAttack} from "./unarmed-attack.js";
import {getInheritableAttribute} from "../attribute-helper.js";
import {crewQuality, LIGHTSABER_WEAPON_TYPES, weaponGroup} from "../constants.js";
import {compareSizes, getSize} from "./size.js";
import {
    canFinesse,
    getFocusAttackBonuses,
    getPossibleProficiencies,
    getProficiencyBonus,
    getSpecializationDamageBonuses,
    isFocus,
    resolveFinesseBonus
} from "./attack-handler.js";
import {generateArmorCheckPenalties} from "./armor-check-penalty.js";
import {getEquippedItems, SWSEActor} from "./actor.js";
import {reduceWeaponRange, SWSEItem} from "../item/item.js";
import {
    getAttackRange,
    getBonusString,
    getEntityFromCompendiums,
    getOrdinal,
    getRangeModifierBlock,
    handleAttackSelect,
    increaseDieSize,
    resolveValueArray,
    toNumber
} from "../util.js";
import {SWSERollWrapper} from "../common/roll.js";
import {createAttackMacro} from "../swse.js";

//Broken out because i have no idea if i'm doing this in a way that the roller understands

export function getDieFlavor(flavor) {
    return {flavor};
}

function plus() {
    return new OperatorTerm({operator: "+"});
}
function mult() {
    return new OperatorTerm({operator: "*"});
}

function minus() {
    return new OperatorTerm({operator: "-"});
}

export function appendNumericTerm(value, flavor) {
    if (!value) {
        return [];
    }

    let num = parseInt(value);
    if (num === 0) {
        return [];
    }
    return [num > -1 ? plus() : minus(),
        new NumericTerm({number: Math.abs(num), options: getDieFlavor(flavor)})];
}

export class Attack {

    get toJSON() {
        return {actorId: this.actorId, itemId: this.itemId, providerId: this.providerId, options: this.options};
    }

    get toJSONString() {
        return JSON.stringify(this.toJSON);
    }

    static fromJSON(json) {
        if (typeof json === "string") {
            json = JSON.parse(json);
        }
        return new Attack(json.actorId, json.itemId, json.providerId, json.options)
    }

    constructor(actorId, itemId, providerId, options) {
        this.actorId = actorId;
        this.itemId = itemId;
        this.providerId = providerId;
        this.options = options || {};
    }

    /**
     *
     * @returns {ActorData | Object}
     */
    get actor() {
        let find;
        if(this.actorId) {
            find = game.data.actors.find(actor => actor._id === this.actorId);
            if (find instanceof SWSEActor) {
                return find.data;
            }
        } else if(this.providerId){
            let provider = this.provider;
            let quality = provider?.data?.crewQuality?.quality;
            return SWSEActor.getCrewByQuality(quality);
        }
        return find;
    }

    /**
     *
     * @returns {ActorData}
     */
    get provider() {
        let actor = this.getActor(this.providerId)
            if (actor instanceof SWSEActor) {
                return actor.data;
            }
            return actor;
    }

    getActor(actorId) {
        let find = game.data.actors.find(actor => actor._id === actorId);
        if (!find) {
            find = getEntityFromCompendiums("Actor", actorId)
        }
        return find;
    }

    /**
     *
     * @returns {ItemData}
     */
    get item() {
        let provider = this.provider;
        let actor = !!provider ? provider : this.actor;
        if(!actor){
            return undefined;
        }

        if ('Unarmed Attack' === this.itemId) {
            return new UnarmedAttack(this.actorId);
        }

        let items = actor.items?._source || actor.items;
        let find = items.find(item => item._id === this.itemId);

        if(!find){
            find = this.options.items?.get(this.itemId)
        }

        if (find instanceof SWSEItem) {
            return find.data;
        }
        return find;
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

    /**
     *
     * @param item
     * @returns {boolean}
     */
    isRanged(item) {
        let data = item.data.data || item.data;
        return weaponGroup['Ranged Weapons'].includes(data.subtype);
    }
    /**
     *
     * @param item
     * @returns {boolean}
     */
    isMelee(item) {
        let data = item.data.data || item.data;
        return weaponGroup['Melee Weapons'].includes(data.subtype);
    }

    /**
     *
     * @param actor {SWSEActor}
     * @param item {SWSEItem}
     * @returns {boolean|boolean}
     */
    canFinesse(actor, item) {
        let sizes = compareSizes(actor.size, item.size);
        let isOneHanded = sizes < 1;
        let isLight = sizes < 0;
        let weaponTypes = getPossibleProficiencies(actor, item);

        return isLight || (isOneHanded && isFocus(actor, weaponTypes)) || this.isLightsaber(item);
    }

    /**
     *
     * @param weapon {SWSEItem}
     * @returns {boolean}
     */
    isLightsaber(weapon) {
        return LIGHTSABER_WEAPON_TYPES.includes(weapon.data.data.subtype.toLowerCase());
    }


    get name() {
        let name = SWSEItem.buildItemName(this.item);
        return ((this.isUnarmed && 'Unarmed Attack' !== name) ? `Unarmed Attack (${name})` : name) + this.nameModifier;
    }
    get nameModifier() {
        let modifiers = [""];
        if(this.options.duplicateCount > 0){
            modifiers.push(`#${this.options.duplicateCount+1}`)
        }
        if(this.options.additionalAttack > 0){
            modifiers.push(`(${getOrdinal(this.options.additionalAttack+1)} attack)`)
        }
        if(this.options.doubleAttack){
            modifiers.push(`(Double Attack)`)
        }
        if(this.options.tripleAttack){
            modifiers.push(`(Triple Attack)`)
        }
        return modifiers.join(" ");
    }

    get attackRoll() {
        let actor = this.actor;
        let item = this.item;
        let provider = this.provider;

        if(!actor || !item){
            return;
        }

        let actorData = actor?.data;
        //let providerData = provider.data;
        let weaponTypes = getPossibleProficiencies(actor, item);
        let attributeStats = []
        if (this.isRanged(item)) {
            attributeStats.push("DEX")
        } else if(this.isMelee(item)){
            attributeStats.push("STR")
            if (canFinesse(getSize(actor), item, isFocus(actor, weaponTypes))) {
                attributeStats.push(...(getInheritableAttribute({
                    entity: actor,
                    attributeKey: "finesseStat", reduce: "VALUES"
                })));
            }
        }

        let attributeMod = resolveFinesseBonus(actor, attributeStats);
        let terms = getDiceTermsFromString("1d20");

        if(!!provider){
            terms.push(...appendNumericTerm(provider.data.attributes.int.mod, "Vehicle Computer Bonus"))

            if (item.position === 'pilot' && actor.data.skills.pilot.trained) {
                terms.push(...appendNumericTerm(2, "Trained Pilot Bonus"))
            }
            ///terms.push(...appendNumericTerm(providerData.condition === "OUT" ? -10 : providerData.condition, "Condition Modifier"));
        }

        terms.push(...appendNumericTerm(actorData?.offense?.bab, "Base Attack Bonus"));

        if(!provider) {

            let conditionBonus = getInheritableAttribute({
                entity: actor,
                attributeKey: "condition",
                reduce: "FIRST"
            })

            if("OUT" === conditionBonus || !conditionBonus){
                conditionBonus = "0";
            }

            terms.push(...appendNumericTerm(attributeMod, "Attribute Modifier"));
            terms.push(...getProficiencyBonus(actor, weaponTypes));
            terms.push(...appendNumericTerm(toNumber(conditionBonus), "Condition Modifier"));
            terms.push(...getFocusAttackBonuses(actor, weaponTypes));
        }

        for (let mod of this.modifiers("attack")) {
            terms.push(...appendNumericTerm(mod.value, mod.source))
        }


        terms.push(...appendNumericTerm(generateArmorCheckPenalties(actor), "Armor Check Penalty"));

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

    get damageRoll() {
        let actor = this.actor
        let item = this.item

        if(!actor || !item){
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
                reduce: "VALUES"
            })
            let damageDie = damageDice[damageDice.length - 1];
            terms.push(...getDiceTermsFromString(damageDie))
        }

        let heroicClassLevels = (actor?.items || []).filter(item => item.type === 'class' && getInheritableAttribute({
            entity: item,
            attributeKey: "isHeroic", reduce: "OR"
        }))
        let halfHeroicLevel = Math.floor(heroicClassLevels.length / 2)

        terms.push(...appendNumericTerm(halfHeroicLevel, "Half Heroic Level"));
        terms.push(...getInheritableAttribute({
            entity: item,
            attributeKey: "bonusDamage",
            reduce: "VALUES"
        }).map(value => appendNumericTerm(value)).flat());


        for (let mod of this.modifiers("damage")) {
            terms.push(...appendNumericTerm(mod.value, mod.source))
        }

        if (this.isMelee(item)) {
            let strMod = parseInt(actor.data.attributes.str.mod);
            let isTwoHanded = compareSizes(getSize(actor), getSize(item)) === 1;
            terms.push(...appendNumericTerm(isTwoHanded ? strMod * 2 : strMod, "Attribute Modifier"))
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

    get notes(){
        let itemData = this.item;
        let provider = this.provider;
        let notes = getInheritableAttribute({
            entity: itemData,
            attributeKey: 'special'
        })
        let type = this.type;
        if('Stun' === type){
            notes.push({href:"https://swse.fandom.com/wiki/Stun_Damage", value:"Stun Damage"})

        }
        if('Ion' === type){
            notes.push({href:"https://swse.fandom.com/wiki/Ion_Damage", value:"Ion Damage"})
        }

        if(!!provider){
            notes.push({value: `Weapon Emplacement on ${provider.name}`})
        }
        return notes;
    }

    get notesHTML() {
        return this.notes.map(note => {
            let value = note.value;
            let href = note.href;

            if(href){
                value = `<a href="${href}">${value}</a>`
            }

            value = `<span class="note">${value}</span>`

            return value;

        }).join("<span>  </span>");
    }
    get notesText() {
        return this.notes.map(note =>  note.value).join(", ");
    }

    get range() {
        let itemData = this.item;
        let treatedAsForRange = getInheritableAttribute({
            entity: itemData,
            attributeKey: "treatedAs",
            reduce: "FIRST"
        });

        let resolvedSubtype = treatedAsForRange ? treatedAsForRange : itemData.data.subtype;


        if (getItemStripping(itemData, "reduceRange")?.value) {
            resolvedSubtype = reduceWeaponRange(resolvedSubtype);
        }

        return resolvedSubtype;
    }

    get rangeDisplay(){
        let multipliers = getInheritableAttribute({
            entity: this.item,
            attributeKey: "rangeMultiplier",
            reduce: "VALUES"
        })

        let range1 = this.range;

        for(let multiplier of multipliers){
            range1 = range1 + multiplier;
        }

        return range1
    }

    get critical() {
        return "x2" //TODO this is what was currently implemented, but it's clearly not done.  we need a better critical system that this attack object should provide
    }

    get type() {
        let item = this.item;

        if(!item){
            return;
        }
        let attributes = getInheritableAttribute({
            entity: item,
            attributeKey: 'damageType',
            reduce: "VALUES"
        });

        if(attributes.length === 0 && item.type === "vehicleSystem"){
            attributes.push("Energy");
        }

        return attributes.join(', ');
    }

    get modes() {
        let itemData = this.item;
        let modes = SWSEItem.getModesFromItem(itemData);
        let groupedModes = {}
        for (let mode of Object.values(modes).filter(m => !!m)) {
            if (!groupedModes[mode.group]) {
                groupedModes[mode.group] = [];
            }
            groupedModes[mode.group].push(mode);
        }
        return Object.values(groupedModes);
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

    clone(){
        return new Attack(this.actorId, this.itemId, this.providerId, JSON.parse(JSON.stringify(this.options)))
    }
}

function getItemStripping(itemData, key) {
    if (itemData?.data?.stripping) {
        return itemData.data.stripping[key];
    }
    return undefined;
}

function getDiceTermsFromString(dieString) {
    if(!dieString){
        return [];
    }
    if (dieString === "0") {
        return [new NumericTerm({number: 0})];
    }
    if (dieString === "1") {
        return [new NumericTerm({number: 1})];
    }
    let additionalTerms = []
    if(dieString.includes("x")){
        let toks = dieString.split("x")
        dieString = toks[0];
        additionalTerms.push( mult());
        additionalTerms.push(  new NumericTerm({number: toks[1], options: getDieFlavor("multiplier")}));
    }
    let toks = dieString.split("d")
    let dice = [new Die({number: parseInt(toks[0]), faces: parseInt(toks[1])})];
    dice.push(...additionalTerms);
    return dice;
}

/**
 * Resolves the die to be thrown when making an unarmed attack
 * @param {ActorData} actor
 * @returns {String}
 */
function resolveUnarmedDamageDie(actor) {
    let damageDie = getInheritableAttribute({
        entity: actor,
        attributeKey: ["unarmedDamage", "unarmedDamageDie"],
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
    let attackString = JSON.stringify(attack).replaceAll("\"", "&quot;");
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

        let duplicateCount = existingWeaponNames.filter(name => name === attack.name).length;

        existingWeaponNames.push(attack.name)
        if (duplicateCount > 0) {
            attack.options.duplicateCount = duplicateCount;
        }

        let clonedAttack = attack.clone();
        clonedAttack.options.standardAttack = true;
        resolvedAttacks.push(attackOption(clonedAttack, id++))

        let additionalDamageDice = attack.additionalDamageDice

        for (let i = 0; i < additionalDamageDice.length; i++) {
            let clonedAttack = attack.clone();
            clonedAttack.options.additionalAttack = i + 1;
            clonedAttack.options.standardAttack = true;
            resolvedAttacks.push(attackOption(clonedAttack, id++))
        }

        if (doubleAttack.includes(source.data.subtype)) {
            let clonedAttack = attack.clone();
            clonedAttack.options.doubleAttack = true;
            resolvedAttacks.push(attackOption(clonedAttack, id++))
        }
        if (tripleAttack.includes(source.data.subtype)) {
            let clonedAttack = attack.clone();
            clonedAttack.options.tripleAttack = true;
            resolvedAttacks.push(attackOption(clonedAttack, id++))
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
        if(i instanceof Attack){
            return i;
        }
        return Attack.fromJSON(i);
    }) || [];
    let actor = context.actor || context.attacks[0]?.actor;

    if(!actor){
        return;
    }
    let availableAttacks = 1;
    let title = "Single Attack";
    let dualWeaponModifier = -10;
    let doubleAttack = [];
    let tripleAttack = [];
    //let hands = 2; //TODO resolve extra hands

    if (context.type === "fullAttack") {
        title = "Full Attack";
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
        let equippedItems = getEquippedItems(actor)
        availableAttacks = 0;
        let doubleAttackBonus = 0;
        let tripleAttackBonus = 0;
        let availableWeapons = 0
        for (let item of equippedItems) {
            availableWeapons = Math.min(availableWeapons + (item.isDoubleWeapon ? 2 : 1), 2);
            //TODO support exotic weapons
            let subtype = item.data.subtype;
            if (doubleAttack.includes(subtype)) {
                doubleAttackBonus = 1;
            }
            if (tripleAttack.includes(subtype)) {
                tripleAttackBonus = 1;
            }
        }
        availableAttacks = availableWeapons + doubleAttackBonus + tripleAttackBonus


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

    let content = `<p>Select Attacks:</p>`;
    let resolvedAttacks = [];
    if (suppliedAttacks.length < availableAttacks) {
        //CREATE OPTIONS
        resolvedAttacks = attackOptions(actor.data.attacks, doubleAttack, tripleAttack);
    }


    let blockHeight = 225;


    for (let i = 0; i < availableAttacks; i++) {
        let attack = suppliedAttacks.length > i ? suppliedAttacks[i] : undefined;
        let select;
        if (!!attack) {
            select = `<span class="attack-id" data-value="${JSON.stringify(attack).replaceAll("\"", "&quot;")}">${attack.name}</span>`
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

                    rollAttacks(attacks, undefined);
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

                    createAttackMacro(data).then(() => {});
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
    for (let select of selects) {
        if (select.value === "--") {
            continue;
        }
        let attack = JSON.parse(select.value);
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
    }


    if (isDoubleAttack) {
        attackMods.push({value: -5, source: "Double Attack"});
    }
    if (isTripleAttack) {
        attackMods.push({value: -5, source: "Triple Attack"});
    }

    if (standardAttacks > 1) {
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
    options.find(".damage-modifier").on("change", () => setAttackPreviewValues(total, attack, options, context))

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

function generateAttackCard(resolvedAttacks, attack) {
    let attackRolls = '<th>Attack:</th>';
    let damageRolls = '<th>Damage:</th>';


    for (let resolvedAttack of resolvedAttacks) {
        let classes = [];
        let modifiers = [];
        if (resolvedAttack.critical) {
            classes.push("critical")
            modifiers.push(`<i class="fas fa-dice-d20">`)
        }
        if (resolvedAttack.fail) {
            classes.push("fail")
            modifiers.push(`<i class="fas fa-trash">`)
        }
        attackRolls += `<td class="${classes.join(" ")}" title="${resolvedAttack.attack.result}">${resolvedAttack.attack.total} ${modifiers.join(" ")}</td>`
        let damageType = "";
        if(resolvedAttack.damageType){
            damageType = ` (${resolvedAttack.damageType}) `;
        }
        damageRolls += `<td title="${resolvedAttack.damage.result}">${resolvedAttack.damage.total}${damageType}</td>`
    }

    return `<table class="swse">
<thead>
<tr>
<th>${attack.name}</th>
</tr>
</thead>
<tbody>
<tr>
${attackRolls}
</tr>
<tr>
${damageRolls}
</tr>
</tbody>
</table><br/><div>${attack.notesHTML}</div>`
}

function resolveAttack(attack) {
    let attackRollResult = attack.attackRoll.roll.roll({async: false});

    let fail = attack.isFailure(attackRollResult);
    let critical = attack.isCritical(attackRollResult);


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
    return {
        attack: attackRollResult,
        damage: damage,
        damageType: attack.type,
        notes: attack.notes,
        critical,
        fail
    };
}

export function rollAttacks(attacks, rollMode) {
    let cls = getDocumentClass("ChatMessage");

    let attackRows = [];
    let roll;
    for (let attack of attacks) {
        let resolvedAttack = resolveAttack(attack);
        roll = resolvedAttack.attack;
        attackRows.push(generateAttackCard([resolvedAttack], attack))
    }

    let content = `${attackRows.join("<br>")}`;

    let speaker = ChatMessage.getSpeaker({actor: attacks[0].actor});

    let flavor = attacks[0].name;
    if (attacks.length > 1) {
        flavor = "Full Attack " + flavor;
    }


    let messageData = {
        user: game.user.id,
        speaker: speaker,
        flavor: flavor,
        type: CONST.CHAT_MESSAGE_TYPES.ROLL,
        content,
        sound: CONFIG.sounds.dice,
        roll
    }

    let msg = new cls(messageData);
    if (rollMode) msg.applyRollMode(rollMode);

    return cls.create(msg.data, {rollMode});
}