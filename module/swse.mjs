// Import Modules
import {initializeStatusEffects, SWSE} from "./common/config.mjs";
import {buildRollContent, SWSEActor} from "./actor/actor.mjs";
import {SWSEActorSheet} from "./actor/actor-sheet.mjs";
import {SWSEManualActorSheet} from "./actor/manual-actor-sheet.mjs";
import {SWSEItem} from "./item/item.mjs";
import {SWSEItemSheet} from "./item/item-sheet.mjs";
import {registerSystemSettings} from "./settings/core.mjs";
import {registerHandlebarsHelpers} from "./common/helpers.mjs";
import {clearEmptyCompendiums, deleteEmptyCompendiums, generateCompendiums} from "./compendium/generation.mjs";
import {measureDistances} from "./measure.mjs";
import {SWSECompendiumBrowser} from "./compendium/compendium-browser.mjs";
import {toNumber} from "./common/util.mjs";
import {SWSEActiveEffect} from "./active-effect/active-effect.mjs";
import {SWSEActiveEffectConfig} from "./active-effect/active-effect-config.mjs";
import {registerTestSuites} from "../module_test/test-suites.test.mjs";
import {makeAttack} from "./actor/attack/attackDelegate.mjs";
import {getInheritableAttribute} from "./attribute-helper.mjs";
import {SWSETokenHud} from "./token/token-hud.mjs";
import {initializeDragRuler} from "./module-support/drag-ruler.mjs";
import {initializePolyglot} from "./module-support/polyglot.mjs";

import {initializeCompendiumButtons} from "./compendium/compendium-web.mjs";


Hooks.once('quenchReady',  (quench) => {
    //console.warn("It's Quenching time!")
    registerTestSuites(quench);
})


Hooks.once('init', async function () {

    game.swse = {
        SWSEActor,
        SWSEItem,
        rollVariable,
        rollItem,
        makeAttack,
        generateCompendiums, deleteEmptyCompendiums, clearEmptyCompendiums, deleteActorsByName,
        toggleActiveEffect,
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
    CONFIG.Token.hudClass = SWSETokenHud;
    CONFIG.ActiveEffect.documentClass = SWSEActiveEffect;

    //CONFIG.debug.hooks = true

    DocumentSheetConfig.registerSheet(ActiveEffect, "swse", SWSEActiveEffectConfig, { makeDefault: true })

    registerSystemSettings();
    registerHandlebarsHelpers();
    initializeStatusEffects(CONFIG)
    initializeDragRuler();
    initializePolyglot();
    initializeCompendiumButtons();

    Hooks.on("updateCombat", (combat, updateData, updateOptions)=>{
        //console.log(combat.combatant.actor.name)
        if(updateOptions.direction > 0){
            //combat.nextCombatant.actor.startOfTurn(updateData);
        }

    })

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


async function selectTargetList(originallyTargeted, currentlyTargeted) {
    if (!(originallyTargeted.length > 0 && currentlyTargeted.length > 0)) {
        return originallyTargeted.length > 0 ? originallyTargeted : currentlyTargeted;
    }
    const sortedOriginal = originallyTargeted.map(a=> a.name).sort();
    const sortedCurrent = currentlyTargeted.map(a=> a.name).sort();
    if(sortedOriginal.every((val, index) => val === sortedCurrent[index])){
        return originallyTargeted;
    }
    let response = await openTargetListResolutionDialog(sortedOriginal, sortedCurrent)

    return response === "Original" ? originallyTargeted : currentlyTargeted;
}

async function openTargetListResolutionDialog(sortedOriginal,sortedCurrent) {
    return new Promise((resolve) => {
        new Dialog({
            title: "Target Selection",
            content: `<p>Do you want to attack the originally selected targets or the current targets?</p>
<div class="flex flex-row">
<div><ul><li>`+ sortedOriginal.join("</li><li>")+`</li></ul></div>
<div><ul><li>`+ sortedCurrent.join("</li><li>")+`</li></ul></div>
</div>`,
            buttons: {
                original: {
                    label: "Original",
                    callback: () => resolve("Original")
                },
                current: {
                    label: "Current",
                    callback: () => resolve("Current")
                }
            },
            default: "original",
            close: () => resolve("Original") // Optional: handle dialog close without button press
        }).render(true);
    });
}

const applyAttack = async (event) => {
    let element = $(event.currentTarget);
    let damageType = element.data("damage-type")
    let type = element.data("type")
    let attack = element.data("attack")
    let damage = element.data("damage")
    try{
        const attackSummary = element.data("attackSummary");
        //let attackSummary = JSON.parse(text)

        console.log(attackSummary)
    } catch (e) {
        ui.notifications.error("Something went wrong with this button.  Please check the logs and either post it in the discord, open a Github Issue, or shout into the void.")
        console.error("this is probably the log you're looking for.  JSON Parsing issues? shame.", text, e)
    }

    let actorIds = element.data("targetIds").split(", ")
    let targetActors = game.actors.filter(actor => actorIds.includes(actor.id))
    //let currentlyTargeted = [...game.user.targets.map(token => token.actor)]
    //let targetActors = await selectTargetList(originallyTargeted, currentlyTargeted);
    let actorMap = {};

    let damageTypeString = !!damageType ? ` (${damageType})` : ""
    let baseDamage = toNumber(damage);
    if(type === "half"){
        baseDamage /= 2
    } else if(type === "double") {
        baseDamage *= 2
    }
    let damageString = `${Math.floor(baseDamage)}`

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
let dataset = $(element).dataset



    new Dialog({
        title: "Resolve Attacks",
        content: `<div class="subtle-panel">
<div>Attack Roll: ${attack}</div>
<div>${type.titleCase()}: ${damageString}${damageTypeString}</div>
</div>`,
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
        return true;
    }

    if(message.flags.swse.context.type === "attack-roll"){
        html.find('[data-action="apply-attack"]').click(applyAttack.bind(this));
        // html.find('[data-action="apply-attack"]').addEventListener('contextmenu', event => {
        //     event.preventDefault();
        //
        //     // Optional: Position the menu at the mouse pointer
        //     const menu = new ContextMenu(
        //         { event }, // Required event for positioning
        //         [ // Menu options
        //             {
        //                 name: "Inspect",
        //                 icon: '<i class="fas fa-search"></i>',
        //                 callback: () => ui.notifications.info("Inspecting...")
        //             },
        //             {
        //                 name: "Attack",
        //                 icon: '<i class="fas fa-crosshairs"></i>',
        //                 callback: () => ui.notifications.info("Preparing attack...")
        //             },
        //             {
        //                 name: "Cancel",
        //                 icon: '<i class="fas fa-times"></i>',
        //                 callback: () => console.log("Canceled.")
        //             }
        //         ]
        //     );
        //     menu.render(true);
        // });

    }
    if(message.flags.swse.context.type === "damage-result"){
        let activeGM = game.users.activeGM
        if(game.user.id === activeGM.id){
            let targetActor = game.actors.get(message.flags.swse.context.damageTarget)
            targetActor.resolveDamage(message.flags.swse.context.damage, message.timestamp)
        }
    }

    return true;
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
                            } else {
                                let exoticWeaponTypes = getInheritableAttribute({
                                    entity,
                                    attributeKey: "exoticWeapon",
                                    reduce: "VALUES"
                                })
                                game.generated.weapon.exoticWeapons.push(...exoticWeaponTypes);
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


Hooks.on("hotbarDrop", async (bar, data, slot) => {

    let type = data.type.toLowerCase();
    if (type === "skill" || type === "ability") {
        await createVariableMacro(data, slot);
        return false;

    }
    if (type === "item") {
        await createItemMacro(data, slot);
        return false;

    }
    if (type === "attack") {
        await createAttackMacro(data, slot);
        return false;

    } if(type === "activeeffect"){
        await createEffectToggleMacro(data, slot);
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

export async function createAttackMacro(data, slot = getAvailableMacroSlot()) {
    let context = {
        actorId: data.actorId,
        attackKeys: data.attackKeys,
        attacks: data.attacks
    };
    const command = `game.swse.makeAttack(${JSON.stringify(context)});`;
    const name = `${data.actorName}: ${(data.label)}`
    if (game.macros.find((m) => m.name === name && m.command === command)) {
        return;
    }
    let macro = await Macro.create(
        {
            name: name,
            type: "script",
            img: data.img || "systems/swse/icon/skill/default.png", //should refer constant
            command: command,
            flags: {"swse.itemMacro": true},
        },
        {displaySheet: false}
    );
    await game.user.assignHotbarMacro(macro, slot);
}

export async function createEffectToggleMacro(data, slot) {
    let actorId = data.actorId;

    const actor = getActorFromId(actorId);
    if (!actor) return;

    if (!slot) {
        slot = getAvailableMacroSlot();
    }

    let img = "systems/swse/icon/skill/default.png";

    const effect = actor.applicableEffects().find(e =>e.id === data.effectId)

    if (effect.img) {
        img = effect.img;
    }
    if (data.img) {
        img = data.img;
    }


    const command = `game.swse.toggleActiveEffect("${data.actorId}", "${data.effectId}");`;
    const name =  effect.parent instanceof SWSEItem ? `${actor.name}: ${effect.parent.name}: ${effect.name}` : `${actor.name}: ${effect.name}`
    let macro = game.macros.find((m) => m.name === name && m.command === command);
    if (!macro) {
        macro = await Macro.create(
            {
                name: name,
                type: "script",
                img: img,
                command: command,
                flags: {"swse.effectToggle": true},
            },
            {displaySheet: false}
        );
    }

    await game.user.assignHotbarMacro(macro, slot);
}

function toggleActiveEffect(actorId, effectId){
    game.actors.get(actorId)?.toggleStatusEffect(effectId)
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