import {getInheritableAttribute} from "../attribute-helper.mjs";
import {toNumber} from "../common/util.mjs";
import {SWSEActorSheet} from "./base-sheet.mjs";
import {addSubCredits, transferCredits} from "./credits.mjs";

// noinspection JSClosureCompilerSyntax

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {SWSEActorSheet}
 */

export class SWSECharacterSheet extends SWSEActorSheet {
    constructor(...args) {
        super(...args);
    }

    /** @override */
    static get defaultOptions() {

        return mergeObject(super.defaultOptions, {
            classes: ["swse", "sheet", "actor", "character"],
        });
    }

    /* -------------------------------------------- */

    /** @override */
    getData(options) {
        // Retrieve the data structure from the base sheet. You can inspect or log
        // the context variable to see the structure, but some key properties for
        // sheets are the actor object, the data object, whether or not it's
        // editable, the items array, and the effects array.
        const context = super.getData(options);
        
        const actorData = context.data;
        const systemDerived = this.actor.system;

        context.classes = this.actor.classes;
        context.classSummary = systemDerived.classSummary;
        context.defense = systemDerived.defense;
        context.details = actorData.system.details;
        context.skills = systemDerived.skills;
        context.traits = systemDerived.traits;
        context.species = this.actor.itemTypes.species[0] ?? null;
        context.bgdst = this.actor.itemTypes.background[0] ?? this.actor.itemTypes.destiny[0] ?? null;

        this._prepareCharacterActorSheetData(context);

        return context;
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        // Everything below here is only needed if the sheet is editable
        if (!this.isEditable) return;

        html.find("#selectWeight").on("click", () => this._unavailable());
        html.find("#selectHeight").on("click", () => this._unavailable());

        html.find(".rollAbilities").on("click", async (event) =>
            this._selectAbilityScores(event, this, {}, true)
        );
        html.find(".assignStandardArray").on("click", async (event) =>
            this._selectAbilityScores(
                event,
                this,
                CONFIG.SWSE.standardAbilityScorePackage,
                false
            )
        );
        html.find(".assignAbilityPoints").on("click", (event) =>
            this._assignAbilityPoints(event, this)
        );
        html.find(".assignManual").on("click", async (event) =>
            this._selectAbilitiesManually(event, this)
        );
        html.find(".leveledAttributeBonus").each((i, button) => {
            button.addEventListener("click", (event) => this._selectAttributeLevelBonuses(event, this));
        })

        html.find('[data-action="credit"]').click(this._onCredit.bind(this));
        html.find('[data-action="toggle-second-wind"]').click(this._onToggleSecondWind.bind(this));
        html.find('[data-action="level-up-bonus"]').click(this._onAddLevelUpBonus.bind(this));
        html.find('[data-action="gender"]').on("click", event => this._selectGender(event, this));
        html.find('[data-action="age"]').on("click", event => this._selectAge(event, this));
        html.find('[data-action="remove-class-level"]').on("click", event => this.removeClassLevel(event, this));

        html.find('.dark-side-button').click((ev) => {
            this.object.update({"system.darkSideScore": $(ev.currentTarget).data("value")});
        });
    }

    _onCredit(event) {
        let type = $(event.currentTarget).data("action-type")

        if ('add' === type || 'sub' === type) {
            addSubCredits(type, this.actor);
        } else if ('transfer' === type) {
            transferCredits(this.actor);
        }
    }

    async _selectAge(event, sheet) {
        let options = this.buildAgeDialog(sheet);
        await Dialog.prompt(options);
    }

    async _selectGender(event, sheet) {
        let options = this.buildGenderDialog(sheet);
        await Dialog.prompt(options);
    }

    buildAgeDialog(sheet) {
        let system = sheet.actor.system;
        let ageEffects = sheet.actor.itemTypes.trait
            .map((trait) => {
                //let prereqs = trait.system.prerequisite.filter(prereq => );
                let prereq = this._prerequisiteHasTypeInStructure(trait.system.prerequisite, 'AGE');
                if (prereq) {
                    return {
                        name: trait.name,
                        low: parseInt(prereq.low),
                        high: prereq.high ? parseInt(prereq.high) : -1,
                        text: prereq.text
                    };
                }
                return undefined;
            }).filter(trait => !!trait);

        ageEffects.sort(
            (a, b) => a.low - b.low);

        let traits = '';
        for (let effect of ageEffects) {
            let current =
                system.details.age >= effect.low &&
                    (system.details.age <= effect.high || effect.high === -1)
                    ? " current"
                    : "";
            traits += `<div class="flex-grow ageRange${current}" data-low="${effect.low}" data-high="${effect.high}">${effect.name}: ${effect.text}</div>`;
        }
        if (traits === '') {
            traits = `<div>This species has no traits related to age.</div>`;
        }
        let content = `<p>Enter your age. Adults have no modifiers:</p><input class="range" id="age" placeholder="Age" type="number" value="${system.details.age}" onfocus="this.select()"><div>${traits}</div>`;

        return {
            title: "Age Selection",
            content: content,
            callback: async (html) => {
                let key = html.find("#age")[0].value;
                sheet.actor.update({ "system.details.age": key });
            },
            render: async (html) => {
                let ageInput = html.find("#age");
                this.moveAgeCursor(html);
                ageInput.on("input", () => {
                    this.moveAgeCursor(html);
                });
            }
        };
    }

    buildGenderDialog(sheet) {
        let system = sheet.actor.system;
        let searchString = "GENDER";
        let genderEffects = sheet.actor.itemTypes.trait
            .filter((trait) =>
                this._prerequisiteHasTypeInStructure(
                    trait.system.prerequisite,
                    searchString
                )
            )
            .map((trait) => {
                let prerequisite = this._prerequisiteHasTypeInStructure(
                    trait.system.prerequisite,
                    searchString
                );

                return {
                    gender: prerequisite.text,
                    name: trait.data.finalName,
                };
            });

        genderEffects.sort((a, b) => (a.gender < b.gender ? 1 : -1));

        let traits = '';
        for (let effect of genderEffects) {
            let current =
                system.details.gender.toLowerCase() === effect.gender
                    ? " current"
                    : "";
            traits += `<div class="flex-grow gender${current}" data-gender="${effect.gender}" >${effect.gender}: ${effect.name}</div>`;
        }
        if (traits === '') {
            traits = `<div>This species has no traits related to sex.</div>`;
        }

        let content = `<p>Enter your sex, some species have traits tied to sex.  Optionally, enter your gender. If included it will be displayed throughout your sheet instead of sex.</p>
<input class="range" id="sex" type="text" placeholder="Sex" value="${system.details.sex}" onfocus="this.select()">
<input class="range" id="gender" type="text" placeholder="Gender" value="${system.details.gender}"onfocus="this.select()">
<div>${traits}</div>`;

        return {
            title: "Gender Selection",
            content: content,
            callback: async (html) => {
                let updates = {};

                let gender = html.find("#gender")[0].value;
                if (gender) updates["system.details.gender"] = gender;

                let sex = html.find("#sex")[0].value;
                if (sex) updates["system.details.sex"] = sex;

                if (!foundry.utils.isEmpty(updates))
                    sheet.actor.update(updates);
            },
            render: async (html) => {
                let genderInput = html.find("#sex");
                this.moveGenderCursor(html);
                genderInput.on("input", () => {
                    this.moveGenderCursor(html);
                });
            },
        };
    }

    moveAgeCursor(html) {
        let age = parseInt(html.find("#age")[0].value);
        let rangeDivs = html.find(".ageRange")
        for (let div of rangeDivs) {
            let low = parseInt($(div).data("low"));
            let high = parseInt($(div).data("high"));

            if (div.classList.contains("cursor")) {
                div.classList.remove("cursor")
            }
            if (age >= low && (age <= high || high === -1)) {
                div.classList.add("cursor")
            }
        }
    }

    moveGenderCursor(html) {
        let gender = html.find("#sex")[0].value;
        let rangeDivs = html.find(".gender")
        for (let div of rangeDivs) {
            if (div.classList.contains("cursor")) {
                div.classList.remove("cursor")
            }
            if (gender.toLowerCase() === $(div).data('gender').toLowerCase()) {
                div.classList.add("cursor")
            }
        }
    }

    getPointBuyTotal() {
        if (this.actor.isDroid) {
            return CONFIG.SWSE.droidAbilityPointBuyTotal;
        }
        return CONFIG.SWSE.defaultAbilityPointBuyTotal;
    }

    updateTotal(html) {
        let values = this.getTotal(html);

        html.find(".adjustable-total").each((i, item) => {
            item.innerHTML = values.total
        })
        html.find(".attribute-total").each((i, item) => {
            let att = item.dataset.attribute
            item.innerHTML = parseInt(values[att]) + parseInt(item.dataset.bonus);
        })
    }

    getTotal(html) {
        let abilityCost = CONFIG.SWSE.Abilities.abilityCost;
        let response = {};
        let total = 0;
        html.find(".adjustable-value").each((i, item) => {
            total += abilityCost[item.innerHTML];
            response[item.dataset["label"]] = item.innerHTML;
        })
        response.total = total;
        return response;
    }

    /** @inheritdoc */
    async _updateObject(event, formData) {
        if (this.object.system.settings.abilityGeneration.value === "Manual") {
            formData['system.abilities.str.base'] = toNumber(formData['system.abilities.str.base']);
            formData['system.abilities.dex.base'] = toNumber(formData['system.abilities.dex.base']);
            formData['system.abilities.con.base'] = toNumber(formData['system.abilities.con.base']);
            formData['system.abilities.wis.base'] = toNumber(formData['system.abilities.wis.base']);
            formData['system.abilities.int.base'] = toNumber(formData['system.abilities.int.base']);
            formData['system.abilities.cha.base'] = toNumber(formData['system.abilities.cha.base']);
        }

        return super._updateObject(event, formData);
    }

    _onAddLevelUpBonus(){
        if(this.object.isHeroic){
            this.object.addItems({items: [{name: "Heroic Ability Score Level Bonus", type: "trait"}]})
        } else {
            this.object.addItems({items: [{name: "Nonheroic Ability Score Level Bonus", type: "trait"}]})
        }
    }

    /* -------------------------------------------- */

    async removeClassLevel(event, sheet) {
        event.preventDefault();
        const button = event.currentTarget;
        if (button.disabled) return;

        const li = $(button).closest(".item");

        let itemId = li.data("itemId");
        let itemToDelete = this.actor.items.get(itemId);
        if (game.keyboard.downKeys.has("Shift") || game.keyboard.downKeys.has("ShiftLeft")) {
            await this.object.removeClassLevel(itemId);
        } else {
            button.disabled = true;

            let title = `Are you sure you want to delete ${itemToDelete.finalName}`;
            await Dialog.confirm({
                title: title,
                content: title,
                yes: async () => {
                    await this.object.removeClassLevel(itemId);
                    button.disabled = false
                },
                no: () => (button.disabled = false),
            });
        }
    }

    _onToggleSecondWind(event) {
        event.preventDefault();
        let toggle = event.currentTarget.checked;
        let key = event.currentTarget.dataset.name;
        foundry.utils.setProperty(this.actor, key, toggle);
    }

    /**
     *
     * @param event
     * @param sheet {SWSEActorSheet}
     * @param scores
     * @param canReRoll
     * @returns {Promise<void>}
     * @private
     */
    async _selectAbilityScores(event, sheet, scores, canReRoll) {
        let system = sheet.actor.system;
        if (Object.keys(scores).length === 0) {
            let existingValues = {};
            for (let [key, ability] of Object.entries(system.abilities)) {
                existingValues[key] = ability.base;
            }

            scores = {str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8};
            for (let val of Object.keys(existingValues)) {
                scores[val] = existingValues[val];
            }
        }

        let data = {
            canReRoll,
            abilities: CONFIG.SWSE.droidAbilitySkip,
            isDroid: sheet.actor.isDroid,
            scores,
            formula: CONFIG.SWSE.defaultAbilityScoreGenerationRoll,
        };
        const template = `systems/swse/templates/dialog/roll-and-standard-array.hbs`;

        let content = await renderTemplate(template, data);

        let response = await Dialog.confirm({
            title: "Assign Ability Scores",
            content: content,
            yes: async (html) => {
                let response = {str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8};
                html.find(".container").each((i, item) => {
                    let ability = $(item).data("ability");
                    let value = 8;
                    if (item.innerText) {
                        value = parseInt(item.innerText);
                    }
                    if (ability) {
                        response[ability] = value;
                    }
                })
                return response;
            },
            no: async () => {

            },
            render: (html) => {
                html.find(".movable").each((i, item) => {
                    item.setAttribute("draggable", true);
                    item.addEventListener("dragstart", (ev) => this._onDragStart(ev), false);
                });

                html.find(".container").each((i, item) => {
                    item.addEventListener("drop", (ev) => this._onDragEndMovable(ev), false);
                });

                if (canReRoll) {
                    html.find("#reRoll").each((i, button) => {
                        button.addEventListener("click", () => {
                            let rollFormula =
                                CONFIG.SWSE.defaultAbilityScoreGenerationRoll;
                            html.find(".movable").each((i, item) => {
                                let roll = new Roll(rollFormula).roll({async: false});
                                let title = "";
                                for (let term of roll.terms) {
                                    for (let result of term.results) {
                                        if (title !== "") {
                                            title += ", "
                                        }
                                        if (result.discarded) {
                                            title += `(Ignored: ${result.result})`
                                        } else {
                                            title += result.result
                                        }

                                    }
                                }
                                item.title = title;
                                item.innerHTML = roll.total;
                            });
                        })
                    })
                }
            }
        });
        if (response) {
            system.setAbilities(response);
        }
    }

    /**
     *
     * @param event
     * @param sheet {SWSEActorSheet}
     * @returns {Promise<void>}
     * @private
     */
    async _selectAbilitiesManually(event, sheet) {
        let system = sheet.actor.system;
        let combined = {};
        for (let [key, ability] of Object.entries(system.abilities)) {
            combined[key] = {
                val: ability.base,
                skip: CONFIG.SWSE.droidAbilitySkip[key],
            };
        }

        let data = {
            availablePoints: sheet.getPointBuyTotal(),
            abilityCost: CONFIG.SWSE.abilityScorePointCost,
            abilities: combined,
            isDroid: system.isDroid,
        };
        const template = `systems/swse/templates/dialog/manual-attributes.hbs`;

        let content = await renderTemplate(template, data);

        let response = await Dialog.confirm({
            title: "Assign Ability Score Points",
            content: content,
            yes: async (html) => {
                let response = {};
                html.find(".adjustable-value").each((i, item) => {
                    response[$(item).data("label")] = item.value;
                })
                return response;
            }
        });
        if (response) {
            system.setAbilities(response);
        }

    }

    /**
     *
     * @param event
     * @param sheet {SWSEActorSheet}
     * @returns {Promise<void>}
     * @private
     */
    async _selectAttributeLevelBonuses(event, sheet) {
        let level = $(event.currentTarget).data("level");
        let bonus = sheet.actor.getAttributeLevelBonus(level);

        let combined = {};
        for (let val of Object.keys(CONFIG.SWSE.droidAbilitySkip)) {
            combined[val] = {
                val: bonus[val],
                skip: CONFIG.SWSE.droidAbilitySkip[val],
            };
        }

        let availableBonuses = [false];
        if (this.actor.isHeroic) {
            availableBonuses = [false, false];
        }
        for (let i = 0; i < availableBonuses.length - Object.values(bonus).filter(b => b === 1).length; i++) {
            availableBonuses[i] = true;
        }

        let data = {
            abilityCost: CONFIG.SWSE.abilityScorePointCost,
            abilities: combined,
            isDroid: sheet.actor.isDroid,
            availableBonuses
        };
        const template = `systems/swse/templates/dialog/level-attribute-bonus.hbs`;

        let content = await renderTemplate(template, data);

        let response = await Dialog.confirm({
            title: "Assign Ability Score Points",
            content: content,
            yes: async (html) => {
                let response = {};
                html.find(".container").each((i, item) => {
                    let ability = $(item).data("ability");
                    let value = null;
                    if (item.innerText) {
                        value = parseInt(item.innerText);
                    }
                    if (ability) {
                        response[ability] = value;
                    }
                })
                return response;
            },
            render: (html) => {
                html.find(".movable").each((i, item) => {
                    item.setAttribute("draggable", true);
                    item.addEventListener("dragstart", (ev) => this._onDragStart(ev), false);
                });

                html.find(".container").each((i, item) => {
                    item.addEventListener("drop", (ev) => this._onDragEndMovable(ev), false);
                });
            }
        });
        if (response) {
            sheet.actor.setAttributeLevelBonus(level, response);
        }
    }

    /**
     *
     * @param event
     * @param sheet {SWSEActorSheet}
     * @returns {Promise<void>}
     * @private
     */
    async _assignAbilityPoints(event, sheet) {
        let system = sheet.actor.system;
        let combined = {};
        for (let [key, ability] of Object.entries(system.abilities)) {
            combined[key] = {
                val: ability.base,
                skip: CONFIG.SWSE.droidAbilitySkip[key],
                bonus: ability.bonus,
            };
        }

        let data = {
            availablePoints: sheet.getPointBuyTotal(),
            abilityCost: CONFIG.SWSE.abilityScorePointCost,
            abilities: combined,
            isDroid: system.isDroid,
        };
        const template = `systems/swse/templates/dialog/point-buy.hbs`;

        let content = await renderTemplate(template, data);

        let response = await Dialog.confirm({
            title: "Assign Ability Score Points",
            content: content,
            yes: async (html) => {
                let response = {};
                html.find(".adjustable-value").each((i, item) => {
                    response[$(item).data("label")] = parseInt(item.innerHTML);
                })
                return response;
            },
            render: (html) => {
                sheet.updateTotal(html);

                html.find(".adjustable-plus").on("click", (event) => {
                    const parent = $(event.currentTarget).parents(".adjustable");
                    const valueContainer = parent.children(".adjustable-value");
                    valueContainer.each((i, item) => {
                        item.innerHTML = parseInt(item.innerHTML) + 1;
                        if (parseInt(item.innerHTML) > 18 || sheet.getTotal(html).total > sheet.getPointBuyTotal()) {
                            item.innerHTML = parseInt(item.innerHTML) - 1;
                        }
                    });
                    sheet.updateTotal(html);
                });
                html.find(".adjustable-minus").on("click", (event) => {
                    const parent = $(event.currentTarget).parents(".adjustable");
                    const valueContainer = parent.children(".adjustable-value");
                    valueContainer.each((i, item) => {
                        item.innerHTML = parseInt(item.innerHTML) - 1;
                        if (parseInt(item.innerHTML) < 8) {
                            item.innerHTML = parseInt(item.innerHTML) + 1;
                        }
                    });
                    sheet.updateTotal(html);
                });
            }
        });
        if (response) {
            system.setAbilities(response);
        }
    }

    _unavailable() {
        Dialog.prompt({
            title: "Sorry this content isn't finished.",
            content: "Sorry, this content isn't finished.  if you have an idea of how you think it should work please let me know.",
            callback: () => {
            }
        })
    }

    _prerequisiteHasTypeInStructure(prereq, type) {
        if (!prereq) {
            return false;
        }
        if (prereq.type === type) {
            return prereq;
        }
        if (prereq.children) {
            for (let child of prereq.children) {
                let prerequisiteHasTypeInStructure = this._prerequisiteHasTypeInStructure(child, type);
                if (prerequisiteHasTypeInStructure) {
                    return prerequisiteHasTypeInStructure;
                }
            }
        }
        return false;
    }

    _prepareCharacterActorSheetData(context) {
        let system = context.system;

        //********************************
        //Dark Side Array
        context.darkSideArray = [];
        let score = system.darkSideScore;
        for (let i = 0; i <= system.abilities.wis.value; i++) {
            if (score < i) {
                context.darkSideArray.push({
                    value: i,
                    active: false,
                });
            } else {
                context.darkSideArray.push({
                    value: i,
                    active: true,
                });
            }
        }

        let darkSideTaint = getInheritableAttribute({
            entity: system.parent,
            attributeKey: "darksideTaint",
            reduce: "SUM",
        });

        context.finalDarksideScore = system.darkSideScore + darkSideTaint;

        //********************************
        //Add skill data
        for (let [key, skill] of Object.entries(CONFIG.SWSE.skills)) {
            context.skills[key].label = skill.name.replace("Knowledge", "K.");
            context.skills[key].rowColor =
                key === "init" || key === "perc" ? "highlighted-skill" : "";
        }

        //********************************
        //Add defense data
        // for (let [key, defense] of Object.entries(CONFIG.SWSE.defenses)) {
        // 	context.defense[key].label = defense.label;
        // 	context.defense[key].abbrev = key;
        // }

        //********************************
        //Add second winds
        context.system.secondWinds = this.actor.system.secondWinds;
    }
}
