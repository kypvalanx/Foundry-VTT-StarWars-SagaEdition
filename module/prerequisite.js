import {
    equippedItems,
    filterItemsByType,
    inheritableItems,
    resolveExpression,
    resolveValueArray,
    toNumber
} from "./util.js";
import {sizeArray, weaponGroup} from "./constants.js";
import {getInheritableAttribute, getResolvedSize} from "./attribute-helper.js";
import {SWSEActor} from "./actor/actor.js";
import {SWSEItem} from "./item/item.js";
import {SimpleCache} from "./common/simple-cache.js";

function ensureArray(array) {
    if (Array.isArray(array)) {
        return array;
    } else if (!!array[0]) {
        return Object.values(array)
    }
    return [array];
}

function meetsPrerequisite(prereq, target, options) {
    const fn = () => {
        let failureList = [];
        let successList = [];
        switch (prereq.type.toUpperCase()) {
            case undefined:
                break;
            case 'AGE':
                let age = toNumber(target.age) || toNumber(target.system.age);
                if (!age || toNumber(prereq.low) > age || (prereq.high && toNumber(prereq.high) < age)) {
                    failureList.push({fail: true, message: `${prereq.type}: ${prereq.text}`});
                    break;
                }
                successList.push({prereq, count: 1});
                break;
            case 'SIZE':
                let resolvedSize = getResolvedSize(target, options)
                if (sizeArray[resolvedSize] !== prereq.requirement) {
                    failureList.push({fail: true, message: `${prereq.type}: ${prereq.text}`});
                    break;
                }
                successList.push({prereq, count: 1});
                break;
            case 'CHARACTER LEVEL':
                if (!(target.characterLevel < toNumber(prereq.requirement))) {
                    successList.push({prereq, count: 1});
                    break;
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case 'BASE ATTACK BONUS':
                if (!(target.baseAttackBonus < parseInt(prereq.requirement))) {
                    successList.push({prereq, count: 1});
                    break;
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case 'DARK SIDE SCORE':
                if (!(target.darkSideScore < resolveValueArray([prereq.requirement], target))) {
                    successList.push({prereq, count: 1});
                    break;
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case 'ITEM':
                let ownedItem = SWSEActor.getInventoryItems(options.embeddedItemOverride);
                let filteredItem = ownedItem.filter(feat => feat.finalName === prereq.requirement);
                if (filteredItem.length > 0) {
                    successList.push({prereq, count: 1});
                    break;
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case 'SPECIES':
                let filteredSpecies = [target.species].filter(feat => feat?.finalName === prereq.requirement);
                if (filteredSpecies.length > 0) {
                    successList.push({prereq, count: 1});
                    break;
                }
                break;
            case 'TRAINED SKILL':
                if (Object.entries(target.system.skills).filter(skill => skill[0].toLowerCase() === prereq.requirement.toLowerCase() && skill[1].trained).length === 1) {
                    successList.push({prereq, count: 1});
                    break;
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case 'FEAT':
                let filteredFeats;
                if (prereq.requirement.toLowerCase().includes("(any)")) {
                    let req = prereq.requirement.replace(/ \(a|Any\)/, "");
                    filteredFeats = options.embeddedItemOverride
                        .filter(item => item.type === "feat"
                            && SWSEItem.buildItemName(item).startsWith(req));
                } else if (prereq.requirement.includes("(Exotic Melee Weapons)")) {
                    let exoticMeleeWeapons = game.generated?.exoticMeleeWeapons || [];
                    let possibleFeats = exoticMeleeWeapons?.map(w => prereq.requirement.replace("(Exotic Melee Weapons)", `(${w})`))

                    filteredFeats = options.embeddedItemOverride
                        .filter(item => item.type === "feat"
                            && possibleFeats.includes(SWSEItem.buildItemName(item)));
                } else {
                    filteredFeats = options.embeddedItemOverride
                        .filter(item => item.type === "feat"
                            && SWSEItem.buildItemName(item) === prereq.requirement);
                }

                if (filteredFeats.length > 0) {
                    let prereqs1 = filteredFeats[0].system?.prerequisite;
                    if (!meetsPrerequisites(target, prereqs1, options).doesFail) {
                        successList.push({prereq, count: 1});
                        break;
                    }
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case 'CLASS':
                let filteredClasses = options.embeddedItemOverride
                    .filter(item => item.type === "class"
                        && item.finalName === prereq.requirement);
                if (filteredClasses.length > 0) {
                    if (!meetsPrerequisites(target, filteredClasses[0].system.prerequisite, options).doesFail) {
                        successList.push({prereq, count: 1});
                        break;
                    }
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case 'TRAIT':
                let filteredTraits = options.embeddedItemOverride
                    .filter(item => item.type === "trait"
                        && item.finalName === prereq.requirement);
                if (filteredTraits.length > 0) {
                    let parentsMeetPrequisites = false;
                    for (let filteredTrait of filteredTraits) {
                        if (!meetsPrerequisites(target, filteredTrait.system.prerequisite, options).doesFail) {
                            successList.push({prereq, count: 1});
                            parentsMeetPrequisites = true;
                        }
                    }
                    if (parentsMeetPrequisites) {
                        break;
                    }
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case 'SPECIAL_QUALITY':
                let filteredSpecialQualities = options.embeddedItemOverride
                    .filter(item => item.type === "beastQuality"
                        && item.finalName === prereq.requirement);
                if (filteredSpecialQualities.length > 0) {
                    let parentsMeetPrequisites = false;
                    for (let filteredTrait of filteredSpecialQualities) {
                        if (!meetsPrerequisites(target, filteredTrait.system.prerequisite, options).doesFail) {
                            successList.push({prereq, count: 1});
                            parentsMeetPrequisites = true;
                        }
                    }
                    if (parentsMeetPrequisites) {
                        break;
                    }
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case 'SPECIES_TYPE':
                let filteredSpeciesTypes = options.embeddedItemOverride
                    .filter(item => item.type === "beastType"
                        && item.finalName === prereq.requirement);
                if (filteredSpeciesTypes.length > 0) {
                    let parentsMeetPrequisites = false;
                    for (let filteredTrait of filteredSpeciesTypes) {
                        if (!meetsPrerequisites(target, filteredTrait?.system?.prerequisite, options).doesFail) {
                            successList.push({prereq, count: 1});
                            parentsMeetPrequisites = true;
                        }
                    }
                    if (parentsMeetPrequisites) {
                        break;
                    }
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case 'BEAST_ATTACK':
                let filteredBeastAttacks = options.embeddedItemOverride
                    .filter(item => item.type === "beastAttack"
                        && item.finalName === prereq.requirement);
                if (filteredBeastAttacks.length > 0) {
                    let parentsMeetPrequisites = false;
                    for (let filteredTrait of filteredBeastAttacks) {
                        if (!meetsPrerequisites(target, filteredTrait?.system?.prerequisite, options).doesFail) {
                            successList.push({prereq, count: 1});
                            parentsMeetPrequisites = true;
                        }
                    }
                    if (parentsMeetPrequisites) {
                        break;
                    }
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case 'PROFICIENCY':
                let proficiencies = getInheritableAttribute({
                    entity: target,
                    recursive: true,
                    embeddedItemOverride: options.embeddedItemOverride,
                    attributeKey: ["weaponProficiency", "armorProficiency"],
                    reduce: "VALUES_TO_LOWERCASE"
                })
                if (proficiencies.includes(prereq.requirement.toLowerCase())) {
                    successList.push({prereq, count: 1});
                    break;
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case 'TALENT':
                let filteredTalents = options.embeddedItemOverride
                    .filter(item => {
                        if (item.type !== "talent") {
                            return false;
                        }
                        let actsAs = getInheritableAttribute({
                            entity: item,
                            recursive: true,
                            attributeKey: "actsAs",
                            reduce: "VALUES"
                        }) || []

                        return item.finalName === prereq.requirement ||
                            item.system.possibleProviders.includes(prereq.requirement) ||
                            item.system.talentTree === prereq.requirement || actsAs.includes(prereq.requirement)
                    });

                if (filteredTalents.length > 0) {
                    if (!meetsPrerequisites(target, filteredTalents[0].system.prerequisite, options).doesFail) {
                        successList.push({prereq, count: filteredTalents.length});
                        break;
                    }
                }

                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case 'TRADITION':
                let filteredTraditions = options.embeddedItemOverride
                    .filter(item => item.type === "affiliation"
                        && item.finalName === prereq.requirement);

                if (filteredTraditions.length > 0) {
                    if (!meetsPrerequisites(target, filteredTraditions[0].system.prerequisite, options).doesFail) {
                        successList.push({prereq, count: 1});
                        break;
                    }
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case 'FORCE TECHNIQUE':
                let ownedForceTechniques = filterItemsByType(options.embeddedItemOverride, "forceTechnique");
                if (!isNaN(prereq.requirement)) {
                    if (!(ownedForceTechniques.length < parseInt(prereq.requirement))) {
                        successList.push({prereq, count: 1});
                        break;
                    }
                }

                let filteredForceTechniques = ownedForceTechniques.filter(feat => feat.data.finalName === prereq.requirement);
                if (filteredForceTechniques.length > 0) {
                    if (!meetsPrerequisites(target, filteredForceTechniques[0].data.data.prerequisite, options).doesFail) {
                        successList.push({prereq, count: 1});
                        break;
                    }
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case 'FORCE POWER':
                let ownedForcePowers = filterItemsByType(options.embeddedItemOverride, "forcePower");
                if (!isNaN(prereq.requirement)) {
                    if (!(ownedForcePowers.length < parseInt(prereq.requirement))) {
                        successList.push({prereq, count: 1});
                        break;
                    }
                }

                let filteredForcePowers = ownedForcePowers.filter(feat => feat.finalName === prereq.requirement);
                if (filteredForcePowers.length > 0) {
                    if (!meetsPrerequisites(target, filteredForcePowers[0].system.prerequisite, options).doesFail) {
                        successList.push({prereq, count: 1});
                        break;
                    }
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case 'ATTRIBUTE':
                if (prereq.requirement.includes(":")) {
                    let toks = prereq.requirement.split(":");
                    let val = getInheritableAttribute({
                        entity: target,
                        recursive: true,
                        embeddedItemOverride: options.embeddedItemOverride,
                        attributeKey: toks[0],
                        reduce: "SUM"
                    });
                    let check = parseInt(toks[1].substring(1));
                    if (toks[1].startsWith(">")) {
                        if (val > check) {
                            successList.push({prereq, count: 1});
                            break;
                        }
                    } else if (toks[1].startsWith("<")) {
                        if (val < check) {
                            successList.push({prereq, count: 1});
                            break;
                        }
                    } else if (toks[1].startsWith("=")) {
                        if (val === check) {
                            successList.push({prereq, count: 1});
                            break;
                        }
                    } else {
                        if (val === toks[1]) {
                            successList.push({prereq, count: 1});
                            break;
                        }
                    }
                } else {
                    let toks = prereq.requirement.split(" ");
                    let actorAttribute = SWSEActor.getActorAttribute(target, toks[0]);
                    let number = parseInt(toks[1]);
                    if (!(actorAttribute < number)) {
                        successList.push({prereq, count: 1});
                        break;
                    }
                }
                break;
            case 'NOT': {
                let meetsChildPrereqs = meetsPrerequisites(target, prereq.child, options);
                if (meetsChildPrereqs.doesFail) {
                    successList.push({prereq, count: 1});
                    break;
                }
                meetsChildPrereqs.successList.forEach(item => item.fail = true)
                failureList.push(...meetsChildPrereqs.successList)
                break;
            }
            case 'AND': {
                let meetsChildPrereqs = meetsPrerequisites(target, prereq.children, options);
                if (!(meetsChildPrereqs.doesFail)) {
                    successList.push({prereq, count: 1});
                    break;
                }
                if (meetsChildPrereqs.failureList.length > 1) {
                    failureList.push({fail: true, message: `all of:`, children: meetsChildPrereqs.failureList})
                } else {
                    failureList.push(...meetsChildPrereqs.failureList)
                }
                break;
            }
            case 'OR': {
                let meetsChildPrereqs = meetsPrerequisites(target, prereq.children, options)
                let count = 0;
                for (let success of meetsChildPrereqs.successList) {
                    count += success.count;
                }

                if (!(count < prereq.count)) {
                    successList.push({prereq, count: 1});
                    break;
                }
                if (prereq.text) {
                    failureList.push({
                        fail: true,
                        message: prereq.text
                    })
                } else {
                    failureList.push({
                        fail: true,
                        message: `at least ${prereq.count} of:`,
                        children: meetsChildPrereqs.failureList
                    })
                }

                break;
            }
            case 'SPECIAL':
                if (prereq.requirement.toLowerCase() === 'not a droid') {
                    let inheritableAttributesByKey = getInheritableAttribute({
                        entity: target,
                        recursive: true,
                        embeddedItemOverride: options.embeddedItemOverride,
                        attributeKey: "isDroid",
                        reduce: "OR"
                    });
                    if (!inheritableAttributesByKey) {
                        successList.push({prereq, count: 1});
                        break;
                    }
                    break;
                } else if (prereq.requirement.toLowerCase() === 'is a droid') {
                    if (getInheritableAttribute({
                        entity: target,
                        recursive: true,
                        embeddedItemOverride: options.embeddedItemOverride,
                        attributeKey: "isDroid",
                        reduce: "OR"
                    })) {
                        successList.push({prereq, count: 1});
                        break;
                    }
                    break;
                } else if (prereq.requirement === 'Has Built Lightsaber') {
                    failureList.push({fail: false, message: `${prereq.type}: ${prereq.text}`});
                    break;
                } else if (prereq.requirement === 'is part of a military') {
                    if (filterItemsByType(options.embeddedItemOverride, "affiliation").length > 0) {
                        successList.push({prereq: prereq + " (missing an affiliation)", count: 1});
                        break;
                    }
                } else if (prereq.requirement === 'is part of a major interstellar corporation') {
                    if (filterItemsByType(options.embeddedItemOverride, "affiliation").length > 0) {
                        successList.push({prereq: prereq + " (missing an affiliation)", count: 1});
                        break;
                    }
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case 'GENDER':
                if (target.system.sex && target.system.sex.toLowerCase() === prereq.requirement.toLowerCase()) {
                    successList.push({prereq, count: 1});
                    break;
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case 'EQUIPPED':
                let req = prereq.requirement;
                let comparison;
                if (req.includes(":")) {
                    let toks = req.split(":");
                    req = toks[0];
                    comparison = toks[1];
                }
                let items = equippedItems(target);
                let filteredEquippedItems = items.filter(item => {
                    let actsAs = getInheritableAttribute({
                        entity: item,
                        recursive: true,
                        embeddedItemOverride: options.embeddedItemOverride,
                        attributeKey: ["actsAsForProficiency", "actsAs"],
                        reduce: "VALUES"
                    })

                    return item.name === req || item.finalName === req || target.system?.subtype === req || actsAs.includes(req)
                });
                let count = filteredEquippedItems.length;
                if ((count > 0 && !comparison) || (comparison && resolveExpression(`${count}${comparison}`))) {
                    successList.push({prereq, count: 1});
                    break;
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case "TYPE":
                if (target.type && target.type.toLowerCase() === prereq.requirement.toLowerCase()) {
                    successList.push({prereq, count: 1});
                    break;
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case "SUBTYPE":
                if (target.system.subtype && target.system.subtype.toLowerCase() === prereq.requirement.toLowerCase()) {
                    successList.push({prereq, count: 1});
                    break;
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case "WEAPON_GROUP":
                if (weaponGroup[prereq.requirement].includes(target.system.subtype)) {
                    successList.push({prereq, count: 1});
                    break;
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case "TEMPLATE":
                let templates = target.system.items.filter(item => item.type === "template").map(item => item.name)
                if (templates.includes(prereq.requirement)) {
                    successList.push({prereq, count: 1});
                    break;
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case "MODE":
                let modes = Object.values(target.system.modes).map(item => item.name.toLowerCase());
                if (modes.includes(prereq.requirement.toLowerCase())) {
                    successList.push({prereq, count: 1});
                    break;
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case "DAMAGE_TYPE":
                let damageTypes = getInheritableAttribute({
                    entity: target,
                    recursive: true,
                    embeddedItemOverride: options.embeddedItemOverride,
                    attributeKey: "damageType",
                    reduce: "VALUES_TO_LOWERCASE"
                });
                if (damageTypes.includes(prereq.requirement.toLowerCase())) {
                    successList.push({prereq, count: 1});
                    break;
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case "WEAPON_SIZE":
                let weaponSize = SWSEItem.getItemSize(target);

                if (prereq.requirement.toLowerCase() === weaponSize.toLowerCase()) {
                    successList.push({prereq, count: 1});
                    break;
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            default:
                console.warn("this prereq is not supported", prereq)
        }
        return {failureList, successList}
    }
    return !!options.prerequisiteCache ? options.prerequisiteCache.getCached(prereq.text, fn): fn()
}

/**
 *
 * @param {SWSEActor|SWSEItem|ActorData|ItemData|Object} target
 * @param {Object[]} prereqs
 * @param {string} prereqs[].text always available
 * @param {string} prereqs[].type always available
 * @param {string} prereqs[].requirement available on all types except AND, OR, and NULL
 * @param {number} prereqs[].count available on OR
 * @param {Object[]} prereqs[].children available on AND and OR
 * @returns {{failureList: [], doesFail: boolean, silentFail: []}}
 */
export function meetsPrerequisites(target, prereqs, options = {}) {
    //TODO add links to failures to upen up the fancy compendium to show the missing thing.  when you make a fancy compendium

    let failureList = [];
    let silentFail = [];
    let successList = [];
    if (!prereqs || (target.system.ignorePrerequisites && !options.existingTraitPrerequisite)) {
        return {doesFail: false, failureList, silentFail, successList};
    }
    if (!target) {
        return {doesFail: true, failureList, silentFail, successList};
    }

    if(!options.prerequisiteCache){
        options.prerequisiteCache = new SimpleCache();
    }

    prereqs = ensureArray(prereqs)
    if (!options.embeddedItemOverride) {
        options.embeddedItemOverride = inheritableItems(target)
    }
    for (let prereq of prereqs) {
        let response = meetsPrerequisite(prereq, target, options);
        failureList.push(...response.failureList)
        successList.push(...response.successList)
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
        if (fail.children && fail.children.length > 0) {
            format = format + "</br>" + formatPrerequisites(fail.children);
        }
        format = format + `</li>`;
    }
    return format + "</ul>";
}