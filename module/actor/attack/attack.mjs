import {UnarmedAttack} from "../unarmed-attack.mjs";
import {getInheritableAttribute} from "../../attribute-helper.mjs";
import {compareSizes, getSize} from "../size.mjs";
import {
    canFinesse,
    getFocusAttackBonuses,
    getPossibleProficiencies,
    getProficiencyBonus,
    getSpecializationDamageBonuses,
    isFocus,
    isLightsaber,
    isMelee,
    isRanged
} from "../attack-handler.mjs";
import {generateArmorCheckPenalties} from "../armor-check-penalty.mjs";
import {SWSEActor} from "../actor.mjs";
import {reduceWeaponRange, SWSEItem} from "../../item/item.mjs";
import {
    appendNumericTerm,
    appendTerms,
    getAttackRange,
    getDocumentByUuid,
    getEntityFromCompendiums,
    getOrdinal,
    increaseDieSize,
    minus,
    mult,
    plus,
    toNumber,
    toShortAttribute
} from "../../common/util.mjs";
import {SWSERollWrapper} from "../../common/roll.mjs";
import {SimpleCache} from "../../common/simple-cache.mjs";
import {weaponGroup} from "../../common/constants.mjs";
import {SWSE} from "../../common/config.mjs";
import {RollModifier, RollModifierChoice} from "../../common/roll-modifier.mjs";

//Broken out because i have no idea if i'm doing this in a way that the roller understands



export class Attack {
    static TYPES = {
        FULL_ATTACK: "FULL_ATTACK",
        SINGLE_ATTACK: "SINGLE_ATTACK"
    };

    /**
     *
     * @param actorId {String} the actor that this attack belongs to.
     * @param weaponId {String} the weapon that is being used.
     * @param operatorId {String} the actor that is using the weapon
     * @param parentId {String} the parent actor of the weapon
     * @param options {object}
     */
    constructor(actorId, weaponId, operatorId, parentId, options= {}) {
        this.actorId = actorId;
        this.weaponId = weaponId;
        this.operatorId = operatorId;
        this.parentId = parentId;
        this.options = options;
        this.cache = new SimpleCache()
    }

    /**
     *
     * @param criteria
     * @param criteria.actorId {String} the actor that this attack belongs to.
     * @param criteria.weaponId {String} the weapon that is being used.
     * @param criteria.operatorId {String} the actor that is using the weapon
     * @param criteria.parentId {String} the parent actor of the weapon
     * @param criteria.options {object}
     * @return {Attack}
     */
    static create(criteria) {
        return new Attack(criteria.actorId, criteria.weaponId, criteria.operatorId, criteria.parentId || criteria.actorId, JSON.parse(JSON.stringify(criteria.options || {})));
    }

    static fromJSON(json) {
        if (typeof json === "string") {
            json = JSON.parse(unescape(json));
        }
        if (Array.isArray(json)) {
            let attks = [];
            for (let atk of json) {
                attks.push(this.create(atk))
            }
            return attks;
        }
        return this.create(json)
    }

    get toJSON() {
        return {
            actorId: this.actorId,
            weaponId: this.weaponId,
            operatorId: this.operatorId,
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

    reduceAmmunition(count = 1) {
        if (!(this.item && this.item.hasAmmunition)) {
            return;
        }

        let ammoModifiers = getInheritableAttribute({entity: this.item, attributeKey: ["ammoUse", "ammoUseMultiplier"]})

        const baseCounts = [count];
        baseCounts.push(...ammoModifiers.filter(m => m.key === "ammoUse").map(m=>parseInt(m.value)))
        count = Math.max(...baseCounts);

        for(const mod of ammoModifiers.filter(m => m.type === "ammoUseMultiplier")){
            count *= parseInt(mod.value, 10)
        }

        const ammo = this.item.ammunition.current[0];
        this.item.ammunition.decreaseAmmunition(ammo.key, count);
    }


    getCached(key, fn) {
        if (!this.cache) {
            return fn();
        }
        return this.cache.getCached(key, fn)
    }

    /**
     *
     * @returns {SWSEActor}
     */
    get actor() {
        return this.getCached("actor", () => {

            if (this.parentId) {
                let tokens = canvas.tokens.children || [];
                let token = tokens.flatMap(token => token.children).find(token => token.id === this.parentId);
                const actor = token?.document?.actor
                if(actor){
                    return actor;
                }
            }

            if (this.actorId) {
                let find = getDocumentByUuid(this.actorId)

                if (find) {
                    return find;
                }

                let values = [...game.packs.values()];
                for (let pack of values.filter(pack => pack.documentClass.documentName === "Actor")) {
                    find = pack.get(this.actorId)

                    if (find) {
                        return find;
                    }
                }
                return find;
            }
            if (this.operatorId) {
                let provider = this.provider;
                let quality = provider?.system?.crewQuality?.quality;
                return SWSEActor.getCrewByQuality(quality);
            }
        })
    }

    /**
     *
     * @returns {ActorData}
     */
    get provider() {
        return getActor(this.parentId);
    }

    /**
     *
     * @returns {ActorData}
     */
    get operator() {
        return getActor(this.operatorId) || SWSEActor.getCrewByQuality(getActor(this.parentId).system?.crewQuality?.quality);
    }

    /**
     *
     * @returns {ActorData}
     */
    get parent() {
        return getActor(this.parentId);
    }


    /**
     *
     * @returns {SWSEItem}
     */
    get item() {
        return this.getCached("item", () => {
            let provider = this.provider;
            let actor = !!provider ? provider : this.actor;
            if (!actor) {
                return undefined;
            }

            if ('Unarmed Attack' === this.weaponId) {
                return new UnarmedAttack(this.actorId);
            }

            return actor.items.get(this.weaponId);
        })
    }

    get isUnarmed() {
        return 0 < getInheritableAttribute({
            entity: this.item,
            attributeKey: ['unarmedModifier', 'unarmedBonusDamage']
        }).length || this.item?.isUnarmed
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
        //let actor = this.actor;
        const weapon = this.item;
        const parent = this.parent;
        const operator = this.operator;

        if (!operator || !weapon) {
            return;
        }

        const terms = getDiceTermsFromString("1d20").dice;

        terms.push(...appendNumericTerm(operator.baseAttackBonus, "Base Attack Bonus"));
        terms.push(...appendNumericTerm(this.getConditionModifier(operator), "Condition Modifier"));

        if(parent !== operator){
            terms.push(...appendNumericTerm(this.getConditionModifier(parent), "Vehicle Condition Modifier"));
        }

        if (!parent || parent === operator) {
            let weaponTypes = getPossibleProficiencies(operator, weapon);
            terms.push(...appendNumericTerm(this._resolveAttributeModifier(weapon, operator, weaponTypes), "Attribute Modifier"));
            terms.push(...getProficiencyBonus(operator, weaponTypes));
            terms.push(...getFocusAttackBonuses(operator, weaponTypes));
        } else {
            terms.push(...appendNumericTerm(parent.system.attributes.int.mod, "Vehicle Computer Bonus"))

            if (weapon.position === 'pilot' && operator.system.skills.pilot.trained) {
                terms.push(...appendNumericTerm(2, "Trained Pilot Bonus"))
            }
        }

        for (let mod of this.modifiers("attack")) {
            terms.push(...appendTerms(mod.value, mod.source))
        }


        terms.push(...appendNumericTerm(generateArmorCheckPenalties(operator), "Armor Check Penalty"));

        //toHitModifiers only apply to the weapon they are on.  a toHitModifier change that is not on a weapon always applies
        const inheritableAttribute = getInheritableAttribute({
            entity: [weapon, operator],
            attributeKey: "toHitModifier",
            parent: !!parent ? parent : operator,
            itemFilter: ((item) => item.type !== 'weapon')
        });
        inheritableAttribute.forEach(val => {
            terms.push(...appendNumericTerm(val.value, this.actor.items.find(item => item.id === val.source)?.name));
        })

        const primaryTerms = [];
        let cache;
        for (const term of terms) {
            if(term.operator){
                cache = term;
                continue;
            }

            if (!term.options.requirements) {
                if(cache){
                    primaryTerms.push(cache)
                    cache = undefined;
                }
                primaryTerms.push(term)
            }
        }

        return new SWSERollWrapper(Roll.fromTerms(primaryTerms
            .filter(term => !!term)), []);
    }

    getConditionModifier(operator) {
        let conditionBonus = getInheritableAttribute({
            entity: operator,
            attributeKey: "condition",
            reduce: "FIRST"
        })

        if ("OUT" === conditionBonus || !conditionBonus) {
            conditionBonus = "0";
        }
        return toNumber(conditionBonus);
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
        let attributes = actor.attributes;
        return !attributes ? 0 : attributes[toShortAttribute(attributeName).toLowerCase()].mod;
    }


    get damageRoll() {
        let actor = this.actor
        let item = this.item

        if (!actor || !item) {
            return;
        }

        let terms = [];
        const doubleWeaponDamage = [];
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
                parent: item.parent,
                attributeKey: ["damage", "damageDie"],
                reduce: "SUM"
            })
            //let damageDie = damageDice[damageDice.length - 1];
            const {dice, additionalTerms} = getDiceTermsFromString(damageDice);
            if(additionalTerms){
                doubleWeaponDamage.push(...additionalTerms)
            }
            if(dice){
                terms.push(...dice)
            }
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
            const meleeDamageAbilityModifier = this.getMeleeDamageAbilityModifier(actor, item);
            terms.push(...meleeDamageAbilityModifier)
        }

        let weaponTypes = getPossibleProficiencies(actor, item);
        terms.push(...getSpecializationDamageBonuses(actor, weaponTypes));
        //actorData.


        terms = terms
            .filter(term => !!term);

        terms = terms.length > 0 ? terms : [new foundry.dice.terms.NumericTerm({number: 0})]
        let roll = Roll.fromTerms(terms);

        let bonusDamageDice = getInheritableAttribute({
            entity: item,
            attributeKey: "bonusDamageDie",
            reduce: "SUM"
        })
        roll.alter(1, toNumber(bonusDamageDice));

        return new SWSERollWrapper(roll, doubleWeaponDamage);
    }

    getMeleeDamageAbilityModifier(actor, item) {
        let abilityMod = parseInt(actor.system.attributes.str.mod);
        let isTwoHanded = this.hands === 2 || compareSizes(getSize(actor), getSize(item)) === 1;
        let isMySize = compareSizes(getSize(actor), getSize(item)) === 0;

        if (isMySize) {
            let grips = getInheritableAttribute({
                entity: item,
                attributeKey: "grip",
                reduce: "VALUES"
            })

            if (grips.includes("two handed")) {
                isTwoHanded = true;
            }
            if (abilityMod < 1) {
                isTwoHanded = false;
            }
        }

        if (isLightsaber(item)) {
            let abilitySelect = getInheritableAttribute({
                entity: actor,
                attributeKey: "lightsabersDamageStat",
                reduce: "VALUES"
            })[0]
            if (abilitySelect) {
                abilitySelect = abilitySelect.toLowerCase();
                const abilities = ["str", "dex", "con", "int", "wis", "cha"];
                if (abilities.includes(abilitySelect)) {
                    let replaceAbilityMod = parseInt(actor.system.attributes[`${abilitySelect}`].mod);
                    abilityMod = replaceAbilityMod > abilityMod ? replaceAbilityMod : abilityMod;
                }
            }
        }

        return appendNumericTerm(isTwoHanded ? Math.max(abilityMod * 2, abilityMod) : abilityMod, "Attribute Modifier");
    }

    getHandednessModifier() {
        const compare = compareSizes(getSize(this.actor), getSize(this.item));
        let isTwoHanded = compare === 1;
        let isMySize = compare === 0;

        let rollModifier = RollModifier.createRadio("hands", "Handedness", this.item.id);

        if(!isTwoHanded){
            const rollModifierChoice = new RollModifierChoice(`1 Hand`, 1, !isTwoHanded && !isMySize);
            rollModifierChoice.icon = "fa-hand";
            rollModifier.addChoice(rollModifierChoice);

        }

        if(isTwoHanded || isMySize){
            const rollModifierChoice1 = new RollModifierChoice(`2 Hand`, 2, isTwoHanded || isMySize);
            rollModifierChoice1.icon = "fa-hands";
            rollModifier.addChoice(rollModifierChoice1);
        }

        return rollModifier.hasChoices() ? [rollModifier] : [];
    }

    get rangeDamageModifiers(){
        const modifiers = getInheritableAttribute({
            entity: [this.item, this.operator],
            attributeKey: "bonusDamage",
            parent: !!this.parent ? this.parent : this.operator,
            itemFilter: ((item) => item.type !== 'weapon')
        });
        return this.filterBonusesByType(modifiers, "range");
    }

    get rangeAttackModifiers(){
        const modifiers = getInheritableAttribute({
            entity: [this.item, this.operator],
            attributeKey: "toHitModifier",
            parent: !!this.parent ? this.parent : this.operator,
            itemFilter: ((item) => item.type !== 'weapon')
        });
        return this.filterBonusesByType(modifiers, "range");
    }

    filterBonusesByType(modifiers, range) {
        const response = [];
        modifiers.forEach(modifier => {
            if (typeof modifier.value === "string") {
                const toks = modifier.value.split(":")
                if (toks.length > 2 && toks[1].toLowerCase() === range) {
                    response.push({type: toks[2].toLowerCase(), bonus: parseInt(toks[0])})
                }
            }
        })
        return response;
    }

    getRangeModifierBlock() {
        let range = this.effectiveRange;
        const accurate =this.isAccurate;
        const inaccurate = this.isInaccurate
        const defaultRange = this.defaultRange
        const damageModifiers = this.rangeDamageModifiers
        const attackModifiers = this.rangeAttackModifiers

        let rollModifier = RollModifier.createOption(["attack", "damage"], "Range Modifier");

        for (let [rangeName, rangeIncrement] of Object.entries(SWSE.Combat.range[range] || {})) {
            let rangePenalty = SWSE.Combat.rangePenalty[rangeName];
            if (accurate && rangeName === 'short') {
                rangePenalty = 0;
            }
            if (inaccurate && rangeName === 'long') {
                continue;
            }
            const damageBonus = damageModifiers.filter(modifier=>modifier.type === rangeName).map(modifier => modifier.bonus).reduce((a,b) => a + b, 0);
            const attackBonus = attackModifiers.filter(modifier=>modifier.type === rangeName).map(modifier => modifier.bonus).reduce((a,b) => a + b, 0) + rangePenalty;

            const display = `${rangeName.titleCase()}, ${rangeIncrement.string.titleCase()}, ${rangePenalty}`;
            const value = {attack: attackBonus === 0 ? "+0" : attackBonus, damage: damageBonus};
            rollModifier.addChoice(new RollModifierChoice(display, value, rangeName === defaultRange));
        }

        return rollModifier.hasChoices() ? [rollModifier] : [];
    }

    get effectiveRange() {
        let range = this.range;
        if (range === 'Grenades') {
            range = 'Thrown Weapons'
        }

        //For now, standardize 'treated as' groups
        for (let rangedGroup of weaponGroup["Ranged Weapons"]) {
            if (rangedGroup.includes(range)) {
                range = rangedGroup;
                break;
            }
        }
        return range;
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
        const itemData = this.item;
        const provider = this.provider;
        const operator = this.operator;
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

        if (!!provider && provider.name !== operator.name) {
            notes.push({value: `Weapon Emplacement on ${provider.name} operated by ${operator.name + (operator instanceof SWSEActor ? "" : " Crewman")}`})
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
        let bonus = getInheritableAttribute({
            entity: this.item,
            attributeKey: 'criticalMultiplierBonus',
            reduce: "SUM"
        });

        return 2 + bonus
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
        modes = modes.filter(mode => !!mode && mode.type !== "dynamic")

        // modes.forEach(mode => {if(!mode.uuid){
        //     mode.uuid = generateUUID(this.actorId, this.itemId, mode._id)
        // }})
        return modes;
    }



    get defaultRange() {
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
        const modifiers = this.modifierOptions;

        //modifiers.sort((a,b) => a.modifierType )

        return modifiers.map(m => m.HTMLBlock)


        // let attackLabel = document.createElement("label");
        // attackLabel.innerText = "Attack Modifier:";
        // modifiers.push(attackLabel);
        //
        // //modifiers.push(...)
        // let attackInput =
        // modifiers.push(attackInput);
        //
        // modifiers.push(document.createElement("br"))
        //
        // let damageLabel = document.createElement("label");
        // damageLabel.innerText = "Damage Modifier:";
        // modifiers.push(damageLabel);
        //
        //
        // let damageInput = document.createElement("input");
        // damageInput.dataset.source = "Miscellaneous"
        // damageInput.classList.add("damage-modifier", "suppress-propagation")
        // modifiers.push(damageInput);
        //
        // return modifiers;
    }

    /**
     *
     * @returns {RollModifier[]}
     */
    get modifierOptions() {
        let modifiers = [];
        modifiers.push(...this.getHandednessModifier())
        modifiers.push(...this.getRangeModifierBlock());
        modifiers.push(RollModifier.createTextModifier("attack", "Miscellaneous Attack Bonus"));
        modifiers.push(RollModifier.createTextModifier("damage", "Miscellaneous Damage Bonus"));
        return modifiers
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
        let num = roll.total
        return num < defense;
    }

    get ammunition() {
        return this.item.ammunition;
    }

    get hasAmmunition() {
        return this.item.hasAmmunition;
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
        return Attack.create(this)
    }

    checkExistingDynamicModes(existingModes, newMode) {
        const found = existingModes.find(existingMode => existingMode.modePath === newMode.modePath)
        if (found) {
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
            let cannotUseTwoHands = getInheritableAttribute({
                entity: this.item,
                attributeKey: "isLightWeapon",
                reduce: "OR"
            })
            if (isMySize && !cannotUseTwoHands) {
                const handedness = [this.checkExistingDynamicModes(existingDynamicModes, {
                    name: "One-Handed Grip",
                    attributes: {0: {key: "grip", value: "one handed"}},
                    modePath: "One-Handed Grip",
                    group: "grip",
                    type: "dynamic"
                }),
                    this.checkExistingDynamicModes(existingDynamicModes, {
                        name: "Two-Handed Grip",
                        attributes: {0: {key: "grip", value: "two handed"}},
                        modePath: "Two-Handed Grip",
                        group: "grip",
                        type: "dynamic"
                    })];

                if (!handedness[1].isActive) {
                    handedness[0].isActive = true
                }

                dynamics.push(...handedness)
            }
            //terms.push(...appendNumericTerm(isTwoHanded ? strMod * 2 : strMod, "Attribute Modifier"))
        }
        return dynamics;
    }

get summary(){
        return {attributes:[{key:"value", value:this.toJSONString}, {key:"data-item-id", value: this.weaponId}], value:this.toJSONString, item:this.weaponId, name:this.name}
}
    attackOption(attack, id) {
        let attackString = attack.toJSONString
        return `<option id="${id}" data-item-id="${attack.itemId}" value="${attackString}" data-attack="${attackString}">${attack.name}</option>`;
    }
    // attackOption(attack, id) {
    //     let attackString = attack.toJSONString
    //     return `<option id="${id}" data-item-id="${attack.itemId}" value="${attackString}" data-attack="${attackString}">${attack.name}</option>`;
    // }

    getPossibleAttacksFromAttacks(existingWeaponNames, doubleAttack, tripleAttack) {
        const item = this.item;
        if (!item) {
            return [];
        }

        let resolvedAttacks = [];
        let quantity = item.system.quantity || 1
        for (let i = 0; i < quantity; i++) {
            let duplicateCount = existingWeaponNames.filter(name => name === this.name).length;
            if (duplicateCount > 0) {
                this.options.duplicateCount = duplicateCount;
            }
            existingWeaponNames.push(this.name)

            let clonedAttack = this.clone();
            if (item.type === "beastAttack") {
                clonedAttack.options.beastAttack = true;
            } else {
                clonedAttack.options.standardAttack = true;
            }
            resolvedAttacks.push(clonedAttack)

            for (let j = 1; j <= this.additionalDamageDice.length; j++) {
                let clonedAttack = this.clone();
                clonedAttack.options.additionalAttack = j;
                clonedAttack.options.standardAttack = true;
                resolvedAttacks.push(clonedAttack)
            }

            const subtype = item.system.subtype;
            if (doubleAttack.includes(subtype)) {
                let clonedAttack = this.clone();
                clonedAttack.options.doubleAttack = true;
                resolvedAttacks.push(clonedAttack)
            }

            if (tripleAttack.includes(subtype)) {
                let clonedAttack = this.clone();
                clonedAttack.options.tripleAttack = true;
                resolvedAttacks.push(clonedAttack)
            }
        }
        return resolvedAttacks;
    }



}


function getActor(actorId) {
    if (!actorId) {
        return;
    }
    let find = getDocumentByUuid(actorId);
    if (!find) {
        find = getEntityFromCompendiums("Actor", actorId)
    }
    return find;
}

function getItemStripping(item, key) {
    if (item && item.system.stripping) {
        return item.system.stripping[key];
    }
    return undefined;
}

//TODO probably don't need to export this, but right now the tests are in the wrong file

/**
 * @param dieString String
 * @returns {{additionalTerms: *[], dice: *[]}}
 */
export function getDiceTermsFromString(dieString) {
    const additionalTerms = []
    const dice = [];
    if (!dieString) {
        return {dice, additionalTerms};
    }
    dieString = `${dieString}`
    let dieTerms = dieString
        .replace(/ /g, "")
        .replace(/-/g, " - ")
        .replace(/\+/g, " + ")
        .replace(/x/g, " x ")
        .split(/ /g)

    let lastOperator = "";
    for (let dieTerm of dieTerms) {
        if (dieTerm === "0") {
            dice.push(new foundry.dice.terms.NumericTerm({number: 0}));
        } else if (!isNaN(dieTerm)) {
            if (lastOperator === "x") {
                dice.push(new foundry.dice.terms.NumericTerm({number: toNumber(dieTerm), options: {flavor: "multiplier"}}));
            } else {
                dice.push(new foundry.dice.terms.NumericTerm({number: toNumber(dieTerm)}));
            }
            lastOperator = "";
        } else if (dieTerm === "+") {
            dice.push(plus())
            lastOperator = "+"
        } else if (dieTerm === "-") {
            dice.push(minus())
            lastOperator = "-"
        } else if (dieTerm === "x") {
            dice.push(mult())
            lastOperator = "x"
        } else {
            let diceTokens = dieTerm.split("/");
            diceTokens.forEach((token, i) => {
                let toks = token.split("d")
                const die = new foundry.dice.terms.Die({number: parseInt(toks[0]), faces: parseInt(toks[1])});
                if(i === 0){
                    dice.push(die);
                } else {
                    additionalTerms.push(die);
                }
            })
        }
    }

    return {dice, additionalTerms: additionalTerms || []};
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
    return getDiceTermsFromString(damageDie).dice;
}
