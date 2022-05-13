import {GM_BONUSES, lightsaberForms} from "../constants.js";
import {getInheritableAttribute} from "../attribute-helper.js";

function skipFirstLevelChoice(choice, context) {
    return choice.isFirstLevel && !context.isFirstLevel;
}


/**
 * if no choices exist > success empty item array
 * if no choices can be run > success empty array
 * if a choice is exited from > fail
 * if choices run, modify parent item and return future items
 *
 * @param item
 * @param context
 * @returns {Promise<{success: boolean, items: []}>}
 */
export async function activateChoices(item, context) {
    let choices = item.data.data.choices;
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
        let payload = choice.payload;
        if('INTEGER' === choice.type){
            greetingString = choice.description;
            content = `<p>${greetingString}</p>`;
            content += `<input class="choice" type="number" data-option-key="">`
        } else {
            options = explodeOptions(choice.options);

            let optionString = "";
            let keys = Object.keys(options);
            if (options.length === 0) {
                greetingString = choice.noOptions ? choice.noOptions : choice.description;
            } else if (options.length === 1) {
                greetingString = choice.oneOption ? choice.oneOption : choice.description;
                optionString = `<div class="choice">${options[0].name}</div>`
            } else {
                greetingString = choice.description;

                for (let option of Object.values(options)) {
                    optionString += `<option value="${option.name}"${option.isDefault ? " selected" : ""}>${option.name}</option>`
                }

                if (optionString !== "") {
                    optionString = `<div><select class="choice">${optionString}</select></div>`
                }
            }


            content = `<p>${greetingString}</p>`;

            let availableSelections = choice.availableSelections ? choice.availableSelections : 1;

            for (let i = 0; i < availableSelections; i++) {
                content += optionString;
            }
        }

        let response = await Dialog.prompt({
            title: greetingString,
            content: content,
            rejectClose: async (html) => {
                return false
            },
            callback: async (html) => {
                let find = html.find(".choice");
                let items = [];
                for(let foundElement of find) {
                    if(!foundElement){
                        return;
                    }
                    let elementValue = foundElement.value || foundElement.innerText;

                    item.setChoice(elementValue)
                    if(choice.type === 'INTEGER'){
                        item.setPayload(elementValue, payload);
                    } else {
                        let selectedChoice = options[elementValue];
                        if (!selectedChoice) {
                            return;
                        }
                        if (selectedChoice.payloads && Object.values(selectedChoice.payloads).length > 0) {
                            Object.entries(selectedChoice.payloads).forEach(payload => {
                                item.setPayload(payload[1], payload[0]);
                            })
                        }
                        if (selectedChoice.providedItems && selectedChoice.providedItems.length > 0) {
                            items = selectedChoice.providedItems
                        }
                        if (selectedChoice.attributes && Object.values(selectedChoice.attributes).length > 0) {
                            Object.values(selectedChoice.attributes).forEach(attr => {
                                let index = Math.max(Object.keys(item.data.data.attributes)) +1
                                item.data.data.attributes[index] = attr;
                            })
                        }
                    }
                }

                return {success: true, items: items}
            }
        });

        if (response === false) {
            return {success: false, items: []};
        }
        items.push(...response.items)
    }
    return {success: true, items};
}


function explodeOptions(options) {
    if(!Array.isArray(options)){
        let resolvedOptions = [];
        for (let [key, value] of Object.entries(options)) {
            value.name = value.name || key;
            resolvedOptions.push(value);
        }
        options = resolvedOptions;
    }

    let resolvedOptions = {};
    for (let value of options) {
        let key = value.name;
        let destination = Object.keys(value).find(destination => destination.startsWith("payload"))
        if (key === 'AVAILABLE_GM_BONUSES'){
            for(let bonus of GM_BONUSES){
                let data = {};
                data.attributes = [];
                data.attributes.push(bonus)
                resolvedOptions[bonus.display] = data;
            }

        } else if (key === 'AVAILABLE_EXOTIC_WEAPON_PROFICIENCY') {
            let weaponProficiencies = getInheritableAttribute({
                entity: this,
                attributeKey: "weaponProficiency",
                reduce: "VALUES"
            })
            for (let weapon of game.generated.exoticWeapons) {
                if (!weaponProficiencies.includes(weapon)) {
                    resolvedOptions[weapon] = {abilities: [], items: [], payload: weapon};
                }
            }
        } else if (key === 'AVAILABLE_WEAPON_FOCUS') {
            let focuses = getInheritableAttribute({
                entity: this,
                attributeKey: "weaponFocus",
                reduce: "VALUES"
            })
            for (let weapon of getInheritableAttribute({
                entity: this,
                attributeKey: "weaponProficiency",
                reduce: "VALUES"
            })) {
                if (!focuses.includes(weapon)) {
                    resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                }
            }
        } else if (key === 'AVAILABLE_WEAPON_SPECIALIZATION') {
            let weaponSpecializations = getInheritableAttribute({
                entity: this,
                attributeKey: "weaponSpecialization",
                reduce: "VALUES"
            })
            for (let weapon of getInheritableAttribute({
                entity: this,
                attributeKey: "weaponFocus",
                reduce: "VALUES"
            })) {
                if (!weaponSpecializations.includes(weapon)) {
                    resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                }
            }
        } else if (key === 'AVAILABLE_GREATER_WEAPON_SPECIALIZATION') {
            let greaterWeaponSpecialization = getInheritableAttribute({
                entity: this,
                attributeKey: "greaterWeaponSpecialization",
                reduce: "VALUES"
            })
            let greaterWeaponFocus = getInheritableAttribute({
                entity: this,
                attributeKey: "greaterWeaponFocus",
                reduce: "VALUES"
            })
            for (let weaponSpecialization of getInheritableAttribute({
                entity: this,
                attributeKey: "weaponSpecialization",
                reduce: "VALUES"
            })) {
                if (!greaterWeaponSpecialization.includes(weaponSpecialization) && greaterWeaponFocus.includes(weaponSpecialization)) {
                    resolvedOptions[weaponSpecialization.titleCase()] = {
                        abilities: [],
                        items: [],
                        payload: weaponSpecialization.titleCase()
                    };
                }
            }
        } else if (key === 'AVAILABLE_GREATER_WEAPON_FOCUS') {
            let greaterWeaponFocus = getInheritableAttribute({
                entity: this,
                attributeKey: "greaterWeaponFocus",
                reduce: "VALUES"
            })
            for (let weaponFocus of getInheritableAttribute({
                entity: this,
                attributeKey: "weaponFocus",
                reduce: "VALUES"
            })) {
                if (!greaterWeaponFocus.includes(weaponFocus)) {
                    resolvedOptions[weaponFocus.titleCase()] = {
                        abilities: [],
                        items: [],
                        payload: weaponFocus.titleCase()
                    };
                }
            }
        } else if (key === 'AVAILABLE_WEAPON_PROFICIENCIES') {
            let weaponProficiencies = getInheritableAttribute({
                entity: this,
                attributeKey: "weaponProficiency",
                reduce: "VALUES"
            });
            for (let weapon of ["Simple Weapons", "Pistols", "Rifles", "Lightsabers", "Heavy Weapons", "Advanced Melee Weapons"]) {
                if (!weaponProficiencies.includes(weapon)) {
                    resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                }
            }
        } else if (key === 'UNFOCUSED_SKILLS') {
            let skillFocuses = getInheritableAttribute({
                entity: this,
                attributeKey: "skillFocus",
                reduce: "VALUES"
            });
            for (let skill of skills) {
                if (!skillFocuses.includes(skill)) {
                    resolvedOptions[skill.titleCase()] = {abilities: [], items: [], payload: skill.titleCase()};
                }
            }
        } else if (key === 'AVAILABLE_SKILL_FOCUS') {
            let skillFocuses = getInheritableAttribute({
                entity: this,
                attributeKey: "skillFocus",
                reduce: "VALUES"
            });
            for (let skill of this.trainedSkills) {
                if (!skillFocuses.includes(skill.key)) {
                    resolvedOptions[skill.key.titleCase()] = {
                        abilities: [],
                        items: [],
                        payload: skill.key.titleCase()
                    };
                }
            }
        } else if (key === 'AVAILABLE_SKILL_MASTERY') {
            let masterSkills = getInheritableAttribute({
                entity: this,
                attributeKey: "skillMastery",
                reduce: "VALUES"
            });
            masterSkills.push("Use The Force")
            for (let skill of getInheritableAttribute({
                entity: this,
                attributeKey: "skillFocus",
                reduce: "VALUES"
            })) {
                if (!masterSkills.includes(skill)) {
                    resolvedOptions[skill.titleCase()] = {abilities: [], items: [], payload: skill.titleCase()};
                }
            }
        } else if (key === 'AVAILABLE_DOUBLE_ATTACK') {
            let doubleAttack = getInheritableAttribute({
                entity: this,
                attributeKey: "doubleAttack",
                reduce: "VALUES"
            })
            for (let weapon of getInheritableAttribute({
                entity: this,
                attributeKey: "weaponProficiency",
                reduce: "VALUES"
            })) {
                if (!doubleAttack.includes(weapon)) {
                    resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                }
            }
        } else if (key === 'AVAILABLE_TRIPLE_ATTACK') {
            let tripleAttack = getInheritableAttribute({
                entity: this,
                attributeKey: "tripleAttack",
                reduce: "VALUES"
            })

            for (let weapon of getInheritableAttribute({
                entity: this,
                attributeKey: "doubleAttack",
                reduce: "VALUES"
            })) {
                if (!tripleAttack.includes(weapon.toLowerCase())) {
                    resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                }
            }
        } else if (key === 'AVAILABLE_SAVAGE_ATTACK') {
            let savageAttack = getInheritableAttribute({
                entity: this,
                attributeKey: "savageAttack",
                reduce: "VALUES"
            })

            for (let weapon of getInheritableAttribute({
                entity: this,
                attributeKey: "doubleAttack",
                reduce: "VALUES"
            })) {
                if (!savageAttack.includes(weapon)) {
                    resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                }
            }
        } else if (key === 'AVAILABLE_RELENTLESS_ATTACK') {
            let relentlessAttack = getInheritableAttribute({
                entity: this,
                attributeKey: "relentlessAttack",
                reduce: "VALUES"
            })

            for (let weapon of getInheritableAttribute({
                entity: this,
                attributeKey: "doubleAttack",
                reduce: "VALUES"
            })) {
                if (!relentlessAttack.includes(weapon)) {
                    resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                }
            }
        } else if (key === 'AVAILABLE_AUTOFIRE_SWEEP') {
            let autofireSweep = getInheritableAttribute({
                entity: this,
                attributeKey: "autofireSweep",
                reduce: "VALUES"
            })

            for (let weapon of getInheritableAttribute({
                entity: this,
                attributeKey: "weaponFocus",
                reduce: "VALUES"
            })) {
                if (!autofireSweep.includes(weapon)) {
                    resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                }
            }
        } else if (key === 'AVAILABLE_AUTOFIRE_ASSAULT') {
            let autofireAssault = getInheritableAttribute({
                entity: this,
                attributeKey: "autofireAssault",
                reduce: "VALUES"
            })

            for (let weapon of getInheritableAttribute({
                entity: this,
                attributeKey: "weaponFocus",
                reduce: "VALUES"
            })) {
                if (!autofireAssault.includes(weapon)) {
                    resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                }
            }
        } else if (key === 'AVAILABLE_HALT') {
            let halt = getInheritableAttribute({
                entity: this,
                attributeKey: "halt",
                reduce: "VALUES"
            })

            for (let weapon of getInheritableAttribute({
                entity: this,
                attributeKey: "weaponFocus",
                reduce: "VALUES"
            })) {
                if (!halt.includes(weapon)) {
                    resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                }
            }
        } else if (key === 'AVAILABLE_RETURN_FIRE') {
            let returnFire = getInheritableAttribute({
                entity: this,
                attributeKey: "returnFire",
                reduce: "VALUES"
            })

            for (let weapon of getInheritableAttribute({
                entity: this,
                attributeKey: "weaponFocus",
                reduce: "VALUES"
            })) {
                if (!returnFire.includes(weapon.toLowerCase())) {
                    resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                }
            }
        } else if (key === 'AVAILABLE_CRITICAL_STRIKE') {
            let criticalStrike = getInheritableAttribute({
                entity: this,
                attributeKey: "criticalStrike",
                reduce: "VALUES"
            })

            for (let weapon of getInheritableAttribute({
                entity: this,
                attributeKey: "weaponFocus",
                reduce: "VALUES"
            })) {
                if (!criticalStrike.includes(weapon.toLowerCase())) {
                    resolvedOptions[weapon.titleCase()] = {abilities: [], items: [], payload: weapon.titleCase()};
                }
            }
        } else if (key === 'AVAILABLE_LIGHTSABER_FORMS') {
            for (let form of lightsaberForms) {
                if (!this.talents.map(t => t.name).includes(form)) {
                    resolvedOptions[form] = {abilities: [], items: [], payload: form};
                }
            }
        } else {
            resolvedOptions[key] = value;
        }
    }
    return resolvedOptions;
}
