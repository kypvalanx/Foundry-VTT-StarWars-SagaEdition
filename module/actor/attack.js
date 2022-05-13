import {UnarmedAttack} from "./unarmed-attack.js";
import {getInheritableAttribute} from "../attribute-helper.js";
import {LIGHTSABER_WEAPON_TYPES, weaponGroup} from "../constants.js";
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
import {SWSEActor} from "./actor.js";
import {reduceWeaponRange, SWSEItem} from "../item/item.js";
import {
    getEntityFromCompendiums,
    getOrdinal,
    getRangedAttackMod,
    getRangeModifierBlock,
    increaseDieSize,
    toNumber
} from "../util.js";
import {SWSERollWrapper} from "../common/roll.js";

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
     * @returns {ActorData}
     */
    get actor() {
        let find = game.data.actors.find(actor => actor._id === this.actorId);
        if (find instanceof SWSEActor) {
            return find.data;
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
            terms.push(...appendNumericTerm(attributeMod, "Attribute Modifier"));
            terms.push(...getProficiencyBonus(actor, weaponTypes));
            terms.push(...appendNumericTerm(actorData.condition === "OUT" ? -10 : actorData.condition, "Condition Modifier"));
            terms.push(...getFocusAttackBonuses(actor, weaponTypes));
        }

        for (let mod of this.modifiers("attack")) {
            terms.push(...appendNumericTerm(mod.value, mod.source))
        }


        terms.push(...appendNumericTerm(generateArmorCheckPenalties(actor), "Armor Check Penalty"));

        getInheritableAttribute({
            entity: item,
            attributeKey: "toHitModifier",
            parent: !!provider ? provider : actor
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
        return getRangedAttackMod(this.range, this.isAccurate, this.isInaccurate, this.actor)
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
        let rangedAttackModifier = this.rangedAttackModifier;
        let modifiers = [];
        let uniqueId = Math.floor(Math.random() * 50000 + Math.random() * 50000)
        if (isNaN(rangedAttackModifier)) {
            modifiers.push(getRangeModifierBlock(this.range, this.isAccurate, this.isInaccurate, uniqueId))
        }

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