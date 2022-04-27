import {filterItemsByType, resolveExpression, resolveValueArray, toNumber} from "./util.js";
import {weaponGroup} from "./constants.js";
import {getInheritableAttribute} from "./attribute-helper.js";
import {SWSEActor} from "./actor/actor.js";
import {SWSEItem} from "./item/item.js";

/**
 *
 * @param {SWSEActor|SWSEItem} target
 * @param {Object[]} prereqs
 * @param {string} prereqs[].text always available
 * @param {string} prereqs[].type always available
 * @param {string} prereqs[].requirement available on all types except AND, OR, and NULL
 * @param {number} prereqs[].count available on OR
 * @param {Object[]} prereqs[].children available on AND and OR
 * @returns {{failureList: [], doesFail: boolean, silentFail: []}}
 */
export function meetsPrerequisites(target, prereqs) {
    //TODO add links to failures to upen up the fancy compendium to show the missing thing.  when you make a fancy compendium

    let failureList = [];
    let silentFail = [];
    let successList = [];
    if (!prereqs) {
        return {doesFail: false, failureList, silentFail: silentFail, successList};
    }
    if(!target){
        return {doesFail: true, failureList, silentFail: silentFail, successList};
    }

    if (!Array.isArray(prereqs)) {
        prereqs = [prereqs];
    }

    for (let prereq of prereqs) {
        switch (prereq.type.toUpperCase()) {
            case undefined:
                continue;
            case 'AGE':
                let age = toNumber(target.age) || toNumber(target.data.age);
                if (!age || toNumber(prereq.low) > age || (prereq.high && toNumber(prereq.high) < age)) {
                    failureList.push({fail: true, message: `${prereq.type}: ${prereq.text}`});
                    continue;
                }
                successList.push({prereq, count: 1});
                continue;
            case 'CHARACTER LEVEL':
                if (!(target.characterLevel < toNumber(prereq.requirement))) {
                    successList.push({prereq, count: 1});
                    continue;
                }
                break;
            case 'BASE ATTACK BONUS':
                if (!(target.baseAttackBonus < parseInt(prereq.requirement))) {
                    successList.push({prereq, count: 1});
                    continue;
                }
                break;
            case 'DARK SIDE SCORE':
                if (!(target.darkSideScore < resolveValueArray([prereq.requirement], target))) {
                    successList.push({prereq, count: 1});
                    continue;
                }
                break;
            case 'ITEM':
                let ownedItem = target.getInventoryItems(this.items.values());
                let filteredItem = ownedItem.filter(feat => feat.data.finalName === prereq.requirement);
                if (filteredItem.length > 0) {
                    successList.push({prereq, count: 1});
                    continue;
                }
                break;
            case 'SPECIES':
                let filteredSpecies = target.species.filter(feat => feat.data.finalName === prereq.requirement);
                if (filteredSpecies.length > 0) {
                    successList.push({prereq, count: 1});
                    continue;
                }
                break;
            case 'TRAINED SKILL':
                if (Object.entries(target.data.data.skills).filter(skill => skill[0].toLowerCase() === prereq.requirement.toLowerCase() && skill[1].trained).length === 1) {
                    successList.push({prereq, count: 1});
                    continue;
                }
                break;
            case 'FEAT':
                let ownedFeats = filterItemsByType(target.items.values(), "feat");
                let filteredFeats = ownedFeats.filter(feat => feat.data.finalName === prereq.requirement);
                if (filteredFeats.length > 0) {
                    if (!meetsPrerequisites(target, filteredFeats[0].data.data.prerequisite).doesFail) {
                        successList.push({prereq, count: 1});
                        continue;
                    }
                }
                break;
            case 'CLASS':
                let ownedClasses = filterItemsByType(target.items.values(), "class");
                let filteredClasses = ownedClasses.filter(feat => feat.data.finalName === prereq.requirement);
                if (filteredClasses.length > 0) {
                    if (!meetsPrerequisites(target, filteredClasses[0].data.data.prerequisite).doesFail) {
                        successList.push({prereq, count: 1});
                        continue;
                    }
                }
                break;
            case 'TRAIT':
                let filteredTraits = filterItemsByType(target.items.values(), "trait")
                    .filter(feat => feat.data.finalName === prereq.requirement);
                if (filteredTraits.length > 0) {
                    let parentsMeetPrequisites = false;
                    for (let filteredTrait of filteredTraits) {
                        if (!meetsPrerequisites(target, filteredTrait.data.data.prerequisite).doesFail) {
                            successList.push({prereq, count: 1});
                            parentsMeetPrequisites = true;
                        }
                    }
                    if (parentsMeetPrequisites) {
                        continue;
                    }
                }
                break;
            case 'PROFICIENCY':
                if (target.data.proficiency.weapon.includes(prereq.requirement.toLowerCase())
                    || target.data.proficiency.armor.includes(prereq.requirement.toLowerCase())) {
                    successList.push({prereq, count: 1});
                    continue;
                }
                break;
            case 'TALENT':
                let ownedTalents = filterItemsByType(target.items.values(), "talent");
                let filteredTalents = ownedTalents.filter(feat => feat.data.finalName === prereq.requirement);
                if (filteredTalents.length > 0) {
                    if (!meetsPrerequisites(target, filteredTalents[0].data.data.prerequisite).doesFail) {
                        successList.push({prereq, count: 1});
                        continue;
                    }
                }

                let talentsByTreeFilter = ownedTalents.filter(talent => talent.data.data.talentTree === prereq.requirement || talent.data.data.bonusTalentTree === prereq.requirement);
                if (talentsByTreeFilter.length > 0) {
                    let count = 0;
                    for (let talent of talentsByTreeFilter) {
                        if (!meetsPrerequisites(target, talent.data.data.prerequisite).doesFail) {
                            count++;
                        }
                    }
                    if (count > 0) {
                        successList.push({prereq, count})
                        continue;
                    }
                }

                break;
            case 'TRADITION':
                let ownedTraditions = filterItemsByType(target.items.values(), "affiliation");
                let filteredTraditions = ownedTraditions.filter(feat => feat.data.finalName === prereq.requirement);
                if (filteredTraditions.length > 0) {
                    if (!meetsPrerequisites(target, filteredTraditions[0].data.data.prerequisite).doesFail) {
                        successList.push({prereq, count: 1});
                        continue;
                    }
                }
                break;
            case 'FORCE TECHNIQUE':
                let ownedForceTechniques = filterItemsByType(target.items.values(), "forceTechnique");
                if (!isNaN(prereq.requirement)) {
                    if (!(ownedForceTechniques.length < parseInt(prereq.requirement))) {
                        successList.push({prereq, count: 1});
                        continue;
                    }
                }

                let filteredForceTechniques = ownedForceTechniques.filter(feat => feat.data.finalName === prereq.requirement);
                if (filteredForceTechniques.length > 0) {
                    if (!meetsPrerequisites(target, filteredForceTechniques[0].data.data.prerequisite).doesFail) {
                        successList.push({prereq, count: 1});
                        continue;
                    }
                }
                break;
            case 'FORCE POWER':
                let ownedForcePowers = filterItemsByType(target.items.values(), "forcePower");
                if (!isNaN(prereq.requirement)) {
                    if (!(ownedForcePowers.length < parseInt(prereq.requirement))) {
                        successList.push({prereq, count: 1});
                        continue;
                    }
                }

                let filteredForcePowers = ownedForcePowers.filter(feat => feat.data.finalName === prereq.requirement);
                if (filteredForcePowers.length > 0) {
                    if (!meetsPrerequisites(target, filteredForcePowers[0].data.data.prerequisite).doesFail) {
                        successList.push({prereq, count: 1});
                        continue;
                    }
                }
                break;
            case 'ATTRIBUTE':
                if(prereq.requirement.includes(":")){
                    let toks = prereq.requirement.split(":");
                    let val = getInheritableAttribute({
                        entity: target,
                        attributeKey: toks[0],
                        reduce: "SUM"
                    });
                    let check = parseInt(toks[1].substring(1));
                    if(toks[1].startsWith(">")){
                        if(val > check){
                            successList.push({prereq, count: 1});
                            continue;
                        }
                    } else if(toks[1].startsWith("<")){
                        if(val < check){
                            successList.push({prereq, count: 1});
                            continue;
                        }
                    } else if(toks[1].startsWith("=")){
                        if(val === check){
                            successList.push({prereq, count: 1});
                            continue;
                        }
                    }
                } else {
                    let toks = prereq.requirement.split(" ");
                    let actorAttribute = SWSEActor.getActorAttribute(target, toks[0]);
                    let number = parseInt(toks[1]);
                    if (!(actorAttribute < number)) {
                        successList.push({prereq, count: 1});
                        continue;
                    }
                }
                break;
            case 'NOT': {
                let meetsChildPrereqs = meetsPrerequisites(target, prereq.child);
                if (meetsChildPrereqs.doesFail) {
                    successList.push({prereq, count: 1});
                    continue;
                }
                meetsChildPrereqs.successList.forEach(item => item.fail = true)
                failureList.push(...meetsChildPrereqs.successList)
                continue;
            }
            case 'AND': {
                let meetsChildPrereqs = meetsPrerequisites(target, prereq.children);
                if (!(meetsChildPrereqs.doesFail)) {
                    successList.push({prereq, count: 1});
                    continue;
                }
                if(meetsChildPrereqs.failureList.length > 1) {
                    failureList.push({fail: true, message: `all of:`, children: meetsChildPrereqs.failureList})
                } else {
                    failureList.push(...meetsChildPrereqs.failureList)
                }
                continue;
            }
            case 'OR': {
                let meetsChildPrereqs = meetsPrerequisites(target, prereq.children)
                let count = 0;
                for (let success of meetsChildPrereqs.successList) {
                    count += success.count;
                }

                if (!(count < prereq.count)) {
                    successList.push({prereq, count: 1});
                    continue;
                }
                if(meetsChildPrereqs.failureList.length > 1) {
                    if(prereq.text){
                        failureList.push({
                            fail: meetsChildPrereqs.doesFail,
                            message: prereq.text
                        })
                    } else {
                        failureList.push({
                            fail: meetsChildPrereqs.doesFail,
                            message: `at least of ${prereq.count}:`,
                            children: meetsChildPrereqs.failureList
                        })
                    }
                } else {
                    failureList.push(...meetsChildPrereqs.failureList)
                }
                continue;
            }
            case 'SPECIAL':
                if (prereq.requirement.toLowerCase() === 'not a droid') {
                    let inheritableAttributesByKey = getInheritableAttribute({
                        entity: target,
                        attributeKey: "isDroid",
                        reduce: "OR"
                    });
                    if (!inheritableAttributesByKey) {
                        successList.push({prereq, count: 1});
                        continue;
                    }
                    break;
                } else if (prereq.requirement.toLowerCase() === 'is a droid') {
                    if (getInheritableAttribute({
                        entity: target,
                        attributeKey: "isDroid",
                        reduce: "OR"
                    })) {
                        successList.push({prereq, count: 1});
                        continue;
                    }
                    break;
                } else if (prereq.requirement === 'Has Built Lightsaber') {
                    failureList.push({fail: false, message: `${prereq.type}: ${prereq.text}`});
                    continue;
                } else if (prereq.requirement === 'is part of a military') {
                    if(filterItemsByType(target.items.values(), "affiliation").length > 0) {
                        successList.push({prereq, count: 1});
                        continue;
                    }
                }
                break;
            case 'GENDER':
                if (target.data.data.sex && target.data.data.sex.toLowerCase() === prereq.requirement.toLowerCase()) {
                    successList.push({prereq, count: 1});
                    continue;
                }
                break;
            case 'EQUIPPED':
                let req = prereq.requirement;
                let comparison;
                if(req.includes(":")){
                    let toks = req.split(":");
                    req = toks[0];
                    comparison = toks[1];
                }
                let equippedItems = target.getEquippedItems();
                let filteredEquippedItems = equippedItems.filter(item => item.data.finalName === req || item.data.data.subtype === req);
                let count = filteredEquippedItems.length;
                if ((count > 0 && !comparison) || (comparison && resolveExpression(`${count}${comparison}`))) {
                    successList.push({prereq, count: 1});
                    continue;
                }
                break;
            case "TYPE":
                if (target.type && target.type.toLowerCase() === prereq.requirement.toLowerCase()) {
                    successList.push({prereq, count: 1});
                    continue;
                }
                break;
            case "SUBTYPE":
                if (target.data.data.subtype && target.data.data.subtype.toLowerCase() === prereq.requirement.toLowerCase()) {
                    successList.push({prereq, count: 1});
                    continue;
                }
                break;
            case "WEAPON_GROUP":
                if (weaponGroup[ prereq.requirement].includes(target.data.data.subtype)) {
                    successList.push({prereq, count: 1});
                    continue;
                }
                break;
            case "TEMPLATE":
                let templates = target.data.data.items.filter(item => item.type === "template").map(item => item.name)
                if (templates.includes(prereq.requirement)) {
                    successList.push({prereq, count: 1});
                    continue;
                }
                break;
            case "MODE":
                let modes = Object.values(target.data.data.modes).map(item => item.name.toLowerCase());
                if (modes.includes(prereq.requirement.toLowerCase())) {
                    successList.push({prereq, count: 1});
                    continue;
                }
                break;
            case "DAMAGE_TYPE":
                let damageTypes = getInheritableAttribute({
                    entity: target,
                    attributeKey: "damageType",
                    reduce: "VALUES_TO_LOWERCASE"
                });
                if (damageTypes.includes(prereq.requirement.toLowerCase())) {
                    successList.push({prereq, count: 1});
                    continue;
                }
                break;
            case "WEAPON_SIZE":
                let weaponSize = SWSEItem.getItemSize(target);

                if(prereq.requirement.toLowerCase() === weaponSize.toLowerCase()){

                    successList.push({prereq, count: 1});
                    continue;
                }
                break;
            default:
                console.warn("this prereq is not supported", prereq)
        }

        failureList.push({fail: true, message: `${prereq.text}`});
    }

    let doesFail = false;
    for (let fail of failureList) {
        if (fail.fail === true) {
            doesFail = true;
            break;
        }
    }
    //
    // for (let fail of silentFail) {
    //     if (fail.fail === true) {
    //         doesFail = true;
    //         break;
    //     }
    // }

    return {doesFail, failureList, silentFail, successList};
}


export function formatPrerequisites(failureList) {
    let format = "<ul>";
    for (let fail of failureList) {
        format = format + `<li>${fail.message}`;
        if(fail.children && fail.children.length>0){
            format = format + "</br>" + formatPrerequisites(fail.children);
        }
        format = format + `</li>`;
    }
    return format + "</ul>";
}