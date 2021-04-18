import {resolveValueArray} from "../util.mjs";

const sizeArray = ["Colossal", "Gargantuan", "Huge", "Large", "Medium", "Small", "Tiny", "Diminutive", "Fine"];

const d20 = "1d20";

export class AttackHandler {

    async generateAttacks(actor) {
        actor.data.data.attacks = [];
        actor.data.data.attacks.push(...this.generateUnarmedAttacks(actor.data.equipped, actor));
        for (const weapon of actor.data.equipped) {
            actor.data.data.attacks.push(...this.generateAttacksFromWeapon(weapon, actor));
        }
        actor.resolvedAttacks = new Map();
        let i = 0;
        for (let attack of actor.data.data.attacks) {
            attack.id = i++;
            actor.resolvedAttacks.set(`${actor.data._id} ${attack.name}`, attack);
        }
    }

    generateAttacksFromWeapon(item, actor) {
        let actorData = actor.data;
        let itemData = item.data;
        if (!actorData || !itemData) {
            return [];
        }
        let actorSize = this.getActorSize(actorData);
        let weapon = itemData.weapon;
        if (this.isOversized(actorSize, itemData) || !weapon) {
            return [];
        }

        let proficiencies = actorData.proficiency.weapon;
        let weaponCategories = this.getWeaponCategories(item);
        let isProficient = this.isProficient(proficiencies, weaponCategories);
        let proficiencyBonus = isProficient ? 0 : -5;
        let isRanged = this.isRanged(item);
        let hasWeaponFinesse = actorData.prerequisites.feats.includes("weapon finesse");
        let isFocus = this.isFocus(actorData.proficiency.focus, weaponCategories);
        let isOneHanded = this.compareSizes(actorSize, itemData.finalSize) === 0;
        let isLight = (this.compareSizes(actorSize, itemData.finalSize) < 0) || (isOneHanded && isFocus) || (this.isLightsaber(item));
        let isTwoHanded = this.compareSizes(actorSize, itemData.finalSize) === 1;

        let offense = actorData.data.offense;
        let meleeToHit = (hasWeaponFinesse && isLight) ? Math.max(offense.mab, offense.fab) : offense.mab;
        let strMod = parseInt(actor.getAttributeMod("str"));
        let strBonus = isTwoHanded ? strMod * 2 : strMod;
        let rof = weapon.ratesOfFire;
        let isAutofireOnly = rof ? rof.size === 1 && rof[0].toLowerCase === 'autofire' : false;

        let attacks = [];

        let stunAttacks = this.resolveStunAttack(item, actor, isRanged, offense, meleeToHit, isFocus, proficiencyBonus, isAutofireOnly, strBonus);
        attacks = attacks.concat(stunAttacks.attacks);

        if (stunAttacks.isStunOnly || !(weapon.damage?.attacks)) {
            return attacks;
        }

        let dieEquation = weapon.damage.finalDamage;
        if (dieEquation.includes("/")) {
            dieEquation = dieEquation.split("/");
        } else {
            dieEquation = [dieEquation];
        }

        let custom = weapon.damage ? weapon.damage.custom : null;
        let damageBonuses = [];
        damageBonuses.push(actor.getHalfCharacterLevel(actorData))
        damageBonuses.push(isRanged ? 0 : strBonus)

        let damageBonus = resolveValueArray(damageBonuses);
        let dam = [];
        for (let eq of dieEquation) {
            dam.push(eq + this.getBonusString(damageBonus));
        }
        if (custom) {
            dam = [custom];
        }

        let atkBonus = (isRanged ? offense.rab : meleeToHit) + proficiencyBonus + (isFocus ? 1 : 0);

        if (rof) {
            for (const rate of rof) {
                let th = this.getToHit(rate, atkBonus, item);
                attacks.push({
                    name: item.name + " [" + rate.toUpperCase() + "]",
                    th,
                    dam, sound: "", itemId: item._id, actorId: actor.data._id, img: item.img
                });
            }
            return attacks;
        }

        if (dam.length === 1) {
            let th = d20 + this.getBonusString(atkBonus);
            attacks.push({
                name: item.name,
                th,
                dam,
                sound: "",
                itemId: item._id,
                actorId: actor.data._id,
                img: item.img
            });
            return attacks;
        }

        let attkRoll = d20 + this.getBonusString(this._multipleAttacks(atkBonus, isProficient, actorData.prerequisites.feats));
        let frAtk = "";
        let damMap = new Map();
        for (let da of dam) {
            if (frAtk !== "") {
                frAtk = frAtk + ",";
            }
            frAtk = frAtk + attkRoll;
            let th = d20 + this.getBonusString(atkBonus);
            damMap.set(da, {
                name: item.name,
                th: th,
                dam: da,
                sound: "",
                itemId: item._id,
                actorId: actor.data._id,
                img: item.img
            });
        }
        attacks.push({
            name: item.name + " [FULL ROUND]",
            th: frAtk,
            dam,
            sound: "",
            itemId: item._id,
            actorId: actor.data._id,
            img: item.img
        });
        attacks.push(...damMap.values())

        return attacks;
    }

    resolveStunAttack(item, actor, isRanged, offense, meleeToHit, isFocus, proficiencyBonus, isAutofireOnly, strBonus) {
        let isStunOnly = false;
        let attacks = [];

        let weapon = item?.data?.weapon;

        if (weapon?.stun?.isAvailable) {
            if (weapon.stun.isOnly) {
                isStunOnly = true;
            }
            let dieEquation = weapon.stun.dieEquation ? weapon.stun.dieEquation : weapon.damage.finalDamage;

            let atkBonuses = [];
            atkBonuses.push(isRanged ? offense.rab : meleeToHit);
            atkBonuses.push(isFocus ? 1 : 0)
            atkBonuses.push(proficiencyBonus)
            atkBonuses.push(isAutofireOnly ? -5 : 0)

            let th = d20 + this.getBonusString(resolveValueArray(atkBonuses));
            let halfCharacterLevel = actor.getHalfCharacterLevel();

            let dmgBonuses = [];
            dmgBonuses.push(halfCharacterLevel)
            dmgBonuses.push(isRanged ? 0 : strBonus)

            let dam = dieEquation + this.getBonusString(resolveValueArray(dmgBonuses));
            attacks.push({
                name: `${item.name} [STUN${isAutofireOnly ? ", AUTOFIRE" : ""}]`,
                th,
                dam,
                sound: "",
                itemId: item._id,
                actorId: actor.data._id,
                img: item.img
            });
        }

        return {isStunOnly, attacks};
    }

    getBonusString(atkBonus) {
        return (atkBonus > 0 ? `+${atkBonus}` : "");
    }

    isOversized(actorSize, itemData) {
        return this.compareSizes(actorSize, itemData.finalSize) > 1;
    }

    getToHit(rate, atkBonus, itemData) {
        if (rate.toLowerCase() === 'single-shot') {
            return d20 + this.getBonusString(atkBonus);
        } else if (rate.toLowerCase() === 'autofire') {
            return d20 + this.getBonusString(atkBonus - 5);
        } else {
            console.error("UNRECOGNIZED ROF", itemData);
        }
    }

    getWeaponCategories(weapon) {
        let weaponCategories = [weapon.name];
        weaponCategories.push(...weapon.data.categories);
        return weaponCategories;
    }

    isRanged(weapon) {
        for (const category of weapon.data.categories) {
            if (["pistols", "rifles", "exotic ranged weapons", "ranged weapons", "grenades", "heavy weapons", "simple ranged weapons"].includes(category.toLowerCase())) {
                return true;
            }
        }
        return false;
    }

    isLightsaber(weapon) {
        for (const category of weapon.data.categories) {
            if (["lightsabers", "lightsaber"].includes(category.toLowerCase())) {
                return true;
            }
        }
        return false;
    }

    isFocus(focuses, categories) {
        focuses = this.explodeProficiencies(focuses);
        for (const focus of focuses) {
            if (categories.map(cat => cat.toLowerCase()).includes(focus.toLowerCase())) {
                return true;
            }
        }
        return false;
    }

    isProficient(proficiencies, categories) {
        proficiencies = this.explodeProficiencies(proficiencies);
        for (let proficiency of proficiencies) {
            if (categories.map(cat => cat.toLowerCase()).includes(proficiency.toLowerCase())) {
                return true;
            }
        }
        return false;
    }

    getActorSize(actorData) {
        for (let ability of actorData?.generalAbilities ? actorData.generalAbilities : []) {
            if (sizeArray.includes(ability.name)) {
                return ability.name;
            }
        }
        return 'Medium';
    }

    compareSizes(size1, size2) {
        return sizeArray.indexOf(size1) - sizeArray.indexOf(size2);
    }

    explodeProficiencies(proficiencies) {
        let result = [];
        for (let proficiency of proficiencies ? proficiencies : []) {
            if (proficiency === 'simple weapons') {
                result.push(...['simple melee weapons', 'simple ranged weapons']);
                continue;
            }
            result.push(proficiency)
        }
        return result;
    }

    _multipleAttacks(atkBonus, isProficient, feats) {
        if (isProficient) {
            if (feats.includes("dual weapon mastery iii")) {
                return atkBonus;
            }
            if (feats.includes("dual weapon mastery ii")) {
                return atkBonus - 2;
            }
            if (feats.includes("dual weapon mastery i")) {
                return atkBonus - 5;
            }
        }
        return atkBonus - 10;
    }

    generateUnarmedAttacks(equippedWeapons, actor) {
        if (!actor) {
            return [];
        }
        let actorData = actor.data;
        let size = this.getActorSize(actorData);
        let feats = actor?.data?.prerequisites?.feats;
        feats = feats ? feats : [];

        let isProficient = this.isProficient(actorData?.proficiency?.weapon, ["simple melee weapon"]);
        let proficiencyBonus = isProficient ? 0 : -5;
        let isFocus = this.isFocus(actorData?.proficiency?.focus, ["simple melee weapon"]);
        let hasWeaponFinesse = feats.includes("weapon finesse");
        let offense = actorData?.data?.offense;

        let atkBonuses = [];
        atkBonuses.push(hasWeaponFinesse ? Math.max(offense?.mab, offense?.fab) : offense?.mab)
        atkBonuses.push(proficiencyBonus)
        atkBonuses.push(isFocus ? 1 : 0)
        for (let equippedWeapon of equippedWeapons ? equippedWeapons : []) {
            if (equippedWeapon.data.weaponAttributes?.damage?.unarmed) {
                atkBonuses.push(equippedWeapon.data.weaponAttributes.damage.unarmed.damage);
            }
        }

        let th = d20 + this.getBonusString(resolveValueArray(atkBonuses));

        let damageBonuses = [];
        damageBonuses.push(actor.getHalfCharacterLevel(actorData))
        damageBonuses.push(actor.getAttributeMod("str"))

        let dam = this.resolveUnarmedDamageDie(size, feats) + this.getBonusString(resolveValueArray(damageBonuses));

        let attacks = [];
        attacks.push({
            name: "Unarmed Attack",
            th,
            dam,
            sound: "",
            itemId: "unarmed",
            actorId: actor.data._id
        });
        return attacks;
    }

    resolveUnarmedDamageDie(size, feats) {
        //TODO make this a property of the feats
        let damageDie = this.getDamageDieSizeByCharacterSize(size);
        if (feats.includes("martial arts iii")) {
            damageDie = this.increaseDamageDie(damageDie);
        }
        if (feats.includes("martial arts ii")) {
            damageDie = this.increaseDamageDie(damageDie);
        }
        if (feats.includes("martial arts i")) {
            damageDie = this.increaseDamageDie(damageDie);
        }
        return `1d${damageDie}`;
    }

    getDamageDieSizeByCharacterSize(size) {
        //TODO make this a property of the ability object
        if (size === 'Medium') {
            return 4;
        } else if (size === 'Small') {
            return 3;
        }
        return undefined;
    }

    increaseDamageDie(damageDieSize) {
        let dieSize = [2, 3, 4, 6, 8, 10, 12];
        let index = dieSize.indexOf(damageDieSize);
        return dieSize[index + 1];
    }
}
