import {getInheritableAttribute} from "../attribute-helper.mjs";
import {suppressibleDialog} from "../common/dialog.mjs";
import {characterActorTypes, EQUIPABLE_TYPES, LIMITED_TO_ONE_TYPES, vehicleActorTypes} from "../common/constants.mjs";
import {unique, viewableEntityFromEntityType} from "../common/util.mjs";
import {SWSEActor} from "./actor.mjs";
import {formatPrerequisites, meetsPrerequisites} from "../prerequisite.mjs";

//helpers
const isPermittedForActorType = (actor, type) => {
    if (characterActorTypes.includes(actor.type)) {
        return ["weapon",
            "armor",
            "equipment",
            "implant",
            "feat",
            "talent",
            "species",
            "droid system",
            "class",
            "upgrade",
            "forcePower",
            "affiliation",
            "forceTechnique",
            "forceSecret",
            "forceRegimen",
            "trait",
            "template",
            "background",
            "destiny",
            "beastAttack",
            "beastSense",
            "beastType",
            "beastQuality",
            "language"
        ].includes(type)
    } else if (vehicleActorTypes.includes(actor.type)) {
        return ["weapon",
            "armor",
            "equipment",
            "upgrade",
            "vehicleBaseType",
            "vehicleSystem",
            "template",
        "trait"].includes(type)
    }

    return false;
}


///

const isHomebrewPermitted = async (context) => {
    if (game.settings.get("swse", "enableHomebrewContent")) {
        return true;
    }
    const isHomebrew = getInheritableAttribute({
        entity: context.entity,
        attributeKey: "isHomebrew",
        reduce: "OR"
    });

    if (isHomebrew) {
        suppressibleDialog.call(context.actor, context.entity,
            `Attempted to add ${context.entity.finalName} but could not because Homebrew Content is currently disabled`, `Inappropriate Item`,
            context.actor.suppressDialog);

        return false;
    }
    return true;
}

const isItemTypePermitted = async (context) => {
    if (isPermittedForActorType(context.actor, context.entity.type)) {
        return true;
    } else if(context.actor.type === "vehicle" && context.entity.name === "Droid Socket"){
        return true; //Droid sockets can go on vehicles
    }
    else {
        suppressibleDialog.call(context.actor, context.entity,
            `Attempted to add ${context.entity.finalName} but could not because a ${context.entity.type} can't be added to a ${context.actor.type}`, `Inappropriate Item`,
            context.actor.suppressDialog);

        return false;
    }
}

const canTakeMoreThanOnce = async (context) => {
    if (LIMITED_TO_ONE_TYPES.includes(context.entity.type)) {
        const canTakeMultipleTimes = getInheritableAttribute({
            entity: context.entity,
            attributeKey: "takeMultipleTimes",
            reduce: "OR"
        })

        const maximumQuantity = getInheritableAttribute({
            entity: context.entity,
            attributeKey: "takeMultipleTimesMax",
            reduce: "MAX"
        });

        if(!maximumQuantity){
            return true;
        }
        const timesTaken = context.actor.countItem(context.entity);
        const isAtMaximumQuantity = timesTaken >= maximumQuantity;

        if (isAtMaximumQuantity) {
            suppressibleDialog.call(context.actor, context.entity,
                `Attempted to add ${context.entity.finalName} but could not because ${context.entity.finalName} can't be taken more than ${timesTaken} time${timesTaken > 1 ? 's' : ''}`, `Already Taken ${timesTaken} Time${timesTaken > 1 ? 's' : ''}`,
                context.actor.suppressDialog);

            return false;
        }
    }
    return true;
}


const handleTalent = async (context) => {
    if (context.entity.type !== 'talent') {
        return true;
    }

    let possibleTalentTrees = new Set();
    let possibleProviders = new Set();

    let actorsBonusTrees = getInheritableAttribute({
        entity: context.actor,
        attributeKey: 'bonusTalentTree',
        reduce: "VALUES"
    });

    let possible = context.entity.possibleProviders

    if (actorsBonusTrees.filter(t => possible.includes(t)).length > 0) {
        for (let [id, item] of Object.entries(context.actor.availableItems)) {
            possibleProviders.add(id);
            if (id.includes("Talent") && item > 0) {
                possibleTalentTrees.add(id);
            }
        }
    } else {
        for (let talentTree of possible) {
            possibleProviders.add(talentTree);
            let count = context.actor.availableItems[talentTree];
            if (count && count > 0) {
                possibleTalentTrees.add(talentTree);
            }
        }
    }

    const optionString = [...possibleTalentTrees]
        .map(talentTree => `<option value="${talentTree}">${talentTree}</option>`)
        .join("");


    if (possibleTalentTrees.size === 0) {
        suppressibleDialog.call(context.actor, context.entity,
            `Attempting to add ${context.entity.finalName}. You don't have more talents available of these types: <br/><ul><li>${Array.from(possibleProviders).join("</li><li>")}</li></ul>`, `Insufficient Talents`,
            context.actor.suppressDialog);
        return false;
    } else if (possibleTalentTrees.size > 1) {
        let content = `<p>Select an unused talent source.</p>
                    <div><select id='choice'>${optionString}</select> 
                    </div>`;

        await Dialog.prompt({
            title: "Select an unused talent source.",
            content: content,
            callback: async (html) => {
                let key = html.find("#choice")[0].value;
                possibleTalentTrees = new Set();
                possibleTalentTrees.add(key);
            }
        });
    }
    context.entity.system.activeCategory = Array.from(possibleTalentTrees)[0];


    return true;
}

function getAnswer(answers, choices) {
    for (let answer of answers) {
        if (choices.includes(answer)) {
            return answer;
        }
    }
    return undefined;
}

const handleFeat = async (context) => {
    if (context.entity.type !== 'feat' || context.ignoreAvailability) {
        return true;
    }
    let possibleFeatTypes = [];
    let optionString = "";
    let possibleProviders = context.entity.system.possibleProviders;
    if (context.actor.availableItems) {
        for (let provider of possibleProviders) {
            if (context.actor.availableItems[provider] > 0) {
                possibleFeatTypes.push(provider);
                optionString += `<option value="${JSON.stringify(provider).replace(/"/g, '&quot;')}">${provider}</option>`;
            }
        }
    }
    if (possibleFeatTypes.length === 0) {
        suppressibleDialog.call(context.actor, context.entity,
            `Attempting to add ${context.entity.finalName}. You don't have more feats available of these types: <br/><ul><li>${Array.from(possibleProviders).join("</li><li>")}</li></ul>`, `Insufficient Feats`,
            context.actor.suppressDialog);
        return false;
    } else if (possibleFeatTypes.length > 1) {
        let preselected = getAnswer([...(context.itemAnswers||[]), ...(context.answers||[])], possibleFeatTypes)

        if(!preselected){
            let content = `<p>Select an unused feat type.</p>
                    <div><select id='choice'>${optionString}</select> 
                    </div>`;

            await Dialog.prompt({
                title: "Select an unused feat source.",
                content: content,
                callback: async (html) => {
                    let key = html.find("#choice")[0].value;
                    possibleFeatTypes = JSON.parse(key.replace(/&quot;/g, '"'));
                }
            });
        } else {
            possibleFeatTypes = preselected;
        }

    }
    context.entity.system.activeCategory = possibleFeatTypes;
    return true;
}


const handleForceItems = async (context) => {
    if (!(context.entity.type === 'forcePower' || context.entity.type === 'forceTechnique' || context.entity.type === 'forceSecret')) {
        return true;
    }
    let viewable = viewableEntityFromEntityType(context.entity.type);
    let foundCategory = false
    for (let category of context.entity.system.categories || []) {
        if (!!context.actor.availableItems[category.value]) {
            foundCategory = true;
            context.entity.system.activeCategory = category.value;
            break;
        }
    }
    if (!foundCategory && !context.actor.availableItems[viewable]) {
        await Dialog.prompt({
            title: `You can't take any more ${viewable.titleCase()}`,
            content: `You can't take any more ${viewable.titleCase()}`,
            callback: () => {
            }
        });
        return false;
    }
    context.entity.system.activeCategory = context.entity.system.activeCategory || viewable;
    return true;
}

const handleClass = async (context) => {
    if (context.entity.type !== "class") {
        return true;
    }
    context.isFirstLevel = context.actor.classes.length === 0;
    const isFollowerClass = getInheritableAttribute({
        entity: context.entity,
        attributeKey: "isFollowerTemplate",
        reduce: "OR"
    })
    const isFollower = getInheritableAttribute({entity: context.actor, attributeKey: "follower", reduce: "OR"})
    if ((isFollower && !isFollowerClass) || (!isFollower && isFollowerClass)) {
        suppressibleDialog.call(context.actor, context.entity,
            `Follower Templates can only be applied to followers`, `Follower Templates`,
            context.actor.suppressDialog);
        return false;
    }
    if (!context.isFirstLevel && isFollowerClass) {
        suppressibleDialog.call(context.actor, context.entity,
            `Follower Templates can only be taken as the first level`, `Follower Templates`,
            context.actor.suppressDialog);
        return false;
    }
    if (context.entity.name === "Beast" && !context.isFirstLevel && context.actor.classes.filter(clazz => clazz.name === "Beast").length === 0) {
        new Dialog({
            title: "The Beast class is not allowed at this time",
            content: `The Beast class is only allowed to be taken at first level or if it has been taken in a previous level`,
            buttons: {
                ok: {
                    icon: '<i class="fas fa-check"></i>',
                    label: 'Ok'
                }
            }
        }).render(true);
        return false;
    }
    if (context.entity.name !== "Beast" && context.actor.classes.filter(clazz => clazz.name === "Beast").length > 0 && context.actor.getAttribute("INT") < 3) {
        new Dialog({
            title: "The Beast class is not allowed to multiclass at this time",
            content: `Beasts can only multiclass when they have an Intelligence higher than 2.`,
            buttons: {
                ok: {
                    icon: '<i class="fas fa-check"></i>',
                    label: 'Ok'
                }
            }
        }).render(true);
        return false
    }
    SWSEActor.updateOrAddChange(context.entity, "isFirstLevel", context.isFirstLevel);
    if (context.isFirstLevel) {
        let firstLevelHP = getInheritableAttribute({
            entity: context.entity,
            attributeKey: "firstLevelHitPoints",
            reduce: "VALUES"
        })[0]
        SWSEActor.updateOrAddChange(context.entity, "rolledHP", `${firstLevelHP}`.includes('d') ? 1 : firstLevelHP);

    } else {
        SWSEActor.updateOrAddChange(context.entity, "rolledHP", 1);
    }
    return true;
}

const handleSpeciesAndVehicleBase = async (context) => {
    if (!(context.entity.type === "vehicleBaseType" || context.entity.type === "species")) {
        return true;
    }
    let type = context.entity.type;
    let viewable = type.replace(/([A-Z])/g, " $1");
    if (context.actor.itemTypes[type].length > 0) {
        new Dialog({
            title: `${viewable.titleCase()} Selection`,
            content: `Only one ${viewable.titleCase()} allowed at a time.  Please remove the existing one before adding a new one.`,
            buttons: {
                ok: {
                    icon: '<i class="fas fa-check"></i>',
                    label: 'Ok'
                }
            }
        }).render(true);
        return false
    }
    return true
}

const handleBackgroundAndDestiny = async (context) => {
    if (!(context.entity.type === "background" || context.entity.type === "destiny")) {
        return true;
    }
    if (context.actor.itemTypes["background"].length > 0 || context.actor.itemTypes["destiny"].length > 0) {
        new Dialog({
            title: `${context.entity.type.titleCase()} Selection`,
            content: `Only one background or destiny allowed at a time.  Please remove the existing one before adding a new one.`,
            buttons: {
                ok: {
                    icon: '<i class="fas fa-check"></i>',
                    label: 'Ok'
                }
            }
        }).render(true);
        return false
    }

    return true;
}

const handlePrerequisites = async (context) => {
    if (EQUIPABLE_TYPES.includes(context.entity.type)) {
        return true;
    }
    let meetsPrereqs = meetsPrerequisites(context.actor, context.entity.system.prerequisite, {isLoad: true});
    if (!meetsPrereqs.doesFail) {
        if (meetsPrereqs.failureList.length > 0) {
            suppressibleDialog.call(context.actor, context.entity,
                `You MAY meet the prerequisites. Check the remaining reqs:<br/>${formatPrerequisites(meetsPrereqs.failureList)}`, `You <b>MAY</b> Meet the Prerequisites!`,
                context.actor.suppressDialog);
        }
        return true
    }

        if (context.offerOverride) {
            let override = await Dialog.wait({
                title: "You Don't Meet the Prerequisites!",
                content: `You do not meet the prerequisites:<br/> ${formatPrerequisites(meetsPrereqs.failureList)}`,
                buttons: {
                    ok: {
                        icon: '<i class="fas fa-check"></i>',
                        label: 'Ok',
                        callback: () => {
                            return false
                        }
                    },
                    override: {
                        icon: '<i class="fas fa-check"></i>',
                        label: 'Override',
                        callback: () => {
                            return true
                        }
                    }
                }
            });
            if (!override) {
                return false;
            }
        } else {
            suppressibleDialog.call(context.actor, context.entity,
                `You do not meet the prerequisites:<br/>${formatPrerequisites(meetsPrereqs.failureList)}`, `You Don't Meet the Prerequisites!`,
                context.actor.suppressDialog);
            return false;
        }


    return true;
}

// /**
//  *  TODO handle feat and handle talent are very similiar
//  * @type {((function(*): (boolean))|*|(function(*): (boolean)))[]}
//  */

/**
 *
 * @type {(function(context): Promise<boolean>)}
 */
export const VALIDATORS = [
    isHomebrewPermitted,
    isItemTypePermitted,
    canTakeMoreThanOnce,
    handleTalent,
    handleFeat,
    handleForceItems,
    handleClass,
    handleSpeciesAndVehicleBase,
    handleBackgroundAndDestiny,
    handlePrerequisites
]
