import {filterItemsByType, resolveValueArray} from "./util";

export function
/**
 *
 * @param {SWSEActor|SWSEItem} target
 * @param {Object[]} prereqs
 * @param {string} prereqs[].text always available
 * @param {string} prereqs[].type always available
 * @param {string} prereqs[].requirement available on all types except AND, OR, and NULL
 * @param {number} prereqs[].count available on OR
 * @param {Object[]} prereqs[].children available on AND and OR
 * @param notifyOnFailure
 * @returns {{failureList: [], doesFail: boolean, silentFail: []}}
 */
meetsPrerequisites(target, prereqs, notifyOnFailure = true) {
    //TODO add links to failures to upen up the fancy compendium to show the missing thing.  when you make a fancy compendium

    let failureList = [];
    let silentFailList = [];
    let successList = [];
    if (!prereqs) {
        return {doesFail: false, failureList, silentFail: silentFailList, successList};
    }

    if (!Array.isArray(prereqs)) {
        prereqs = [prereqs];
    }

    for (let prereq of prereqs) {
        switch (prereq.type) {
            case undefined:
                continue;
            case 'AGE':
                let age = target.age;
                if (parseInt(prereq.low) > age || (prereq.high && parseInt(prereq.high) < age)) {
                    failureList.push({fail: true, message: `${prereq.type}: ${prereq.text}`});
                    continue;
                }
                successList.push({prereq, count: 1});
                continue;
            case 'CHARACTER LEVEL':
                if (!(target.getCharacterLevel() < parseInt(prereq.requirement))) {
                    successList.push({prereq, count: 1});
                    continue;
                }
                break;
            case 'BASE ATTACK BONUS':
                if (!(target.getBaseAttackBonus() < parseInt(prereq.requirement))) {
                    successList.push({prereq, count: 1});
                    continue;
                }
                break;
            case 'DARK SIDE SCORE':
                if (!target.getDarkSideScore() < resolveValueArray([prereq.requirement], target)) {
                    successList.push({prereq, count: 1});
                    continue;
                }
                break;
            case 'ITEM':
                let ownedItem = target.getInventoryItems();
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
                if (target.data.prerequisites.trainedSkills.filter(trainedSkill => trainedSkill.toLowerCase() === prereq.requirement.toLowerCase()).length === 1) {
                    successList.push({prereq, count: 1});
                    continue;
                }
                break;
            case 'FEAT':
                let ownedFeats = filterItemsByType(target.items.values(), "feat");
                let filteredFeats = ownedFeats.filter(feat => feat.data.finalName === prereq.requirement);
                if (filteredFeats.length > 0) {
                    if (!meetsPrerequisites(target, filteredFeats[0].data.data.prerequisite, false).doesFail) {
                        successList.push({prereq, count: 1});
                        continue;
                    }
                }
                break;
            case 'CLASS':
                let ownedClasses = filterItemsByType(target.items.values(), "class");
                let filteredClasses = ownedClasses.filter(feat => feat.data.finalName === prereq.requirement);
                if (filteredClasses.length > 0) {
                    if (!meetsPrerequisites(target, filteredClasses[0].data.data.prerequisite, false).doesFail) {
                        successList.push({prereq, count: 1});
                        continue;
                    }
                }
                break;
            case 'TRAIT':
                let ownedTraits = filterItemsByType(target.items.values(), "trait");
                let filteredTraits = ownedTraits.filter(feat => feat.data.finalName === prereq.requirement);
                if (filteredTraits.length > 0) {
                    let parentsMeetPrequisites = false;
                    for (let filteredTrait of filteredTraits) {
                        if (!meetsPrerequisites(target, filteredTrait.data.data.prerequisite, false).doesFail) {
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
                    if (!meetsPrerequisites(target, filteredTalents[0].data.data.prerequisite, false).doesFail) {
                        successList.push({prereq, count: 1});
                        continue;
                    }
                }

                let talentsByTreeFilter = ownedTalents.filter(talent => talent.data.data.talentTree === prereq.requirement || talent.data.data.bonusTalentTree === prereq.requirement);
                if (talentsByTreeFilter.length > 0) {
                    let count = 0;
                    for (let talent of talentsByTreeFilter) {
                        if (!meetsPrerequisites(target, talent.data.data.prerequisite, false).doesFail) {
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
                let ownedTraditions = filterItemsByType(target.items.values(), "forceTradition");
                let filteredTraditions = ownedTraditions.filter(feat => feat.data.finalName === prereq.requirement);
                if (filteredTraditions.length > 0) {
                    if (!meetsPrerequisites(target, filteredTraditions[0].data.data.prerequisite, false).doesFail) {
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
                    if (!meetsPrerequisites(target, filteredForceTechniques[0].data.data.prerequisite, false).doesFail) {
                        successList.push({prereq, count: 1});
                        continue;
                    }
                }
                break;
            case 'ATTRIBUTE':
                let toks = prereq.requirement.split(" ");
                if (!(target.getAttribute(toks[0]) < parseInt(toks[1]))) {
                    successList.push({prereq, count: 1});
                    continue;
                }
                break;
            case 'AND': {
                let meetsChildPrereqs = meetsPrerequisites(target, prereq.children, false);
                if (!(meetsChildPrereqs.doesFail)) {
                    successList.push({prereq, count: 1});
                    continue;
                }
                failureList.push(...meetsChildPrereqs.failureList)
                continue;
            }
            case 'OR': {
                let meetsChildPrereqs = meetsPrerequisites(target, prereq.children, false)
                let count = 0;
                for (let success of meetsChildPrereqs.successList) {
                    count += success.count;
                }

                if (!(count < prereq.count)) {
                    successList.push({prereq, count: 1});
                    continue;
                }
                failureList.push(...meetsChildPrereqs.failureList)
                continue;
            }
            case 'SPECIAL':
                if (prereq.requirement.toLowerCase() === 'not a droid') {
                    if (!target.data.data.isDroid) {
                        successList.push({prereq, count: 1});
                        continue;
                    }
                    break;
                } else if (prereq.requirement.toLowerCase() === 'is a droid') {
                    if (target.data.data.isDroid) {
                        successList.push({prereq, count: 1});
                        continue;
                    }
                    break;
                } else if (prereq.requirement === 'Has Built Lightsaber') {
                    failureList.push({fail: false, message: `${prereq.type}: ${prereq.text}`});
                    continue;
                }
                console.log("this prereq is not supported", prereq)
                failureList.push({fail: true, message: `${prereq.type}: ${prereq.text}`});
                break;
            case 'GENDER':
                if (target.data.data.sex.toLowerCase() === prereq.requirement.toLowerCase()) {
                    successList.push({prereq, count: 1});
                    continue;
                }
                break;
            case 'EQUIPPED':
                let equippedItems = target.getEquippedItems();
                let filteredEquippedItems = equippedItems.filter(item => item.data.finalName === prereq.requirement);
                if (filteredEquippedItems.length > 0) {
                    successList.push({prereq, count: 1});
                    continue;
                }
                break;
            default:
                console.log("this prereq is not supported", prereq)
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

    for (let fail of silentFailList) {
        if (fail.fail === true) {
            doesFail = true;
            break;
        }
    }

    let meetsPrereqs = {doesFail, failureList, silentFail: silentFailList, successList};

    if (notifyOnFailure && meetsPrereqs.failureList.length > 0) {
        if (meetsPrereqs.doesFail) {
            new Dialog({
                title: "You Don't Meet the Prerequisites!",
                content: "You do not meet the prerequisites:<br/>" + target._formatPrerequisites(meetsPrereqs.failureList),
                buttons: {
                    ok: {
                        icon: '<i class="fas fa-check"></i>',
                        label: 'Ok'
                    }
                }
            }).render(true);

        } else {
            new Dialog({
                title: "You MAY Meet the Prerequisites!",
                content: "You MAY meet the prerequisites. Check the remaining reqs:<br/>" + target._formatPrerequisites(meetsPrereqs.failureList),
                buttons: {
                    ok: {
                        icon: '<i class="fas fa-check"></i>',
                        label: 'Ok'
                    }
                }
            }).render(true);
        }
    }

    return meetsPrereqs;
}