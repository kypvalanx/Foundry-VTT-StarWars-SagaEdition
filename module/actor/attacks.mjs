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
        } else {
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
            } else {
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
            }
        }


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

// console.log(new AttackHandler().generateAttacksFromWeapon({
//
// },{
//     data:{}
// }));

let actorData = {
    "_id": "sqx3fSqKp9goZL7q",
    "name": "test actor",
    "permission": {
        "default": 3,
        "3YLIH0KbPBFrWWji": 3
    },
    "type": "character",
    "data": {
        "health": {
            "value": null,
            "min": 0,
            "max": 10,
            "condition": 0,
            "temp": null,
            "dr": null,
            "sr": null,
            "rolledHp": null
        },
        "equippedIds": [
            "NwjZbPexItnhUSvl",
            "W5ahfGSCxmIigHkt"
        ],
        "classesfirst": "YBa3AOVFL8itd14p",
        "abilities": {
            "str": {
                "total": 10,
                "mod": 0,
                "classLevelBonus": 0,
                "speciesBonus": 0,
                "ageBonus": 0,
                "equipmentBonus": 0,
                "buffBonus": 0,
                "customBonus": 0,
                "bonus": 0,
                "base": 18
            },
            "dex": {
                "total": 10,
                "mod": 0,
                "classLevelBonus": 0,
                "speciesBonus": 0,
                "ageBonus": 0,
                "equipmentBonus": 0,
                "buffBonus": 0,
                "customBonus": 0,
                "bonus": 0,
                "base": 8
            },
            "con": {
                "total": 10,
                "mod": 0,
                "classLevelBonus": 0,
                "speciesBonus": 0,
                "ageBonus": 0,
                "equipmentBonus": 0,
                "buffBonus": 0,
                "customBonus": 0,
                "bonus": 0,
                "base": 8
            },
            "int": {
                "total": 10,
                "mod": 0,
                "classLevelBonus": 0,
                "speciesBonus": 0,
                "ageBonus": 0,
                "equipmentBonus": 0,
                "buffBonus": 0,
                "customBonus": 0,
                "bonus": 0,
                "base": 8
            },
            "wis": {
                "total": 10,
                "mod": 0,
                "classLevelBonus": 0,
                "speciesBonus": 0,
                "ageBonus": 0,
                "equipmentBonus": 0,
                "buffBonus": 0,
                "customBonus": 0,
                "bonus": 0,
                "base": 8
            },
            "cha": {
                "total": 10,
                "mod": 0,
                "classLevelBonus": 0,
                "speciesBonus": 0,
                "ageBonus": 0,
                "equipmentBonus": 0,
                "buffBonus": 0,
                "customBonus": 0,
                "bonus": 0,
                "base": 11
            }
        },
        "skills": {
            "acrobatics": {
                "value": 0,
                "ability": "dex",
                "uut": true,
                "trained": false,
                "acp": true,
                "link": "https://swse.fandom.com/wiki/acrobatics"
            },
            "climb": {
                "value": 0,
                "ability": "str",
                "uut": true,
                "trained": false,
                "acp": true,
                "link": "https://swse.fandom.com/wiki/climb"
            },
            "deception": {
                "value": 0,
                "ability": "cha",
                "uut": true,
                "trained": false,
                "acp": false,
                "link": "https://swse.fandom.com/wiki/deception"
            },
            "endurance": {
                "value": 0,
                "ability": "con",
                "uut": true,
                "trained": false,
                "acp": true,
                "link": "https://swse.fandom.com/wiki/endurance"
            },
            "gather information": {
                "value": 0,
                "ability": "cha",
                "uut": true,
                "trained": false,
                "acp": false,
                "link": "https://swse.fandom.com/wiki/gather_information"
            },
            "initiative": {
                "value": 0,
                "ability": "dex",
                "uut": true,
                "trained": false,
                "acp": true,
                "link": "https://swse.fandom.com/wiki/initiative"
            },
            "jump": {
                "value": 0,
                "ability": "str",
                "uut": true,
                "trained": false,
                "acp": true,
                "link": "https://swse.fandom.com/wiki/jump"
            },
            "knowledge (bureaucracy)": {
                "value": 0,
                "ability": "int",
                "uut": true,
                "trained": false,
                "acp": false,
                "link": "https://swse.fandom.com/wiki/knowledge"
            },
            "knowledge (galactic lore)": {
                "value": 0,
                "ability": "int",
                "uut": true,
                "trained": false,
                "acp": false,
                "link": "https://swse.fandom.com/wiki/knowledge"
            },
            "knowledge (life sciences)": {
                "value": 0,
                "ability": "int",
                "uut": true,
                "trained": false,
                "acp": false,
                "link": "https://swse.fandom.com/wiki/knowledge"
            },
            "knowledge (physical sciences)": {
                "value": 0,
                "ability": "int",
                "uut": true,
                "trained": false,
                "acp": false,
                "link": "https://swse.fandom.com/wiki/knowledge"
            },
            "knowledge (social sciences)": {
                "value": 0,
                "ability": "int",
                "uut": true,
                "trained": false,
                "acp": false,
                "link": "https://swse.fandom.com/wiki/knowledge"
            },
            "knowledge (tactics)": {
                "value": 0,
                "ability": "int",
                "uut": true,
                "trained": false,
                "acp": false,
                "link": "https://swse.fandom.com/wiki/knowledge"
            },
            "knowledge (technology)": {
                "value": 0,
                "ability": "int",
                "uut": true,
                "trained": false,
                "acp": false,
                "link": "https://swse.fandom.com/wiki/knowledge"
            },
            "mechanics": {
                "value": 0,
                "ability": "int",
                "uut": false,
                "trained": false,
                "acp": false,
                "link": "https://swse.fandom.com/wiki/mechanics"
            },
            "perception": {
                "value": 0,
                "ability": "wis",
                "uut": true,
                "trained": false,
                "acp": false,
                "link": "https://swse.fandom.com/wiki/perception"
            },
            "persuasion": {
                "value": 0,
                "ability": "cha",
                "uut": true,
                "trained": false,
                "acp": false,
                "link": "https://swse.fandom.com/wiki/persuasion"
            },
            "pilot": {
                "value": 0,
                "ability": "dex",
                "uut": true,
                "trained": false,
                "acp": false,
                "link": "https://swse.fandom.com/wiki/pilot"
            },
            "ride": {
                "value": 0,
                "ability": "dex",
                "uut": true,
                "trained": false,
                "acp": false,
                "link": "https://swse.fandom.com/wiki/ride"
            },
            "stealth": {
                "value": 0,
                "ability": "dex",
                "uut": true,
                "trained": false,
                "acp": true,
                "link": "https://swse.fandom.com/wiki/stealth"
            },
            "survival": {
                "value": 0,
                "ability": "wis",
                "uut": true,
                "trained": false,
                "acp": false,
                "link": "https://swse.fandom.com/wiki/survival"
            },
            "swim": {
                "value": 0,
                "ability": "str",
                "uut": true,
                "trained": false,
                "acp": true,
                "link": "https://swse.fandom.com/wiki/swim"
            },
            "treat injury": {
                "value": 0,
                "ability": "wis",
                "uut": true,
                "trained": false,
                "acp": false,
                "link": "https://swse.fandom.com/wiki/treat_injury"
            },
            "use computer": {
                "value": 0,
                "ability": "int",
                "uut": true,
                "trained": false,
                "acp": false,
                "link": "https://swse.fandom.com/wiki/use_computer"
            },
            "use the force": {
                "value": 0,
                "ability": "cha",
                "uut": true,
                "trained": false,
                "acp": false,
                "link": "https://swse.fandom.com/wiki/use_the_force"
            }
        },
        "biography": "",
        "attributes": {
            "level": {
                "value": 1
            }
        },
        "attributeGenerationType": "Roll",
        "levelAttributeBonus": {}
    },
    "sort": 100001,
    "flags": {},
    "token": {
        "flags": {},
        "name": "test actor",
        "displayName": 0,
        "img": "icons/svg/mystery-man.svg",
        "tint": null,
        "width": 1,
        "height": 1,
        "scale": 1,
        "lockRotation": false,
        "rotation": 0,
        "vision": false,
        "dimSight": 0,
        "brightSight": 0,
        "dimLight": 0,
        "brightLight": 0,
        "sightAngle": 360,
        "lightAngle": 360,
        "lightAlpha": 1,
        "lightAnimation": {
            "speed": 5,
            "intensity": 5
        },
        "actorId": "sqx3fSqKp9goZL7q",
        "actorLink": true,
        "disposition": -1,
        "displayBars": 0,
        "bar1": {},
        "bar2": {},
        "randomImg": false
    },
    "items": [
        {
            "_id": "f0iEnRXXt3btE75U",
            "name": "Small",
            "type": "ability",
            "data": {
                "description": "<div class=\"mw-parser-output\">\n <p>As Small creatures, beings gain a +1 size bonus to their&nbsp;<a href=\"https://swse.fandom.com/wiki/Reflex_Defense\" class=\"mw-redirect\" title=\"Reflex Defense\">Reflex Defense</a>&nbsp;and a +5 size bonus on&nbsp;<a href=\"https://swse.fandom.com/wiki/Stealth\" title=\"Stealth\">Stealth</a>&nbsp;checks. However, their lifting and carrying limits are three-quarters of those of <a href=\"https://swse.fandom.com/wiki/Category:Medium\" title=\"Category:Medium\">Medium</a> characters. </p> <!-- \nNewPP limit report\nCached time: 20210128183103\nCache expiry: 1209600\nDynamic content: false\nCPU time usage: 0.003 seconds\nReal time usage: 0.004 seconds\nPreprocessor visited node count: 1/1000000\nPreprocessor generated node count: 0/1000000\nPost‐expand include size: 0/2097152 bytes\nTemplate argument size: 0/2097152 bytes\nHighest expansion depth: 1/40\nExpensive parser function count: 0/100\nUnstrip recursion depth: 0/20\nUnstrip post‐expand size: 0/5000000 bytes\n--> <!--\nTransclusion expansion time report (%,ms,calls,template)\n100.00%    0.000      1 -total\n--> <!-- Saved in parser cache with key prod:swse:pcache:idhash:12866-0!canonical and timestamp 20210128183103 and revision id 38469\n --> \n</div>",
                "attributes": {
                    "sizeModifier": 1,
                    "sneakModifier": 5
                },
                "choices": [],
                "payload": "",
                "categories": [
                    "Species Traits"
                ],
                "supplyingClass": "",
                "supplyingSpecies": "1st-Degree Droid Model",
                "supplyingFeature": "",
                "supplyingFeat": "",
                "isSupplied": true
            },
            "sort": 100000,
            "flags": {},
            "img": "icons/svg/mystery-man.svg",
            "effects": []
        },
        {
            "_id": "AO1S3CdL5xhSh08E",
            "name": "1st-Degree Droid Model",
            "type": "species",
            "data": {
                "description": "<div class=\"mw-parser-output\">\n <p><i>See also: <a href=\"https://swse.fandom.com/wiki/Droids\" title=\"Droids\">Droids</a></i> </p>\n <p>A&nbsp;1st-Degree&nbsp;or&nbsp;Class One Droid&nbsp;is&nbsp;programmed&nbsp;for the mathematical, medical, or physical sciences. Subcategories of the 1st-Degree are&nbsp;medical Droids, biological science Droids, physical science Droids, and mathematics Droids. </p>  \n <h3><span class=\"mw-headline\" id=\"1st-Degree_Droid_Traits\">1st-Degree Droid Traits</span></h3> \n <p>1st-Degree have the following special traits: </p>\n <p><b>Ability Modifiers:</b> All 1st-Degree Droids receive +2 bonuses to both their <a href=\"https://swse.fandom.com/wiki/Intelligence\" title=\"Intelligence\">Intelligence</a> and <a href=\"https://swse.fandom.com/wiki/Wisdom\" title=\"Wisdom\">Wisdom</a> scores, but suffer a -2 penalty to their <a href=\"https://swse.fandom.com/wiki/Strength\" title=\"Strength\">Strength</a> score. </p>\n <p><b>Behavioral Inhibitors:</b> 1st-Degree Droids firstly cannot knowingly harm a sentient creature, unless another creature would be harmed due to inaction. 1st-Degree Droids secondly obey orders from their designated owner (Whether that be an actual owner or themselves). </p>\n <p><b>Droid Traits:</b> All 1st-Degree Droids posses <a href=\"https://swse.fandom.com/wiki/Droid_Traits\" title=\"Droid Traits\">Droid Traits</a>. </p>\n <p><b>Droid Talents:</b> All 1st-Degree Droids can select <a href=\"https://swse.fandom.com/wiki/Droid_Talents\" title=\"Droid Talents\">Droid Talents</a> from the <a href=\"https://swse.fandom.com/wiki/1st-Degree_Droid_Talent_Tree\" title=\"1st-Degree Droid Talent Tree\">1st-Degree Droid Talent Tree</a>. </p> \n <table class=\"wikitable\"> \n  <tbody>\n   <tr> \n    <th>DROID MODEL </th> \n    <th>CHALLENGE LEVEL </th> \n    <th>AVAILABLE FOR PLAYER DROID </th> \n    <th>IMAGE </th>\n   </tr> \n   <tr> \n    <td><a href=\"https://swse.fandom.com/wiki/2-1B_Medical_Droid\" title=\"2-1B Medical Droid\">2-1B Medical Droid</a> </td> \n    <td>CL 0 </td> \n    <td>Yes </td> \n    <td> </td>\n   </tr>\n  </tbody>\n </table> \n <h2><span class=\"mw-headline\" id=\"Additional_1st-Degree_Droids\">Additional 1st-Degree Droids</span></h2> \n <p>The below 1st-Degree Droid Models include all 1st-Degree Droid Models found throughout the&nbsp;<i>Star Wars Saga Edition</i>&nbsp;addons. </p> \n <h3><span class=\"mw-headline\" id=\"Threats_of_the_Galaxy\"><a href=\"https://swse.fandom.com/wiki/Threats_of_the_Galaxy\" class=\"mw-redirect\" title=\"Threats of the Galaxy\">Threats of the Galaxy</a></span></h3> \n <table class=\"wikitable\"> \n  <tbody>\n   <tr> \n    <th>DROID MODEL </th> \n    <th>CHALLENGE LEVEL </th> \n    <th>AVAILABLE FOR PLAYER <p>DROID </p> </th> \n    <th>IMAGE </th>\n   </tr> \n   <tr> \n    <td><a href=\"https://swse.fandom.com/wiki/GH-7_Medical_Droid\" title=\"GH-7 Medical Droid\">GH-7 Medical Droid</a> </td> \n    <td>CL 1 </td> \n    <td>Yes </td> \n    <td> </td>\n   </tr> \n   <tr> \n    <td><a href=\"https://swse.fandom.com/wiki/T0-D_Interrogation_Droid\" title=\"T0-D Interrogation Droid\">T0-D Interrogation Droid</a> </td> \n    <td>CL 4 </td> \n    <td>No </td> \n    <td> </td>\n   </tr>\n  </tbody>\n </table> \n <h3><span class=\"mw-headline\" id=\"Knights_of_the_Old_Republic_Campaign_Guide\"><a href=\"https://swse.fandom.com/wiki/Knights_of_the_Old_Republic_Campaign_Guide\" class=\"mw-redirect\" title=\"Knights of the Old Republic Campaign Guide\">Knights of the Old Republic Campaign Guide</a></span></h3> \n <p>Droids play an important part in any <a href=\"https://swse.fandom.com/wiki/Old_Republic_Campaign\" class=\"mw-redirect\" title=\"Old Republic Campaign\">Old Republic Campaign</a>. Droids are just as prominent during the days of <a href=\"https://swse.fandom.com/wiki/The_Old_Republic\" title=\"The Old Republic\">The Old Republic</a> as they are in later years, and many models are the obvious predecessors of Droids used during the Galactic Civil War. </p> \n <table class=\"wikitable\"> \n  <tbody>\n   <tr> \n    <th>DROID MODEL </th> \n    <th>CHALLENGE LEVEL </th> \n    <th>AVAILABLE FOR PLAYER DROID </th> \n    <th>IMAGE </th>\n   </tr> \n   <tr> \n    <td><a href=\"https://swse.fandom.com/wiki/ET-74_Communications_Droid\" title=\"ET-74 Communications Droid\">ET-74 Communications Droid</a> </td> \n    <td>CL 0 </td> \n    <td>Yes </td> \n    <td> </td>\n   </tr>\n  </tbody>\n </table> \n <h3><span class=\"mw-headline\" id=\"Clone_Wars_Campaign_Guide\"><a href=\"https://swse.fandom.com/wiki/Clone_Wars_Campaign_Guide\" class=\"mw-redirect\" title=\"Clone Wars Campaign Guide\">Clone Wars Campaign Guide</a></span></h3> \n <p>The Clone Wars saw the rapid development of Droid technology, mainly due to the Separatists' heavy reliance on Droid military units. The&nbsp;Droids&nbsp;presented in this chapter are some of the models found in use in nonmilitary capacities. </p> \n <table class=\"wikitable\"> \n  <tbody>\n   <tr> \n    <th>DROID MODEL </th> \n    <th>CHALLENGE LEVEL </th> \n    <th>AVAILABLE FOR PLAYER DROID </th> \n    <th>IMAGE </th>\n   </tr> \n   <tr> \n    <td><a href=\"https://swse.fandom.com/wiki/DD-13_Medical_Assistant_Droid\" title=\"DD-13 Medical Assistant Droid\">DD-13 Medical Assistant Droid</a> </td> \n    <td>CL 1 </td> \n    <td>No </td> \n    <td> </td>\n   </tr> \n   <tr> \n    <td><a href=\"https://swse.fandom.com/wiki/EW-3_Midwife_Droid\" title=\"EW-3 Midwife Droid\">EW-3 Midwife Droid</a> </td> \n    <td>CL 0 </td> \n    <td>Yes </td> \n    <td> </td>\n   </tr> \n   <tr> \n    <td><a href=\"https://swse.fandom.com/wiki/FX-6_Medical_Assistance_Droid\" title=\"FX-6 Medical Assistance Droid\">FX-6 Medical Assistance Droid</a> </td> \n    <td>CL 1 </td> \n    <td>Yes </td> \n    <td> </td>\n   </tr> \n   <tr> \n    <td><a href=\"https://swse.fandom.com/wiki/IM-6_Medical_Droid\" title=\"IM-6 Medical Droid\">IM-6 Medical Droid</a> </td> \n    <td>CL 1 </td> \n    <td>Yes </td> \n    <td> </td>\n   </tr> \n   <tr> \n    <td><a href=\"https://swse.fandom.com/wiki/SP-4_Analysis_Droid\" title=\"SP-4 Analysis Droid\">SP-4 Analysis Droid</a> </td> \n    <td>CL 1 </td> \n    <td>Yes </td> \n    <td> </td>\n   </tr>\n  </tbody>\n </table> \n <h3><span class=\"mw-headline\" id=\"Legacy_Era_Campaign_Guide\"><a href=\"https://swse.fandom.com/wiki/Legacy_Era_Campaign_Guide\" class=\"mw-redirect\" title=\"Legacy Era Campaign Guide\">Legacy Era Campaign Guide</a></span></h3> \n <p>The following&nbsp;Droids&nbsp;are common sights across the galaxy during&nbsp;<a href=\"https://swse.fandom.com/wiki/The_Legacy_Era\" class=\"mw-redirect\" title=\"The Legacy Era\">The Legacy Era</a>. </p> \n <table class=\"wikitable\"> \n  <tbody>\n   <tr> \n    <th>DROID MODEL </th> \n    <th>CHALLENGE LEVEL </th> \n    <th>AVAILABLE FOR PLAYER DROID </th> \n    <th>IMAGE </th>\n   </tr> \n   <tr> \n    <td><a href=\"https://swse.fandom.com/wiki/3Z3_Medical_Droid\" title=\"3Z3 Medical Droid\">3Z3 Medical Droid</a> </td> \n    <td>CL 1 </td> \n    <td>Yes </td> \n    <td> </td>\n   </tr> \n   <tr> \n    <td><a href=\"https://swse.fandom.com/wiki/BL-39_Interrogator_Droid\" title=\"BL-39 Interrogator Droid\">BL-39 Interrogator Droid</a> </td> \n    <td>CL 1 </td> \n    <td>Yes </td> \n    <td> </td>\n   </tr> \n   <tr> \n    <td><a href=\"https://swse.fandom.com/wiki/PI-Series_Medical_Assistant_Droid\" title=\"PI-Series Medical Assistant Droid\">PI-Series Medical Assistant Droid</a> </td> \n    <td>CL 0 </td> \n    <td>No </td> \n    <td> </td>\n   </tr>\n  </tbody>\n </table> \n <h3><span class=\"mw-headline\" id=\"Rebellion_Era_Campaign_Guide\"><a href=\"https://swse.fandom.com/wiki/Rebellion_Era_Campaign_Guide\" class=\"mw-redirect\" title=\"Rebellion Era Campaign Guide\">Rebellion Era Campaign Guide</a></span></h3> \n <p>The most common 1st-Degree Droids are medical models; civilians rarely encounter other types of 1st-Degree Droids. Newer models are very expensive and heavily licensed by the Empire, so most beings do with whatever older models they can keep running. </p> \n <table class=\"wikitable\"> \n  <tbody>\n   <tr> \n    <th>DROID MODEL </th> \n    <th>CHALLENGE LEVEL </th> \n    <th>AVAILABLE FOR PLAYER DROID </th> \n    <th>IMAGE </th>\n   </tr> \n   <tr> \n    <td><a href=\"https://swse.fandom.com/wiki/FX-7_Medical_Droid\" title=\"FX-7 Medical Droid\">FX-7 Medical Droid</a> </td> \n    <td>CL 0 </td> \n    <td>No </td> \n    <td> </td>\n   </tr>\n  </tbody>\n </table> \n <h3><span class=\"mw-headline\" id=\"Galaxy_at_War\"><a href=\"https://swse.fandom.com/wiki/Galaxy_at_War\" class=\"mw-redirect\" title=\"Galaxy at War\">Galaxy at War</a></span></h3> \n <p>Although soldiers are loath to admit it, Droids can be invaluable assets in battle, whether as support or as front-line combatants. Even in eras when Droids are less common or distrusted- such as <a href=\"https://swse.fandom.com/wiki/The_Dark_Times\" class=\"mw-redirect\" title=\"The Dark Times\">The Dark Times</a>- they are still utilized in some fashion. </p> \n <table class=\"wikitable\"> \n  <tbody>\n   <tr> \n    <th>DROID MODEL </th> \n    <th>CHALLENGE LEVEL </th> \n    <th>AVAILABLE FOR PLAYER DROID </th> \n    <th>IMAGE </th>\n   </tr> \n   <tr> \n    <td><a href=\"https://swse.fandom.com/wiki/A-Series_Medical_Droid\" title=\"A-Series Medical Droid\">A-Series Medical Droid</a> </td> \n    <td>CL 1 </td> \n    <td>Yes </td> \n    <td> </td>\n   </tr>\n  </tbody>\n </table> \n <h3><span id=\"Scavenger's_Guide_to_Droids\"></span><span class=\"mw-headline\" id=\"Scavenger.27s_Guide_to_Droids\"><a href=\"https://swse.fandom.com/wiki/Scavenger%27s_Guide_to_Droids\" class=\"mw-redirect\" title=\"Scavenger's Guide to Droids\">Scavenger's Guide to Droids</a></span></h3> \n <table class=\"wikitable\"> \n  <tbody>\n   <tr> \n    <th>DROID MODEL </th> \n    <th>CHALLENGE LEVEL </th> \n    <th>AVAILABLE FOR PLAYER DROID </th> \n    <th>IMAGE </th>\n   </tr> \n   <tr> \n    <td><a href=\"https://swse.fandom.com/wiki/88-Series_Administration_Droid\" title=\"88-Series Administration Droid\">88-Series Administration Droid</a> </td> \n    <td>CL 5 </td> \n    <td>Yes </td> \n    <td> </td>\n   </tr> \n   <tr> \n    <td><a href=\"https://swse.fandom.com/wiki/A9G-Series_Archive_Droid\" title=\"A9G-Series Archive Droid\">A9G-Series Archive Droid</a> </td> \n    <td>CL 0 </td> \n    <td>Yes </td> \n    <td> </td>\n   </tr> \n   <tr> \n    <td><a href=\"https://swse.fandom.com/wiki/AD-Series_Weapons_Maintenance_Droid\" title=\"AD-Series Weapons Maintenance Droid\">AD-Series Weapons Maintenance Droid</a> </td> \n    <td>CL 1 </td> \n    <td>Yes </td> \n    <td> </td>\n   </tr> \n   <tr> \n    <td><a href=\"https://swse.fandom.com/wiki/MEV-Series_Medical_Evacuation_Droid\" title=\"MEV-Series Medical Evacuation Droid\">MEV-Series Medical Evacuation Droid</a> </td> \n    <td>CL 1 </td> \n    <td>Yes </td> \n    <td> </td>\n   </tr>\n  </tbody>\n </table> \n <h3><span class=\"mw-headline\" id=\"Galaxy_of_Intrigue\"><a href=\"https://swse.fandom.com/wiki/Galaxy_of_Intrigue\" class=\"mw-redirect\" title=\"Galaxy of Intrigue\">Galaxy of Intrigue</a></span></h3> \n <table class=\"wikitable\"> \n  <tbody>\n   <tr> \n    <th>DROID MODEL </th> \n    <th>CHALLENGE LEVEL </th> \n    <th>AVAILABLE FOR PLAYER DROID </th> \n    <th>IMAGE </th>\n   </tr> \n   <tr> \n    <td><a href=\"https://swse.fandom.com/wiki/5-BT_Threat_Analysis_Droid\" title=\"5-BT Threat Analysis Droid\">5-BT Threat Analysis Droid</a> </td> \n    <td>CL 1 </td> \n    <td>Yes </td> \n    <td><i>Image Unavailable</i> </td>\n   </tr>\n  </tbody>\n </table> \n <h3><span class=\"mw-headline\" id=\"Unknown_Regions\"><a href=\"https://swse.fandom.com/wiki/Unknown_Regions\" class=\"mw-redirect\" title=\"Unknown Regions\">Unknown Regions</a></span></h3> \n <table class=\"wikitable\"> \n  <tbody>\n   <tr> \n    <th>DROID MODEL </th> \n    <th>CHALLENGE LEVEL </th> \n    <th>AVAILABLE FOR PLAYER DROID </th> \n    <th>IMAGE </th>\n   </tr> \n   <tr> \n    <td><a href=\"https://swse.fandom.com/wiki/WED-20_Treadwell\" title=\"WED-20 Treadwell\">WED-20 Treadwell</a> </td> \n    <td>CL 0 </td> \n    <td>Yes </td> \n    <td> </td>\n   </tr>\n  </tbody>\n </table> <!-- \nNewPP limit report\nCached time: 20210203123854\nCache expiry: 1209600\nDynamic content: false\nCPU time usage: 0.046 seconds\nReal time usage: 0.060 seconds\nPreprocessor visited node count: 81/1000000\nPreprocessor generated node count: 0/1000000\nPost‐expand include size: 0/2097152 bytes\nTemplate argument size: 0/2097152 bytes\nHighest expansion depth: 2/40\nExpensive parser function count: 0/100\nUnstrip recursion depth: 0/20\nUnstrip post‐expand size: 0/5000000 bytes\n--> <!--\nTransclusion expansion time report (%,ms,calls,template)\n100.00%    0.000      1 -total\n--> <!-- Saved in parser cache with key prod:swse:pcache:idhash:5003-0!canonical and timestamp 20210203123854 and revision id 50851\n --> \n</div>",
                "attributes": {},
                "choices": [
                    {
                        "options": {
                            "Small": {
                                "abilities": [
                                    "Small"
                                ],
                                "items": []
                            },
                            "Medium": {
                                "abilities": [
                                    "Medium"
                                ],
                                "items": []
                            }
                        },
                        "description": "Select the size of your droid's chassis:"
                    }
                ],
                "payload": "",
                "categories": [],
                "ages": {},
                "statBonuses": {
                    "all": {
                        "strength": -2,
                        "intelligence": 2,
                        "wisdom": 2
                    }
                }
            },
            "sort": 200000,
            "flags": {
                "core": {
                    "sourceId": "Compendium.world.swse-species.UjWPTwL0MVZ6zLIV"
                }
            },
            "img": "systems/swse/icon/species/2-1B Medical Droid.jpg",
            "effects": []
        },
        {
            "_id": "LKBapq5fsCwYEonW",
            "name": "Toughness",
            "type": "feat",
            "data": {
                "description": "<div class=\"mw-parser-output\">\n <p><i>See also: <a href=\"https://swse.fandom.com/wiki/Feats\" title=\"Feats\">Feats</a></i> </p>\n <p>You are tougher than normal. </p>\n <p><b>Effect:</b> You gain +1 Hit Point per Character Level. </p> <!-- \nNewPP limit report\nCached time: 20210130073225\nCache expiry: 1209600\nDynamic content: false\nCPU time usage: 0.003 seconds\nReal time usage: 0.004 seconds\nPreprocessor visited node count: 1/1000000\nPreprocessor generated node count: 0/1000000\nPost‐expand include size: 0/2097152 bytes\nTemplate argument size: 0/2097152 bytes\nHighest expansion depth: 1/40\nExpensive parser function count: 0/100\nUnstrip recursion depth: 0/20\nUnstrip post‐expand size: 0/5000000 bytes\n--> <!--\nTransclusion expansion time report (%,ms,calls,template)\n100.00%    0.000      1 -total\n--> <!-- Saved in parser cache with key prod:swse:pcache:idhash:2215-0!canonical and timestamp 20210130073225 and revision id 46037\n --> \n</div>",
                "attributes": {
                    "fortDefenceBonus": {
                        "dtype": "String",
                        "value": ""
                    },
                    "refDefenceBonus": {
                        "dtype": "String",
                        "value": ""
                    },
                    "hitPointEq": {
                        "dtype": "String",
                        "value": "@charLevel"
                    }
                },
                "choices": [],
                "payload": "",
                "prerequisites": [],
                "categories": [
                    "Feats"
                ],
                "supplyingClass": "",
                "supplyingSpecies": "",
                "supplyingFeature": "",
                "supplyingFeat": "",
                "isSupplied": false
            },
            "sort": 300000,
            "flags": {
                "core": {
                    "sourceId": "Compendium.world.swse-feats.1VQSTSOLpGnZUvoW"
                }
            },
            "img": "icons/svg/mystery-man.svg",
            "effects": []
        },
        {
            "_id": "Ldbg82n8nvEwT0H1",
            "name": "Bonus Feat",
            "type": "ability",
            "data": {
                "description": "<div class=\"mw-parser-output\">\n <p>Beings gain one bonus&nbsp;<a href=\"https://swse.fandom.com/wiki/Feat\" class=\"mw-redirect\" title=\"Feat\">Feat</a>&nbsp;at 1st level. </p> <!-- \nNewPP limit report\nCached time: 20210117210515\nCache expiry: 1209600\nDynamic content: false\nCPU time usage: 0.002 seconds\nReal time usage: 0.002 seconds\nPreprocessor visited node count: 1/1000000\nPreprocessor generated node count: 0/1000000\nPost‐expand include size: 0/2097152 bytes\nTemplate argument size: 0/2097152 bytes\nHighest expansion depth: 1/40\nExpensive parser function count: 0/100\nUnstrip recursion depth: 0/20\nUnstrip post‐expand size: 0/5000000 bytes\n--> <!--\nTransclusion expansion time report (%,ms,calls,template)\n100.00%    0.000      1 -total\n--> <!-- Saved in parser cache with key prod:swse:pcache:idhash:12657-0!canonical and timestamp 20210117210515 and revision id 38458\n --> \n</div>",
                "attributes": {},
                "choices": [],
                "payload": "Armor Proficiency (Light)",
                "categories": [
                    "Species Traits"
                ],
                "supplyingClass": "Soldier",
                "supplyingSpecies": "",
                "supplyingFeature": "",
                "supplyingFeat": "",
                "isSupplied": true
            },
            "sort": 400000,
            "flags": {},
            "img": "icons/svg/mystery-man.svg",
            "effects": []
        },
        {
            "_id": "5RhtXRLQ2HTp10Zb",
            "name": "Bonus Feat",
            "type": "ability",
            "data": {
                "description": "<div class=\"mw-parser-output\">\n <p>Beings gain one bonus&nbsp;<a href=\"https://swse.fandom.com/wiki/Feat\" class=\"mw-redirect\" title=\"Feat\">Feat</a>&nbsp;at 1st level. </p> <!-- \nNewPP limit report\nCached time: 20210117210515\nCache expiry: 1209600\nDynamic content: false\nCPU time usage: 0.002 seconds\nReal time usage: 0.002 seconds\nPreprocessor visited node count: 1/1000000\nPreprocessor generated node count: 0/1000000\nPost‐expand include size: 0/2097152 bytes\nTemplate argument size: 0/2097152 bytes\nHighest expansion depth: 1/40\nExpensive parser function count: 0/100\nUnstrip recursion depth: 0/20\nUnstrip post‐expand size: 0/5000000 bytes\n--> <!--\nTransclusion expansion time report (%,ms,calls,template)\n100.00%    0.000      1 -total\n--> <!-- Saved in parser cache with key prod:swse:pcache:idhash:12657-0!canonical and timestamp 20210117210515 and revision id 38458\n --> \n</div>",
                "attributes": {},
                "choices": [],
                "payload": "Armor Proficiency (Medium)",
                "categories": [
                    "Species Traits"
                ],
                "supplyingClass": "Soldier",
                "supplyingSpecies": "",
                "supplyingFeature": "",
                "supplyingFeat": "",
                "isSupplied": true
            },
            "sort": 500000,
            "flags": {},
            "img": "icons/svg/mystery-man.svg",
            "effects": []
        },
        {
            "_id": "AgG6X5mVMlWqVaXf",
            "name": "Bonus Feat",
            "type": "ability",
            "data": {
                "description": "<div class=\"mw-parser-output\">\n <p>Beings gain one bonus&nbsp;<a href=\"https://swse.fandom.com/wiki/Feat\" class=\"mw-redirect\" title=\"Feat\">Feat</a>&nbsp;at 1st level. </p> <!-- \nNewPP limit report\nCached time: 20210117210515\nCache expiry: 1209600\nDynamic content: false\nCPU time usage: 0.002 seconds\nReal time usage: 0.002 seconds\nPreprocessor visited node count: 1/1000000\nPreprocessor generated node count: 0/1000000\nPost‐expand include size: 0/2097152 bytes\nTemplate argument size: 0/2097152 bytes\nHighest expansion depth: 1/40\nExpensive parser function count: 0/100\nUnstrip recursion depth: 0/20\nUnstrip post‐expand size: 0/5000000 bytes\n--> <!--\nTransclusion expansion time report (%,ms,calls,template)\n100.00%    0.000      1 -total\n--> <!-- Saved in parser cache with key prod:swse:pcache:idhash:12657-0!canonical and timestamp 20210117210515 and revision id 38458\n --> \n</div>",
                "attributes": {},
                "choices": [],
                "payload": "Weapon Proficiency (Pistols)",
                "categories": [
                    "Species Traits"
                ],
                "supplyingClass": "Soldier",
                "supplyingSpecies": "",
                "supplyingFeature": "",
                "supplyingFeat": "",
                "isSupplied": true
            },
            "sort": 600000,
            "flags": {},
            "img": "icons/svg/mystery-man.svg",
            "effects": []
        },
        {
            "_id": "cs9ulsazS1dHkATl",
            "name": "Bonus Feat",
            "type": "ability",
            "data": {
                "description": "<div class=\"mw-parser-output\">\n <p>Beings gain one bonus&nbsp;<a href=\"https://swse.fandom.com/wiki/Feat\" class=\"mw-redirect\" title=\"Feat\">Feat</a>&nbsp;at 1st level. </p> <!-- \nNewPP limit report\nCached time: 20210117210515\nCache expiry: 1209600\nDynamic content: false\nCPU time usage: 0.002 seconds\nReal time usage: 0.002 seconds\nPreprocessor visited node count: 1/1000000\nPreprocessor generated node count: 0/1000000\nPost‐expand include size: 0/2097152 bytes\nTemplate argument size: 0/2097152 bytes\nHighest expansion depth: 1/40\nExpensive parser function count: 0/100\nUnstrip recursion depth: 0/20\nUnstrip post‐expand size: 0/5000000 bytes\n--> <!--\nTransclusion expansion time report (%,ms,calls,template)\n100.00%    0.000      1 -total\n--> <!-- Saved in parser cache with key prod:swse:pcache:idhash:12657-0!canonical and timestamp 20210117210515 and revision id 38458\n --> \n</div>",
                "attributes": {},
                "choices": [],
                "payload": "Weapon Proficiency (Rifles)",
                "categories": [
                    "Species Traits"
                ],
                "supplyingClass": "Soldier",
                "supplyingSpecies": "",
                "supplyingFeature": "",
                "supplyingFeat": "",
                "isSupplied": true
            },
            "sort": 700000,
            "flags": {},
            "img": "icons/svg/mystery-man.svg",
            "effects": []
        },
        {
            "_id": "VNJVi6ELYNc9DgIy",
            "name": "Bonus Feat",
            "type": "ability",
            "data": {
                "description": "<div class=\"mw-parser-output\">\n <p>Beings gain one bonus&nbsp;<a href=\"https://swse.fandom.com/wiki/Feat\" class=\"mw-redirect\" title=\"Feat\">Feat</a>&nbsp;at 1st level. </p> <!-- \nNewPP limit report\nCached time: 20210117210515\nCache expiry: 1209600\nDynamic content: false\nCPU time usage: 0.002 seconds\nReal time usage: 0.002 seconds\nPreprocessor visited node count: 1/1000000\nPreprocessor generated node count: 0/1000000\nPost‐expand include size: 0/2097152 bytes\nTemplate argument size: 0/2097152 bytes\nHighest expansion depth: 1/40\nExpensive parser function count: 0/100\nUnstrip recursion depth: 0/20\nUnstrip post‐expand size: 0/5000000 bytes\n--> <!--\nTransclusion expansion time report (%,ms,calls,template)\n100.00%    0.000      1 -total\n--> <!-- Saved in parser cache with key prod:swse:pcache:idhash:12657-0!canonical and timestamp 20210117210515 and revision id 38458\n --> \n</div>",
                "attributes": {},
                "choices": [],
                "payload": "Weapon Proficiency (Simple Weapons)",
                "categories": [
                    "Species Traits"
                ],
                "supplyingClass": "Soldier",
                "supplyingSpecies": "",
                "supplyingFeature": "",
                "supplyingFeat": "",
                "isSupplied": true
            },
            "sort": 800000,
            "flags": {},
            "img": "icons/svg/mystery-man.svg",
            "effects": []
        },
        {
            "_id": "YBa3AOVFL8itd14p",
            "name": "Soldier",
            "type": "class",
            "data": {
                "description": "<div class=\"mw-parser-output\">\n <table style=\"width:100%; margin-top:1em; border:1px solid #999; font-size:90%; text-align:center; background:#363636\"> \n  <tbody>\n   <tr> \n    <td><i>This article details the the Soldier Heroic Class found in the Core Rulebook. You may be looking for the <a href=\"https://swse.fandom.com/wiki/Threats_of_the_Galaxy\" class=\"mw-redirect\" title=\"Threats of the Galaxy\">Threats of the Galaxy</a> character of the same name, the <a href=\"https://swse.fandom.com/wiki/Soldier_(TotG)\" title=\"Soldier (TotG)\">Soldier</a>.</i> </td>\n   </tr>\n  </tbody>\n </table> \n <p><br> </p>\n <p>Soldiers combine discipline with martial skills to become the best pure warriors in the galaxy. Soldiers can be stalwart defenders of those in need, cruel marauders, or brave adventurers. They can be hired guns, noble champions, or cold-hearted killers. They fight for glory, for honor, to right wrongs, to gain power, to acquire wealth, or simply for the thrill of battle. </p>  \n <h3><span class=\"mw-headline\" id=\"Adventurers\">Adventurers</span></h3> \n <p>Many Soldiers see adventures, raids on enemy strongholds, and dangerous missions as their jobs. Some want to defend those who can't defend themselves; others seek to use their muscle to carve their own place of importance in the galaxy. Whatever their initial motivation, most Soldiers wind up living for the thrill of combat and the excitement of adventure. Adventuring Soldiers call themselves guards, bodyguards, champions, enforcers, mercenaries, warriors, soldiers of fortune, or simple adventurers. </p> \n <h3><span class=\"mw-headline\" id=\"Characteristics\">Characteristics</span></h3> \n <p>Soldiers have the best all-around fighting abilities, and an individual Soldier develops styles and techniques that set him apart from their peers. A given Soldier might be especially capable with certain weapons, another trained to execute specific combat maneuvers. As Soldiers gain experience, they get more opportunities to develop their fighting skills. </p> \n <h3><span class=\"mw-headline\" id=\"Backgrounds\">Backgrounds</span></h3> \n <p>Most Soldiers come to the profession after receiving at least some amount of formal training from a military organization, local militia, or private army. Some attend formal academies; others are self-taught and well tested. A Soldier may have taken up his weapon to escape a mundane life. Another may be following a proud family tradition. Soldiers in a particular unit share certain camaraderie, but most have nothing in common except battle prowess and the desire to apply it to a given situation. </p> \n <h4><span class=\"mw-headline\" id=\"Examples_of_Soldiers_in_Star_Wars\"><b>Examples of Soldiers in <i>Star Wars</i></b></span></h4> \n <p>Admiral Ackbar, Corran Horn, Captain Panaka, Captain Typho, General Crix Madine, Kyle Katarn, Wedge Antilles, Zam Wesell </p> \n <h3><span class=\"mw-headline\" id=\"Game_Rule_Information\">Game Rule Information</span></h3> \n <p>Soldiers have the following game statistics: </p> \n <table class=\"wikitable\"> \n  <tbody>\n   <tr> \n    <th>CLASS LEVEL </th> \n    <th><a href=\"https://swse.fandom.com/wiki/BASE_ATTACK_BONUS\" class=\"mw-redirect\" title=\"BASE ATTACK BONUS\">BASE ATTACK BONUS</a> </th> \n    <th>CLASS FEATURES </th>\n   </tr> \n   <tr> \n    <td>1st </td> \n    <td>+1 </td> \n    <td><a href=\"https://swse.fandom.com/wiki/Defense\" class=\"mw-redirect\" title=\"Defense\">Defense</a> Bonuses, Starting <a href=\"https://swse.fandom.com/wiki/Feats\" title=\"Feats\">Feats</a>, <a href=\"https://swse.fandom.com/wiki/Talent_Trees_(Soldier)\" title=\"Talent Trees (Soldier)\">Talent</a> </td>\n   </tr> \n   <tr> \n    <td>2nd </td> \n    <td>+2 </td> \n    <td><a href=\"https://swse.fandom.com/wiki/Bonus_Feat_(Soldier)\" class=\"mw-redirect\" title=\"Bonus Feat (Soldier)\">Bonus Feat (Soldier)</a> </td>\n   </tr> \n   <tr> \n    <td>3rd </td> \n    <td>+3 </td> \n    <td><a href=\"https://swse.fandom.com/wiki/Talent_Trees_(Soldier)\" title=\"Talent Trees (Soldier)\">Talent</a> </td>\n   </tr> \n   <tr> \n    <td>4th </td> \n    <td>+4 </td> \n    <td><a href=\"https://swse.fandom.com/wiki/Bonus_Feat_(Soldier)\" class=\"mw-redirect\" title=\"Bonus Feat (Soldier)\">Bonus Feat (Soldier)</a> </td>\n   </tr> \n   <tr> \n    <td>5th </td> \n    <td>+5 </td> \n    <td><a href=\"https://swse.fandom.com/wiki/Talent_Trees_(Soldier)\" title=\"Talent Trees (Soldier)\">Talent</a> </td>\n   </tr> \n   <tr> \n    <td>6th </td> \n    <td>+6 </td> \n    <td><a href=\"https://swse.fandom.com/wiki/Bonus_Feat_(Soldier)\" class=\"mw-redirect\" title=\"Bonus Feat (Soldier)\">Bonus Feat (Soldier)</a> </td>\n   </tr> \n   <tr> \n    <td>7th </td> \n    <td>+7 </td> \n    <td><a href=\"https://swse.fandom.com/wiki/Talent_Trees_(Soldier)\" title=\"Talent Trees (Soldier)\">Talent</a> </td>\n   </tr> \n   <tr> \n    <td>8th </td> \n    <td>+8 </td> \n    <td><a href=\"https://swse.fandom.com/wiki/Bonus_Feat_(Soldier)\" class=\"mw-redirect\" title=\"Bonus Feat (Soldier)\">Bonus Feat (Soldier)</a> </td>\n   </tr> \n   <tr> \n    <td>9th </td> \n    <td>+9 </td> \n    <td><a href=\"https://swse.fandom.com/wiki/Talent_Trees_(Soldier)\" title=\"Talent Trees (Soldier)\">Talent</a> </td>\n   </tr> \n   <tr> \n    <td>10th </td> \n    <td>+10 </td> \n    <td><a href=\"https://swse.fandom.com/wiki/Bonus_Feat_(Soldier)\" class=\"mw-redirect\" title=\"Bonus Feat (Soldier)\">Bonus Feat (Soldier)</a> </td>\n   </tr> \n   <tr> \n    <td>11th </td> \n    <td>+11 </td> \n    <td><a href=\"https://swse.fandom.com/wiki/Talent_Trees_(Soldier)\" title=\"Talent Trees (Soldier)\">Talent</a> </td>\n   </tr> \n   <tr> \n    <td>12th </td> \n    <td>+12 </td> \n    <td><a href=\"https://swse.fandom.com/wiki/Bonus_Feat_(Soldier)\" class=\"mw-redirect\" title=\"Bonus Feat (Soldier)\">Bonus Feat (Soldier)</a> </td>\n   </tr> \n   <tr> \n    <td>13th </td> \n    <td>+13 </td> \n    <td><a href=\"https://swse.fandom.com/wiki/Talent_Trees_(Soldier)\" title=\"Talent Trees (Soldier)\">Talent</a> </td>\n   </tr> \n   <tr> \n    <td>14th </td> \n    <td>+14 </td> \n    <td><a href=\"https://swse.fandom.com/wiki/Bonus_Feat_(Soldier)\" class=\"mw-redirect\" title=\"Bonus Feat (Soldier)\">Bonus Feat (Soldier)</a> </td>\n   </tr> \n   <tr> \n    <td>15th </td> \n    <td>+15 </td> \n    <td><a href=\"https://swse.fandom.com/wiki/Talent_Trees_(Soldier)\" title=\"Talent Trees (Soldier)\">Talent</a> </td>\n   </tr> \n   <tr> \n    <td>16th </td> \n    <td>+16 </td> \n    <td><a href=\"https://swse.fandom.com/wiki/Bonus_Feat_(Soldier)\" class=\"mw-redirect\" title=\"Bonus Feat (Soldier)\">Bonus Feat (Soldier)</a> </td>\n   </tr> \n   <tr> \n    <td>17th </td> \n    <td>+17 </td> \n    <td><a href=\"https://swse.fandom.com/wiki/Talent_Trees_(Soldier)\" title=\"Talent Trees (Soldier)\">Talent</a> </td>\n   </tr> \n   <tr> \n    <td>18th </td> \n    <td>+18 </td> \n    <td><a href=\"https://swse.fandom.com/wiki/Bonus_Feat_(Soldier)\" class=\"mw-redirect\" title=\"Bonus Feat (Soldier)\">Bonus Feat (Soldier)</a> </td>\n   </tr> \n   <tr> \n    <td>19th </td> \n    <td>+19 </td> \n    <td><a href=\"https://swse.fandom.com/wiki/Talent_Trees_(Soldier)\" title=\"Talent Trees (Soldier)\">Talent</a> </td>\n   </tr> \n   <tr> \n    <td>20th </td> \n    <td>+20 </td> \n    <td><a href=\"https://swse.fandom.com/wiki/Bonus_Feat_(Soldier)\" class=\"mw-redirect\" title=\"Bonus Feat (Soldier)\">Bonus Feat (Soldier)</a> </td>\n   </tr>\n  </tbody>\n </table> \n <h4><span class=\"mw-headline\" id=\"Abilities\"><b>Abilities</b></span></h4> \n <p>Since most combat in the <i>Star Wars</i> universe uses blasters and other ranged weapons, <a href=\"https://swse.fandom.com/wiki/Dexterity\" title=\"Dexterity\">Dexterity</a> is the soldier's most important <a href=\"https://swse.fandom.com/wiki/Abilities\" title=\"Abilities\">ability score</a>, followed closely by <a href=\"https://swse.fandom.com/wiki/Constitution\" title=\"Constitution\">Constitution</a> and <a href=\"https://swse.fandom.com/wiki/Strength\" title=\"Strength\">Strength</a>. Don't underestimate the importance of <a href=\"https://swse.fandom.com/wiki/Intelligence\" title=\"Intelligence\">Intelligence</a> and <a href=\"https://swse.fandom.com/wiki/Wisdom\" title=\"Wisdom\">Wisdom</a>, however, since many of a soldier's useful <a href=\"https://swse.fandom.com/wiki/Skills\" title=\"Skills\">Skills</a> are based on these abilities. </p> \n <h4><span class=\"mw-headline\" id=\"Class_Skills\"><b>Class Skills </b></span></h4> \n <p><a href=\"https://swse.fandom.com/wiki/Trained\" class=\"mw-redirect\" title=\"Trained\">Trained</a> in 3 + <a href=\"https://swse.fandom.com/wiki/Intelligence\" title=\"Intelligence\">Intelligence</a> modifier: </p> \n <ul>\n  <li><a href=\"https://swse.fandom.com/wiki/Climb\" title=\"Climb\">Climb</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Endurance\" title=\"Endurance\">Endurance</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Initiative\" title=\"Initiative\">Initiative</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Jump\" title=\"Jump\">Jump</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Knowledge_(Tactics)\" class=\"mw-redirect\" title=\"Knowledge (Tactics)\">Knowledge (Tactics)</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Mechanics\" title=\"Mechanics\">Mechanics</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Perception\" title=\"Perception\">Perception</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Pilot\" title=\"Pilot\">Pilot</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Swim\" title=\"Swim\">Swim</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Treat_Injury\" title=\"Treat Injury\">Treat Injury</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Use_Computer\" title=\"Use Computer\">Use Computer</a></li>\n </ul> \n <h4><span class=\"mw-headline\" id=\"Hit_Points\"><b>Hit Points</b></span></h4> \n <p>Soldiers begin play at 1st level with a number of hit points equal to 30 + their <a href=\"https://swse.fandom.com/wiki/Constitution\" title=\"Constitution\">Constitution</a> modifier. At each level after 1st, Soldiers gain 1d10 hit points + their <a href=\"https://swse.fandom.com/wiki/Constitution\" title=\"Constitution\">Constitution</a> modifier. </p> \n <h4><span class=\"mw-headline\" id=\"Force_Points\"><b>Force Points</b></span></h4> \n <p>Soldiers gain a number of <a href=\"https://swse.fandom.com/wiki/Force_Points\" title=\"Force Points\">Force Points</a> equal to 5 + one-half their Character Level (Rounded down) at 1st level, and every time they gain a new level in this class. Any <a href=\"https://swse.fandom.com/wiki/Force_Points\" title=\"Force Points\">Force Points</a> left over from previous levels are lost. </p> \n <h3><span class=\"mw-headline\" id=\"Class_Features.\">Class Features.</span></h3> \n <p>All of the following are features of the Soldier class. </p> \n <h4><span class=\"mw-headline\" id=\"Defense_Bonuses\"><b>Defense Bonuses</b></span></h4> \n <p>At 1st level, a Soldier gains a +1 bonus to their <a href=\"https://swse.fandom.com/wiki/Reflex_Defense\" class=\"mw-redirect\" title=\"Reflex Defense\">Reflex Defense</a> and a +2 bonus to their <a href=\"https://swse.fandom.com/wiki/Fortitude_Defense\" class=\"mw-redirect\" title=\"Fortitude Defense\">Fortitude Defense</a>. </p> \n <h4><span class=\"mw-headline\" id=\"Starting_Feats\"><b>Starting Feats</b></span></h4> \n <p>A Soldier begins play with the following bonus <a href=\"https://swse.fandom.com/wiki/Feats\" title=\"Feats\">Feats</a>: </p> \n <ul>\n  <li><a href=\"https://swse.fandom.com/wiki/Armor_Proficiency_(Light)\" title=\"Armor Proficiency (Light)\">Armor Proficiency (Light)</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Armor_Proficiency_(Medium)\" title=\"Armor Proficiency (Medium)\">Armor Proficiency (Medium)</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Weapon_Proficiency_(Pistols)\" class=\"mw-redirect\" title=\"Weapon Proficiency (Pistols)\">Weapon Proficiency (Pistols)</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Weapon_Proficiency_(Rifles)\" class=\"mw-redirect\" title=\"Weapon Proficiency (Rifles)\">Weapon Proficiency (Rifles)</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Weapon_Proficiency_(Simple_Weapons)\" class=\"mw-redirect\" title=\"Weapon Proficiency (Simple Weapons)\">Weapon Proficiency (Simple Weapons)</a></li>\n </ul> \n <h4><span class=\"mw-headline\" id=\"Talent_Trees\"><b>Talent Trees</b></span></h4> \n <p>At every odd-numbered level (1st, 3rd, 5th, and so on), a Soldier gains an additional&nbsp;<a href=\"https://swse.fandom.com/wiki/Talent\" class=\"mw-redirect\" title=\"Talent\">Talent</a>. A Soldier may choose a&nbsp;<a href=\"https://swse.fandom.com/wiki/Talent\" class=\"mw-redirect\" title=\"Talent\">Talent</a>&nbsp;from any&nbsp;<a href=\"https://swse.fandom.com/wiki/Talent_Trees\" class=\"mw-redirect\" title=\"Talent Trees\">Talent Tree</a>&nbsp;they wish, but they must meet the prerequisites (If any) of the chosen&nbsp;<a href=\"https://swse.fandom.com/wiki/Talent\" class=\"mw-redirect\" title=\"Talent\">Talent</a>. The&nbsp;<a href=\"https://swse.fandom.com/wiki/Talent\" class=\"mw-redirect\" title=\"Talent\">Talent</a>&nbsp;can be selected from any of the&nbsp;<a href=\"https://swse.fandom.com/wiki/Talent_Trees_(Soldier)\" title=\"Talent Trees (Soldier)\">Talent Trees (Soldier)</a>. </p> \n <h4><span class=\"mw-headline\" id=\"Bonus_Feats\"><b>Bonus Feats</b></span></h4> \n <p>At every even-numbered level (2nd, 4th, 6th, etc.), a Soldier gains a bonus <a href=\"https://swse.fandom.com/wiki/Feat\" class=\"mw-redirect\" title=\"Feat\">Feat</a>. This&nbsp;<a href=\"https://swse.fandom.com/wiki/Feat\" class=\"mw-redirect\" title=\"Feat\">Feat</a>&nbsp;must be selected from the related page (<a href=\"https://swse.fandom.com/wiki/Bonus_Feats_(Soldier)\" title=\"Bonus Feats (Soldier)\">Bonus Feats (Soldier)</a>). As with normal&nbsp;<a href=\"https://swse.fandom.com/wiki/Feats\" title=\"Feats\">Feats</a>, you must meet the prerequisites to select the&nbsp;<a href=\"https://swse.fandom.com/wiki/Feat\" class=\"mw-redirect\" title=\"Feat\">Feat</a>. The Bonus&nbsp;<a href=\"https://swse.fandom.com/wiki/Feat\" class=\"mw-redirect\" title=\"Feat\">Feat</a>&nbsp;must be from the&nbsp;<a href=\"https://swse.fandom.com/wiki/Bonus_Feats_(Soldier)\" title=\"Bonus Feats (Soldier)\">Bonus Feats (Soldier)</a>, unless explicitly stated otherwise. </p> \n <h4><span class=\"mw-headline\" id=\"Credits\"><b>Credits</b></span></h4> \n <p>A 1st-level Soldier starts play with 3d4 x 250 credits. </p> <!-- \nNewPP limit report\nCached time: 20210131141021\nCache expiry: 1209600\nDynamic content: false\nCPU time usage: 0.029 seconds\nReal time usage: 0.035 seconds\nPreprocessor visited node count: 229/1000000\nPreprocessor generated node count: 0/1000000\nPost‐expand include size: 644/2097152 bytes\nTemplate argument size: 333/2097152 bytes\nHighest expansion depth: 5/40\nExpensive parser function count: 0/100\nUnstrip recursion depth: 0/20\nUnstrip post‐expand size: 51/5000000 bytes\n--> <!--\nTransclusion expansion time report (%,ms,calls,template)\n100.00%    4.754      1 -total\n100.00%    4.754      1 Template:Youmay\n 32.75%    1.557      1 Template:Dablink\n--> <!-- Saved in parser cache with key prod:swse:pcache:idhash:2770-0!canonical and timestamp 20210131141021 and revision id 49480\n --> \n</div>",
                "attributes": {},
                "choices": [],
                "payload": "",
                "prerequisites": {
                    "prerequisites": {},
                    "isPrestige": false
                },
                "skills": {
                    "skills": [
                        "Climb",
                        "Endurance",
                        "Initiative",
                        "Jump",
                        "Knowledge (Tactics)",
                        "Mechanics",
                        "Perception",
                        "Pilot",
                        "Swim",
                        "Treat Injury",
                        "Use Computer"
                    ],
                    "perLevel": 3
                },
                "defense": {
                    "will": 0,
                    "reflex": 1,
                    "fortitude": 2
                },
                "health": {
                    "levelUp": "1d10",
                    "firstLevel": 30
                },
                "feats": {
                    "feats": [
                        "Armor Proficiency (Light)",
                        "Armor Proficiency (Medium)",
                        "Weapon Proficiency (Pistols)",
                        "Weapon Proficiency (Rifles)",
                        "Weapon Proficiency (Simple Weapons)"
                    ]
                },
                "levels": {
                    "1": {
                        "BASE ATTACK BONUS": "+1",
                        "CLASS FEATURES": "Defense Bonuses, Starting Feats, Talent"
                    },
                    "2": {
                        "BASE ATTACK BONUS": "+2",
                        "CLASS FEATURES": "Bonus Feat (Soldier)"
                    },
                    "3": {
                        "BASE ATTACK BONUS": "+3",
                        "CLASS FEATURES": "Talent"
                    },
                    "4": {
                        "BASE ATTACK BONUS": "+4",
                        "CLASS FEATURES": "Bonus Feat (Soldier)"
                    },
                    "5": {
                        "BASE ATTACK BONUS": "+5",
                        "CLASS FEATURES": "Talent"
                    },
                    "6": {
                        "BASE ATTACK BONUS": "+6",
                        "CLASS FEATURES": "Bonus Feat (Soldier)"
                    },
                    "7": {
                        "BASE ATTACK BONUS": "+7",
                        "CLASS FEATURES": "Talent"
                    },
                    "8": {
                        "BASE ATTACK BONUS": "+8",
                        "CLASS FEATURES": "Bonus Feat (Soldier)"
                    },
                    "9": {
                        "BASE ATTACK BONUS": "+9",
                        "CLASS FEATURES": "Talent"
                    },
                    "10": {
                        "BASE ATTACK BONUS": "+10",
                        "CLASS FEATURES": "Bonus Feat (Soldier)"
                    },
                    "11": {
                        "BASE ATTACK BONUS": "+11",
                        "CLASS FEATURES": "Talent"
                    },
                    "12": {
                        "BASE ATTACK BONUS": "+12",
                        "CLASS FEATURES": "Bonus Feat (Soldier)"
                    },
                    "13": {
                        "BASE ATTACK BONUS": "+13",
                        "CLASS FEATURES": "Talent"
                    },
                    "14": {
                        "BASE ATTACK BONUS": "+14",
                        "CLASS FEATURES": "Bonus Feat (Soldier)"
                    },
                    "15": {
                        "BASE ATTACK BONUS": "+15",
                        "CLASS FEATURES": "Talent"
                    },
                    "16": {
                        "BASE ATTACK BONUS": "+16",
                        "CLASS FEATURES": "Bonus Feat (Soldier)"
                    },
                    "17": {
                        "BASE ATTACK BONUS": "+17",
                        "CLASS FEATURES": "Talent"
                    },
                    "18": {
                        "BASE ATTACK BONUS": "+18",
                        "CLASS FEATURES": "Bonus Feat (Soldier)"
                    },
                    "19": {
                        "BASE ATTACK BONUS": "+19",
                        "CLASS FEATURES": "Talent"
                    },
                    "20": {
                        "BASE ATTACK BONUS": "+20",
                        "CLASS FEATURES": "Bonus Feat (Soldier)"
                    }
                }
            },
            "sort": 900000,
            "flags": {
                "core": {
                    "sourceId": "Compendium.world.swse-classes.AQgM7w5v8PZUCzJP"
                }
            },
            "img": "icons/svg/mystery-man.svg",
            "effects": []
        },
        {
            "_id": "eukEDoP53yZHteWn",
            "name": "Armor Proficiency (Light)",
            "type": "feat",
            "data": {
                "description": "<div class=\"mw-parser-output\">\n <p><i>See also: <a href=\"https://swse.fandom.com/wiki/Feats\" title=\"Feats\">Feats</a></i> </p>\n <p>You are proficient with <a href=\"https://swse.fandom.com/wiki/Light_Armor\" title=\"Light Armor\">Light Armor</a>, and can wear it without impediment. </p>\n <p><b>Effect:</b> When you wear <a href=\"https://swse.fandom.com/wiki/Light_Armor\" title=\"Light Armor\">Light Armor</a>, you take no <a href=\"https://swse.fandom.com/wiki/Armor_Check_Penalty\" class=\"mw-redirect\" title=\"Armor Check Penalty\">Armor Check Penalty</a> on attack rolls or <a href=\"https://swse.fandom.com/wiki/Skill_Checks\" class=\"mw-redirect\" title=\"Skill Checks\">Skill Checks</a>. Additionally, you benefit from all of the armor's special <a href=\"https://swse.fandom.com/wiki/Equipment\" title=\"Equipment\">Equipment</a> bonuses (If any). </p>\n <p><b>Normal:</b> A character who wears <a href=\"https://swse.fandom.com/wiki/Light_Armor\" title=\"Light Armor\">Light Armor</a> with which they are not proficient takes a -2 <a href=\"https://swse.fandom.com/wiki/Armor_Check_Penalty\" class=\"mw-redirect\" title=\"Armor Check Penalty\">Armor Check Penalty</a> on attack rolls as well as <a href=\"https://swse.fandom.com/wiki/Skill_Checks\" class=\"mw-redirect\" title=\"Skill Checks\">Skill Checks</a> made using the following <a href=\"https://swse.fandom.com/wiki/Skills\" title=\"Skills\">Skills</a>: <a href=\"https://swse.fandom.com/wiki/Acrobatics\" title=\"Acrobatics\">Acrobatics</a>, <a href=\"https://swse.fandom.com/wiki/Climb\" title=\"Climb\">Climb</a>, <a href=\"https://swse.fandom.com/wiki/Endurance\" title=\"Endurance\">Endurance</a>, <a href=\"https://swse.fandom.com/wiki/Initiative\" title=\"Initiative\">Initiative</a>, <a href=\"https://swse.fandom.com/wiki/Jump\" title=\"Jump\">Jump</a>, <a href=\"https://swse.fandom.com/wiki/Stealth\" title=\"Stealth\">Stealth</a>, and <a href=\"https://swse.fandom.com/wiki/Swim\" title=\"Swim\">Swim</a>. Additionally, the character gains none of the armor's special <a href=\"https://swse.fandom.com/wiki/Equipment\" title=\"Equipment\">Equipment</a> bonuses. </p> <!-- \nNewPP limit report\nCached time: 20210130190847\nCache expiry: 1209600\nDynamic content: false\nCPU time usage: 0.005 seconds\nReal time usage: 0.006 seconds\nPreprocessor visited node count: 1/1000000\nPreprocessor generated node count: 0/1000000\nPost‐expand include size: 0/2097152 bytes\nTemplate argument size: 0/2097152 bytes\nHighest expansion depth: 1/40\nExpensive parser function count: 0/100\nUnstrip recursion depth: 0/20\nUnstrip post‐expand size: 0/5000000 bytes\n--> <!--\nTransclusion expansion time report (%,ms,calls,template)\n100.00%    0.000      1 -total\n--> <!-- Saved in parser cache with key prod:swse:pcache:idhash:2162-0!canonical and timestamp 20210130190847 and revision id 46054\n --> \n</div>",
                "attributes": {
                    "fortDefenceBonus": {
                        "dtype": "String",
                        "value": ""
                    },
                    "refDefenceBonus": {
                        "dtype": "String",
                        "value": ""
                    },
                    "hitPointEq": {
                        "dtype": "String",
                        "value": ""
                    }
                },
                "choices": [],
                "payload": "Light",
                "prerequisites": [],
                "categories": [
                    "Feats"
                ],
                "supplyingClass": "Soldier",
                "supplyingSpecies": "",
                "supplyingFeature": "",
                "supplyingFeat": "",
                "isSupplied": true
            },
            "sort": 1000000,
            "flags": {},
            "img": "icons/svg/mystery-man.svg",
            "effects": []
        },
        {
            "_id": "DQQSSFT64pm0qzKn",
            "name": "Weapon Proficiency",
            "type": "feat",
            "data": {
                "description": "<div class=\"mw-parser-output\">\n <p><i>See also: <a href=\"https://swse.fandom.com/wiki/Feats\" title=\"Feats\">Feats</a></i> </p>\n <p>You are proficient with a particular kind of weaponry. </p>\n <p><b>Effect:</b> Choose one Weapon Group. You are proficient with all weapons of the selected group. Weapon Groups include the following: </p> \n <ul>\n  <li>Simple Weapons (Includes <a href=\"https://swse.fandom.com/wiki/Simple_Weapons_(Melee)\" title=\"Simple Weapons (Melee)\">Simple Weapons (Melee)</a>, <a href=\"https://swse.fandom.com/wiki/Simple_Weapons_(Ranged)\" title=\"Simple Weapons (Ranged)\">Simple Weapons (Ranged)</a>, <a href=\"https://swse.fandom.com/wiki/Grenades\" title=\"Grenades\">Grenades</a>, and <a href=\"https://swse.fandom.com/wiki/Mines\" title=\"Mines\">Mines</a>)</li> \n  <li><a href=\"https://swse.fandom.com/wiki/Pistols\" title=\"Pistols\">Pistols</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Rifles\" title=\"Rifles\">Rifles</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Lightsabers\" title=\"Lightsabers\">Lightsabers</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Heavy_Weapons\" title=\"Heavy Weapons\">Heavy Weapons</a> (Includes both <a href=\"https://swse.fandom.com/wiki/Heavy_Weapons\" title=\"Heavy Weapons\">Heavy Weapons</a> and <a href=\"https://swse.fandom.com/wiki/Vehicle_Weapons\" class=\"mw-redirect\" title=\"Vehicle Weapons\">Vehicle Weapons</a>)</li> \n  <li><a href=\"https://swse.fandom.com/wiki/Advanced_Melee_Weapons\" title=\"Advanced Melee Weapons\">Advanced Melee Weapons</a></li>\n </ul> \n <p><b>Normal:</b> If you wield a weapon with which you are not proficient, you take a -5 penalty to your attack rolls. </p>\n <p><b>Special:</b> You can gain this Feat multiple times. Each time you take the Feat, it applies to a different Weapon Group. You cannot take <a href=\"https://swse.fandom.com/wiki/Exotic_Weapons\" title=\"Exotic Weapons\">Exotic Weapons</a> as a weapon group; instead you must select the <a href=\"https://swse.fandom.com/wiki/Exotic_Weapon_Proficiency\" title=\"Exotic Weapon Proficiency\">Exotic Weapon Proficiency</a> Feat to gain proficiency with a specific Exotic Weapon. </p> \n <h2><span class=\"mw-headline\" id=\"Additional_Weapon_Proficiency\">Additional Weapon Proficiency</span><span class=\"mw-editsection\"><span class=\"mw-editsection-bracket\">[</span><a href=\"https://swse.fandom.com/wiki/Weapon_Proficiency?veaction=edit&amp;section=1\" class=\"mw-editsection-visualeditor\" title=\"Edit section: Additional Weapon Proficiency\">edit</a><span class=\"mw-editsection-divider\"> | </span><a href=\"https://swse.fandom.com/wiki/Weapon_Proficiency?action=edit&amp;section=1\" title=\"Edit section: Additional Weapon Proficiency\">\n    <svg class=\"wds-icon wds-icon-tiny section-edit-pencil-icon\">\n     <use xlink:href=\"#wds-icons-pencil-tiny\"></use>\n    </svg>edit source</a><span class=\"mw-editsection-bracket\">]</span></span></h2> \n <p><i>Reference Book:</i>&nbsp;<i><a href=\"https://swse.fandom.com/wiki/Star_Wars_Saga_Edition_Knights_of_the_Old_Republic_Campaign_Guide\" title=\"Star Wars Saga Edition Knights of the Old Republic Campaign Guide\">Star Wars Saga Edition Knights of the Old Republic Campaign Guide</a></i> </p>\n <p><b><a href=\"https://swse.fandom.com/wiki/Combined_Feat\" class=\"mw-redirect\" title=\"Combined Feat\">Combined Feat</a> (<a href=\"https://swse.fandom.com/wiki/Quick_Draw\" title=\"Quick Draw\">Quick Draw</a>):</b> You can draw and ignite your <a href=\"https://swse.fandom.com/wiki/Lightsaber\" class=\"mw-redirect\" title=\"Lightsaber\">Lightsaber</a> as a single <a href=\"https://swse.fandom.com/wiki/Swift_Action\" class=\"mw-redirect\" title=\"Swift Action\">Swift Action</a>. </p> <!-- \nNewPP limit report\nCached time: 20210212123253\nCache expiry: 1209600\nDynamic content: false\nCPU time usage: 0.006 seconds\nReal time usage: 0.008 seconds\nPreprocessor visited node count: 17/1000000\nPreprocessor generated node count: 0/1000000\nPost‐expand include size: 0/2097152 bytes\nTemplate argument size: 0/2097152 bytes\nHighest expansion depth: 2/40\nExpensive parser function count: 0/100\nUnstrip recursion depth: 0/20\nUnstrip post‐expand size: 0/5000000 bytes\n--> <!--\nTransclusion expansion time report (%,ms,calls,template)\n100.00%    0.000      1 -total\n--> <!-- Saved in parser cache with key prod:swse:pcache:idhash:2222-0!canonical and timestamp 20210212123253 and revision id 46047\n --> \n</div>",
                "attributes": {
                    "fortDefenceBonus": {
                        "dtype": "String",
                        "value": ""
                    },
                    "refDefenceBonus": {
                        "dtype": "String",
                        "value": ""
                    },
                    "hitPointEq": {
                        "dtype": "String",
                        "value": ""
                    }
                },
                "choices": [
                    {
                        "options": {
                            "Simple Weapons": {
                                "abilities": [],
                                "payload": "Simple Weapons",
                                "items": []
                            },
                            "Lightsabers": {
                                "abilities": [],
                                "payload": "Lightsabers",
                                "items": []
                            },
                            "Pistols": {
                                "abilities": [],
                                "payload": "Pistols",
                                "items": []
                            },
                            "Advanced Melee Weapons": {
                                "abilities": [],
                                "payload": "Advanced Melee Weapons",
                                "items": []
                            },
                            "Heavy Weapons": {
                                "abilities": [],
                                "payload": "Heavy Weapons",
                                "items": []
                            },
                            "Rifles": {
                                "abilities": [],
                                "payload": "Rifles",
                                "items": []
                            }
                        },
                        "description": "Select a Weapon Proficiency"
                    }
                ],
                "payload": "Pistols",
                "prerequisites": [],
                "categories": [
                    "Feats"
                ],
                "supplyingClass": "Soldier",
                "supplyingSpecies": "",
                "supplyingFeature": "",
                "supplyingFeat": "",
                "isSupplied": true
            },
            "sort": 1100000,
            "flags": {},
            "img": "icons/svg/mystery-man.svg",
            "effects": []
        },
        {
            "_id": "9iF8O2mKld8dqopW",
            "name": "Weapon Proficiency",
            "type": "feat",
            "data": {
                "description": "<div class=\"mw-parser-output\">\n <p><i>See also: <a href=\"https://swse.fandom.com/wiki/Feats\" title=\"Feats\">Feats</a></i> </p>\n <p>You are proficient with a particular kind of weaponry. </p>\n <p><b>Effect:</b> Choose one Weapon Group. You are proficient with all weapons of the selected group. Weapon Groups include the following: </p> \n <ul>\n  <li>Simple Weapons (Includes <a href=\"https://swse.fandom.com/wiki/Simple_Weapons_(Melee)\" title=\"Simple Weapons (Melee)\">Simple Weapons (Melee)</a>, <a href=\"https://swse.fandom.com/wiki/Simple_Weapons_(Ranged)\" title=\"Simple Weapons (Ranged)\">Simple Weapons (Ranged)</a>, <a href=\"https://swse.fandom.com/wiki/Grenades\" title=\"Grenades\">Grenades</a>, and <a href=\"https://swse.fandom.com/wiki/Mines\" title=\"Mines\">Mines</a>)</li> \n  <li><a href=\"https://swse.fandom.com/wiki/Pistols\" title=\"Pistols\">Pistols</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Rifles\" title=\"Rifles\">Rifles</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Lightsabers\" title=\"Lightsabers\">Lightsabers</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Heavy_Weapons\" title=\"Heavy Weapons\">Heavy Weapons</a> (Includes both <a href=\"https://swse.fandom.com/wiki/Heavy_Weapons\" title=\"Heavy Weapons\">Heavy Weapons</a> and <a href=\"https://swse.fandom.com/wiki/Vehicle_Weapons\" class=\"mw-redirect\" title=\"Vehicle Weapons\">Vehicle Weapons</a>)</li> \n  <li><a href=\"https://swse.fandom.com/wiki/Advanced_Melee_Weapons\" title=\"Advanced Melee Weapons\">Advanced Melee Weapons</a></li>\n </ul> \n <p><b>Normal:</b> If you wield a weapon with which you are not proficient, you take a -5 penalty to your attack rolls. </p>\n <p><b>Special:</b> You can gain this Feat multiple times. Each time you take the Feat, it applies to a different Weapon Group. You cannot take <a href=\"https://swse.fandom.com/wiki/Exotic_Weapons\" title=\"Exotic Weapons\">Exotic Weapons</a> as a weapon group; instead you must select the <a href=\"https://swse.fandom.com/wiki/Exotic_Weapon_Proficiency\" title=\"Exotic Weapon Proficiency\">Exotic Weapon Proficiency</a> Feat to gain proficiency with a specific Exotic Weapon. </p> \n <h2><span class=\"mw-headline\" id=\"Additional_Weapon_Proficiency\">Additional Weapon Proficiency</span><span class=\"mw-editsection\"><span class=\"mw-editsection-bracket\">[</span><a href=\"https://swse.fandom.com/wiki/Weapon_Proficiency?veaction=edit&amp;section=1\" class=\"mw-editsection-visualeditor\" title=\"Edit section: Additional Weapon Proficiency\">edit</a><span class=\"mw-editsection-divider\"> | </span><a href=\"https://swse.fandom.com/wiki/Weapon_Proficiency?action=edit&amp;section=1\" title=\"Edit section: Additional Weapon Proficiency\">\n    <svg class=\"wds-icon wds-icon-tiny section-edit-pencil-icon\">\n     <use xlink:href=\"#wds-icons-pencil-tiny\"></use>\n    </svg>edit source</a><span class=\"mw-editsection-bracket\">]</span></span></h2> \n <p><i>Reference Book:</i>&nbsp;<i><a href=\"https://swse.fandom.com/wiki/Star_Wars_Saga_Edition_Knights_of_the_Old_Republic_Campaign_Guide\" title=\"Star Wars Saga Edition Knights of the Old Republic Campaign Guide\">Star Wars Saga Edition Knights of the Old Republic Campaign Guide</a></i> </p>\n <p><b><a href=\"https://swse.fandom.com/wiki/Combined_Feat\" class=\"mw-redirect\" title=\"Combined Feat\">Combined Feat</a> (<a href=\"https://swse.fandom.com/wiki/Quick_Draw\" title=\"Quick Draw\">Quick Draw</a>):</b> You can draw and ignite your <a href=\"https://swse.fandom.com/wiki/Lightsaber\" class=\"mw-redirect\" title=\"Lightsaber\">Lightsaber</a> as a single <a href=\"https://swse.fandom.com/wiki/Swift_Action\" class=\"mw-redirect\" title=\"Swift Action\">Swift Action</a>. </p> <!-- \nNewPP limit report\nCached time: 20210212123253\nCache expiry: 1209600\nDynamic content: false\nCPU time usage: 0.006 seconds\nReal time usage: 0.008 seconds\nPreprocessor visited node count: 17/1000000\nPreprocessor generated node count: 0/1000000\nPost‐expand include size: 0/2097152 bytes\nTemplate argument size: 0/2097152 bytes\nHighest expansion depth: 2/40\nExpensive parser function count: 0/100\nUnstrip recursion depth: 0/20\nUnstrip post‐expand size: 0/5000000 bytes\n--> <!--\nTransclusion expansion time report (%,ms,calls,template)\n100.00%    0.000      1 -total\n--> <!-- Saved in parser cache with key prod:swse:pcache:idhash:2222-0!canonical and timestamp 20210212123253 and revision id 46047\n --> \n</div>",
                "attributes": {
                    "fortDefenceBonus": {
                        "dtype": "String",
                        "value": ""
                    },
                    "refDefenceBonus": {
                        "dtype": "String",
                        "value": ""
                    },
                    "hitPointEq": {
                        "dtype": "String",
                        "value": ""
                    }
                },
                "choices": [
                    {
                        "options": {
                            "Simple Weapons": {
                                "abilities": [],
                                "payload": "Simple Weapons",
                                "items": []
                            },
                            "Lightsabers": {
                                "abilities": [],
                                "payload": "Lightsabers",
                                "items": []
                            },
                            "Pistols": {
                                "abilities": [],
                                "payload": "Pistols",
                                "items": []
                            },
                            "Advanced Melee Weapons": {
                                "abilities": [],
                                "payload": "Advanced Melee Weapons",
                                "items": []
                            },
                            "Heavy Weapons": {
                                "abilities": [],
                                "payload": "Heavy Weapons",
                                "items": []
                            },
                            "Rifles": {
                                "abilities": [],
                                "payload": "Rifles",
                                "items": []
                            }
                        },
                        "description": "Select a Weapon Proficiency"
                    }
                ],
                "payload": "Rifles",
                "prerequisites": [],
                "categories": [
                    "Feats"
                ],
                "supplyingClass": "Soldier",
                "supplyingSpecies": "",
                "supplyingFeature": "",
                "supplyingFeat": "",
                "isSupplied": true
            },
            "sort": 1200000,
            "flags": {},
            "img": "icons/svg/mystery-man.svg",
            "effects": []
        },
        {
            "_id": "8PJCgfPeEHJndr6w",
            "name": "Weapon Proficiency",
            "type": "feat",
            "data": {
                "description": "<div class=\"mw-parser-output\">\n <p><i>See also: <a href=\"https://swse.fandom.com/wiki/Feats\" title=\"Feats\">Feats</a></i> </p>\n <p>You are proficient with a particular kind of weaponry. </p>\n <p><b>Effect:</b> Choose one Weapon Group. You are proficient with all weapons of the selected group. Weapon Groups include the following: </p> \n <ul>\n  <li>Simple Weapons (Includes <a href=\"https://swse.fandom.com/wiki/Simple_Weapons_(Melee)\" title=\"Simple Weapons (Melee)\">Simple Weapons (Melee)</a>, <a href=\"https://swse.fandom.com/wiki/Simple_Weapons_(Ranged)\" title=\"Simple Weapons (Ranged)\">Simple Weapons (Ranged)</a>, <a href=\"https://swse.fandom.com/wiki/Grenades\" title=\"Grenades\">Grenades</a>, and <a href=\"https://swse.fandom.com/wiki/Mines\" title=\"Mines\">Mines</a>)</li> \n  <li><a href=\"https://swse.fandom.com/wiki/Pistols\" title=\"Pistols\">Pistols</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Rifles\" title=\"Rifles\">Rifles</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Lightsabers\" title=\"Lightsabers\">Lightsabers</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Heavy_Weapons\" title=\"Heavy Weapons\">Heavy Weapons</a> (Includes both <a href=\"https://swse.fandom.com/wiki/Heavy_Weapons\" title=\"Heavy Weapons\">Heavy Weapons</a> and <a href=\"https://swse.fandom.com/wiki/Vehicle_Weapons\" class=\"mw-redirect\" title=\"Vehicle Weapons\">Vehicle Weapons</a>)</li> \n  <li><a href=\"https://swse.fandom.com/wiki/Advanced_Melee_Weapons\" title=\"Advanced Melee Weapons\">Advanced Melee Weapons</a></li>\n </ul> \n <p><b>Normal:</b> If you wield a weapon with which you are not proficient, you take a -5 penalty to your attack rolls. </p>\n <p><b>Special:</b> You can gain this Feat multiple times. Each time you take the Feat, it applies to a different Weapon Group. You cannot take <a href=\"https://swse.fandom.com/wiki/Exotic_Weapons\" title=\"Exotic Weapons\">Exotic Weapons</a> as a weapon group; instead you must select the <a href=\"https://swse.fandom.com/wiki/Exotic_Weapon_Proficiency\" title=\"Exotic Weapon Proficiency\">Exotic Weapon Proficiency</a> Feat to gain proficiency with a specific Exotic Weapon. </p> \n <h2><span class=\"mw-headline\" id=\"Additional_Weapon_Proficiency\">Additional Weapon Proficiency</span><span class=\"mw-editsection\"><span class=\"mw-editsection-bracket\">[</span><a href=\"https://swse.fandom.com/wiki/Weapon_Proficiency?veaction=edit&amp;section=1\" class=\"mw-editsection-visualeditor\" title=\"Edit section: Additional Weapon Proficiency\">edit</a><span class=\"mw-editsection-divider\"> | </span><a href=\"https://swse.fandom.com/wiki/Weapon_Proficiency?action=edit&amp;section=1\" title=\"Edit section: Additional Weapon Proficiency\">\n    <svg class=\"wds-icon wds-icon-tiny section-edit-pencil-icon\">\n     <use xlink:href=\"#wds-icons-pencil-tiny\"></use>\n    </svg>edit source</a><span class=\"mw-editsection-bracket\">]</span></span></h2> \n <p><i>Reference Book:</i>&nbsp;<i><a href=\"https://swse.fandom.com/wiki/Star_Wars_Saga_Edition_Knights_of_the_Old_Republic_Campaign_Guide\" title=\"Star Wars Saga Edition Knights of the Old Republic Campaign Guide\">Star Wars Saga Edition Knights of the Old Republic Campaign Guide</a></i> </p>\n <p><b><a href=\"https://swse.fandom.com/wiki/Combined_Feat\" class=\"mw-redirect\" title=\"Combined Feat\">Combined Feat</a> (<a href=\"https://swse.fandom.com/wiki/Quick_Draw\" title=\"Quick Draw\">Quick Draw</a>):</b> You can draw and ignite your <a href=\"https://swse.fandom.com/wiki/Lightsaber\" class=\"mw-redirect\" title=\"Lightsaber\">Lightsaber</a> as a single <a href=\"https://swse.fandom.com/wiki/Swift_Action\" class=\"mw-redirect\" title=\"Swift Action\">Swift Action</a>. </p> <!-- \nNewPP limit report\nCached time: 20210212123253\nCache expiry: 1209600\nDynamic content: false\nCPU time usage: 0.006 seconds\nReal time usage: 0.008 seconds\nPreprocessor visited node count: 17/1000000\nPreprocessor generated node count: 0/1000000\nPost‐expand include size: 0/2097152 bytes\nTemplate argument size: 0/2097152 bytes\nHighest expansion depth: 2/40\nExpensive parser function count: 0/100\nUnstrip recursion depth: 0/20\nUnstrip post‐expand size: 0/5000000 bytes\n--> <!--\nTransclusion expansion time report (%,ms,calls,template)\n100.00%    0.000      1 -total\n--> <!-- Saved in parser cache with key prod:swse:pcache:idhash:2222-0!canonical and timestamp 20210212123253 and revision id 46047\n --> \n</div>",
                "attributes": {
                    "fortDefenceBonus": {
                        "dtype": "String",
                        "value": ""
                    },
                    "refDefenceBonus": {
                        "dtype": "String",
                        "value": ""
                    },
                    "hitPointEq": {
                        "dtype": "String",
                        "value": ""
                    }
                },
                "choices": [
                    {
                        "options": {
                            "Simple Weapons": {
                                "abilities": [],
                                "payload": "Simple Weapons",
                                "items": []
                            },
                            "Lightsabers": {
                                "abilities": [],
                                "payload": "Lightsabers",
                                "items": []
                            },
                            "Pistols": {
                                "abilities": [],
                                "payload": "Pistols",
                                "items": []
                            },
                            "Advanced Melee Weapons": {
                                "abilities": [],
                                "payload": "Advanced Melee Weapons",
                                "items": []
                            },
                            "Heavy Weapons": {
                                "abilities": [],
                                "payload": "Heavy Weapons",
                                "items": []
                            },
                            "Rifles": {
                                "abilities": [],
                                "payload": "Rifles",
                                "items": []
                            }
                        },
                        "description": "Select a Weapon Proficiency"
                    }
                ],
                "payload": "Simple Weapons",
                "prerequisites": [],
                "categories": [
                    "Feats"
                ],
                "supplyingClass": "Soldier",
                "supplyingSpecies": "",
                "supplyingFeature": "",
                "supplyingFeat": "",
                "isSupplied": true
            },
            "sort": 1300000,
            "flags": {},
            "img": "icons/svg/mystery-man.svg",
            "effects": []
        },
        {
            "_id": "0jkqo1j7eabNWkqh",
            "name": "Armor Proficiency (Medium)",
            "type": "feat",
            "data": {
                "description": "<div class=\"mw-parser-output\">\n <p><i>See also: <a href=\"https://swse.fandom.com/wiki/Feats\" title=\"Feats\">Feats</a></i> </p>\n <p>You are proficient with <a href=\"https://swse.fandom.com/wiki/Medium_Armor\" title=\"Medium Armor\">Medium Armor</a>, and can wear it without impediment. </p>\n <p><b>Prerequisite:</b> <a href=\"https://swse.fandom.com/wiki/Armor_Proficiency_(Light)\" title=\"Armor Proficiency (Light)\">Armor Proficiency (Light)</a> Feat </p>\n <p><b>Effect:</b> When you wear <a href=\"https://swse.fandom.com/wiki/Medium_Armor\" title=\"Medium Armor\">Medium Armor</a>, you take no <a href=\"https://swse.fandom.com/wiki/Armor_Check_Penalty\" class=\"mw-redirect\" title=\"Armor Check Penalty\">Armor Check Penalty</a> on attack rolls or <a href=\"https://swse.fandom.com/wiki/Skill_Checks\" class=\"mw-redirect\" title=\"Skill Checks\">Skill Checks</a>. Additionally, you benefit from all of the armor's special <a href=\"https://swse.fandom.com/wiki/Equipment\" title=\"Equipment\">Equipment</a> bonuses (If any). </p>\n <p><b>Normal:</b>&nbsp;A character who wears <a href=\"https://swse.fandom.com/wiki/Medium_Armor\" title=\"Medium Armor\">Medium Armor</a> with which they are not proficient takes a -5 <a href=\"https://swse.fandom.com/wiki/Armor_Check_Penalty\" class=\"mw-redirect\" title=\"Armor Check Penalty\">Armor Check Penalty</a> on attack rolls as well as <a href=\"https://swse.fandom.com/wiki/Skill_Checks\" class=\"mw-redirect\" title=\"Skill Checks\">Skill Checks</a> made using the following <a href=\"https://swse.fandom.com/wiki/Skills\" title=\"Skills\">Skills</a>: <a href=\"https://swse.fandom.com/wiki/Acrobatics\" title=\"Acrobatics\">Acrobatics</a>, <a href=\"https://swse.fandom.com/wiki/Climb\" title=\"Climb\">Climb</a>, <a href=\"https://swse.fandom.com/wiki/Endurance\" title=\"Endurance\">Endurance</a>, <a href=\"https://swse.fandom.com/wiki/Initiative\" title=\"Initiative\">Initiative</a>, <a href=\"https://swse.fandom.com/wiki/Jump\" title=\"Jump\">Jump</a>, <a href=\"https://swse.fandom.com/wiki/Stealth\" title=\"Stealth\">Stealth</a>, and <a href=\"https://swse.fandom.com/wiki/Swim\" title=\"Swim\">Swim</a>. Additionally, the character gains none of the armor's special <a href=\"https://swse.fandom.com/wiki/Equipment\" title=\"Equipment\">Equipment</a> bonuses. </p> <!-- \nNewPP limit report\nCached time: 20210201011049\nCache expiry: 1209600\nDynamic content: false\nCPU time usage: 0.007 seconds\nReal time usage: 0.008 seconds\nPreprocessor visited node count: 1/1000000\nPreprocessor generated node count: 0/1000000\nPost‐expand include size: 0/2097152 bytes\nTemplate argument size: 0/2097152 bytes\nHighest expansion depth: 1/40\nExpensive parser function count: 0/100\nUnstrip recursion depth: 0/20\nUnstrip post‐expand size: 0/5000000 bytes\n--> <!--\nTransclusion expansion time report (%,ms,calls,template)\n100.00%    0.000      1 -total\n--> <!-- Saved in parser cache with key prod:swse:pcache:idhash:2163-0!canonical and timestamp 20210201011049 and revision id 46055\n --> \n</div>",
                "attributes": {
                    "fortDefenceBonus": {
                        "dtype": "String",
                        "value": ""
                    },
                    "refDefenceBonus": {
                        "dtype": "String",
                        "value": ""
                    },
                    "hitPointEq": {
                        "dtype": "String",
                        "value": ""
                    }
                },
                "choices": [],
                "payload": "Medium",
                "prerequisites": [
                    "Armor Proficiency (Light) Feat"
                ],
                "categories": [
                    "Feats"
                ],
                "supplyingClass": "Soldier",
                "supplyingSpecies": "",
                "supplyingFeature": "",
                "supplyingFeat": "",
                "isSupplied": true
            },
            "sort": 1400000,
            "flags": {},
            "img": "icons/svg/mystery-man.svg",
            "effects": []
        },
        {
            "_id": "W5ahfGSCxmIigHkt",
            "name": "Stun Baton",
            "type": "weapon",
            "data": {
                "description": "<div class=\"mw-parser-output\">\n <p>A short <a href=\"https://swse.fandom.com/wiki/Club\" class=\"mw-redirect\" title=\"Club\">Club</a> with a <a href=\"https://swse.fandom.com/wiki/Power_Pack\" title=\"Power Pack\">Power Pack</a> in the handle, the Stun Baton can be activated to produce a stunning charge when it strikes a target. </p>\n <p>A Stun Baton requires an <a href=\"https://swse.fandom.com/wiki/Energy_Cell\" title=\"Energy Cell\">Energy Cell</a> to operate. </p>    \n</div>",
                "attributes": {},
                "choices": [],
                "payload": "",
                "equipable": true,
                "droidPart": false,
                "bioPart": false,
                "isMod": false,
                "cost": "15",
                "weight": "0.5 Kilograms",
                "availability": "",
                "size": "Small",
                "categories": [
                    "simple melee weapons"
                ],
                "items": [],
                "supplyingClass": "",
                "supplyingSpecies": "",
                "supplyingFeature": "",
                "supplyingFeat": "",
                "isSupplied": false,
                "weapon": {
                    "damage": {
                        "attacks": [
                            {
                                "dtype": "String",
                                "value": "1d6",
                                "key": "base"
                            }
                        ],
                        "finalDamage": "1d6"
                    },
                    "accurate": false,
                    "weaponType": "Simple Melee Weapons",
                    "stun": {
                        "isAvailable": true,
                        "dieEquation": "2d6"
                    },
                    "type": " Bludgeoning or Energy (Stun)",
                    "inaccurate": false,
                    "stripping": {
                        "canReduceRange": false,
                        "canStripStun": true,
                        "canStripDesign": true,
                        "canMakeTiny": false,
                        "makeTiny": false,
                        "canMakeSmall": false,
                        "makeSmall": false,
                        "canMakeMedium": true,
                        "makeLarge": false,
                        "canMakeHuge": false,
                        "makeHuge": false,
                        "canMakeGargantuan": false,
                        "makeGargantuan": false,
                        "canMakeColossal": false,
                        "makeColossal": false
                    },
                    "isBaseExotic": false,
                    "finalWeaponRange": "Simple Melee Weapons",
                    "finalStun": "2d6"
                }
            },
            "sort": 1500000,
            "flags": {
                "core": {
                    "sourceId": "Compendium.world.swse-items.4MeUem9zjxZxBzwp"
                }
            },
            "img": "systems/swse/icon/item/simple melee weapons/default.png",
            "effects": []
        },
        {
            "_id": "NwjZbPexItnhUSvl",
            "name": "Sonic Stunner",
            "type": "weapon",
            "data": {
                "description": "<div class=\"mw-parser-output\">\n <p><i>Reference Book:</i> <i><a href=\"https://swse.fandom.com/wiki/Star_Wars_Saga_Edition_Threats_of_the_Galaxy\" title=\"Star Wars Saga Edition Threats of the Galaxy\">Star Wars Saga Edition Threats of the Galaxy</a></i> </p>\n <p>A Sonic Stunner creates waves of sonic energy that assault the aural receptors of anyone it targets. The weapon fires a concentrated burst of sonic energy (Using technology similar to sonic weapons used by <a href=\"https://swse.fandom.com/wiki/Geonosian\" title=\"Geonosian\">Geonosians</a>) that manipulates the minds of living beings, causing them great pain. Even deaf creatures can be harmed by a Sonic Stunner, because it creates high-frequency vibrations that penetrate the brain. However, unlike with most blaster weapons, only the target of the attack hears any noise, making the weapon otherwise silent. </p>    \n</div>",
                "attributes": {},
                "choices": [],
                "payload": "",
                "equipable": true,
                "droidPart": false,
                "bioPart": false,
                "isMod": false,
                "cost": "450",
                "weight": "1 Kilogram",
                "availability": "Illegal",
                "size": "Tiny",
                "categories": [
                    "Pistols",
                    "Ranged Weapons",
                    "pistols"
                ],
                "items": [],
                "supplyingClass": "",
                "supplyingSpecies": "",
                "supplyingFeature": "",
                "supplyingFeat": "",
                "isSupplied": false,
                "weapon": {
                    "accurate": false,
                    "weaponType": "Pistols",
                    "stun": {
                        "isOnly": true,
                        "isAvailable": true,
                        "dieEquation": "3d6"
                    },
                    "type": " Energy",
                    "inaccurate": false,
                    "ratesOfFire": [
                        "Single-Shot"
                    ],
                    "stripping": {
                        "canReduceRange": true,
                        "canStripAutofire": false,
                        "canStripStun": false,
                        "canStripDesign": true,
                        "canMakeTiny": false,
                        "makeTiny": false,
                        "canMakeSmall": true,
                        "makeMedium": false,
                        "canMakeLarge": false,
                        "makeLarge": false,
                        "canMakeHuge": false,
                        "makeHuge": false,
                        "canMakeGargantuan": false,
                        "makeGargantuan": false,
                        "canMakeColossal": false,
                        "makeColossal": false,
                        "damage": false,
                        "makeSmall": false,
                        "range": false,
                        "design": false
                    },
                    "isBaseExotic": false,
                    "finalWeaponRange": "Pistols",
                    "finalStun": "3d6",
                    "finalRatesOfFire": "Single-Shot"
                }
            },
            "sort": 1600000,
            "flags": {
                "core": {
                    "sourceId": "Compendium.world.swse-items.RXQSq9Kh36Jaum7z"
                }
            },
            "img": "systems/swse/icon/item/pistols/default.png",
            "effects": []
        }
    ],
    "effects": [],
    "age": "",
    "gender": "",
    "height": "",
    "weight": "",
    "destiny": "",
    "ecl": "",
    "condition": 0
}

actorData.data.offense = {bab: 1, mab: 3, rab: 1, fab: 1}

let actor = {data: actorData};
actor.getHalfCharacterLevel = function () {
    return 4
};
actor.getAttributeMod = function (attribute) {
    return 4
};

let offense = {bab: 1, mab: 3, rab: 1, fab: 1}

let item = {
    "_id": "W5ahfGSCxmIigHkt",
    "name": "Stun Baton",
    "type": "weapon",
    "data": {
        "description": "<div class=\"mw-parser-output\">\n <p>A short <a href=\"https://swse.fandom.com/wiki/Club\" class=\"mw-redirect\" title=\"Club\">Club</a> with a <a href=\"https://swse.fandom.com/wiki/Power_Pack\" title=\"Power Pack\">Power Pack</a> in the handle, the Stun Baton can be activated to produce a stunning charge when it strikes a target. </p>\n <p>A Stun Baton requires an <a href=\"https://swse.fandom.com/wiki/Energy_Cell\" title=\"Energy Cell\">Energy Cell</a> to operate. </p>    \n</div>",
        "attributes": {},
        "choices": [],
        "payload": "",
        "equipable": true,
        "droidPart": false,
        "bioPart": false,
        "isMod": false,
        "cost": "15",
        "weight": "0.5 Kilograms",
        "availability": "",
        "size": "Small",
        "categories": [
            "simple melee weapons"
        ],
        "items": [],
        "supplyingClass": "",
        "supplyingSpecies": "",
        "supplyingFeature": "",
        "supplyingFeat": "",
        "isSupplied": false,
        "weapon": {
            "damage": {
                "attacks": [
                    {
                        "dtype": "String",
                        "value": "1d6",
                        "key": "base"
                    }
                ],
                "finalDamage": "1d6"
            },
            "accurate": false,
            "weaponType": "Simple Melee Weapons",
            "stun": {
                "isAvailable": true,
                "dieEquation": "2d6"
            },
            "type": " Bludgeoning or Energy (Stun)",
            "inaccurate": false,
            "stripping": {
                "canReduceRange": false,
                "canStripStun": true,
                "canStripDesign": true,
                "canMakeTiny": false,
                "makeTiny": false,
                "canMakeSmall": false,
                "makeSmall": false,
                "canMakeMedium": true,
                "makeLarge": false,
                "canMakeHuge": false,
                "makeHuge": false,
                "canMakeGargantuan": false,
                "makeGargantuan": false,
                "canMakeColossal": false,
                "makeColossal": false
            },
            "isBaseExotic": false,
            "finalWeaponRange": "Simple Melee Weapons",
            "finalStun": "2d6"
        },
        "textDescription": "\n A short Club with a Power Pack in the handle, the Stun Baton can be activated to produce a stunning charge when it strikes a target. \n A Stun Baton requires an Energy Cell to operate.     \n",
        "upgradePoints": 1,
        "finalSize": "Small"
    },
    "sort": 1500000,
    "flags": {
        "core": {
            "sourceId": "Compendium.world.swse-items.4MeUem9zjxZxBzwp"
        }
    },
    "img": "systems/swse/icon/item/simple melee weapons/default.png",
    "effects": [],
    "mods": []
};
//let actual = new AttackHandler().resolveStunAttack(item, actor,false, offense, 3, false,0, false, 2);


let expected = {
    isStunOnly: false,
    attacks: [
        {
            name: 'Stun Baton [STUN]',
            th: '1d20+3',
            dam: '2d6+6',
            sound: '',
            itemId: 'W5ahfGSCxmIigHkt',
            actorId: 'sqx3fSqKp9goZL7q',
            img: 'systems/swse/icon/item/simple melee weapons/default.png'
        }
    ]
}

//console.log(actual, expected)

//console.log(JSON.stringify(actual) === JSON.stringify(expected))

//console.assert(JSON.stringify(actual) === JSON.stringify(expected), JSON.stringify(actual) +","+ JSON.stringify(expected))

let generateUnarmedAttacksResponse = new AttackHandler().generateUnarmedAttacks(null, actor);

console.log(generateUnarmedAttacksResponse);

let shit = {
    "0": [
        {
            "_id": "W5ahfGSCxmIigHkt",
            "name": "Stun Baton",
            "type": "weapon",
            "data": {
                "description": "<div class=\"mw-parser-output\">\n <p>A short <a href=\"https://swse.fandom.com/wiki/Club\" class=\"mw-redirect\" title=\"Club\">Club</a> with a <a href=\"https://swse.fandom.com/wiki/Power_Pack\" title=\"Power Pack\">Power Pack</a> in the handle, the Stun Baton can be activated to produce a stunning charge when it strikes a target. </p>\n <p>A Stun Baton requires an <a href=\"https://swse.fandom.com/wiki/Energy_Cell\" title=\"Energy Cell\">Energy Cell</a> to operate. </p>    \n</div>",
                "attributes": {},
                "choices": [],
                "payload": "",
                "equipable": true,
                "droidPart": false,
                "bioPart": false,
                "isMod": false,
                "cost": "15",
                "weight": "0.5 Kilograms",
                "availability": "",
                "size": "Small",
                "categories": [
                    "simple melee weapons"
                ],
                "items": [],
                "supplyingClass": "",
                "supplyingSpecies": "",
                "supplyingFeature": "",
                "supplyingFeat": "",
                "isSupplied": false,
                "weapon": {
                    "damage": {
                        "attacks": [
                            {
                                "dtype": "String",
                                "value": "1d6",
                                "key": "base"
                            }
                        ],
                        "finalDamage": "1d6"
                    },
                    "accurate": false,
                    "weaponType": "Simple Melee Weapons",
                    "stun": {
                        "isAvailable": true,
                        "dieEquation": "2d6"
                    },
                    "type": " Bludgeoning or Energy (Stun)",
                    "inaccurate": false,
                    "stripping": {
                        "canReduceRange": false,
                        "canStripStun": true,
                        "canStripDesign": true,
                        "canMakeTiny": false,
                        "makeTiny": false,
                        "canMakeSmall": false,
                        "makeSmall": false,
                        "canMakeMedium": true,
                        "makeLarge": false,
                        "canMakeHuge": false,
                        "makeHuge": false,
                        "canMakeGargantuan": false,
                        "makeGargantuan": false,
                        "canMakeColossal": false,
                        "makeColossal": false
                    },
                    "isBaseExotic": false,
                    "finalWeaponRange": "Simple Melee Weapons",
                    "finalStun": "2d6"
                },
                "textDescription": "\n A short Club with a Power Pack in the handle, the Stun Baton can be activated to produce a stunning charge when it strikes a target. \n A Stun Baton requires an Energy Cell to operate.     \n",
                "upgradePoints": 1,
                "finalSize": "Small"
            },
            "sort": 1500000,
            "flags": {
                "core": {
                    "sourceId": "Compendium.world.swse-items.4MeUem9zjxZxBzwp"
                }
            },
            "img": "systems/swse/icon/item/simple melee weapons/default.png",
            "effects": [],
            "mods": []
        },
        {
            "_id": "NwjZbPexItnhUSvl",
            "name": "Sonic Stunner",
            "type": "weapon",
            "data": {
                "description": "<div class=\"mw-parser-output\">\n <p><i>Reference Book:</i> <i><a href=\"https://swse.fandom.com/wiki/Star_Wars_Saga_Edition_Threats_of_the_Galaxy\" title=\"Star Wars Saga Edition Threats of the Galaxy\">Star Wars Saga Edition Threats of the Galaxy</a></i> </p>\n <p>A Sonic Stunner creates waves of sonic energy that assault the aural receptors of anyone it targets. The weapon fires a concentrated burst of sonic energy (Using technology similar to sonic weapons used by <a href=\"https://swse.fandom.com/wiki/Geonosian\" title=\"Geonosian\">Geonosians</a>) that manipulates the minds of living beings, causing them great pain. Even deaf creatures can be harmed by a Sonic Stunner, because it creates high-frequency vibrations that penetrate the brain. However, unlike with most blaster weapons, only the target of the attack hears any noise, making the weapon otherwise silent. </p>    \n</div>",
                "attributes": {},
                "choices": [],
                "payload": "",
                "equipable": true,
                "droidPart": false,
                "bioPart": false,
                "isMod": false,
                "cost": "450",
                "weight": "1 Kilogram",
                "availability": "Illegal",
                "size": "Tiny",
                "categories": [
                    "Pistols",
                    "Ranged Weapons",
                    "pistols"
                ],
                "items": [],
                "supplyingClass": "",
                "supplyingSpecies": "",
                "supplyingFeature": "",
                "supplyingFeat": "",
                "isSupplied": false,
                "weapon": {
                    "accurate": false,
                    "weaponType": "Pistols",
                    "stun": {
                        "isOnly": true,
                        "isAvailable": true,
                        "dieEquation": "3d6"
                    },
                    "type": " Energy",
                    "inaccurate": false,
                    "ratesOfFire": [
                        "Single-Shot"
                    ],
                    "stripping": {
                        "canReduceRange": true,
                        "canStripAutofire": false,
                        "canStripStun": false,
                        "canStripDesign": true,
                        "canMakeTiny": false,
                        "makeTiny": false,
                        "canMakeSmall": true,
                        "makeMedium": false,
                        "canMakeLarge": false,
                        "makeLarge": false,
                        "canMakeHuge": false,
                        "makeHuge": false,
                        "canMakeGargantuan": false,
                        "makeGargantuan": false,
                        "canMakeColossal": false,
                        "makeColossal": false,
                        "damage": false,
                        "makeSmall": false,
                        "range": false,
                        "design": false,
                        "canMakeMedium": false
                    },
                    "isBaseExotic": false,
                    "finalWeaponRange": "Pistols",
                    "finalStun": "3d6",
                    "finalRatesOfFire": "Single-Shot"
                },
                "textDescription": "\n Reference Book: Star Wars Saga Edition Threats of the Galaxy \n A Sonic Stunner creates waves of sonic energy that assault the aural receptors of anyone it targets. The weapon fires a concentrated burst of sonic energy (Using technology similar to sonic weapons used by Geonosians) that manipulates the minds of living beings, causing them great pain. Even deaf creatures can be harmed by a Sonic Stunner, because it creates high-frequency vibrations that penetrate the brain. However, unlike with most blaster weapons, only the target of the attack hears any noise, making the weapon otherwise silent.     \n",
                "upgradePoints": 1,
                "finalSize": "Tiny"
            },
            "sort": 1600000,
            "flags": {
                "core": {
                    "sourceId": "Compendium.world.swse-items.RXQSq9Kh36Jaum7z"
                }
            },
            "img": "systems/swse/icon/item/pistols/default.png",
            "effects": [],
            "mods": []
        }
    ],
    "1": {
        "_id": "sqx3fSqKp9goZL7q",
        "name": "test actor",
        "permission": {
            "default": 3,
            "3YLIH0KbPBFrWWji": 3
        },
        "type": "character",
        "data": {
            "health": {
                "value": null,
                "min": 0,
                "max": 10,
                "condition": 0,
                "temp": null,
                "dr": null,
                "sr": null,
                "rolledHp": null
            },
            "equippedIds": [
                "NwjZbPexItnhUSvl",
                "W5ahfGSCxmIigHkt"
            ],
            "classesfirst": "YBa3AOVFL8itd14p",
            "abilities": {
                "str": {
                    "total": 10,
                    "mod": 0,
                    "classLevelBonus": 0,
                    "speciesBonus": 0,
                    "ageBonus": 0,
                    "equipmentBonus": 0,
                    "buffBonus": 0,
                    "customBonus": 0,
                    "bonus": 0,
                    "base": 18
                },
                "dex": {
                    "total": 10,
                    "mod": 0,
                    "classLevelBonus": 0,
                    "speciesBonus": 0,
                    "ageBonus": 0,
                    "equipmentBonus": 0,
                    "buffBonus": 0,
                    "customBonus": 0,
                    "bonus": 0,
                    "base": 8
                },
                "con": {
                    "total": 10,
                    "mod": 0,
                    "classLevelBonus": 0,
                    "speciesBonus": 0,
                    "ageBonus": 0,
                    "equipmentBonus": 0,
                    "buffBonus": 0,
                    "customBonus": 0,
                    "bonus": 0,
                    "base": 8
                },
                "int": {
                    "total": 10,
                    "mod": 0,
                    "classLevelBonus": 0,
                    "speciesBonus": 0,
                    "ageBonus": 0,
                    "equipmentBonus": 0,
                    "buffBonus": 0,
                    "customBonus": 0,
                    "bonus": 0,
                    "base": 8
                },
                "wis": {
                    "total": 10,
                    "mod": 0,
                    "classLevelBonus": 0,
                    "speciesBonus": 0,
                    "ageBonus": 0,
                    "equipmentBonus": 0,
                    "buffBonus": 0,
                    "customBonus": 0,
                    "bonus": 0,
                    "base": 8
                },
                "cha": {
                    "total": 10,
                    "mod": 0,
                    "classLevelBonus": 0,
                    "speciesBonus": 0,
                    "ageBonus": 0,
                    "equipmentBonus": 0,
                    "buffBonus": 0,
                    "customBonus": 0,
                    "bonus": 0,
                    "base": 11
                }
            },
            "skills": {
                "acrobatics": {
                    "value": 0,
                    "ability": "dex",
                    "uut": true,
                    "trained": false,
                    "acp": true,
                    "link": "https://swse.fandom.com/wiki/acrobatics"
                },
                "climb": {
                    "value": 0,
                    "ability": "str",
                    "uut": true,
                    "trained": false,
                    "acp": true,
                    "link": "https://swse.fandom.com/wiki/climb"
                },
                "deception": {
                    "value": 0,
                    "ability": "cha",
                    "uut": true,
                    "trained": false,
                    "acp": false,
                    "link": "https://swse.fandom.com/wiki/deception"
                },
                "endurance": {
                    "value": 0,
                    "ability": "con",
                    "uut": true,
                    "trained": false,
                    "acp": true,
                    "link": "https://swse.fandom.com/wiki/endurance"
                },
                "gather information": {
                    "value": 0,
                    "ability": "cha",
                    "uut": true,
                    "trained": false,
                    "acp": false,
                    "link": "https://swse.fandom.com/wiki/gather_information"
                },
                "initiative": {
                    "value": 0,
                    "ability": "dex",
                    "uut": true,
                    "trained": false,
                    "acp": true,
                    "link": "https://swse.fandom.com/wiki/initiative"
                },
                "jump": {
                    "value": 0,
                    "ability": "str",
                    "uut": true,
                    "trained": false,
                    "acp": true,
                    "link": "https://swse.fandom.com/wiki/jump"
                },
                "knowledge (bureaucracy)": {
                    "value": 0,
                    "ability": "int",
                    "uut": true,
                    "trained": false,
                    "acp": false,
                    "link": "https://swse.fandom.com/wiki/knowledge"
                },
                "knowledge (galactic lore)": {
                    "value": 0,
                    "ability": "int",
                    "uut": true,
                    "trained": false,
                    "acp": false,
                    "link": "https://swse.fandom.com/wiki/knowledge"
                },
                "knowledge (life sciences)": {
                    "value": 0,
                    "ability": "int",
                    "uut": true,
                    "trained": false,
                    "acp": false,
                    "link": "https://swse.fandom.com/wiki/knowledge"
                },
                "knowledge (physical sciences)": {
                    "value": 0,
                    "ability": "int",
                    "uut": true,
                    "trained": false,
                    "acp": false,
                    "link": "https://swse.fandom.com/wiki/knowledge"
                },
                "knowledge (social sciences)": {
                    "value": 0,
                    "ability": "int",
                    "uut": true,
                    "trained": false,
                    "acp": false,
                    "link": "https://swse.fandom.com/wiki/knowledge"
                },
                "knowledge (tactics)": {
                    "value": 0,
                    "ability": "int",
                    "uut": true,
                    "trained": false,
                    "acp": false,
                    "link": "https://swse.fandom.com/wiki/knowledge"
                },
                "knowledge (technology)": {
                    "value": 0,
                    "ability": "int",
                    "uut": true,
                    "trained": false,
                    "acp": false,
                    "link": "https://swse.fandom.com/wiki/knowledge"
                },
                "mechanics": {
                    "value": 0,
                    "ability": "int",
                    "uut": false,
                    "trained": false,
                    "acp": false,
                    "link": "https://swse.fandom.com/wiki/mechanics"
                },
                "perception": {
                    "value": 0,
                    "ability": "wis",
                    "uut": true,
                    "trained": false,
                    "acp": false,
                    "link": "https://swse.fandom.com/wiki/perception"
                },
                "persuasion": {
                    "value": 0,
                    "ability": "cha",
                    "uut": true,
                    "trained": false,
                    "acp": false,
                    "link": "https://swse.fandom.com/wiki/persuasion"
                },
                "pilot": {
                    "value": 0,
                    "ability": "dex",
                    "uut": true,
                    "trained": false,
                    "acp": false,
                    "link": "https://swse.fandom.com/wiki/pilot"
                },
                "ride": {
                    "value": 0,
                    "ability": "dex",
                    "uut": true,
                    "trained": false,
                    "acp": false,
                    "link": "https://swse.fandom.com/wiki/ride"
                },
                "stealth": {
                    "value": 0,
                    "ability": "dex",
                    "uut": true,
                    "trained": false,
                    "acp": true,
                    "link": "https://swse.fandom.com/wiki/stealth"
                },
                "survival": {
                    "value": 0,
                    "ability": "wis",
                    "uut": true,
                    "trained": false,
                    "acp": false,
                    "link": "https://swse.fandom.com/wiki/survival"
                },
                "swim": {
                    "value": 0,
                    "ability": "str",
                    "uut": true,
                    "trained": false,
                    "acp": true,
                    "link": "https://swse.fandom.com/wiki/swim"
                },
                "treat injury": {
                    "value": 0,
                    "ability": "wis",
                    "uut": true,
                    "trained": false,
                    "acp": false,
                    "link": "https://swse.fandom.com/wiki/treat_injury"
                },
                "use computer": {
                    "value": 0,
                    "ability": "int",
                    "uut": true,
                    "trained": false,
                    "acp": false,
                    "link": "https://swse.fandom.com/wiki/use_computer"
                },
                "use the force": {
                    "value": 0,
                    "ability": "cha",
                    "uut": true,
                    "trained": false,
                    "acp": false,
                    "link": "https://swse.fandom.com/wiki/use_the_force"
                }
            },
            "biography": "",
            "attributes": {
                "level": {
                    "value": 1
                }
            },
            "attributeGenerationType": "Roll",
            "levelAttributeBonus": {}
        },
        "sort": 100001,
        "flags": {},
        "token": {
            "flags": {},
            "name": "test actor",
            "displayName": 0,
            "img": "icons/svg/mystery-man.svg",
            "tint": null,
            "width": 1,
            "height": 1,
            "scale": 1,
            "lockRotation": false,
            "rotation": 0,
            "vision": false,
            "dimSight": 0,
            "brightSight": 0,
            "dimLight": 0,
            "brightLight": 0,
            "sightAngle": 360,
            "lightAngle": 360,
            "lightAlpha": 1,
            "lightAnimation": {
                "speed": 5,
                "intensity": 5
            },
            "actorId": "sqx3fSqKp9goZL7q",
            "actorLink": true,
            "disposition": -1,
            "displayBars": 0,
            "bar1": {},
            "bar2": {},
            "randomImg": false
        },
        "items": [
            {
                "_id": "f0iEnRXXt3btE75U",
                "name": "Small",
                "type": "ability",
                "data": {
                    "description": "<div class=\"mw-parser-output\">\n <p>As Small creatures, beings gain a +1 size bonus to their&nbsp;<a href=\"https://swse.fandom.com/wiki/Reflex_Defense\" class=\"mw-redirect\" title=\"Reflex Defense\">Reflex Defense</a>&nbsp;and a +5 size bonus on&nbsp;<a href=\"https://swse.fandom.com/wiki/Stealth\" title=\"Stealth\">Stealth</a>&nbsp;checks. However, their lifting and carrying limits are three-quarters of those of <a href=\"https://swse.fandom.com/wiki/Category:Medium\" title=\"Category:Medium\">Medium</a> characters. </p> <!-- \nNewPP limit report\nCached time: 20210128183103\nCache expiry: 1209600\nDynamic content: false\nCPU time usage: 0.003 seconds\nReal time usage: 0.004 seconds\nPreprocessor visited node count: 1/1000000\nPreprocessor generated node count: 0/1000000\nPost‐expand include size: 0/2097152 bytes\nTemplate argument size: 0/2097152 bytes\nHighest expansion depth: 1/40\nExpensive parser function count: 0/100\nUnstrip recursion depth: 0/20\nUnstrip post‐expand size: 0/5000000 bytes\n--> <!--\nTransclusion expansion time report (%,ms,calls,template)\n100.00%    0.000      1 -total\n--> <!-- Saved in parser cache with key prod:swse:pcache:idhash:12866-0!canonical and timestamp 20210128183103 and revision id 38469\n --> \n</div>",
                    "attributes": {
                        "sizeModifier": 1,
                        "sneakModifier": 5
                    },
                    "choices": [],
                    "payload": "",
                    "categories": [
                        "Species Traits"
                    ],
                    "supplyingClass": "",
                    "supplyingSpecies": "1st-Degree Droid Model",
                    "supplyingFeature": "",
                    "supplyingFeat": "",
                    "isSupplied": true
                },
                "sort": 100000,
                "flags": {},
                "img": "icons/svg/mystery-man.svg",
                "effects": []
            },
            {
                "_id": "AO1S3CdL5xhSh08E",
                "name": "1st-Degree Droid Model",
                "type": "species",
                "data": {
                    "description": "<div class=\"mw-parser-output\">\n <p><i>See also: <a href=\"https://swse.fandom.com/wiki/Droids\" title=\"Droids\">Droids</a></i> </p>\n <p>A&nbsp;1st-Degree&nbsp;or&nbsp;Class One Droid&nbsp;is&nbsp;programmed&nbsp;for the mathematical, medical, or physical sciences. Subcategories of the 1st-Degree are&nbsp;medical Droids, biological science Droids, physical science Droids, and mathematics Droids. </p>  \n <h3><span class=\"mw-headline\" id=\"1st-Degree_Droid_Traits\">1st-Degree Droid Traits</span></h3> \n <p>1st-Degree have the following special traits: </p>\n <p><b>Ability Modifiers:</b> All 1st-Degree Droids receive +2 bonuses to both their <a href=\"https://swse.fandom.com/wiki/Intelligence\" title=\"Intelligence\">Intelligence</a> and <a href=\"https://swse.fandom.com/wiki/Wisdom\" title=\"Wisdom\">Wisdom</a> scores, but suffer a -2 penalty to their <a href=\"https://swse.fandom.com/wiki/Strength\" title=\"Strength\">Strength</a> score. </p>\n <p><b>Behavioral Inhibitors:</b> 1st-Degree Droids firstly cannot knowingly harm a sentient creature, unless another creature would be harmed due to inaction. 1st-Degree Droids secondly obey orders from their designated owner (Whether that be an actual owner or themselves). </p>\n <p><b>Droid Traits:</b> All 1st-Degree Droids posses <a href=\"https://swse.fandom.com/wiki/Droid_Traits\" title=\"Droid Traits\">Droid Traits</a>. </p>\n <p><b>Droid Talents:</b> All 1st-Degree Droids can select <a href=\"https://swse.fandom.com/wiki/Droid_Talents\" title=\"Droid Talents\">Droid Talents</a> from the <a href=\"https://swse.fandom.com/wiki/1st-Degree_Droid_Talent_Tree\" title=\"1st-Degree Droid Talent Tree\">1st-Degree Droid Talent Tree</a>. </p> \n <table class=\"wikitable\"> \n  <tbody>\n   <tr> \n    <th>DROID MODEL </th> \n    <th>CHALLENGE LEVEL </th> \n    <th>AVAILABLE FOR PLAYER DROID </th> \n    <th>IMAGE </th>\n   </tr> \n   <tr> \n    <td><a href=\"https://swse.fandom.com/wiki/2-1B_Medical_Droid\" title=\"2-1B Medical Droid\">2-1B Medical Droid</a> </td> \n    <td>CL 0 </td> \n    <td>Yes </td> \n    <td> </td>\n   </tr>\n  </tbody>\n </table> \n <h2><span class=\"mw-headline\" id=\"Additional_1st-Degree_Droids\">Additional 1st-Degree Droids</span></h2> \n <p>The below 1st-Degree Droid Models include all 1st-Degree Droid Models found throughout the&nbsp;<i>Star Wars Saga Edition</i>&nbsp;addons. </p> \n <h3><span class=\"mw-headline\" id=\"Threats_of_the_Galaxy\"><a href=\"https://swse.fandom.com/wiki/Threats_of_the_Galaxy\" class=\"mw-redirect\" title=\"Threats of the Galaxy\">Threats of the Galaxy</a></span></h3> \n <table class=\"wikitable\"> \n  <tbody>\n   <tr> \n    <th>DROID MODEL </th> \n    <th>CHALLENGE LEVEL </th> \n    <th>AVAILABLE FOR PLAYER <p>DROID </p> </th> \n    <th>IMAGE </th>\n   </tr> \n   <tr> \n    <td><a href=\"https://swse.fandom.com/wiki/GH-7_Medical_Droid\" title=\"GH-7 Medical Droid\">GH-7 Medical Droid</a> </td> \n    <td>CL 1 </td> \n    <td>Yes </td> \n    <td> </td>\n   </tr> \n   <tr> \n    <td><a href=\"https://swse.fandom.com/wiki/T0-D_Interrogation_Droid\" title=\"T0-D Interrogation Droid\">T0-D Interrogation Droid</a> </td> \n    <td>CL 4 </td> \n    <td>No </td> \n    <td> </td>\n   </tr>\n  </tbody>\n </table> \n <h3><span class=\"mw-headline\" id=\"Knights_of_the_Old_Republic_Campaign_Guide\"><a href=\"https://swse.fandom.com/wiki/Knights_of_the_Old_Republic_Campaign_Guide\" class=\"mw-redirect\" title=\"Knights of the Old Republic Campaign Guide\">Knights of the Old Republic Campaign Guide</a></span></h3> \n <p>Droids play an important part in any <a href=\"https://swse.fandom.com/wiki/Old_Republic_Campaign\" class=\"mw-redirect\" title=\"Old Republic Campaign\">Old Republic Campaign</a>. Droids are just as prominent during the days of <a href=\"https://swse.fandom.com/wiki/The_Old_Republic\" title=\"The Old Republic\">The Old Republic</a> as they are in later years, and many models are the obvious predecessors of Droids used during the Galactic Civil War. </p> \n <table class=\"wikitable\"> \n  <tbody>\n   <tr> \n    <th>DROID MODEL </th> \n    <th>CHALLENGE LEVEL </th> \n    <th>AVAILABLE FOR PLAYER DROID </th> \n    <th>IMAGE </th>\n   </tr> \n   <tr> \n    <td><a href=\"https://swse.fandom.com/wiki/ET-74_Communications_Droid\" title=\"ET-74 Communications Droid\">ET-74 Communications Droid</a> </td> \n    <td>CL 0 </td> \n    <td>Yes </td> \n    <td> </td>\n   </tr>\n  </tbody>\n </table> \n <h3><span class=\"mw-headline\" id=\"Clone_Wars_Campaign_Guide\"><a href=\"https://swse.fandom.com/wiki/Clone_Wars_Campaign_Guide\" class=\"mw-redirect\" title=\"Clone Wars Campaign Guide\">Clone Wars Campaign Guide</a></span></h3> \n <p>The Clone Wars saw the rapid development of Droid technology, mainly due to the Separatists' heavy reliance on Droid military units. The&nbsp;Droids&nbsp;presented in this chapter are some of the models found in use in nonmilitary capacities. </p> \n <table class=\"wikitable\"> \n  <tbody>\n   <tr> \n    <th>DROID MODEL </th> \n    <th>CHALLENGE LEVEL </th> \n    <th>AVAILABLE FOR PLAYER DROID </th> \n    <th>IMAGE </th>\n   </tr> \n   <tr> \n    <td><a href=\"https://swse.fandom.com/wiki/DD-13_Medical_Assistant_Droid\" title=\"DD-13 Medical Assistant Droid\">DD-13 Medical Assistant Droid</a> </td> \n    <td>CL 1 </td> \n    <td>No </td> \n    <td> </td>\n   </tr> \n   <tr> \n    <td><a href=\"https://swse.fandom.com/wiki/EW-3_Midwife_Droid\" title=\"EW-3 Midwife Droid\">EW-3 Midwife Droid</a> </td> \n    <td>CL 0 </td> \n    <td>Yes </td> \n    <td> </td>\n   </tr> \n   <tr> \n    <td><a href=\"https://swse.fandom.com/wiki/FX-6_Medical_Assistance_Droid\" title=\"FX-6 Medical Assistance Droid\">FX-6 Medical Assistance Droid</a> </td> \n    <td>CL 1 </td> \n    <td>Yes </td> \n    <td> </td>\n   </tr> \n   <tr> \n    <td><a href=\"https://swse.fandom.com/wiki/IM-6_Medical_Droid\" title=\"IM-6 Medical Droid\">IM-6 Medical Droid</a> </td> \n    <td>CL 1 </td> \n    <td>Yes </td> \n    <td> </td>\n   </tr> \n   <tr> \n    <td><a href=\"https://swse.fandom.com/wiki/SP-4_Analysis_Droid\" title=\"SP-4 Analysis Droid\">SP-4 Analysis Droid</a> </td> \n    <td>CL 1 </td> \n    <td>Yes </td> \n    <td> </td>\n   </tr>\n  </tbody>\n </table> \n <h3><span class=\"mw-headline\" id=\"Legacy_Era_Campaign_Guide\"><a href=\"https://swse.fandom.com/wiki/Legacy_Era_Campaign_Guide\" class=\"mw-redirect\" title=\"Legacy Era Campaign Guide\">Legacy Era Campaign Guide</a></span></h3> \n <p>The following&nbsp;Droids&nbsp;are common sights across the galaxy during&nbsp;<a href=\"https://swse.fandom.com/wiki/The_Legacy_Era\" class=\"mw-redirect\" title=\"The Legacy Era\">The Legacy Era</a>. </p> \n <table class=\"wikitable\"> \n  <tbody>\n   <tr> \n    <th>DROID MODEL </th> \n    <th>CHALLENGE LEVEL </th> \n    <th>AVAILABLE FOR PLAYER DROID </th> \n    <th>IMAGE </th>\n   </tr> \n   <tr> \n    <td><a href=\"https://swse.fandom.com/wiki/3Z3_Medical_Droid\" title=\"3Z3 Medical Droid\">3Z3 Medical Droid</a> </td> \n    <td>CL 1 </td> \n    <td>Yes </td> \n    <td> </td>\n   </tr> \n   <tr> \n    <td><a href=\"https://swse.fandom.com/wiki/BL-39_Interrogator_Droid\" title=\"BL-39 Interrogator Droid\">BL-39 Interrogator Droid</a> </td> \n    <td>CL 1 </td> \n    <td>Yes </td> \n    <td> </td>\n   </tr> \n   <tr> \n    <td><a href=\"https://swse.fandom.com/wiki/PI-Series_Medical_Assistant_Droid\" title=\"PI-Series Medical Assistant Droid\">PI-Series Medical Assistant Droid</a> </td> \n    <td>CL 0 </td> \n    <td>No </td> \n    <td> </td>\n   </tr>\n  </tbody>\n </table> \n <h3><span class=\"mw-headline\" id=\"Rebellion_Era_Campaign_Guide\"><a href=\"https://swse.fandom.com/wiki/Rebellion_Era_Campaign_Guide\" class=\"mw-redirect\" title=\"Rebellion Era Campaign Guide\">Rebellion Era Campaign Guide</a></span></h3> \n <p>The most common 1st-Degree Droids are medical models; civilians rarely encounter other types of 1st-Degree Droids. Newer models are very expensive and heavily licensed by the Empire, so most beings do with whatever older models they can keep running. </p> \n <table class=\"wikitable\"> \n  <tbody>\n   <tr> \n    <th>DROID MODEL </th> \n    <th>CHALLENGE LEVEL </th> \n    <th>AVAILABLE FOR PLAYER DROID </th> \n    <th>IMAGE </th>\n   </tr> \n   <tr> \n    <td><a href=\"https://swse.fandom.com/wiki/FX-7_Medical_Droid\" title=\"FX-7 Medical Droid\">FX-7 Medical Droid</a> </td> \n    <td>CL 0 </td> \n    <td>No </td> \n    <td> </td>\n   </tr>\n  </tbody>\n </table> \n <h3><span class=\"mw-headline\" id=\"Galaxy_at_War\"><a href=\"https://swse.fandom.com/wiki/Galaxy_at_War\" class=\"mw-redirect\" title=\"Galaxy at War\">Galaxy at War</a></span></h3> \n <p>Although soldiers are loath to admit it, Droids can be invaluable assets in battle, whether as support or as front-line combatants. Even in eras when Droids are less common or distrusted- such as <a href=\"https://swse.fandom.com/wiki/The_Dark_Times\" class=\"mw-redirect\" title=\"The Dark Times\">The Dark Times</a>- they are still utilized in some fashion. </p> \n <table class=\"wikitable\"> \n  <tbody>\n   <tr> \n    <th>DROID MODEL </th> \n    <th>CHALLENGE LEVEL </th> \n    <th>AVAILABLE FOR PLAYER DROID </th> \n    <th>IMAGE </th>\n   </tr> \n   <tr> \n    <td><a href=\"https://swse.fandom.com/wiki/A-Series_Medical_Droid\" title=\"A-Series Medical Droid\">A-Series Medical Droid</a> </td> \n    <td>CL 1 </td> \n    <td>Yes </td> \n    <td> </td>\n   </tr>\n  </tbody>\n </table> \n <h3><span id=\"Scavenger's_Guide_to_Droids\"></span><span class=\"mw-headline\" id=\"Scavenger.27s_Guide_to_Droids\"><a href=\"https://swse.fandom.com/wiki/Scavenger%27s_Guide_to_Droids\" class=\"mw-redirect\" title=\"Scavenger's Guide to Droids\">Scavenger's Guide to Droids</a></span></h3> \n <table class=\"wikitable\"> \n  <tbody>\n   <tr> \n    <th>DROID MODEL </th> \n    <th>CHALLENGE LEVEL </th> \n    <th>AVAILABLE FOR PLAYER DROID </th> \n    <th>IMAGE </th>\n   </tr> \n   <tr> \n    <td><a href=\"https://swse.fandom.com/wiki/88-Series_Administration_Droid\" title=\"88-Series Administration Droid\">88-Series Administration Droid</a> </td> \n    <td>CL 5 </td> \n    <td>Yes </td> \n    <td> </td>\n   </tr> \n   <tr> \n    <td><a href=\"https://swse.fandom.com/wiki/A9G-Series_Archive_Droid\" title=\"A9G-Series Archive Droid\">A9G-Series Archive Droid</a> </td> \n    <td>CL 0 </td> \n    <td>Yes </td> \n    <td> </td>\n   </tr> \n   <tr> \n    <td><a href=\"https://swse.fandom.com/wiki/AD-Series_Weapons_Maintenance_Droid\" title=\"AD-Series Weapons Maintenance Droid\">AD-Series Weapons Maintenance Droid</a> </td> \n    <td>CL 1 </td> \n    <td>Yes </td> \n    <td> </td>\n   </tr> \n   <tr> \n    <td><a href=\"https://swse.fandom.com/wiki/MEV-Series_Medical_Evacuation_Droid\" title=\"MEV-Series Medical Evacuation Droid\">MEV-Series Medical Evacuation Droid</a> </td> \n    <td>CL 1 </td> \n    <td>Yes </td> \n    <td> </td>\n   </tr>\n  </tbody>\n </table> \n <h3><span class=\"mw-headline\" id=\"Galaxy_of_Intrigue\"><a href=\"https://swse.fandom.com/wiki/Galaxy_of_Intrigue\" class=\"mw-redirect\" title=\"Galaxy of Intrigue\">Galaxy of Intrigue</a></span></h3> \n <table class=\"wikitable\"> \n  <tbody>\n   <tr> \n    <th>DROID MODEL </th> \n    <th>CHALLENGE LEVEL </th> \n    <th>AVAILABLE FOR PLAYER DROID </th> \n    <th>IMAGE </th>\n   </tr> \n   <tr> \n    <td><a href=\"https://swse.fandom.com/wiki/5-BT_Threat_Analysis_Droid\" title=\"5-BT Threat Analysis Droid\">5-BT Threat Analysis Droid</a> </td> \n    <td>CL 1 </td> \n    <td>Yes </td> \n    <td><i>Image Unavailable</i> </td>\n   </tr>\n  </tbody>\n </table> \n <h3><span class=\"mw-headline\" id=\"Unknown_Regions\"><a href=\"https://swse.fandom.com/wiki/Unknown_Regions\" class=\"mw-redirect\" title=\"Unknown Regions\">Unknown Regions</a></span></h3> \n <table class=\"wikitable\"> \n  <tbody>\n   <tr> \n    <th>DROID MODEL </th> \n    <th>CHALLENGE LEVEL </th> \n    <th>AVAILABLE FOR PLAYER DROID </th> \n    <th>IMAGE </th>\n   </tr> \n   <tr> \n    <td><a href=\"https://swse.fandom.com/wiki/WED-20_Treadwell\" title=\"WED-20 Treadwell\">WED-20 Treadwell</a> </td> \n    <td>CL 0 </td> \n    <td>Yes </td> \n    <td> </td>\n   </tr>\n  </tbody>\n </table> <!-- \nNewPP limit report\nCached time: 20210203123854\nCache expiry: 1209600\nDynamic content: false\nCPU time usage: 0.046 seconds\nReal time usage: 0.060 seconds\nPreprocessor visited node count: 81/1000000\nPreprocessor generated node count: 0/1000000\nPost‐expand include size: 0/2097152 bytes\nTemplate argument size: 0/2097152 bytes\nHighest expansion depth: 2/40\nExpensive parser function count: 0/100\nUnstrip recursion depth: 0/20\nUnstrip post‐expand size: 0/5000000 bytes\n--> <!--\nTransclusion expansion time report (%,ms,calls,template)\n100.00%    0.000      1 -total\n--> <!-- Saved in parser cache with key prod:swse:pcache:idhash:5003-0!canonical and timestamp 20210203123854 and revision id 50851\n --> \n</div>",
                    "attributes": {},
                    "choices": [
                        {
                            "options": {
                                "Small": {
                                    "abilities": [
                                        "Small"
                                    ],
                                    "items": []
                                },
                                "Medium": {
                                    "abilities": [
                                        "Medium"
                                    ],
                                    "items": []
                                }
                            },
                            "description": "Select the size of your droid's chassis:"
                        }
                    ],
                    "payload": "",
                    "categories": [],
                    "ages": {},
                    "statBonuses": {
                        "all": {
                            "strength": -2,
                            "intelligence": 2,
                            "wisdom": 2
                        }
                    }
                },
                "sort": 200000,
                "flags": {
                    "core": {
                        "sourceId": "Compendium.world.swse-species.UjWPTwL0MVZ6zLIV"
                    }
                },
                "img": "systems/swse/icon/species/2-1B Medical Droid.jpg",
                "effects": []
            },
            {
                "_id": "LKBapq5fsCwYEonW",
                "name": "Toughness",
                "type": "feat",
                "data": {
                    "description": "<div class=\"mw-parser-output\">\n <p><i>See also: <a href=\"https://swse.fandom.com/wiki/Feats\" title=\"Feats\">Feats</a></i> </p>\n <p>You are tougher than normal. </p>\n <p><b>Effect:</b> You gain +1 Hit Point per Character Level. </p> <!-- \nNewPP limit report\nCached time: 20210130073225\nCache expiry: 1209600\nDynamic content: false\nCPU time usage: 0.003 seconds\nReal time usage: 0.004 seconds\nPreprocessor visited node count: 1/1000000\nPreprocessor generated node count: 0/1000000\nPost‐expand include size: 0/2097152 bytes\nTemplate argument size: 0/2097152 bytes\nHighest expansion depth: 1/40\nExpensive parser function count: 0/100\nUnstrip recursion depth: 0/20\nUnstrip post‐expand size: 0/5000000 bytes\n--> <!--\nTransclusion expansion time report (%,ms,calls,template)\n100.00%    0.000      1 -total\n--> <!-- Saved in parser cache with key prod:swse:pcache:idhash:2215-0!canonical and timestamp 20210130073225 and revision id 46037\n --> \n</div>",
                    "attributes": {
                        "fortDefenceBonus": {
                            "dtype": "String",
                            "value": ""
                        },
                        "refDefenceBonus": {
                            "dtype": "String",
                            "value": ""
                        },
                        "hitPointEq": {
                            "dtype": "String",
                            "value": "@charLevel"
                        }
                    },
                    "choices": [],
                    "payload": "",
                    "prerequisites": [],
                    "categories": [
                        "Feats"
                    ],
                    "supplyingClass": "",
                    "supplyingSpecies": "",
                    "supplyingFeature": "",
                    "supplyingFeat": "",
                    "isSupplied": false
                },
                "sort": 300000,
                "flags": {
                    "core": {
                        "sourceId": "Compendium.world.swse-feats.1VQSTSOLpGnZUvoW"
                    }
                },
                "img": "icons/svg/mystery-man.svg",
                "effects": []
            },
            {
                "_id": "Ldbg82n8nvEwT0H1",
                "name": "Bonus Feat",
                "type": "ability",
                "data": {
                    "description": "<div class=\"mw-parser-output\">\n <p>Beings gain one bonus&nbsp;<a href=\"https://swse.fandom.com/wiki/Feat\" class=\"mw-redirect\" title=\"Feat\">Feat</a>&nbsp;at 1st level. </p> <!-- \nNewPP limit report\nCached time: 20210117210515\nCache expiry: 1209600\nDynamic content: false\nCPU time usage: 0.002 seconds\nReal time usage: 0.002 seconds\nPreprocessor visited node count: 1/1000000\nPreprocessor generated node count: 0/1000000\nPost‐expand include size: 0/2097152 bytes\nTemplate argument size: 0/2097152 bytes\nHighest expansion depth: 1/40\nExpensive parser function count: 0/100\nUnstrip recursion depth: 0/20\nUnstrip post‐expand size: 0/5000000 bytes\n--> <!--\nTransclusion expansion time report (%,ms,calls,template)\n100.00%    0.000      1 -total\n--> <!-- Saved in parser cache with key prod:swse:pcache:idhash:12657-0!canonical and timestamp 20210117210515 and revision id 38458\n --> \n</div>",
                    "attributes": {},
                    "choices": [],
                    "payload": "Armor Proficiency (Light)",
                    "categories": [
                        "Species Traits"
                    ],
                    "supplyingClass": "Soldier",
                    "supplyingSpecies": "",
                    "supplyingFeature": "",
                    "supplyingFeat": "",
                    "isSupplied": true
                },
                "sort": 400000,
                "flags": {},
                "img": "icons/svg/mystery-man.svg",
                "effects": []
            },
            {
                "_id": "5RhtXRLQ2HTp10Zb",
                "name": "Bonus Feat",
                "type": "ability",
                "data": {
                    "description": "<div class=\"mw-parser-output\">\n <p>Beings gain one bonus&nbsp;<a href=\"https://swse.fandom.com/wiki/Feat\" class=\"mw-redirect\" title=\"Feat\">Feat</a>&nbsp;at 1st level. </p> <!-- \nNewPP limit report\nCached time: 20210117210515\nCache expiry: 1209600\nDynamic content: false\nCPU time usage: 0.002 seconds\nReal time usage: 0.002 seconds\nPreprocessor visited node count: 1/1000000\nPreprocessor generated node count: 0/1000000\nPost‐expand include size: 0/2097152 bytes\nTemplate argument size: 0/2097152 bytes\nHighest expansion depth: 1/40\nExpensive parser function count: 0/100\nUnstrip recursion depth: 0/20\nUnstrip post‐expand size: 0/5000000 bytes\n--> <!--\nTransclusion expansion time report (%,ms,calls,template)\n100.00%    0.000      1 -total\n--> <!-- Saved in parser cache with key prod:swse:pcache:idhash:12657-0!canonical and timestamp 20210117210515 and revision id 38458\n --> \n</div>",
                    "attributes": {},
                    "choices": [],
                    "payload": "Armor Proficiency (Medium)",
                    "categories": [
                        "Species Traits"
                    ],
                    "supplyingClass": "Soldier",
                    "supplyingSpecies": "",
                    "supplyingFeature": "",
                    "supplyingFeat": "",
                    "isSupplied": true
                },
                "sort": 500000,
                "flags": {},
                "img": "icons/svg/mystery-man.svg",
                "effects": []
            },
            {
                "_id": "AgG6X5mVMlWqVaXf",
                "name": "Bonus Feat",
                "type": "ability",
                "data": {
                    "description": "<div class=\"mw-parser-output\">\n <p>Beings gain one bonus&nbsp;<a href=\"https://swse.fandom.com/wiki/Feat\" class=\"mw-redirect\" title=\"Feat\">Feat</a>&nbsp;at 1st level. </p> <!-- \nNewPP limit report\nCached time: 20210117210515\nCache expiry: 1209600\nDynamic content: false\nCPU time usage: 0.002 seconds\nReal time usage: 0.002 seconds\nPreprocessor visited node count: 1/1000000\nPreprocessor generated node count: 0/1000000\nPost‐expand include size: 0/2097152 bytes\nTemplate argument size: 0/2097152 bytes\nHighest expansion depth: 1/40\nExpensive parser function count: 0/100\nUnstrip recursion depth: 0/20\nUnstrip post‐expand size: 0/5000000 bytes\n--> <!--\nTransclusion expansion time report (%,ms,calls,template)\n100.00%    0.000      1 -total\n--> <!-- Saved in parser cache with key prod:swse:pcache:idhash:12657-0!canonical and timestamp 20210117210515 and revision id 38458\n --> \n</div>",
                    "attributes": {},
                    "choices": [],
                    "payload": "Weapon Proficiency (Pistols)",
                    "categories": [
                        "Species Traits"
                    ],
                    "supplyingClass": "Soldier",
                    "supplyingSpecies": "",
                    "supplyingFeature": "",
                    "supplyingFeat": "",
                    "isSupplied": true
                },
                "sort": 600000,
                "flags": {},
                "img": "icons/svg/mystery-man.svg",
                "effects": []
            },
            {
                "_id": "cs9ulsazS1dHkATl",
                "name": "Bonus Feat",
                "type": "ability",
                "data": {
                    "description": "<div class=\"mw-parser-output\">\n <p>Beings gain one bonus&nbsp;<a href=\"https://swse.fandom.com/wiki/Feat\" class=\"mw-redirect\" title=\"Feat\">Feat</a>&nbsp;at 1st level. </p> <!-- \nNewPP limit report\nCached time: 20210117210515\nCache expiry: 1209600\nDynamic content: false\nCPU time usage: 0.002 seconds\nReal time usage: 0.002 seconds\nPreprocessor visited node count: 1/1000000\nPreprocessor generated node count: 0/1000000\nPost‐expand include size: 0/2097152 bytes\nTemplate argument size: 0/2097152 bytes\nHighest expansion depth: 1/40\nExpensive parser function count: 0/100\nUnstrip recursion depth: 0/20\nUnstrip post‐expand size: 0/5000000 bytes\n--> <!--\nTransclusion expansion time report (%,ms,calls,template)\n100.00%    0.000      1 -total\n--> <!-- Saved in parser cache with key prod:swse:pcache:idhash:12657-0!canonical and timestamp 20210117210515 and revision id 38458\n --> \n</div>",
                    "attributes": {},
                    "choices": [],
                    "payload": "Weapon Proficiency (Rifles)",
                    "categories": [
                        "Species Traits"
                    ],
                    "supplyingClass": "Soldier",
                    "supplyingSpecies": "",
                    "supplyingFeature": "",
                    "supplyingFeat": "",
                    "isSupplied": true
                },
                "sort": 700000,
                "flags": {},
                "img": "icons/svg/mystery-man.svg",
                "effects": []
            },
            {
                "_id": "VNJVi6ELYNc9DgIy",
                "name": "Bonus Feat",
                "type": "ability",
                "data": {
                    "description": "<div class=\"mw-parser-output\">\n <p>Beings gain one bonus&nbsp;<a href=\"https://swse.fandom.com/wiki/Feat\" class=\"mw-redirect\" title=\"Feat\">Feat</a>&nbsp;at 1st level. </p> <!-- \nNewPP limit report\nCached time: 20210117210515\nCache expiry: 1209600\nDynamic content: false\nCPU time usage: 0.002 seconds\nReal time usage: 0.002 seconds\nPreprocessor visited node count: 1/1000000\nPreprocessor generated node count: 0/1000000\nPost‐expand include size: 0/2097152 bytes\nTemplate argument size: 0/2097152 bytes\nHighest expansion depth: 1/40\nExpensive parser function count: 0/100\nUnstrip recursion depth: 0/20\nUnstrip post‐expand size: 0/5000000 bytes\n--> <!--\nTransclusion expansion time report (%,ms,calls,template)\n100.00%    0.000      1 -total\n--> <!-- Saved in parser cache with key prod:swse:pcache:idhash:12657-0!canonical and timestamp 20210117210515 and revision id 38458\n --> \n</div>",
                    "attributes": {},
                    "choices": [],
                    "payload": "Weapon Proficiency (Simple Weapons)",
                    "categories": [
                        "Species Traits"
                    ],
                    "supplyingClass": "Soldier",
                    "supplyingSpecies": "",
                    "supplyingFeature": "",
                    "supplyingFeat": "",
                    "isSupplied": true
                },
                "sort": 800000,
                "flags": {},
                "img": "icons/svg/mystery-man.svg",
                "effects": []
            },
            {
                "_id": "YBa3AOVFL8itd14p",
                "name": "Soldier",
                "type": "class",
                "data": {
                    "description": "<div class=\"mw-parser-output\">\n <table style=\"width:100%; margin-top:1em; border:1px solid #999; font-size:90%; text-align:center; background:#363636\"> \n  <tbody>\n   <tr> \n    <td><i>This article details the the Soldier Heroic Class found in the Core Rulebook. You may be looking for the <a href=\"https://swse.fandom.com/wiki/Threats_of_the_Galaxy\" class=\"mw-redirect\" title=\"Threats of the Galaxy\">Threats of the Galaxy</a> character of the same name, the <a href=\"https://swse.fandom.com/wiki/Soldier_(TotG)\" title=\"Soldier (TotG)\">Soldier</a>.</i> </td>\n   </tr>\n  </tbody>\n </table> \n <p><br> </p>\n <p>Soldiers combine discipline with martial skills to become the best pure warriors in the galaxy. Soldiers can be stalwart defenders of those in need, cruel marauders, or brave adventurers. They can be hired guns, noble champions, or cold-hearted killers. They fight for glory, for honor, to right wrongs, to gain power, to acquire wealth, or simply for the thrill of battle. </p>  \n <h3><span class=\"mw-headline\" id=\"Adventurers\">Adventurers</span></h3> \n <p>Many Soldiers see adventures, raids on enemy strongholds, and dangerous missions as their jobs. Some want to defend those who can't defend themselves; others seek to use their muscle to carve their own place of importance in the galaxy. Whatever their initial motivation, most Soldiers wind up living for the thrill of combat and the excitement of adventure. Adventuring Soldiers call themselves guards, bodyguards, champions, enforcers, mercenaries, warriors, soldiers of fortune, or simple adventurers. </p> \n <h3><span class=\"mw-headline\" id=\"Characteristics\">Characteristics</span></h3> \n <p>Soldiers have the best all-around fighting abilities, and an individual Soldier develops styles and techniques that set him apart from their peers. A given Soldier might be especially capable with certain weapons, another trained to execute specific combat maneuvers. As Soldiers gain experience, they get more opportunities to develop their fighting skills. </p> \n <h3><span class=\"mw-headline\" id=\"Backgrounds\">Backgrounds</span></h3> \n <p>Most Soldiers come to the profession after receiving at least some amount of formal training from a military organization, local militia, or private army. Some attend formal academies; others are self-taught and well tested. A Soldier may have taken up his weapon to escape a mundane life. Another may be following a proud family tradition. Soldiers in a particular unit share certain camaraderie, but most have nothing in common except battle prowess and the desire to apply it to a given situation. </p> \n <h4><span class=\"mw-headline\" id=\"Examples_of_Soldiers_in_Star_Wars\"><b>Examples of Soldiers in <i>Star Wars</i></b></span></h4> \n <p>Admiral Ackbar, Corran Horn, Captain Panaka, Captain Typho, General Crix Madine, Kyle Katarn, Wedge Antilles, Zam Wesell </p> \n <h3><span class=\"mw-headline\" id=\"Game_Rule_Information\">Game Rule Information</span></h3> \n <p>Soldiers have the following game statistics: </p> \n <table class=\"wikitable\"> \n  <tbody>\n   <tr> \n    <th>CLASS LEVEL </th> \n    <th><a href=\"https://swse.fandom.com/wiki/BASE_ATTACK_BONUS\" class=\"mw-redirect\" title=\"BASE ATTACK BONUS\">BASE ATTACK BONUS</a> </th> \n    <th>CLASS FEATURES </th>\n   </tr> \n   <tr> \n    <td>1st </td> \n    <td>+1 </td> \n    <td><a href=\"https://swse.fandom.com/wiki/Defense\" class=\"mw-redirect\" title=\"Defense\">Defense</a> Bonuses, Starting <a href=\"https://swse.fandom.com/wiki/Feats\" title=\"Feats\">Feats</a>, <a href=\"https://swse.fandom.com/wiki/Talent_Trees_(Soldier)\" title=\"Talent Trees (Soldier)\">Talent</a> </td>\n   </tr> \n   <tr> \n    <td>2nd </td> \n    <td>+2 </td> \n    <td><a href=\"https://swse.fandom.com/wiki/Bonus_Feat_(Soldier)\" class=\"mw-redirect\" title=\"Bonus Feat (Soldier)\">Bonus Feat (Soldier)</a> </td>\n   </tr> \n   <tr> \n    <td>3rd </td> \n    <td>+3 </td> \n    <td><a href=\"https://swse.fandom.com/wiki/Talent_Trees_(Soldier)\" title=\"Talent Trees (Soldier)\">Talent</a> </td>\n   </tr> \n   <tr> \n    <td>4th </td> \n    <td>+4 </td> \n    <td><a href=\"https://swse.fandom.com/wiki/Bonus_Feat_(Soldier)\" class=\"mw-redirect\" title=\"Bonus Feat (Soldier)\">Bonus Feat (Soldier)</a> </td>\n   </tr> \n   <tr> \n    <td>5th </td> \n    <td>+5 </td> \n    <td><a href=\"https://swse.fandom.com/wiki/Talent_Trees_(Soldier)\" title=\"Talent Trees (Soldier)\">Talent</a> </td>\n   </tr> \n   <tr> \n    <td>6th </td> \n    <td>+6 </td> \n    <td><a href=\"https://swse.fandom.com/wiki/Bonus_Feat_(Soldier)\" class=\"mw-redirect\" title=\"Bonus Feat (Soldier)\">Bonus Feat (Soldier)</a> </td>\n   </tr> \n   <tr> \n    <td>7th </td> \n    <td>+7 </td> \n    <td><a href=\"https://swse.fandom.com/wiki/Talent_Trees_(Soldier)\" title=\"Talent Trees (Soldier)\">Talent</a> </td>\n   </tr> \n   <tr> \n    <td>8th </td> \n    <td>+8 </td> \n    <td><a href=\"https://swse.fandom.com/wiki/Bonus_Feat_(Soldier)\" class=\"mw-redirect\" title=\"Bonus Feat (Soldier)\">Bonus Feat (Soldier)</a> </td>\n   </tr> \n   <tr> \n    <td>9th </td> \n    <td>+9 </td> \n    <td><a href=\"https://swse.fandom.com/wiki/Talent_Trees_(Soldier)\" title=\"Talent Trees (Soldier)\">Talent</a> </td>\n   </tr> \n   <tr> \n    <td>10th </td> \n    <td>+10 </td> \n    <td><a href=\"https://swse.fandom.com/wiki/Bonus_Feat_(Soldier)\" class=\"mw-redirect\" title=\"Bonus Feat (Soldier)\">Bonus Feat (Soldier)</a> </td>\n   </tr> \n   <tr> \n    <td>11th </td> \n    <td>+11 </td> \n    <td><a href=\"https://swse.fandom.com/wiki/Talent_Trees_(Soldier)\" title=\"Talent Trees (Soldier)\">Talent</a> </td>\n   </tr> \n   <tr> \n    <td>12th </td> \n    <td>+12 </td> \n    <td><a href=\"https://swse.fandom.com/wiki/Bonus_Feat_(Soldier)\" class=\"mw-redirect\" title=\"Bonus Feat (Soldier)\">Bonus Feat (Soldier)</a> </td>\n   </tr> \n   <tr> \n    <td>13th </td> \n    <td>+13 </td> \n    <td><a href=\"https://swse.fandom.com/wiki/Talent_Trees_(Soldier)\" title=\"Talent Trees (Soldier)\">Talent</a> </td>\n   </tr> \n   <tr> \n    <td>14th </td> \n    <td>+14 </td> \n    <td><a href=\"https://swse.fandom.com/wiki/Bonus_Feat_(Soldier)\" class=\"mw-redirect\" title=\"Bonus Feat (Soldier)\">Bonus Feat (Soldier)</a> </td>\n   </tr> \n   <tr> \n    <td>15th </td> \n    <td>+15 </td> \n    <td><a href=\"https://swse.fandom.com/wiki/Talent_Trees_(Soldier)\" title=\"Talent Trees (Soldier)\">Talent</a> </td>\n   </tr> \n   <tr> \n    <td>16th </td> \n    <td>+16 </td> \n    <td><a href=\"https://swse.fandom.com/wiki/Bonus_Feat_(Soldier)\" class=\"mw-redirect\" title=\"Bonus Feat (Soldier)\">Bonus Feat (Soldier)</a> </td>\n   </tr> \n   <tr> \n    <td>17th </td> \n    <td>+17 </td> \n    <td><a href=\"https://swse.fandom.com/wiki/Talent_Trees_(Soldier)\" title=\"Talent Trees (Soldier)\">Talent</a> </td>\n   </tr> \n   <tr> \n    <td>18th </td> \n    <td>+18 </td> \n    <td><a href=\"https://swse.fandom.com/wiki/Bonus_Feat_(Soldier)\" class=\"mw-redirect\" title=\"Bonus Feat (Soldier)\">Bonus Feat (Soldier)</a> </td>\n   </tr> \n   <tr> \n    <td>19th </td> \n    <td>+19 </td> \n    <td><a href=\"https://swse.fandom.com/wiki/Talent_Trees_(Soldier)\" title=\"Talent Trees (Soldier)\">Talent</a> </td>\n   </tr> \n   <tr> \n    <td>20th </td> \n    <td>+20 </td> \n    <td><a href=\"https://swse.fandom.com/wiki/Bonus_Feat_(Soldier)\" class=\"mw-redirect\" title=\"Bonus Feat (Soldier)\">Bonus Feat (Soldier)</a> </td>\n   </tr>\n  </tbody>\n </table> \n <h4><span class=\"mw-headline\" id=\"Abilities\"><b>Abilities</b></span></h4> \n <p>Since most combat in the <i>Star Wars</i> universe uses blasters and other ranged weapons, <a href=\"https://swse.fandom.com/wiki/Dexterity\" title=\"Dexterity\">Dexterity</a> is the soldier's most important <a href=\"https://swse.fandom.com/wiki/Abilities\" title=\"Abilities\">ability score</a>, followed closely by <a href=\"https://swse.fandom.com/wiki/Constitution\" title=\"Constitution\">Constitution</a> and <a href=\"https://swse.fandom.com/wiki/Strength\" title=\"Strength\">Strength</a>. Don't underestimate the importance of <a href=\"https://swse.fandom.com/wiki/Intelligence\" title=\"Intelligence\">Intelligence</a> and <a href=\"https://swse.fandom.com/wiki/Wisdom\" title=\"Wisdom\">Wisdom</a>, however, since many of a soldier's useful <a href=\"https://swse.fandom.com/wiki/Skills\" title=\"Skills\">Skills</a> are based on these abilities. </p> \n <h4><span class=\"mw-headline\" id=\"Class_Skills\"><b>Class Skills </b></span></h4> \n <p><a href=\"https://swse.fandom.com/wiki/Trained\" class=\"mw-redirect\" title=\"Trained\">Trained</a> in 3 + <a href=\"https://swse.fandom.com/wiki/Intelligence\" title=\"Intelligence\">Intelligence</a> modifier: </p> \n <ul>\n  <li><a href=\"https://swse.fandom.com/wiki/Climb\" title=\"Climb\">Climb</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Endurance\" title=\"Endurance\">Endurance</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Initiative\" title=\"Initiative\">Initiative</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Jump\" title=\"Jump\">Jump</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Knowledge_(Tactics)\" class=\"mw-redirect\" title=\"Knowledge (Tactics)\">Knowledge (Tactics)</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Mechanics\" title=\"Mechanics\">Mechanics</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Perception\" title=\"Perception\">Perception</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Pilot\" title=\"Pilot\">Pilot</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Swim\" title=\"Swim\">Swim</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Treat_Injury\" title=\"Treat Injury\">Treat Injury</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Use_Computer\" title=\"Use Computer\">Use Computer</a></li>\n </ul> \n <h4><span class=\"mw-headline\" id=\"Hit_Points\"><b>Hit Points</b></span></h4> \n <p>Soldiers begin play at 1st level with a number of hit points equal to 30 + their <a href=\"https://swse.fandom.com/wiki/Constitution\" title=\"Constitution\">Constitution</a> modifier. At each level after 1st, Soldiers gain 1d10 hit points + their <a href=\"https://swse.fandom.com/wiki/Constitution\" title=\"Constitution\">Constitution</a> modifier. </p> \n <h4><span class=\"mw-headline\" id=\"Force_Points\"><b>Force Points</b></span></h4> \n <p>Soldiers gain a number of <a href=\"https://swse.fandom.com/wiki/Force_Points\" title=\"Force Points\">Force Points</a> equal to 5 + one-half their Character Level (Rounded down) at 1st level, and every time they gain a new level in this class. Any <a href=\"https://swse.fandom.com/wiki/Force_Points\" title=\"Force Points\">Force Points</a> left over from previous levels are lost. </p> \n <h3><span class=\"mw-headline\" id=\"Class_Features.\">Class Features.</span></h3> \n <p>All of the following are features of the Soldier class. </p> \n <h4><span class=\"mw-headline\" id=\"Defense_Bonuses\"><b>Defense Bonuses</b></span></h4> \n <p>At 1st level, a Soldier gains a +1 bonus to their <a href=\"https://swse.fandom.com/wiki/Reflex_Defense\" class=\"mw-redirect\" title=\"Reflex Defense\">Reflex Defense</a> and a +2 bonus to their <a href=\"https://swse.fandom.com/wiki/Fortitude_Defense\" class=\"mw-redirect\" title=\"Fortitude Defense\">Fortitude Defense</a>. </p> \n <h4><span class=\"mw-headline\" id=\"Starting_Feats\"><b>Starting Feats</b></span></h4> \n <p>A Soldier begins play with the following bonus <a href=\"https://swse.fandom.com/wiki/Feats\" title=\"Feats\">Feats</a>: </p> \n <ul>\n  <li><a href=\"https://swse.fandom.com/wiki/Armor_Proficiency_(Light)\" title=\"Armor Proficiency (Light)\">Armor Proficiency (Light)</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Armor_Proficiency_(Medium)\" title=\"Armor Proficiency (Medium)\">Armor Proficiency (Medium)</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Weapon_Proficiency_(Pistols)\" class=\"mw-redirect\" title=\"Weapon Proficiency (Pistols)\">Weapon Proficiency (Pistols)</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Weapon_Proficiency_(Rifles)\" class=\"mw-redirect\" title=\"Weapon Proficiency (Rifles)\">Weapon Proficiency (Rifles)</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Weapon_Proficiency_(Simple_Weapons)\" class=\"mw-redirect\" title=\"Weapon Proficiency (Simple Weapons)\">Weapon Proficiency (Simple Weapons)</a></li>\n </ul> \n <h4><span class=\"mw-headline\" id=\"Talent_Trees\"><b>Talent Trees</b></span></h4> \n <p>At every odd-numbered level (1st, 3rd, 5th, and so on), a Soldier gains an additional&nbsp;<a href=\"https://swse.fandom.com/wiki/Talent\" class=\"mw-redirect\" title=\"Talent\">Talent</a>. A Soldier may choose a&nbsp;<a href=\"https://swse.fandom.com/wiki/Talent\" class=\"mw-redirect\" title=\"Talent\">Talent</a>&nbsp;from any&nbsp;<a href=\"https://swse.fandom.com/wiki/Talent_Trees\" class=\"mw-redirect\" title=\"Talent Trees\">Talent Tree</a>&nbsp;they wish, but they must meet the prerequisites (If any) of the chosen&nbsp;<a href=\"https://swse.fandom.com/wiki/Talent\" class=\"mw-redirect\" title=\"Talent\">Talent</a>. The&nbsp;<a href=\"https://swse.fandom.com/wiki/Talent\" class=\"mw-redirect\" title=\"Talent\">Talent</a>&nbsp;can be selected from any of the&nbsp;<a href=\"https://swse.fandom.com/wiki/Talent_Trees_(Soldier)\" title=\"Talent Trees (Soldier)\">Talent Trees (Soldier)</a>. </p> \n <h4><span class=\"mw-headline\" id=\"Bonus_Feats\"><b>Bonus Feats</b></span></h4> \n <p>At every even-numbered level (2nd, 4th, 6th, etc.), a Soldier gains a bonus <a href=\"https://swse.fandom.com/wiki/Feat\" class=\"mw-redirect\" title=\"Feat\">Feat</a>. This&nbsp;<a href=\"https://swse.fandom.com/wiki/Feat\" class=\"mw-redirect\" title=\"Feat\">Feat</a>&nbsp;must be selected from the related page (<a href=\"https://swse.fandom.com/wiki/Bonus_Feats_(Soldier)\" title=\"Bonus Feats (Soldier)\">Bonus Feats (Soldier)</a>). As with normal&nbsp;<a href=\"https://swse.fandom.com/wiki/Feats\" title=\"Feats\">Feats</a>, you must meet the prerequisites to select the&nbsp;<a href=\"https://swse.fandom.com/wiki/Feat\" class=\"mw-redirect\" title=\"Feat\">Feat</a>. The Bonus&nbsp;<a href=\"https://swse.fandom.com/wiki/Feat\" class=\"mw-redirect\" title=\"Feat\">Feat</a>&nbsp;must be from the&nbsp;<a href=\"https://swse.fandom.com/wiki/Bonus_Feats_(Soldier)\" title=\"Bonus Feats (Soldier)\">Bonus Feats (Soldier)</a>, unless explicitly stated otherwise. </p> \n <h4><span class=\"mw-headline\" id=\"Credits\"><b>Credits</b></span></h4> \n <p>A 1st-level Soldier starts play with 3d4 x 250 credits. </p> <!-- \nNewPP limit report\nCached time: 20210131141021\nCache expiry: 1209600\nDynamic content: false\nCPU time usage: 0.029 seconds\nReal time usage: 0.035 seconds\nPreprocessor visited node count: 229/1000000\nPreprocessor generated node count: 0/1000000\nPost‐expand include size: 644/2097152 bytes\nTemplate argument size: 333/2097152 bytes\nHighest expansion depth: 5/40\nExpensive parser function count: 0/100\nUnstrip recursion depth: 0/20\nUnstrip post‐expand size: 51/5000000 bytes\n--> <!--\nTransclusion expansion time report (%,ms,calls,template)\n100.00%    4.754      1 -total\n100.00%    4.754      1 Template:Youmay\n 32.75%    1.557      1 Template:Dablink\n--> <!-- Saved in parser cache with key prod:swse:pcache:idhash:2770-0!canonical and timestamp 20210131141021 and revision id 49480\n --> \n</div>",
                    "attributes": {},
                    "choices": [],
                    "payload": "",
                    "prerequisites": {
                        "prerequisites": {},
                        "isPrestige": false
                    },
                    "skills": {
                        "skills": [
                            "Climb",
                            "Endurance",
                            "Initiative",
                            "Jump",
                            "Knowledge (Tactics)",
                            "Mechanics",
                            "Perception",
                            "Pilot",
                            "Swim",
                            "Treat Injury",
                            "Use Computer"
                        ],
                        "perLevel": 3
                    },
                    "defense": {
                        "will": 0,
                        "reflex": 1,
                        "fortitude": 2
                    },
                    "health": {
                        "levelUp": "1d10",
                        "firstLevel": 30
                    },
                    "feats": {
                        "feats": [
                            "Armor Proficiency (Light)",
                            "Armor Proficiency (Medium)",
                            "Weapon Proficiency (Pistols)",
                            "Weapon Proficiency (Rifles)",
                            "Weapon Proficiency (Simple Weapons)"
                        ]
                    },
                    "levels": {
                        "1": {
                            "BASE ATTACK BONUS": "+1",
                            "CLASS FEATURES": "Defense Bonuses, Starting Feats, Talent"
                        },
                        "2": {
                            "BASE ATTACK BONUS": "+2",
                            "CLASS FEATURES": "Bonus Feat (Soldier)"
                        },
                        "3": {
                            "BASE ATTACK BONUS": "+3",
                            "CLASS FEATURES": "Talent"
                        },
                        "4": {
                            "BASE ATTACK BONUS": "+4",
                            "CLASS FEATURES": "Bonus Feat (Soldier)"
                        },
                        "5": {
                            "BASE ATTACK BONUS": "+5",
                            "CLASS FEATURES": "Talent"
                        },
                        "6": {
                            "BASE ATTACK BONUS": "+6",
                            "CLASS FEATURES": "Bonus Feat (Soldier)"
                        },
                        "7": {
                            "BASE ATTACK BONUS": "+7",
                            "CLASS FEATURES": "Talent"
                        },
                        "8": {
                            "BASE ATTACK BONUS": "+8",
                            "CLASS FEATURES": "Bonus Feat (Soldier)"
                        },
                        "9": {
                            "BASE ATTACK BONUS": "+9",
                            "CLASS FEATURES": "Talent"
                        },
                        "10": {
                            "BASE ATTACK BONUS": "+10",
                            "CLASS FEATURES": "Bonus Feat (Soldier)"
                        },
                        "11": {
                            "BASE ATTACK BONUS": "+11",
                            "CLASS FEATURES": "Talent"
                        },
                        "12": {
                            "BASE ATTACK BONUS": "+12",
                            "CLASS FEATURES": "Bonus Feat (Soldier)"
                        },
                        "13": {
                            "BASE ATTACK BONUS": "+13",
                            "CLASS FEATURES": "Talent"
                        },
                        "14": {
                            "BASE ATTACK BONUS": "+14",
                            "CLASS FEATURES": "Bonus Feat (Soldier)"
                        },
                        "15": {
                            "BASE ATTACK BONUS": "+15",
                            "CLASS FEATURES": "Talent"
                        },
                        "16": {
                            "BASE ATTACK BONUS": "+16",
                            "CLASS FEATURES": "Bonus Feat (Soldier)"
                        },
                        "17": {
                            "BASE ATTACK BONUS": "+17",
                            "CLASS FEATURES": "Talent"
                        },
                        "18": {
                            "BASE ATTACK BONUS": "+18",
                            "CLASS FEATURES": "Bonus Feat (Soldier)"
                        },
                        "19": {
                            "BASE ATTACK BONUS": "+19",
                            "CLASS FEATURES": "Talent"
                        },
                        "20": {
                            "BASE ATTACK BONUS": "+20",
                            "CLASS FEATURES": "Bonus Feat (Soldier)"
                        }
                    }
                },
                "sort": 900000,
                "flags": {
                    "core": {
                        "sourceId": "Compendium.world.swse-classes.AQgM7w5v8PZUCzJP"
                    }
                },
                "img": "icons/svg/mystery-man.svg",
                "effects": []
            },
            {
                "_id": "eukEDoP53yZHteWn",
                "name": "Armor Proficiency (Light)",
                "type": "feat",
                "data": {
                    "description": "<div class=\"mw-parser-output\">\n <p><i>See also: <a href=\"https://swse.fandom.com/wiki/Feats\" title=\"Feats\">Feats</a></i> </p>\n <p>You are proficient with <a href=\"https://swse.fandom.com/wiki/Light_Armor\" title=\"Light Armor\">Light Armor</a>, and can wear it without impediment. </p>\n <p><b>Effect:</b> When you wear <a href=\"https://swse.fandom.com/wiki/Light_Armor\" title=\"Light Armor\">Light Armor</a>, you take no <a href=\"https://swse.fandom.com/wiki/Armor_Check_Penalty\" class=\"mw-redirect\" title=\"Armor Check Penalty\">Armor Check Penalty</a> on attack rolls or <a href=\"https://swse.fandom.com/wiki/Skill_Checks\" class=\"mw-redirect\" title=\"Skill Checks\">Skill Checks</a>. Additionally, you benefit from all of the armor's special <a href=\"https://swse.fandom.com/wiki/Equipment\" title=\"Equipment\">Equipment</a> bonuses (If any). </p>\n <p><b>Normal:</b> A character who wears <a href=\"https://swse.fandom.com/wiki/Light_Armor\" title=\"Light Armor\">Light Armor</a> with which they are not proficient takes a -2 <a href=\"https://swse.fandom.com/wiki/Armor_Check_Penalty\" class=\"mw-redirect\" title=\"Armor Check Penalty\">Armor Check Penalty</a> on attack rolls as well as <a href=\"https://swse.fandom.com/wiki/Skill_Checks\" class=\"mw-redirect\" title=\"Skill Checks\">Skill Checks</a> made using the following <a href=\"https://swse.fandom.com/wiki/Skills\" title=\"Skills\">Skills</a>: <a href=\"https://swse.fandom.com/wiki/Acrobatics\" title=\"Acrobatics\">Acrobatics</a>, <a href=\"https://swse.fandom.com/wiki/Climb\" title=\"Climb\">Climb</a>, <a href=\"https://swse.fandom.com/wiki/Endurance\" title=\"Endurance\">Endurance</a>, <a href=\"https://swse.fandom.com/wiki/Initiative\" title=\"Initiative\">Initiative</a>, <a href=\"https://swse.fandom.com/wiki/Jump\" title=\"Jump\">Jump</a>, <a href=\"https://swse.fandom.com/wiki/Stealth\" title=\"Stealth\">Stealth</a>, and <a href=\"https://swse.fandom.com/wiki/Swim\" title=\"Swim\">Swim</a>. Additionally, the character gains none of the armor's special <a href=\"https://swse.fandom.com/wiki/Equipment\" title=\"Equipment\">Equipment</a> bonuses. </p> <!-- \nNewPP limit report\nCached time: 20210130190847\nCache expiry: 1209600\nDynamic content: false\nCPU time usage: 0.005 seconds\nReal time usage: 0.006 seconds\nPreprocessor visited node count: 1/1000000\nPreprocessor generated node count: 0/1000000\nPost‐expand include size: 0/2097152 bytes\nTemplate argument size: 0/2097152 bytes\nHighest expansion depth: 1/40\nExpensive parser function count: 0/100\nUnstrip recursion depth: 0/20\nUnstrip post‐expand size: 0/5000000 bytes\n--> <!--\nTransclusion expansion time report (%,ms,calls,template)\n100.00%    0.000      1 -total\n--> <!-- Saved in parser cache with key prod:swse:pcache:idhash:2162-0!canonical and timestamp 20210130190847 and revision id 46054\n --> \n</div>",
                    "attributes": {
                        "fortDefenceBonus": {
                            "dtype": "String",
                            "value": ""
                        },
                        "refDefenceBonus": {
                            "dtype": "String",
                            "value": ""
                        },
                        "hitPointEq": {
                            "dtype": "String",
                            "value": ""
                        }
                    },
                    "choices": [],
                    "payload": "Light",
                    "prerequisites": [],
                    "categories": [
                        "Feats"
                    ],
                    "supplyingClass": "Soldier",
                    "supplyingSpecies": "",
                    "supplyingFeature": "",
                    "supplyingFeat": "",
                    "isSupplied": true
                },
                "sort": 1000000,
                "flags": {},
                "img": "icons/svg/mystery-man.svg",
                "effects": []
            },
            {
                "_id": "DQQSSFT64pm0qzKn",
                "name": "Weapon Proficiency",
                "type": "feat",
                "data": {
                    "description": "<div class=\"mw-parser-output\">\n <p><i>See also: <a href=\"https://swse.fandom.com/wiki/Feats\" title=\"Feats\">Feats</a></i> </p>\n <p>You are proficient with a particular kind of weaponry. </p>\n <p><b>Effect:</b> Choose one Weapon Group. You are proficient with all weapons of the selected group. Weapon Groups include the following: </p> \n <ul>\n  <li>Simple Weapons (Includes <a href=\"https://swse.fandom.com/wiki/Simple_Weapons_(Melee)\" title=\"Simple Weapons (Melee)\">Simple Weapons (Melee)</a>, <a href=\"https://swse.fandom.com/wiki/Simple_Weapons_(Ranged)\" title=\"Simple Weapons (Ranged)\">Simple Weapons (Ranged)</a>, <a href=\"https://swse.fandom.com/wiki/Grenades\" title=\"Grenades\">Grenades</a>, and <a href=\"https://swse.fandom.com/wiki/Mines\" title=\"Mines\">Mines</a>)</li> \n  <li><a href=\"https://swse.fandom.com/wiki/Pistols\" title=\"Pistols\">Pistols</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Rifles\" title=\"Rifles\">Rifles</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Lightsabers\" title=\"Lightsabers\">Lightsabers</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Heavy_Weapons\" title=\"Heavy Weapons\">Heavy Weapons</a> (Includes both <a href=\"https://swse.fandom.com/wiki/Heavy_Weapons\" title=\"Heavy Weapons\">Heavy Weapons</a> and <a href=\"https://swse.fandom.com/wiki/Vehicle_Weapons\" class=\"mw-redirect\" title=\"Vehicle Weapons\">Vehicle Weapons</a>)</li> \n  <li><a href=\"https://swse.fandom.com/wiki/Advanced_Melee_Weapons\" title=\"Advanced Melee Weapons\">Advanced Melee Weapons</a></li>\n </ul> \n <p><b>Normal:</b> If you wield a weapon with which you are not proficient, you take a -5 penalty to your attack rolls. </p>\n <p><b>Special:</b> You can gain this Feat multiple times. Each time you take the Feat, it applies to a different Weapon Group. You cannot take <a href=\"https://swse.fandom.com/wiki/Exotic_Weapons\" title=\"Exotic Weapons\">Exotic Weapons</a> as a weapon group; instead you must select the <a href=\"https://swse.fandom.com/wiki/Exotic_Weapon_Proficiency\" title=\"Exotic Weapon Proficiency\">Exotic Weapon Proficiency</a> Feat to gain proficiency with a specific Exotic Weapon. </p> \n <h2><span class=\"mw-headline\" id=\"Additional_Weapon_Proficiency\">Additional Weapon Proficiency</span><span class=\"mw-editsection\"><span class=\"mw-editsection-bracket\">[</span><a href=\"https://swse.fandom.com/wiki/Weapon_Proficiency?veaction=edit&amp;section=1\" class=\"mw-editsection-visualeditor\" title=\"Edit section: Additional Weapon Proficiency\">edit</a><span class=\"mw-editsection-divider\"> | </span><a href=\"https://swse.fandom.com/wiki/Weapon_Proficiency?action=edit&amp;section=1\" title=\"Edit section: Additional Weapon Proficiency\">\n    <svg class=\"wds-icon wds-icon-tiny section-edit-pencil-icon\">\n     <use xlink:href=\"#wds-icons-pencil-tiny\"></use>\n    </svg>edit source</a><span class=\"mw-editsection-bracket\">]</span></span></h2> \n <p><i>Reference Book:</i>&nbsp;<i><a href=\"https://swse.fandom.com/wiki/Star_Wars_Saga_Edition_Knights_of_the_Old_Republic_Campaign_Guide\" title=\"Star Wars Saga Edition Knights of the Old Republic Campaign Guide\">Star Wars Saga Edition Knights of the Old Republic Campaign Guide</a></i> </p>\n <p><b><a href=\"https://swse.fandom.com/wiki/Combined_Feat\" class=\"mw-redirect\" title=\"Combined Feat\">Combined Feat</a> (<a href=\"https://swse.fandom.com/wiki/Quick_Draw\" title=\"Quick Draw\">Quick Draw</a>):</b> You can draw and ignite your <a href=\"https://swse.fandom.com/wiki/Lightsaber\" class=\"mw-redirect\" title=\"Lightsaber\">Lightsaber</a> as a single <a href=\"https://swse.fandom.com/wiki/Swift_Action\" class=\"mw-redirect\" title=\"Swift Action\">Swift Action</a>. </p> <!-- \nNewPP limit report\nCached time: 20210212123253\nCache expiry: 1209600\nDynamic content: false\nCPU time usage: 0.006 seconds\nReal time usage: 0.008 seconds\nPreprocessor visited node count: 17/1000000\nPreprocessor generated node count: 0/1000000\nPost‐expand include size: 0/2097152 bytes\nTemplate argument size: 0/2097152 bytes\nHighest expansion depth: 2/40\nExpensive parser function count: 0/100\nUnstrip recursion depth: 0/20\nUnstrip post‐expand size: 0/5000000 bytes\n--> <!--\nTransclusion expansion time report (%,ms,calls,template)\n100.00%    0.000      1 -total\n--> <!-- Saved in parser cache with key prod:swse:pcache:idhash:2222-0!canonical and timestamp 20210212123253 and revision id 46047\n --> \n</div>",
                    "attributes": {
                        "fortDefenceBonus": {
                            "dtype": "String",
                            "value": ""
                        },
                        "refDefenceBonus": {
                            "dtype": "String",
                            "value": ""
                        },
                        "hitPointEq": {
                            "dtype": "String",
                            "value": ""
                        }
                    },
                    "choices": [
                        {
                            "options": {
                                "Simple Weapons": {
                                    "abilities": [],
                                    "payload": "Simple Weapons",
                                    "items": []
                                },
                                "Lightsabers": {
                                    "abilities": [],
                                    "payload": "Lightsabers",
                                    "items": []
                                },
                                "Pistols": {
                                    "abilities": [],
                                    "payload": "Pistols",
                                    "items": []
                                },
                                "Advanced Melee Weapons": {
                                    "abilities": [],
                                    "payload": "Advanced Melee Weapons",
                                    "items": []
                                },
                                "Heavy Weapons": {
                                    "abilities": [],
                                    "payload": "Heavy Weapons",
                                    "items": []
                                },
                                "Rifles": {
                                    "abilities": [],
                                    "payload": "Rifles",
                                    "items": []
                                }
                            },
                            "description": "Select a Weapon Proficiency"
                        }
                    ],
                    "payload": "Pistols",
                    "prerequisites": [],
                    "categories": [
                        "Feats"
                    ],
                    "supplyingClass": "Soldier",
                    "supplyingSpecies": "",
                    "supplyingFeature": "",
                    "supplyingFeat": "",
                    "isSupplied": true
                },
                "sort": 1100000,
                "flags": {},
                "img": "icons/svg/mystery-man.svg",
                "effects": []
            },
            {
                "_id": "9iF8O2mKld8dqopW",
                "name": "Weapon Proficiency",
                "type": "feat",
                "data": {
                    "description": "<div class=\"mw-parser-output\">\n <p><i>See also: <a href=\"https://swse.fandom.com/wiki/Feats\" title=\"Feats\">Feats</a></i> </p>\n <p>You are proficient with a particular kind of weaponry. </p>\n <p><b>Effect:</b> Choose one Weapon Group. You are proficient with all weapons of the selected group. Weapon Groups include the following: </p> \n <ul>\n  <li>Simple Weapons (Includes <a href=\"https://swse.fandom.com/wiki/Simple_Weapons_(Melee)\" title=\"Simple Weapons (Melee)\">Simple Weapons (Melee)</a>, <a href=\"https://swse.fandom.com/wiki/Simple_Weapons_(Ranged)\" title=\"Simple Weapons (Ranged)\">Simple Weapons (Ranged)</a>, <a href=\"https://swse.fandom.com/wiki/Grenades\" title=\"Grenades\">Grenades</a>, and <a href=\"https://swse.fandom.com/wiki/Mines\" title=\"Mines\">Mines</a>)</li> \n  <li><a href=\"https://swse.fandom.com/wiki/Pistols\" title=\"Pistols\">Pistols</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Rifles\" title=\"Rifles\">Rifles</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Lightsabers\" title=\"Lightsabers\">Lightsabers</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Heavy_Weapons\" title=\"Heavy Weapons\">Heavy Weapons</a> (Includes both <a href=\"https://swse.fandom.com/wiki/Heavy_Weapons\" title=\"Heavy Weapons\">Heavy Weapons</a> and <a href=\"https://swse.fandom.com/wiki/Vehicle_Weapons\" class=\"mw-redirect\" title=\"Vehicle Weapons\">Vehicle Weapons</a>)</li> \n  <li><a href=\"https://swse.fandom.com/wiki/Advanced_Melee_Weapons\" title=\"Advanced Melee Weapons\">Advanced Melee Weapons</a></li>\n </ul> \n <p><b>Normal:</b> If you wield a weapon with which you are not proficient, you take a -5 penalty to your attack rolls. </p>\n <p><b>Special:</b> You can gain this Feat multiple times. Each time you take the Feat, it applies to a different Weapon Group. You cannot take <a href=\"https://swse.fandom.com/wiki/Exotic_Weapons\" title=\"Exotic Weapons\">Exotic Weapons</a> as a weapon group; instead you must select the <a href=\"https://swse.fandom.com/wiki/Exotic_Weapon_Proficiency\" title=\"Exotic Weapon Proficiency\">Exotic Weapon Proficiency</a> Feat to gain proficiency with a specific Exotic Weapon. </p> \n <h2><span class=\"mw-headline\" id=\"Additional_Weapon_Proficiency\">Additional Weapon Proficiency</span><span class=\"mw-editsection\"><span class=\"mw-editsection-bracket\">[</span><a href=\"https://swse.fandom.com/wiki/Weapon_Proficiency?veaction=edit&amp;section=1\" class=\"mw-editsection-visualeditor\" title=\"Edit section: Additional Weapon Proficiency\">edit</a><span class=\"mw-editsection-divider\"> | </span><a href=\"https://swse.fandom.com/wiki/Weapon_Proficiency?action=edit&amp;section=1\" title=\"Edit section: Additional Weapon Proficiency\">\n    <svg class=\"wds-icon wds-icon-tiny section-edit-pencil-icon\">\n     <use xlink:href=\"#wds-icons-pencil-tiny\"></use>\n    </svg>edit source</a><span class=\"mw-editsection-bracket\">]</span></span></h2> \n <p><i>Reference Book:</i>&nbsp;<i><a href=\"https://swse.fandom.com/wiki/Star_Wars_Saga_Edition_Knights_of_the_Old_Republic_Campaign_Guide\" title=\"Star Wars Saga Edition Knights of the Old Republic Campaign Guide\">Star Wars Saga Edition Knights of the Old Republic Campaign Guide</a></i> </p>\n <p><b><a href=\"https://swse.fandom.com/wiki/Combined_Feat\" class=\"mw-redirect\" title=\"Combined Feat\">Combined Feat</a> (<a href=\"https://swse.fandom.com/wiki/Quick_Draw\" title=\"Quick Draw\">Quick Draw</a>):</b> You can draw and ignite your <a href=\"https://swse.fandom.com/wiki/Lightsaber\" class=\"mw-redirect\" title=\"Lightsaber\">Lightsaber</a> as a single <a href=\"https://swse.fandom.com/wiki/Swift_Action\" class=\"mw-redirect\" title=\"Swift Action\">Swift Action</a>. </p> <!-- \nNewPP limit report\nCached time: 20210212123253\nCache expiry: 1209600\nDynamic content: false\nCPU time usage: 0.006 seconds\nReal time usage: 0.008 seconds\nPreprocessor visited node count: 17/1000000\nPreprocessor generated node count: 0/1000000\nPost‐expand include size: 0/2097152 bytes\nTemplate argument size: 0/2097152 bytes\nHighest expansion depth: 2/40\nExpensive parser function count: 0/100\nUnstrip recursion depth: 0/20\nUnstrip post‐expand size: 0/5000000 bytes\n--> <!--\nTransclusion expansion time report (%,ms,calls,template)\n100.00%    0.000      1 -total\n--> <!-- Saved in parser cache with key prod:swse:pcache:idhash:2222-0!canonical and timestamp 20210212123253 and revision id 46047\n --> \n</div>",
                    "attributes": {
                        "fortDefenceBonus": {
                            "dtype": "String",
                            "value": ""
                        },
                        "refDefenceBonus": {
                            "dtype": "String",
                            "value": ""
                        },
                        "hitPointEq": {
                            "dtype": "String",
                            "value": ""
                        }
                    },
                    "choices": [
                        {
                            "options": {
                                "Simple Weapons": {
                                    "abilities": [],
                                    "payload": "Simple Weapons",
                                    "items": []
                                },
                                "Lightsabers": {
                                    "abilities": [],
                                    "payload": "Lightsabers",
                                    "items": []
                                },
                                "Pistols": {
                                    "abilities": [],
                                    "payload": "Pistols",
                                    "items": []
                                },
                                "Advanced Melee Weapons": {
                                    "abilities": [],
                                    "payload": "Advanced Melee Weapons",
                                    "items": []
                                },
                                "Heavy Weapons": {
                                    "abilities": [],
                                    "payload": "Heavy Weapons",
                                    "items": []
                                },
                                "Rifles": {
                                    "abilities": [],
                                    "payload": "Rifles",
                                    "items": []
                                }
                            },
                            "description": "Select a Weapon Proficiency"
                        }
                    ],
                    "payload": "Rifles",
                    "prerequisites": [],
                    "categories": [
                        "Feats"
                    ],
                    "supplyingClass": "Soldier",
                    "supplyingSpecies": "",
                    "supplyingFeature": "",
                    "supplyingFeat": "",
                    "isSupplied": true
                },
                "sort": 1200000,
                "flags": {},
                "img": "icons/svg/mystery-man.svg",
                "effects": []
            },
            {
                "_id": "8PJCgfPeEHJndr6w",
                "name": "Weapon Proficiency",
                "type": "feat",
                "data": {
                    "description": "<div class=\"mw-parser-output\">\n <p><i>See also: <a href=\"https://swse.fandom.com/wiki/Feats\" title=\"Feats\">Feats</a></i> </p>\n <p>You are proficient with a particular kind of weaponry. </p>\n <p><b>Effect:</b> Choose one Weapon Group. You are proficient with all weapons of the selected group. Weapon Groups include the following: </p> \n <ul>\n  <li>Simple Weapons (Includes <a href=\"https://swse.fandom.com/wiki/Simple_Weapons_(Melee)\" title=\"Simple Weapons (Melee)\">Simple Weapons (Melee)</a>, <a href=\"https://swse.fandom.com/wiki/Simple_Weapons_(Ranged)\" title=\"Simple Weapons (Ranged)\">Simple Weapons (Ranged)</a>, <a href=\"https://swse.fandom.com/wiki/Grenades\" title=\"Grenades\">Grenades</a>, and <a href=\"https://swse.fandom.com/wiki/Mines\" title=\"Mines\">Mines</a>)</li> \n  <li><a href=\"https://swse.fandom.com/wiki/Pistols\" title=\"Pistols\">Pistols</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Rifles\" title=\"Rifles\">Rifles</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Lightsabers\" title=\"Lightsabers\">Lightsabers</a></li> \n  <li><a href=\"https://swse.fandom.com/wiki/Heavy_Weapons\" title=\"Heavy Weapons\">Heavy Weapons</a> (Includes both <a href=\"https://swse.fandom.com/wiki/Heavy_Weapons\" title=\"Heavy Weapons\">Heavy Weapons</a> and <a href=\"https://swse.fandom.com/wiki/Vehicle_Weapons\" class=\"mw-redirect\" title=\"Vehicle Weapons\">Vehicle Weapons</a>)</li> \n  <li><a href=\"https://swse.fandom.com/wiki/Advanced_Melee_Weapons\" title=\"Advanced Melee Weapons\">Advanced Melee Weapons</a></li>\n </ul> \n <p><b>Normal:</b> If you wield a weapon with which you are not proficient, you take a -5 penalty to your attack rolls. </p>\n <p><b>Special:</b> You can gain this Feat multiple times. Each time you take the Feat, it applies to a different Weapon Group. You cannot take <a href=\"https://swse.fandom.com/wiki/Exotic_Weapons\" title=\"Exotic Weapons\">Exotic Weapons</a> as a weapon group; instead you must select the <a href=\"https://swse.fandom.com/wiki/Exotic_Weapon_Proficiency\" title=\"Exotic Weapon Proficiency\">Exotic Weapon Proficiency</a> Feat to gain proficiency with a specific Exotic Weapon. </p> \n <h2><span class=\"mw-headline\" id=\"Additional_Weapon_Proficiency\">Additional Weapon Proficiency</span><span class=\"mw-editsection\"><span class=\"mw-editsection-bracket\">[</span><a href=\"https://swse.fandom.com/wiki/Weapon_Proficiency?veaction=edit&amp;section=1\" class=\"mw-editsection-visualeditor\" title=\"Edit section: Additional Weapon Proficiency\">edit</a><span class=\"mw-editsection-divider\"> | </span><a href=\"https://swse.fandom.com/wiki/Weapon_Proficiency?action=edit&amp;section=1\" title=\"Edit section: Additional Weapon Proficiency\">\n    <svg class=\"wds-icon wds-icon-tiny section-edit-pencil-icon\">\n     <use xlink:href=\"#wds-icons-pencil-tiny\"></use>\n    </svg>edit source</a><span class=\"mw-editsection-bracket\">]</span></span></h2> \n <p><i>Reference Book:</i>&nbsp;<i><a href=\"https://swse.fandom.com/wiki/Star_Wars_Saga_Edition_Knights_of_the_Old_Republic_Campaign_Guide\" title=\"Star Wars Saga Edition Knights of the Old Republic Campaign Guide\">Star Wars Saga Edition Knights of the Old Republic Campaign Guide</a></i> </p>\n <p><b><a href=\"https://swse.fandom.com/wiki/Combined_Feat\" class=\"mw-redirect\" title=\"Combined Feat\">Combined Feat</a> (<a href=\"https://swse.fandom.com/wiki/Quick_Draw\" title=\"Quick Draw\">Quick Draw</a>):</b> You can draw and ignite your <a href=\"https://swse.fandom.com/wiki/Lightsaber\" class=\"mw-redirect\" title=\"Lightsaber\">Lightsaber</a> as a single <a href=\"https://swse.fandom.com/wiki/Swift_Action\" class=\"mw-redirect\" title=\"Swift Action\">Swift Action</a>. </p> <!-- \nNewPP limit report\nCached time: 20210212123253\nCache expiry: 1209600\nDynamic content: false\nCPU time usage: 0.006 seconds\nReal time usage: 0.008 seconds\nPreprocessor visited node count: 17/1000000\nPreprocessor generated node count: 0/1000000\nPost‐expand include size: 0/2097152 bytes\nTemplate argument size: 0/2097152 bytes\nHighest expansion depth: 2/40\nExpensive parser function count: 0/100\nUnstrip recursion depth: 0/20\nUnstrip post‐expand size: 0/5000000 bytes\n--> <!--\nTransclusion expansion time report (%,ms,calls,template)\n100.00%    0.000      1 -total\n--> <!-- Saved in parser cache with key prod:swse:pcache:idhash:2222-0!canonical and timestamp 20210212123253 and revision id 46047\n --> \n</div>",
                    "attributes": {
                        "fortDefenceBonus": {
                            "dtype": "String",
                            "value": ""
                        },
                        "refDefenceBonus": {
                            "dtype": "String",
                            "value": ""
                        },
                        "hitPointEq": {
                            "dtype": "String",
                            "value": ""
                        }
                    },
                    "choices": [
                        {
                            "options": {
                                "Simple Weapons": {
                                    "abilities": [],
                                    "payload": "Simple Weapons",
                                    "items": []
                                },
                                "Lightsabers": {
                                    "abilities": [],
                                    "payload": "Lightsabers",
                                    "items": []
                                },
                                "Pistols": {
                                    "abilities": [],
                                    "payload": "Pistols",
                                    "items": []
                                },
                                "Advanced Melee Weapons": {
                                    "abilities": [],
                                    "payload": "Advanced Melee Weapons",
                                    "items": []
                                },
                                "Heavy Weapons": {
                                    "abilities": [],
                                    "payload": "Heavy Weapons",
                                    "items": []
                                },
                                "Rifles": {
                                    "abilities": [],
                                    "payload": "Rifles",
                                    "items": []
                                }
                            },
                            "description": "Select a Weapon Proficiency"
                        }
                    ],
                    "payload": "Simple Weapons",
                    "prerequisites": [],
                    "categories": [
                        "Feats"
                    ],
                    "supplyingClass": "Soldier",
                    "supplyingSpecies": "",
                    "supplyingFeature": "",
                    "supplyingFeat": "",
                    "isSupplied": true
                },
                "sort": 1300000,
                "flags": {},
                "img": "icons/svg/mystery-man.svg",
                "effects": []
            },
            {
                "_id": "0jkqo1j7eabNWkqh",
                "name": "Armor Proficiency (Medium)",
                "type": "feat",
                "data": {
                    "description": "<div class=\"mw-parser-output\">\n <p><i>See also: <a href=\"https://swse.fandom.com/wiki/Feats\" title=\"Feats\">Feats</a></i> </p>\n <p>You are proficient with <a href=\"https://swse.fandom.com/wiki/Medium_Armor\" title=\"Medium Armor\">Medium Armor</a>, and can wear it without impediment. </p>\n <p><b>Prerequisite:</b> <a href=\"https://swse.fandom.com/wiki/Armor_Proficiency_(Light)\" title=\"Armor Proficiency (Light)\">Armor Proficiency (Light)</a> Feat </p>\n <p><b>Effect:</b> When you wear <a href=\"https://swse.fandom.com/wiki/Medium_Armor\" title=\"Medium Armor\">Medium Armor</a>, you take no <a href=\"https://swse.fandom.com/wiki/Armor_Check_Penalty\" class=\"mw-redirect\" title=\"Armor Check Penalty\">Armor Check Penalty</a> on attack rolls or <a href=\"https://swse.fandom.com/wiki/Skill_Checks\" class=\"mw-redirect\" title=\"Skill Checks\">Skill Checks</a>. Additionally, you benefit from all of the armor's special <a href=\"https://swse.fandom.com/wiki/Equipment\" title=\"Equipment\">Equipment</a> bonuses (If any). </p>\n <p><b>Normal:</b>&nbsp;A character who wears <a href=\"https://swse.fandom.com/wiki/Medium_Armor\" title=\"Medium Armor\">Medium Armor</a> with which they are not proficient takes a -5 <a href=\"https://swse.fandom.com/wiki/Armor_Check_Penalty\" class=\"mw-redirect\" title=\"Armor Check Penalty\">Armor Check Penalty</a> on attack rolls as well as <a href=\"https://swse.fandom.com/wiki/Skill_Checks\" class=\"mw-redirect\" title=\"Skill Checks\">Skill Checks</a> made using the following <a href=\"https://swse.fandom.com/wiki/Skills\" title=\"Skills\">Skills</a>: <a href=\"https://swse.fandom.com/wiki/Acrobatics\" title=\"Acrobatics\">Acrobatics</a>, <a href=\"https://swse.fandom.com/wiki/Climb\" title=\"Climb\">Climb</a>, <a href=\"https://swse.fandom.com/wiki/Endurance\" title=\"Endurance\">Endurance</a>, <a href=\"https://swse.fandom.com/wiki/Initiative\" title=\"Initiative\">Initiative</a>, <a href=\"https://swse.fandom.com/wiki/Jump\" title=\"Jump\">Jump</a>, <a href=\"https://swse.fandom.com/wiki/Stealth\" title=\"Stealth\">Stealth</a>, and <a href=\"https://swse.fandom.com/wiki/Swim\" title=\"Swim\">Swim</a>. Additionally, the character gains none of the armor's special <a href=\"https://swse.fandom.com/wiki/Equipment\" title=\"Equipment\">Equipment</a> bonuses. </p> <!-- \nNewPP limit report\nCached time: 20210201011049\nCache expiry: 1209600\nDynamic content: false\nCPU time usage: 0.007 seconds\nReal time usage: 0.008 seconds\nPreprocessor visited node count: 1/1000000\nPreprocessor generated node count: 0/1000000\nPost‐expand include size: 0/2097152 bytes\nTemplate argument size: 0/2097152 bytes\nHighest expansion depth: 1/40\nExpensive parser function count: 0/100\nUnstrip recursion depth: 0/20\nUnstrip post‐expand size: 0/5000000 bytes\n--> <!--\nTransclusion expansion time report (%,ms,calls,template)\n100.00%    0.000      1 -total\n--> <!-- Saved in parser cache with key prod:swse:pcache:idhash:2163-0!canonical and timestamp 20210201011049 and revision id 46055\n --> \n</div>",
                    "attributes": {
                        "fortDefenceBonus": {
                            "dtype": "String",
                            "value": ""
                        },
                        "refDefenceBonus": {
                            "dtype": "String",
                            "value": ""
                        },
                        "hitPointEq": {
                            "dtype": "String",
                            "value": ""
                        }
                    },
                    "choices": [],
                    "payload": "Medium",
                    "prerequisites": [
                        "Armor Proficiency (Light) Feat"
                    ],
                    "categories": [
                        "Feats"
                    ],
                    "supplyingClass": "Soldier",
                    "supplyingSpecies": "",
                    "supplyingFeature": "",
                    "supplyingFeat": "",
                    "isSupplied": true
                },
                "sort": 1400000,
                "flags": {},
                "img": "icons/svg/mystery-man.svg",
                "effects": []
            },
            {
                "_id": "W5ahfGSCxmIigHkt",
                "name": "Stun Baton",
                "type": "weapon",
                "data": {
                    "description": "<div class=\"mw-parser-output\">\n <p>A short <a href=\"https://swse.fandom.com/wiki/Club\" class=\"mw-redirect\" title=\"Club\">Club</a> with a <a href=\"https://swse.fandom.com/wiki/Power_Pack\" title=\"Power Pack\">Power Pack</a> in the handle, the Stun Baton can be activated to produce a stunning charge when it strikes a target. </p>\n <p>A Stun Baton requires an <a href=\"https://swse.fandom.com/wiki/Energy_Cell\" title=\"Energy Cell\">Energy Cell</a> to operate. </p>    \n</div>",
                    "attributes": {},
                    "choices": [],
                    "payload": "",
                    "equipable": true,
                    "droidPart": false,
                    "bioPart": false,
                    "isMod": false,
                    "cost": "15",
                    "weight": "0.5 Kilograms",
                    "availability": "",
                    "size": "Small",
                    "categories": [
                        "simple melee weapons"
                    ],
                    "items": [],
                    "supplyingClass": "",
                    "supplyingSpecies": "",
                    "supplyingFeature": "",
                    "supplyingFeat": "",
                    "isSupplied": false,
                    "weapon": {
                        "damage": {
                            "attacks": [
                                {
                                    "dtype": "String",
                                    "value": "1d6",
                                    "key": "base"
                                }
                            ],
                            "finalDamage": "1d6"
                        },
                        "accurate": false,
                        "weaponType": "Simple Melee Weapons",
                        "stun": {
                            "isAvailable": true,
                            "dieEquation": "2d6"
                        },
                        "type": " Bludgeoning or Energy (Stun)",
                        "inaccurate": false,
                        "stripping": {
                            "canReduceRange": false,
                            "canStripStun": true,
                            "canStripDesign": true,
                            "canMakeTiny": false,
                            "makeTiny": false,
                            "canMakeSmall": false,
                            "makeSmall": false,
                            "canMakeMedium": true,
                            "makeLarge": false,
                            "canMakeHuge": false,
                            "makeHuge": false,
                            "canMakeGargantuan": false,
                            "makeGargantuan": false,
                            "canMakeColossal": false,
                            "makeColossal": false
                        },
                        "isBaseExotic": false,
                        "finalWeaponRange": "Simple Melee Weapons",
                        "finalStun": "2d6"
                    }
                },
                "sort": 1500000,
                "flags": {
                    "core": {
                        "sourceId": "Compendium.world.swse-items.4MeUem9zjxZxBzwp"
                    }
                },
                "img": "systems/swse/icon/item/simple melee weapons/default.png",
                "effects": []
            },
            {
                "_id": "NwjZbPexItnhUSvl",
                "name": "Sonic Stunner",
                "type": "weapon",
                "data": {
                    "description": "<div class=\"mw-parser-output\">\n <p><i>Reference Book:</i> <i><a href=\"https://swse.fandom.com/wiki/Star_Wars_Saga_Edition_Threats_of_the_Galaxy\" title=\"Star Wars Saga Edition Threats of the Galaxy\">Star Wars Saga Edition Threats of the Galaxy</a></i> </p>\n <p>A Sonic Stunner creates waves of sonic energy that assault the aural receptors of anyone it targets. The weapon fires a concentrated burst of sonic energy (Using technology similar to sonic weapons used by <a href=\"https://swse.fandom.com/wiki/Geonosian\" title=\"Geonosian\">Geonosians</a>) that manipulates the minds of living beings, causing them great pain. Even deaf creatures can be harmed by a Sonic Stunner, because it creates high-frequency vibrations that penetrate the brain. However, unlike with most blaster weapons, only the target of the attack hears any noise, making the weapon otherwise silent. </p>    \n</div>",
                    "attributes": {},
                    "choices": [],
                    "payload": "",
                    "equipable": true,
                    "droidPart": false,
                    "bioPart": false,
                    "isMod": false,
                    "cost": "450",
                    "weight": "1 Kilogram",
                    "availability": "Illegal",
                    "size": "Tiny",
                    "categories": [
                        "Pistols",
                        "Ranged Weapons",
                        "pistols"
                    ],
                    "items": [],
                    "supplyingClass": "",
                    "supplyingSpecies": "",
                    "supplyingFeature": "",
                    "supplyingFeat": "",
                    "isSupplied": false,
                    "weapon": {
                        "accurate": false,
                        "weaponType": "Pistols",
                        "stun": {
                            "isOnly": true,
                            "isAvailable": true,
                            "dieEquation": "3d6"
                        },
                        "type": " Energy",
                        "inaccurate": false,
                        "ratesOfFire": [
                            "Single-Shot"
                        ],
                        "stripping": {
                            "canReduceRange": true,
                            "canStripAutofire": false,
                            "canStripStun": false,
                            "canStripDesign": true,
                            "canMakeTiny": false,
                            "makeTiny": false,
                            "canMakeSmall": true,
                            "makeMedium": false,
                            "canMakeLarge": false,
                            "makeLarge": false,
                            "canMakeHuge": false,
                            "makeHuge": false,
                            "canMakeGargantuan": false,
                            "makeGargantuan": false,
                            "canMakeColossal": false,
                            "makeColossal": false,
                            "damage": false,
                            "makeSmall": false,
                            "range": false,
                            "design": false
                        },
                        "isBaseExotic": false,
                        "finalWeaponRange": "Pistols",
                        "finalStun": "3d6",
                        "finalRatesOfFire": "Single-Shot"
                    }
                },
                "sort": 1600000,
                "flags": {
                    "core": {
                        "sourceId": "Compendium.world.swse-items.RXQSq9Kh36Jaum7z"
                    }
                },
                "img": "systems/swse/icon/item/pistols/default.png",
                "effects": []
            }
        ],
        "effects": []
    }
};