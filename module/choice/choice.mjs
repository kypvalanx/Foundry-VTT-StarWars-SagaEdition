import {COLORS, GM_BONUSES, lightsaberForms, skills} from "../common/constants.mjs";
import {getInheritableAttribute} from "../attribute-helper.mjs";
import {fullJoin, innerJoin} from "../common/util.mjs";
import {initializeUniqueSelection, uniqueSelection} from "../common/listeners.mjs";
import {getIndexEntriesByTypes} from "../compendium/compendium-util.mjs";

function skipFirstLevelChoice(choice, context) {
    return choice.isFirstLevel && !context.isFirstLevel;
}


async function resolveActionsFromChoice(choice, item, choiceAnswer, options) {
    let items = [];
    if (choice.showSelectionInName) {
        item.setChoice(choiceAnswer)
    }
    if (choice.type === 'INTEGER') {
        await item.setPayload(choiceAnswer, choice.payload);
    } else {
        let selectedChoice = options.find(option => option.name.toLowerCase() === choiceAnswer.toLowerCase());
        if (!selectedChoice) {
            return items;
        }

        if (selectedChoice.payload) {
            selectedChoice.payloads = selectedChoice.payloads || {};
            selectedChoice.payloads[choice.payload] = selectedChoice.payload;
        }

        if (selectedChoice.payloads && Object.values(selectedChoice.payloads).length > 0) {
            for (const payload of Object.entries(selectedChoice.payloads)) {
                await item.setPayload(payload[1], payload[0]);
            }
        }
        if (selectedChoice.providedItems && selectedChoice.providedItems.length > 0) {
            items = selectedChoice.providedItems
        }
        if (selectedChoice.attributes && Object.values(selectedChoice.attributes).length > 0) {
            item.system.changes = item.system.changes || [];
            item.system.changes.push(...Object.values(selectedChoice.attributes))

        }
        if(selectedChoice.modifications && selectedChoice.modifications.length > 0){
            items = [];
            for (const modification of selectedChoice.modifications) {
                modification.modifier = true;
                items.push(modification)
            }
        }
    }
    return items;
}

/**
 * if no choices exist > success empty item array
 * if no choices can be run > success empty array
 * if a choice is exited from > fail
 * if choices run, modify parent item and return future items
 *
 * @param item
 * @param context Object
 * @param context.suppressDialog Boolean
 * @param context.isUpload Boolean
 * @param context.actor SWSEActor
 * @param context.itemAnswers Array
 * @returns {Promise<{success: boolean, items: []}>}
 */
export async function activateChoices(item, context) {
    let actor = context.actor;
    let choices = item.system.choices;
    if (choices?.length === 0) {
        return {success: true, items: []};
    }
    let items = [];
    for (let choice of choices ? choices : []) {
        if (skipFirstLevelChoice(choice, context)) {
            continue;
        }

        let greetingString;
        let content;
        let options;
        if ('INTEGER' === choice.type) {
            let preprogrammedAnswer = !!context.itemAnswers && context.itemAnswers.length === 1 ? context.itemAnswers[0]: undefined;
            if(preprogrammedAnswer){
                items.push(...await resolveActionsFromChoice(choice, item, preprogrammedAnswer, options));
                continue;
            }
            greetingString = choice.description;
            content = `<p>${greetingString}</p>`;
            content += `<input class="choice" type="number" data-option-key="">`
        } else {
            options = await explodeOptions(choice.options, actor);

            //let preprogrammedAnswer;

            //console.log("itemAnswers: " + context.itemAnswers);
            let preprogrammedAnswer = !!context.itemAnswers && context.itemAnswers.length === 1 ? context.itemAnswers[0]: undefined;


            if(!preprogrammedAnswer) {
                const answeredOption = options.find(o => context.itemAnswers && (context.itemAnswers.includes(o.name) || context.itemAnswers.includes(o.value)));
                if (answeredOption) {
                    preprogrammedAnswer = answeredOption.name
                }
            }
            if(!preprogrammedAnswer) {
                const answeredOption = options.find(o => context.generalAnswers && (context.generalAnswers.includes(o.name) || context.generalAnswers.includes(o.value)));
                if(answeredOption){
                    preprogrammedAnswer = answeredOption.name
                }
            }
            if(preprogrammedAnswer){
                items.push(...await resolveActionsFromChoice(choice, item, preprogrammedAnswer, options));
                continue;
            }

            if(context.isUpload){
                console.log(choice.options, context, item);
                console.info("Failed to resolve choices: ",item, context)
                continue;
            }

            let optionString = "";
            if (options.length === 0) {
                greetingString = choice.noOptions ? choice.noOptions : choice.description;
            } else if (options.length === 1) {
                greetingString = choice.oneOption ? choice.oneOption : choice.description;
                optionString = `<div class="choice">${options[0].name}</div>`
            } else {
                greetingString = choice.description;

                for (let option of Object.values(options)) {
                    optionString += `<option value="${option.name}"${option.isDefault ? ` selected="selected"` : ""}>${option.name}</option>`
                }

                if (optionString !== "") {
                    optionString = `<div class="flex flex-row"><select class="choice">${optionString}</select><div class="custom-value"></div></div>`
                }
            }


            content = `<p>${greetingString}</p>`;

            let availableSelections = choice.availableSelections ? choice.availableSelections : 1;

            for (let i = 0; i < availableSelections; i++) {
                content += optionString;
            }
        }

        if(actor.suppressDialog || context.suppressDialog) {
            return {success: false, items: []};
        }

        let response = await Dialog.prompt({
            title: greetingString,
            content: content,
            rejectClose: async (html) => {
                return false
            },
            render: (html) => {
                const selects = html.find(".choice");
                if(choice.uniqueChoices){
                    initializeUniqueSelection(selects);
                    selects.on("change", () => uniqueSelection(selects));
                }
                selects.on("change", (event) => {
                    const target = $(event.target)
                    if(options){
                        const option = options.find(o => o.name === event.target.value);
                        const custom = target.parent().find(".custom-value")
                        if(option.customType){
                            if(option.customType === "color"){

                                custom.append( `<input type="${option.customType}" data-custom-type="${option.customType}">`);
                            }
                        } else {
                            custom.empty();
                        }
                    }
                })
            },
            callback: async (html) => {
                let find = html.find(".choice");
                if(find.length === 0){
                    return false;
                }
                let items = [];
                for (let foundElement of find) {
                    if (!foundElement) {
                        return;
                    }
                    let elementValue = foundElement.value || foundElement.innerText;
                    if(options){
                        const option = options.find(o => o.name === elementValue);
                        if(option.customType){
                            if(option.customType === "color"){
                                const custom = $(foundElement).parent().find(".custom-value input")
                                const value = custom[0].value;
                                let regExp = new RegExp(`#${option.customType}#`, "g");
                                for(const entry of Object.entries(option.payloads)){
                                    option.payloads[entry[0]] = entry[1].replace(regExp, value)
                                }

                            }
                        }
                    }
                    items.push(...await resolveActionsFromChoice(choice, item, elementValue, options));
                }

                return {success: true, items}
            }
        });

        if (response === false) {
            return {success: false, items: []};
        }
        items.push(...response.items)
    }
    return {success: true, items};
}

export async function explodeOptions(options, actor) {
    if(!options){
        return [];
    }


    if (!Array.isArray(options)) {
        let resolvedOptions = [];
        for (let [key, value] of Object.entries(options)) {
            value.name = value.name || key;
            resolvedOptions.push(value);
        }
        options = resolvedOptions;
    }
    const explodable = ['AVAILABLE_GM_BONUSES', 'AVAILABLE_EXOTIC_WEAPON_PROFICIENCY', 'AVAILABLE_LIGHTSABER_COLORS'];

    options = options.sort(option => {
        return explodable.includes(option.name) ? 1 : -1;
    })
    const hasDefault = !!options.find(o => o.isDefault)

    const delay = ms => new Promise(res => setTimeout(res, ms));
    let resolvedOptions = [];
    for (let value of options) {
        let key = value.name;
        let destination = Object.keys(value).find(destination => destination.startsWith("payload"))
        switch (key) {
            case 'AVAILABLE_REPLICA_SPECIES':
                while(!Array.isArray(game.generated.species.replicaDroidChoices)){
                    console.info("loading replica droid choices...")
                    await delay(200)
                }
                resolvedOptions = game.generated.species.replicaDroidChoices
                break;
            case 'AVAILABLE_GM_BONUSES':
                for (let bonus of GM_BONUSES) {
                    let deepCopy = {key: bonus.key, value: bonus.value}
                    resolvedOptions.push({name: bonus.display, attributes: [deepCopy]});
                }
                break;
            case 'AVAILABLE_EXOTIC_WEAPON_PROFICIENCY':
                let weaponProficiencies = getInheritableAttribute({
                    entity: actor,
                    attributeKey: "weaponProficiency",
                    reduce: "VALUES"
                })
                for (let weapon of game.generated.weapon.exoticWeapons) {
                    if (!weaponProficiencies.includes(weapon)) {
                        resolvedOptions.push({name: weapon, abilities: [], items: [], payload: weapon});
                    }
                }
                break;
            case 'AVAILABLE_WEAPON_FOCUS':
                resolvedOptions.push(...(resolveOptions(actor, "weaponFocus", "weaponProficiency")));
                break;
            case 'AVAILABLE_WEAPON_SPECIALIZATION':
                resolvedOptions.push(...(resolveOptions(actor, "weaponSpecialization", "weaponFocus")));
                break;
            case 'AVAILABLE_GREATER_WEAPON_SPECIALIZATION':
                resolvedOptions.push(...(resolveOptions(actor, "greaterWeaponSpecialization", ["greaterWeaponFocus", "weaponSpecialization"])));
                break;
            case 'AVAILABLE_DISARMING_ATTACK':
                resolvedOptions.push(...(resolveOptions(actor, "disarmingAttack", "weaponSpecialization")));
                break;
            case 'AVAILABLE_GREATER_WEAPON_FOCUS':
                resolvedOptions.push(...(resolveOptions(actor, "greaterWeaponFocus", "weaponProficiency")));
                break;
            case 'AVAILABLE_WEAPON_PROFICIENCIES':
                let proficientWeapons = getInheritableAttribute({
                    entity: actor,
                    attributeKey: "weaponProficiency",
                    reduce: "VALUES"
                });
                for (let weapon of ["Simple Weapons", "Pistols", "Rifles", "Lightsabers", "Heavy Weapons", "Advanced Melee Weapons"]) {
                    if (!proficientWeapons.includes(weapon)) {
                        resolvedOptions.push({
                            name: weapon.titleCase(),
                            abilities: [],
                            items: [],
                            payload: weapon.titleCase()
                        });
                    }
                }
                break;
            case 'UNFOCUSED_SKILLS':
                let focussedSkills = getInheritableAttribute({
                    entity: actor,
                    attributeKey: "skillFocus",
                    reduce: "VALUES"
                });
                for (let skill of skills()) {
                    if (!focussedSkills.includes(skill)) {
                        resolvedOptions.push({
                            name: skill.titleCase(),
                            abilities: [],
                            items: [],
                            payload: skill.titleCase()
                        });
                    }
                }
                break;
            case 'AVAILABLE_SKILL_FOCUS':
                let skillFocuses = getInheritableAttribute({
                    entity: actor,
                    attributeKey: "skillFocus",
                    reduce: "VALUES_TO_LOWERCASE"
                });
                for (let skill of actor.trainedSkills) {
                    let attributeKey = skill.label;
                    if (!skillFocuses.includes(attributeKey.toLowerCase())) {
                        resolvedOptions.push({
                            name: attributeKey.titleCase(),
                            abilities: [],
                            items: [],
                            payload: attributeKey.titleCase()
                        });
                    }
                }
                break;
            case 'AVAILABLE_EXCEPTIONAL_SKILL':
                let exceptionalSkillFocuses = getInheritableAttribute({
                    entity: actor,
                    attributeKey: "exceptionalSkill",
                    reduce: "VALUES_TO_LOWERCASE"
                });
                for (let skill of actor.trainedSkills) {
                    let attributeKey = skill.label;
                    if (!exceptionalSkillFocuses.includes(attributeKey.toLowerCase())) {
                        resolvedOptions.push({
                            name: attributeKey.titleCase(),
                            abilities: [],
                            items: [],
                            payload: attributeKey.titleCase()
                        });
                    }
                }
                break;
            case 'AVAILABLE_UNTRAINED_SKILLS':
                for (let skill of actor.untrainedSkills) {
                    let attributeKey = skill.label;
                    resolvedOptions.push({
                        name: attributeKey.titleCase(),
                        abilities: [],
                        items: [],
                        payload: attributeKey.titleCase()
                    });
                }
                break;
            case 'AVAILABLE_SKILL_MASTERY':
                resolvedOptions.push(...(resolveOptions(actor, "skillMastery", "skillFocus", {excluded: ["Use The Force"]})));
                break;
            case 'AVAILABLE_DOUBLE_ATTACK':
                resolvedOptions.push(...(resolveOptions(actor, "doubleAttack", "weaponProficiency")));
                break;
            case 'AVAILABLE_DEVASTATING_ATTACK':
                resolvedOptions.push(...(resolveOptions(actor, "devastatingAttack", "weaponProficiency")));
                break;
            case 'AVAILABLE_GREATER_DEVASTATING_ATTACK':
                resolvedOptions.push(...(resolveOptions(actor, "greaterDevastatingAttack", ["devastatingAttack", "greaterWeaponFocus"])));
                break;
            case 'AVAILABLE_TRIPLE_ATTACK':
                resolvedOptions.push(...(resolveOptions(actor, "tripleAttack", "doubleAttack")));
                break;
            case 'AVAILABLE_SAVAGE_ATTACK':
                resolvedOptions.push(...(resolveOptions(actor, "savageAttack", "doubleAttack")));
                break;
            case 'AVAILABLE_RELENTLESS_ATTACK':
                resolvedOptions.push(...(resolveOptions(actor, "relentlessAttack", "doubleAttack")));
                break;
            case 'AVAILABLE_AUTOFIRE_SWEEP':
                resolvedOptions.push(...(resolveOptions(actor, "autofireSweep", "weaponFocus")));
                break;
            case 'AVAILABLE_AUTOFIRE_ASSAULT':
                resolvedOptions.push(...(resolveOptions(actor, "autofireAssault", "weaponFocus")));
                break;
            case 'AVAILABLE_HALT':
                resolvedOptions.push(...(resolveOptions(actor, "halt", "weaponFocus")));
                break;
            case 'AVAILABLE_PENETRATING_ATTACK':
                resolvedOptions.push(...(resolveOptions(actor, "penetratingAttack", "weaponFocus")));
                break;
            case 'AVAILABLE_RETURN_FIRE':
                resolvedOptions.push(...(resolveOptions(actor, "returnFire", "weaponFocus")));
                break;
            case 'AVAILABLE_CRITICAL_STRIKE':
                resolvedOptions.push(...(resolveOptions(actor, "criticalStrike", "weaponFocus")));
                break;
            case 'AVAILABLE_LIGHTSABER_FORMS':
                for (let form of lightsaberForms) {
                    if (!actor.talents.map(t => t.name).includes(form)) {
                        resolvedOptions.push({name: form, abilities: [], items: [], payload: form});
                    }
                }
                break;
            case 'AVAILABLE_LIGHTSABER_CRYSTALS':
                let items = (await getIndexEntriesByTypes(['upgrade'], ['Lightsaber Crystals'])).values()
                const added = [];
                for (const item of items) {
                    let suffix = "";
                    if (added.includes(item.name)) {
                        suffix = ` (${item.pack})`
                    }
                    resolvedOptions.push({
                        name: item.name + suffix,
                        abilities: [],
                        items: [],
                        modifications: [{uuid: item.uuid, type: "upgrade"}],
                        payload: undefined,
                        isDefault: item.name === "Ilum Crystal"
                    });
                    added.push(item.name)
                }
                break;
            case 'AVAILABLE_LIGHTSABER_COLORS':
                const colors = Object.keys(COLORS)

                const existingColors = resolvedOptions.map(option => option.name);
                for (const lightsaberColor of colors) {
                    if (!existingColors.includes(lightsaberColor)) {
                        resolvedOptions.push({
                            name: lightsaberColor,
                            display: lightsaberColor,
                            abilities: [],
                            items: [],
                            modifications: [],
                            payloads: {lightsaberColor}
                        });
                    }
                }

                resolvedOptions.push({
                    name: 'Custom',
                    display: 'Custom',
                    abilities: [],
                    items: [],
                    modifications: [],
                    customType: 'color',
                    payloads: {lightsaberColor: '#color#'}
                });
                break;
            default:
                if (resolvedOptions.length === 0 && !hasDefault) {
                    value.isDefault = true;
                }
                resolvedOptions.push(value);
                break;
        }
    }

    if(resolvedOptions && Array.isArray(resolvedOptions)){
        resolvedOptions = resolvedOptions.sort((a, b) => {
            if(a.name === 'Custom'){
                return 1;
            }
            if (a.name < b.name) {
                return -1;
            }
            if (a.name > b.name) {
                return 1;
            }
            return 0;
        })
    }

    return resolvedOptions;
}

/**
 *
 * @param actor
 * @param excludingKey {string|[string]} gets attributes to exclude from inclusion list.  when multiple keys are provided a full join is done.
 * @param includeKey {string|[string]} gets attributes to include.  when multiple keys are provided this will be an inner join of attribute queries
 * @param options
 * @param options.excluded additional excluded options
 * @param options.included additional included options
 * @returns {[]}
 */
function resolveOptions(actor, excludingKey, includeKey, options = {}) {
    let resolvable = []
    excludingKey = excludingKey ? excludingKey : [];
    includeKey = includeKey ? includeKey : [];

    excludingKey = Array.isArray(excludingKey) ? excludingKey : [excludingKey];
    includeKey = Array.isArray(includeKey) ? includeKey : [includeKey];

    let excluded = fullJoin(...excludingKey.map(key =>getInheritableAttribute({
        entity: actor,
        attributeKey: key,
        reduce: "VALUES"
    })));
    excluded.push(...(options?.excluded || []))
    let included = innerJoin(...includeKey.map(key => getInheritableAttribute({
        entity: actor,
        attributeKey: key,
        reduce: "VALUES"
    })));
    included.push(...(options?.included || []))
    for (let option of included) {
        if (!excluded.includes(option)) {
            resolvable.push({name: option.titleCase(), abilities: [], items: [], payloads: {payload:option.titleCase()}});
        }
    }
    return resolvable;
}

