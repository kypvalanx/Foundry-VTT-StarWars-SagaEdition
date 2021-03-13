const sizeArray = ["Colossal", "Gargantuan", "Huge", "Large", "Medium", "Small", "Tiny", "Diminutive", "Fine"];

export class AttackHandler {
    dieSize = ["1d3", "1d4","1d6","1d8","1d10","1d12"];
    async generateAttacks(actor) {
        actor.data.data.attacks = [];
        actor.data.data.attacks.push(...this.generateUnarmedAttacks(actor.data.equipped, actor));
        for (const weapon of actor.data.equipped) {
            actor.data.data.attacks.push(...this.generateAttacksFromWeapon(weapon, actor));
        }
        actor.resolvedAttacks = new Map();
        let i = 0;
        for(let attack of actor.data.data.attacks){
            attack.id = i++;
            actor.resolvedAttacks.set(`${actor.data._id} ${attack.name}`, attack);
        }
    }

    generateAttacksFromWeapon(itemData, actor) {
        let actorData = actor.data;
        let actorSize = this.getActorSize(actorData);
        if (this.compareSizes(actorSize, itemData.data.finalSize) > 1) {
            return [];
        }
        let attacks = [];

        let weapon = itemData.data.weapon;
        if (weapon) {
            let proficiencies = actorData.proficiency.weapon;
            let weaponCategories = this.getWeaponCategories(itemData);
            let isProficient = this.isProficient(proficiencies, weaponCategories);
            let proficiencyBonus = isProficient ? 0 : -5;
            let isRanged = this.isRanged(itemData);
            let hasWeaponFinesse = actorData.prerequisites.feats.includes("weapon finesse");
            let isFocus = this.isFocus(actorData.proficiency.focus, weaponCategories);
            let isOneHanded = this.compareSizes(actorSize, itemData.data.finalSize) === 0;
            let isLight = (this.compareSizes(actorSize, itemData.data.finalSize) < 0) || (isOneHanded && isFocus) || (this.isLightsaber(itemData));
            let isTwoHanded = this.compareSizes(actorSize, itemData.data.finalSize) === 1;

            let offense = actorData.data.offense;
            let meleeToHit = (hasWeaponFinesse && isLight) ? Math.max(offense.mab, offense.fab) : offense.mab;
            let strBonus = (isTwoHanded ? parseInt(actor._getAttributeMod(actorData, "str")) * 2 : parseInt(actor._getAttributeMod(actorData, "str")));
            let rof = weapon.ratesOfFire;
            let isAutofireOnly = rof ? rof.size === 1 && rof[0].toLowerCase === 'autofire' : false;
            let hasStandardAttack = true;

            if (weapon.stun?.isAvailable) {
                if (weapon.stun.isOnly) {
                    hasStandardAttack = false;
                }
                let dieEquation = weapon.stun.dieEquation ? weapon.stun.dieEquation : weapon.damage.finalDamage;

                let atkBonus = (isRanged ? offense.rab : meleeToHit) + (isFocus ? 1 : 0) + proficiencyBonus + (isAutofireOnly ? -5 : 0);
                let toHit = "1d20" + this._getSign(atkBonus) + this._filterZeros(atkBonus);
                let damageBonus = (actor.getHalfCharacterLevel(actorData) > 0 ? actor.getHalfCharacterLevel(actorData) : 0) + (isRanged ? 0 : strBonus);
                let dam = dieEquation +  this._getSign(damageBonus) + this._filterZeros(damageBonus);
                let modifier = " [STUN" + (isAutofireOnly ? ", AUTOFIRE" : "") + "]";
                attacks.push({name: itemData.name + " " + modifier, th: toHit, dam: dam, sound: "", itemId: itemData._id, actorId: actor.data._id, img: itemData.img});
            }

            if (hasStandardAttack && weapon.damage?.attacks) {
                let dieEquation = weapon.damage.finalDamage;
                if (dieEquation.includes("/")) {
                    dieEquation = dieEquation.split("/");
                } else {
                    dieEquation = [dieEquation];
                }

                let custom = weapon.damage ? weapon.damage.custom : null;
                let damageBonus = actor.getHalfCharacterLevel(actorData) + (isRanged ? 0 : strBonus);
                let dam = [];
                for (let eq of dieEquation) {
                    dam.push(eq + this._getSign(damageBonus) + this._filterZeros(damageBonus));
                }
                if (custom) {
                    dam = [custom];
                }

                let atkBonus = (isRanged ? offense.rab : meleeToHit) + proficiencyBonus + (isFocus ? 1 : 0);
                if (rof) {
                    for (const rate of rof) {
                        let th = this.getToHit(rate, atkBonus, itemData);
                        attacks.push({
                            name: itemData.name + " [" +rate.toUpperCase()+"]",
                            th: th,
                            dam: dam, sound: "", itemId: itemData._id, actorId: actor.data._id, img: itemData.img
                        });
                    }
                } else {
                    if (dam.length === 1) {
                        let th = "1d20" + this._getSign(atkBonus) + this._filterZeros(atkBonus);
                        attacks.push({name: itemData.name, th: th, dam: dam, sound: "", itemId: itemData._id, actorId: actor.data._id, img: itemData.img});
                    } else {
                        let attkRoll = "1d20" + this._getSign(this._multipleAttacks(atkBonus, isProficient, actorData.prerequisites.feats)) + this._filterZeros(this._multipleAttacks(atkBonus, isProficient, actorData.prerequisites.feats));
                        let frAtk = "";
                        let damMap = new Map();
                        for (let da of dam) {
                            if (frAtk !== "") {
                                frAtk = frAtk + ",";
                            }
                            frAtk = frAtk + attkRoll;
                            let th = "1d20" + this._getSign(atkBonus) + this._filterZeros(atkBonus);
                            damMap.set(da, {name: itemData.name, th: th, dam: da, sound: "", itemId: itemData._id, actorId: actor.data._id, img: itemData.img});
                        }
                        attacks.push({name: itemData.name + " [FULL ROUND]", th: frAtk, dam: dam, sound: "", itemId: itemData._id, actorId: actor.data._id, img: itemData.img});
                        attacks.push(...damMap.values())
                    }
                }
            }
        }
        return attacks;
    }

    getToHit(rate, atkBonus, itemData) {
        if (rate.toLowerCase() === 'single-shot') {
            return "1d20" + this._getSign(atkBonus) + this._filterZeros(atkBonus);
        } else if (rate.toLowerCase() === 'autofire') {
            return "1d20" + this._getSign(atkBonus - 5) + this._filterZeros(atkBonus - 5);
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
        for (let ability of actorData.generalAbilities) {
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
        for (let proficiency of proficiencies) {
            if (proficiency === 'simple weapons') {
                result.push(...['simple melee weapons', 'simple ranged weapons']);
                continue;
            }
            result.push(proficiency)
        }
        return result;
    }

    _getSign(atkBonus) {
        if (atkBonus > 0) {
            return "+";
        }
        return "";
    }

    _filterZeros(atkBonus) {
        if (atkBonus === 0) {
            return "";
        }
        return atkBonus;
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
        let actorData = actor.data;
        let size = this.getActorSize(actorData);
        let feats = actor.data.prerequisites.feats;

        let isProficient = this.isProficient(actorData.proficiency.weapon, ["simple melee weapon"]);
        let proficiencyBonus = isProficient ? 0 : -5;
        let isFocus = this.isFocus(actorData.proficiency.focus, ["simple melee weapon"]);
        let hasWeaponFinesse = feats.includes("weapon finesse");
        let damageDie = this.getDamageDieBySize(size);
        if (feats.includes("martial arts iii")) {
            damageDie = this.increaseDamageDie(damageDie);
        }
        if (feats.includes("martial arts ii")) {
            damageDie = this.increaseDamageDie(damageDie);
        }
        if (feats.includes("martial arts i")) {
            damageDie = this.increaseDamageDie(damageDie);
        }

        let atkBonuses = [];
        let bonus = 0;

        for(let equippedWeapon of equippedWeapons){
            if(equippedWeapon.data.weaponAttributes && equippedWeapon.data.weaponAttributes.damage && equippedWeapon.data.weaponAttributes.damage.unarmed){
                bonus = bonus + parseInt(equippedWeapon.data.weaponAttributes.damage.unarmed.damage);
                atkBonuses.push(parseInt(equippedWeapon.data.weaponAttributes.damage.unarmed.damage))
            }
        }

        let offense = actorData.data.offense;

        let meleeToHit = hasWeaponFinesse ? Math.max(offense.mab, offense.fab) : offense.mab;
        let atkBonus = meleeToHit + (isFocus ? 1 : 0) + proficiencyBonus + bonus;
        atkBonuses.push(meleeToHit)
        atkBonuses.push(proficiencyBonus)
        let toHit = "1d20" + this._getSign(atkBonus) + this._filterZeros(atkBonus);
        let damageBonus = actor.getHalfCharacterLevel(actorData) + parseInt(actor._getAttributeMod(actorData, "str"))
        let dam = damageDie +  this._getSign(damageBonus) + this._filterZeros(damageBonus);

        let attacks = [];
        attacks.push({name: "Unarmed Attack" , th: toHit, dam: dam, sound: "", itemId: "unarmed", actorId: actor.data._id});
        return attacks;
    }

    getDamageDieBySize(size) {
        if(size === 'Medium'){
            return "1d4";
        } else if(size === 'Small'){
            return "1d3";
        }

        return undefined;
    }

    increaseDamageDie(damageDie) {
        let dieSize = ["2","3","4","6","8","10","12"];
        let toks = damageDie.split("d");
        let index = dieSize.indexOf(toks[1]);
        if(index === 0){
            index = 1;
        }
        toks[1] = dieSize[index + 1];
        return toks[0] + "d" + toks[1];
    }
}