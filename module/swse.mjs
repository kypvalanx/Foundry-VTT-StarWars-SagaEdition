// Import Modules
import {initializeStatusEffects, SWSE} from "./common/config.mjs";
import {buildRollContent, SWSEActor} from "./actor/actor.mjs";
import {SWSEActorSheet} from "./actor/actor-sheet.mjs";
import {SWSEManualActorSheet} from "./actor/manual-actor-sheet.mjs";
import {SWSEItem} from "./item/item.mjs";
import {SWSEItemSheet} from "./item/item-sheet.mjs";
import {refreshActors, registerSystemSettings} from "./settings/system.mjs";
import {registerHandlebarsHelpers} from "./settings/helpers.mjs";
import {clearEmptyCompendiums, deleteEmptyCompendiums, generateCompendiums} from "./compendium/generation.mjs";
import {measureDistances} from "./measure.mjs";
import {SWSECompendiumBrowser} from "./compendium/compendium-browser.mjs";
import {filterItemsByType, toNumber} from "./common/util.mjs";
import {SWSEActiveEffect} from "./active-effect/active-effect.mjs";
import {SWSEActiveEffectConfig} from "./active-effect/active-effect-config.mjs";
import {registerTestSuites} from "../module_test/test-suites.test.mjs";
import {makeAttack} from "./actor/attack/attackDelegate.mjs";
import {SWSETokenDocument} from "./token/token-document.js";
import {CompendiumWeb} from "./compendium/compendium-web.mjs";
import {getInheritableAttribute} from "./attribute-helper.mjs";
import {SWSETokenHud} from "./token/token-hud.mjs";


Hooks.once('quenchReady',  (quench) => {
    //console.warn("It's Quenching time!")
    registerTestSuites(quench);
})


const RUN_MULTIPLIER = 4;

const ENCUMBERED_RUN_MULTIPLIER = 3;

function initializeDragRuler() {
    Hooks.once("dragRuler.ready", (SpeedProvider) => {
        class SWSESpeedProvider extends SpeedProvider {
            get colors() {
                return [
                    {id: "move", default: 0x00FF00, name: "swse.speeds.move"},
                    {id: "double", default: 0xFFFF00, name: "swse.speeds.double"},
                    {id: "run", default: 0xFF8000, name: "swse.speeds.run"},
                    {id: "fly", default: 0x0000FF, name: "swse.speeds.fly"},
                ]
            }

            getRanges(token) {
                const speeds = token.actor.gridSpeeds

                const runSpeedMultiplier = token.actor.heaviestArmorType === "Heavy" || this.carriedWeight >= this.heavyLoad ? ENCUMBERED_RUN_MULTIPLIER : RUN_MULTIPLIER

                const fastest = speeds.reduce((selected, current) => selected?.value < current.value ? current : selected)
                // A character can always walk it's base speed and dash twice it's base speed
                const ranges = [
                    {range: fastest.value, color: "move"},
                    {range: fastest.value * 2, color: "double"},
                    {range: fastest.value * runSpeedMultiplier, color: "run"}
                ]

                return ranges
            }
        }

        dragRuler.registerSystem("swse", SWSESpeedProvider)
    })
}

function initializePolyglot() {

    Hooks.once("polyglot.init", (LanguageProvider) => {
        class SWSELanguageProvider extends LanguageProvider {
            async getLanguages() {
                const langs = {};

                const packs = [];
                packs.push(...game.packs.filter(p => true));

                const languagesSetting = game.settings.get("polyglot", "Languages");
                if (!this.replaceLanguages) {
                    //CONFIG.FICTIONAL.spoken = {};
                    const languages = packs.filter(pack => pack.collection.startsWith("swse.languages"))[0].index;

                    for (const language of languages) {
                        langs[language.name] = {
                            label: language.name,
                            font: languagesSetting[language.name]?.font || this.languages[language.name]?.font || this.defaultFont,
                            rng: languagesSetting[language.name]?.rng ?? "default",
                        };
                    }

                    //console.log(languages)
                }
                // for (let lang in CONFIG.FICTIONAL.spoken) {
                //     langs[lang] = {
                //         label: CONFIG.FICTIONAL.spoken[lang],
                //         font: languagesSetting[lang]?.font || this.languages[lang]?.font || this.defaultFont,
                //         rng: languagesSetting[lang]?.rng ?? "default",
                //     };
                // }
                this.languages = langs;
            }

            getUserLanguages(actor) {
                let known_languages = new Set();
                let literate_languages = new Set();

                const maySpeak = getInheritableAttribute({entity:actor, attributeKey: "maySpeak", reduce: "VALUES"})
                const limitedSpeech = maySpeak.length > 0;

                for (let lang of filterItemsByType(actor.items.values(), "language")) {
                    if(limitedSpeech && !maySpeak.includes(lang.name)) {
                        literate_languages.add(lang.name)
                    } else {
                        known_languages.add(lang.name)
                    }
                }
                return [known_languages, literate_languages];
            }
        }


        game.polyglot.api.registerSystem(SWSELanguageProvider);
    })


}

Hooks.once('init', async function () {

    game.swse = {
        SWSEActor,
        SWSEItem,
        rollVariable,
        rollItem,
        makeAttack,
        generateCompendiums, deleteEmptyCompendiums, clearEmptyCompendiums, deleteActorsByName,
        refreshActors,
        applications: {
            SWSECompendiumBrowser
        }
    };


    /**
     * Set an initiative formula for the system
     * @type {String}
     */
    CONFIG.Combat.initiative = {
        formula: "1d20 + @initiative",
        decimals: 2
    };

    // Define custom Entity classes
    CONFIG.SWSE = SWSE;
    CONFIG.Actor.documentClass = SWSEActor;
    CONFIG.Item.documentClass = SWSEItem;
    CONFIG.Token.documentClass = SWSETokenDocument;
    CONFIG.Token.hudClass = SWSETokenHud;

    CONFIG.ActiveEffect.documentClass = SWSEActiveEffect;

    DocumentSheetConfig.registerSheet(ActiveEffect, "swse", SWSEActiveEffectConfig, { makeDefault: true })

    registerSystemSettings();
    registerHandlebarsHelpers();
    initializeStatusEffects(CONFIG)

    initializeDragRuler();
    initializePolyglot();

    // if(game.settings.get("swse", "enableAdvancedCompendium")){
    //     CONFIG.ui.compendium = SWSECompendiumDirectory;
    // }

    Hooks.on("renderCompendiumDirectory", (function (e, t) {
        const featTalentButton = $(`<button type="button" class="feat-web-button constant-button" data-tooltip="SWSE.TALENT_AND_FEAT_WEB"><b class="button-text">Talent and Feat Web</b></button>`);
        featTalentButton.on("click", (function () {
            const options = {
                types: ['feat', "talent"]
            }
            new CompendiumWeb(options).render(!0)
        }))
        t.append(featTalentButton)

        const featButton = $(`<button type="button" class="feat-web-button constant-button" data-tooltip="SWSE.FEAT_WEB"><b class="button-text">Feat Web</b></button>`);
        featButton.on("click", (function () {
            const options = {
                types: ['feat']
            }
            new CompendiumWeb(options).render(!0)
        }))
        t.append(featButton)

        const talentButton = $(`<button type="button" class="talent-web-button constant-button" data-tooltip="SWSE.TALENT_WEB"><b class="button-text">Talent Web</b></button>`);
        talentButton.on("click", (function () {
            const options = {
                types: ['talent']
            }
            new CompendiumWeb(options).render(!0)
        }))
        t.append(talentButton)
    }))

    // Hooks.on("combatTurn", (combat, updateData, updateOptions)=>{
    //     //console.log(combat.combatant.actor.name)
    //     if(updateOptions.direction > 0){
    //         //combat.nextCombatant.actor.startOfTurn(updateData);
    //     }
    //
    // })

    // Register sheet application classes
    Actors.unregisterSheet("core", ActorSheet);
    Actors.registerSheet("swse", SWSEActorSheet, {makeDefault: true});
    Actors.registerSheet("swse", SWSEManualActorSheet, {makeDefault: false});
    Items.unregisterSheet("core", ItemSheet);
    Items.registerSheet("swse", SWSEItemSheet, {makeDefault: true});


    await loadTemplates([
        'systems/swse/templates/actor/manual/parts/actor-summary.hbs',
        'systems/swse/templates/actor/manual/parts/actor-ability-scores.hbs',
        'systems/swse/templates/actor/manual/parts/actor-health.hbs',
        'systems/swse/templates/actor/manual/parts/actor-shields.hbs',
        'systems/swse/templates/actor/parts/actor-affiliations.hbs',
        'systems/swse/templates/actor/parts/actor-summary.hbs',
        'systems/swse/templates/actor/parts/actor-weapon-armor-summary.hbs',
        'systems/swse/templates/actor/parts/skills/actor-skills.hbs',
        'systems/swse/templates/actor/parts/skills/skill-row.hbs',
        'systems/swse/templates/actor/parts/actor-classes.hbs',
        'systems/swse/templates/actor/manual/parts/skills/actor-skills.hbs',
        'systems/swse/templates/actor/parts/actor-ability-scores.hbs',
        'systems/swse/templates/actor/parts/actor-health.hbs',
        'systems/swse/templates/actor/parts/actor-condition.hbs',
        'systems/swse/templates/actor/parts/actor-portrait.hbs',
        'systems/swse/templates/actor/parts/actor-darkside.hbs',
        'systems/swse/templates/actor/parts/actor-defenses.hbs',
        'systems/swse/templates/actor/parts/actor-defense-block.hbs',
        'systems/swse/templates/actor/manual/parts/actor-defenses.hbs',
        'systems/swse/templates/actor/manual/parts/actor-defense-block.hbs',
        'systems/swse/templates/actor/parts/item-entry.hbs',
        'systems/swse/templates/actor/parts/item-list.hbs',
        'systems/swse/templates/actor/vehicle/vehicle-summary.hbs',
        'systems/swse/templates/actor/vehicle/vehicle-stations.hbs',
        'systems/swse/templates/actor/vehicle/vehicle-station.hbs',
        'systems/swse/templates/actor/vehicle/vehicle-skills.hbs',
        'systems/swse/templates/actor/parts/attack/attack-dialogue.hbs',
        'systems/swse/templates/actor/parts/attack/single-attack.hbs',
        'systems/swse/templates/actor/parts/attack/weapon-block.hbs',
        'systems/swse/templates/item/parts/levels.hbs',
        'systems/swse/templates/item/parts/providedItem.hbs',
        'systems/swse/templates/item/parts/providedItems.hbs',
        'systems/swse/templates/item/parts/summary.hbs',
        'systems/swse/templates/item/parts/prerequisites.hbs',
        'systems/swse/templates/item/parts/prerequisite.hbs',
        'systems/swse/templates/item/parts/ammunition.hbs',
        'systems/swse/templates/change/change-list.hbs',
        'systems/swse/templates/change/change.hbs',
        'systems/swse/templates/actor/vehicle/vehicle-template.hbs',
        'systems/swse/templates/actor/vehicle/vehicle-crew.hbs',
        'systems/swse/templates/actor/vehicle/vehicle-health.hbs',
        'systems/swse/templates/credits/credit-chip.hbs',
        'systems/swse/templates/settings/setting.hbs',
        'systems/swse/templates/actor/parts/attack/attack-chat-card.hbs',
        'systems/swse/templates/actor/parts/attack/attack-chat-card-individual-attack.hbs',
        'systems/swse/templates/actor/parts/attack/attack-dialogue.hbs',
        'systems/swse/templates/actor/parts/attack/attack-dialogue-single-attack.hbs',
        'systems/swse/templates/roll/roll.hbs',
        'systems/swse/templates/roll/roll-target.hbs',
        'systems/swse/templates/roll/roll-tooltip.hbs',
        'systems/swse/templates/active-effect/active-effect-list.hbs',
        'systems/swse/templates/common/select.hbs',
        'systems/swse/templates/common/rollable.hbs']);

});


function deleteActorsByName(name){
    game.actors.filter(actor => actor.name === name).forEach(actor => actor.delete())
}

function getHitOptionHTML(target, attack, tokenId) {
    let hit = target.defense.reflex.total <= attack;

    return `<h4>Target: ${target.name} (Reflex Defense: ${target.defense.reflex.total})</h4>
<div class="flex flex-col" data-type="target" data-target="${tokenId}">
    <div>
        <label>Hit: <input data-attribute="target-hit" type="checkbox" ${hit ? "checked" : ""}></label>
    </div>
    <div class="panel">
        <label>Damage Resistance</label>
        <div class="flex flex-row" >
            <label>Additional:<input data-attribute="additional-damage-resistance" type="number"></label> 
            <label>Bypass:<input data-attribute="bypass-damage-resistance" type="checkbox"></label>
        </div>
    </div>
    
    <div class="panel">
        <label>Shield Rating</label>
        <div class="flex flex-row" >
            <label>Additional:<input data-attribute="additional-shield-rating" type="number"></label>
            <label>Bypass:<input data-attribute="bypass-shields" type="checkbox"></label>
        </div>
    </div>
    
    <div class="panel">
        <label>Affect Condition</label>
        <div class="flex flex-row" >
            <input data-attribute="bypass-damage-threshold" type="checkbox" checked>
        </div>
    </div>
</div>`;
}

const applyAttack = (event) => {
    let element = $(event.currentTarget);
    let damageType = element.data("damage-type")
    let type = element.data("type")
    let attack = element.data("attack")
    let damage = element.data("damage")

    let targetTokens = game.user.targets
    let targetActors = [];
    let actorMap = {};

    let damageTypeString = !!damageType ? ` (${damageType})` : ""
    let baseDamage = toNumber(damage);
    if(type === "half"){
        baseDamage /= 2
    } else if(type === "double") {
        baseDamage *= 2
    }
    let damageString = `${Math.floor(baseDamage)}`

    let content = `<div class="subtle-panel">
<div>Attack Roll: ${attack}</div>
<div>${type.titleCase()}: ${damageString}${damageTypeString}</div>
</div>`;
    for(let targetToken of targetTokens.values()){
        //targetToken.update
        let actor = targetToken.document.actor
        if(actor){
            targetActors.push(actor)
            actorMap[targetToken.id] = actor;
            content += getHitOptionHTML(actor, attack, targetToken.id)
        }
    }

    if(targetActors.length === 0){
        new Dialog({
            title: "No Targets Selected",
            content: "No tokens were targeted",
            buttons: {
                ok:{
                    label: "OK",
                    icon:  `<i class="fas fa-check"></i>`
                }
            },
            default: "ok"
        }).render(true);
    return;
    }

    new Dialog({
        title: "Resolve Attacks",
        content,
        buttons: {
            attack:{
                label: "Attack",
                callback: async (html) => {
                    let targets = html.find("[data-type=target]")
                    for (let target of targets) {

                        let targetHit = $(target).find("[data-attribute=target-hit]")[0]?.checked

                        let additionalDR = $(target).find("[data-attribute=additional-damage-resistance]")[0].value
                        let bypassDR = $(target).find("[data-attribute=bypass-damage-resistance]")[0]?.checked
                        let additionalShields = $(target).find("[data-attribute=additional-shield-rating]")[0].value
                        let bypassShields = $(target).find("[data-attribute=bypass-shields]")[0]?.checked
                        let affectDamageThreshold = $(target).find("[data-attribute=bypass-damage-threshold]")[0]?.checked


                        if (!targetHit) {
                            return;
                        }

                        let targetActor = actorMap[target.dataset.target];
                        if (type === "heal") {
                            targetActor.applyHealing({heal: baseDamage})
                        } else {
                            await targetActor.applyDamage({
                                damage: baseDamage,
                                damageType: damageType,
                                additionalDR,
                                skipDamageReduction: bypassDR,
                                additionalShields,
                                skipShields: bypassShields,
                                affectDamageThreshold
                            })
                        }
                    }
                },
                icon:  `<i class="fas fa-check"></i>`
            },
            cancel:{
                label: "Cancel",
                icon:  `<i class="fas fa-x"></i>`
            }
        },
        default: "attack"
    }).render(true);
}

Hooks.on('renderChatMessage', async (message, html) => {
    if (typeof message.flags?.swse?.context === 'undefined') {
        return;
    }

    if(message.flags.swse.context.type === "attack-roll"){
       // console.log("bam")

        html.find('[data-action="apply-attack"]').click(applyAttack.bind(this));
    }

})




Hooks.on("ready", async function () {
    game.generated = {};
    game.generated.species = {}
    game.generated.species.replicaDroidChoices = []
    game.generated.weapon = {}
    game.generated.weapon.exoticWeapons = [];
    game.generated.weapon.exoticMeleeWeapons = [];
    game.generated.weapon.exoticRangedWeapons = [];

    game.generated.species.replicaDroidChoices = new Promise(async resolve => {
        const replicaDroidChoices = [];
        for (const pack of game.packs.filter(p => p.metadata.name.toLowerCase().includes("species"))) {
            let indices = await pack.getIndex()
            for (const index of indices.filter(i => i.type === "species")) {
                const entity = await pack.getDocument(index._id)
                if (entity.changes.filter(c => c.key === "isDroid" && (c.value === "true" || c.value === true)).length > 0) continue;

                let attributes = [];
                for (const change of entity.changes) {
                    attributes.push({key: change.key, value: change.value});
                }
                replicaDroidChoices.push({name: entity.name, attributes: attributes});
            }
        }
        resolve(replicaDroidChoices)
    }).then(result => game.generated.species.replicaDroidChoices = result);

    new Promise(async resolve => {
        game.packs.forEach(pack => {
            pack.getIndex().then(index => {
                index.filter(i => i.type === "weapon" || i.type === "template")
                    .forEach(i => pack.getDocument(i._id)
                    .then(entity => {
                        ///list all exotic weapons
                        if (entity.type === 'weapon') {
                            let subTypeKey = entity._source.system.subtype.toLowerCase();
                            if (subTypeKey.includes('exotic')) {
                                game.generated.weapon.exoticWeapons.push(entity.name);
                                if(subTypeKey.includes('melee')){
                                    game.generated.weapon.exoticMeleeWeapons.push(entity.name);
                                } else {
                                    game.generated.weapon.exoticRangedWeapons.push(entity.name);
                                }
                            }
                        } else if (entity.type === 'template') {
                            let exoticWeaponTypes = getInheritableAttribute({
                                entity,
                                attributeKey: "exoticWeapon",
                                reduce: "VALUES"
                            })
                            game.generated.weapon.exoticWeapons.push(...exoticWeaponTypes);
                        }
                    }))
            });
        });
    })


});

Hooks.on("canvasInit", function () {
    canvas.grid.diagonalRule = game.settings.get("swse", "enable5105Measurement");
    foundry.grid.SquareGrid.prototype.measureDistances = measureDistances;
})


if (!Map.prototype.computeIfAbsent) {
    Map.prototype.computeIfAbsent = function (key, mappingFunction) {
        if (!this.has(key)) {
            this.set(key, mappingFunction.call(key))
        }
        return this.get(key);
    };
}

Array.prototype.distinct = function () {
    return this.filter((value, index, self) => {
        if ("object" === typeof value) {
            let keys = Object.keys(value);
            let foundIndex = self.findIndex((val, i, s) => {
                if (Object.keys(val).length !== keys.length) {
                    return false
                }

                for (let key of keys) {
                    if (value[key] !== val[key]) {
                        return false;
                    }
                }
                return true;
            });
            return foundIndex === index
        } else {
            return self.indexOf(value) === index
        }
    })
}

/**
 * Convert a string to Title Case where the first letter of each word is capitalized
 * @memberof String.prototype
 * @returns {string}
 */
// String.prototype.titleCase = function () {
//     if (!this.length) return this;
//     return this.toLowerCase().split(' ').reduce((parts, word) => {
//         if (!word) return parts;
//         const title = word.replace(word[0], word[0].toUpperCase());
//         parts.push(title);
//         return parts;
//     }, []).join(' ').split('(').reduce((parts, word) => {
//         if (!word) return parts;
//         const title = word.replace(word[0], word[0].toUpperCase());
//         parts.push(title);
//         return parts;
//     }, []).join('(');
// };


Hooks.on("hotbarDrop", (bar, data, slot) => {

    let type = data.type.toLowerCase();
    if (type === "skill" || type === "ability") {
        createVariableMacro(data, slot).then(() => {
        });
        return false;

    }
    if (type === "item") {
        createItemMacro(data, slot).then(() => {
        });
        return false;

    }
    if (type === "attack") {
        createAttackMacro(data, slot).then(() => {
        });
        return false;

    }
    return true;
});


async function createVariableMacro(data, slot) {
    let actorId = data.actorId;
    const actor = getActorFromId(actorId);
    if (!actor) return;

    const command = `game.swse.rollVariable("${actorId}", "${data.variable}");`;
    const name = `${actor.name}: ${data.label}`
    let macro = game.macros._source.find((m) => m.name === name && m.command === command);
    if (!macro) {
        macro = await Macro.create(
            {
                name: name,
                type: "script",
                img: "systems/swse/icon/skill/default.png",
                command: command,
                flags: {"swse.skillMacro": true},
            },
            {displaySheet: false}
        );
    }

    await game.user.assignHotbarMacro(macro, slot);
}

async function createItemMacro(data, slot) {
    let actorId = data.actorId;

    const actor = getActorFromId(actorId);
    if (!actor) return;

    let img = "systems/swse/icon/skill/default.png";

    if (data.img) {
        img = data.img;
    }
    let id = [];
    if (data.label === 'Unarmed Attack') {
        id.push({id: 'Unarmed Attack'});
    } else {
        id.push({id: data.itemId, provider: data.provider});
    }

    const command = `game.swse.rollItem("${actorId}", [${id.map(id => `{id:"${id.id}",provider:"${id.provider}"}`).join(`","`)}]);`;
    const name = `${actor.name}: ${data?.data?.name || data.label}`
    let macro = game.macros.find((m) => m.name === name && m.command === command);
    if (!macro) {
        macro = await Macro.create(
            {
                name: name,
                type: "script",
                img: img,
                command: command,
                flags: {"swse.itemMacro": true},
            },
            {displaySheet: false}
        );
    }

    await game.user.assignHotbarMacro(macro, slot);
}

function getNumericArray(start, end) {
    let array = [];
    for (let i = start; i <= end; i++) {
        array.push(i);
    }
    return array;
}

function getAvailableMacroSlot() {
    const user = game.users.get(game.userId)
    const hotbar = Object.entries(user.hotbar).filter(i => !!game.macros.get(i[1])).map(i => toNumber(i[0]))
    return getNumericArray(1, 50).find(i => !hotbar.includes(i))
}

export async function createAttackMacro(data, slot) {
    let actorId = data.actorId;

    const actor = getActorFromId(actorId);
    if (!actor) return;
    if (!data.attacks || data.attacks.length === 0) return;

    if (!slot) {
        slot = getAvailableMacroSlot();
    }

    let img = "systems/swse/icon/skill/default.png";

    if (data.img) {
        img = data.img;
    }

    let context = {};
    context.attacks = data.attacks;
    let attackName = data.attacks[0].name || data.label
    if (data.attacks.length > 1) {
        context.type = "fullAttack";
        attackName = "Full Attack";
    }


    const command = `game.swse.makeAttack(${JSON.stringify(context)});`;
    const name = `${actor.name}: ${attackName}`
    let macro = game.macros.find((m) => m.name === name && m.command === command);
    if (!macro) {
        macro = await Macro.create(
            {
                name: name,
                type: "script",
                img: img,
                command: command,
                flags: {"swse.itemMacro": true},
            },
            {displaySheet: false}
        );
    }

    await game.user.assignHotbarMacro(macro, slot);
}


function rollItem(actorId, itemIds) {
    const actor = getActorFromId(actorId);
    if (!actor) {
        const msg = `${actorId} not found`;
        console.warn(msg);
        return ui.notifications.error(msg);
    }
    return actor.rollOwnedItem(itemIds);
}

function rollAttack(actorId, itemIds) {
    const actor = getActorFromId(actorId);
    if (!actor) {
        const msg = `${actorId} not found`;
        console.warn(msg);
        return ui.notifications.error(msg);
    }
    return actor.attack.makeAttack({type: (itemIds.length === 1 ? "singleAttack" : "fullAttack"), items: itemIds});
}

export const getActorFromId = function (id) {
    let actor = null;
    if (id) {
        actor = game.actors?.tokens[id]
        if (!actor) actor = game.actors?.get(id);
        if (!actor) actor = game.data.actors.find(a => a._id === id);
    }
    if (!actor) {
        const speaker = ChatMessage.getSpeaker();
        if (speaker.token && !actor) actor = game.actors.tokens[speaker.token];
        if (!actor) actor = game.actors.get(speaker.actor);
    }
    return actor;
};

async function rollVariable(actorId, variable) {
    const actor = getActorFromId(actorId);
    if (!actor) {
        const msg = `${actorId} not found`;
        console.warn(msg);
        return ui.notifications.error(msg);
    }

    let rollStr = actor.resolvedVariables.get(variable);
    let label = actor.resolvedLabels.get(variable);
    let notes = actor.resolvedNotes.get(variable) || [];
    let flavor = label ? `${actor.name} rolls for ${label}!` : '';

    if (variable.startsWith('@Initiative') && game.combat) {
        await actor.rollInitiative({
            createCombatants: false,
            rerollInitiative: true
        })
    } else {
        let roll = new Roll(rollStr);
        await roll.roll()

        let content = buildRollContent(rollStr, roll, notes);


        let speaker = ChatMessage.getSpeaker();
        let messageData = {
            user: game.user.id,
            speaker,
            flavor,
            style: CONST.CHAT_MESSAGE_TYPES.ROLL,
            content,
            sound: CONFIG.sounds.dice,
            roll
        }

        let cls = getDocumentClass("ChatMessage");
        let msg = new cls(messageData);
        let rollMode = false;

        cls.create(msg, {rollMode});
    }
}

Hooks.on('renderChatMessage', (chatItem, html) => {
    html.find(".toggle-hide").on("click", (ev) => {
        let nodes = $(ev.currentTarget)[0].parentElement.childNodes;
        for (let node of nodes) {
            if (node?.classList?.contains("hideable")) {
                console.log(node);
                if (node.classList.contains("hide")) {
                    node.classList.remove("hide");
                } else {
                    node.classList.add("hide");
                }
            }
        }
    });
//add things you want to like to chat messages here
});