// Import Modules
import {initializeStatusEffects, SWSE} from "./common/config.mjs";
import {SWSEActor} from "./actor/actor.mjs";
import {SWSEActorSheet} from "./actor/actor-sheet.mjs";
import {SWSEManualActorSheet} from "./actor/manual-actor-sheet.mjs";
import {SWSEItem} from "./item/item.mjs";
import {SWSEItemSheet} from "./item/item-sheet.mjs";
import {refreshActors, registerSystemSettings} from "./settings/system.mjs";
import {registerHandlebarsHelpers} from "./settings/helpers.mjs";
import {deleteEmptyCompendiums, generateCompendiums} from "./compendium/generation.mjs";
import {measureDistances} from "./measure.mjs";
import {SWSECompendiumBrowser} from "./compendium/compendium-browser.mjs";
import {toNumber} from "./common/util.mjs";
import {SWSEActiveEffect} from "./active-effect/active-effect.mjs";
import {SWSEActiveEffectConfig} from "./active-effect/active-effect-config.mjs";
import {registerTestSuites} from "../module_test/test-suites.test.mjs";
import {makeAttack} from "./actor/attack/attackDelegate.mjs";
import {SWSETokenDocument} from "./token/token-document.js";


Hooks.once('quenchReady',  (quench) => {
    console.warn("It's Quenching time!")
    registerTestSuites(quench);
})



Hooks.once('init', async function () {

    game.swse = {
        SWSEActor,
        SWSEItem,
        rollVariable,
        rollItem,
        makeAttack,
        generateCompendiums, deleteEmptyCompendiums,
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
        formula: "1d20 + @skills.initiative.value",
        decimals: 2
    };

    CONFIG.testMode=document.location.search ==="?test=true";


    // Define custom Entity classes
    CONFIG.SWSE = SWSE;
    CONFIG.Actor.documentClass = SWSEActor;
    CONFIG.Item.documentClass = SWSEItem;
    CONFIG.Token.documentClass = SWSETokenDocument;
    //CONFIG.Token.objectClass = SWSEToken;

    CONFIG.ActiveEffect.documentClass = SWSEActiveEffect;
    //CONFIG.ActiveEffect.sheetClasses["Active Sheet Classes"] = SWSEActiveEffectConfig;

    DocumentSheetConfig.registerSheet(ActiveEffect, "swse", SWSEActiveEffectConfig, { makeDefault: true })
    //DocumentSheetConfig.unregisterSheet(ActiveEffect, "core", ActiveEffectConfig)

    registerSystemSettings();
    registerHandlebarsHelpers();
    initializeStatusEffects(CONFIG)
    if(game.settings.get("swse", "enableAdvancedCompendium")){
        //CONFIG.ui.compendium = SWSECompendiumDirectory;
    }

    // Create compendium browsers
    // game.swse.compendiums = {
    //   spells: new CompendiumBrowser({ type: "spells" })
    // };

    // Register sheet application classes
    Actors.unregisterSheet("core", ActorSheet);
    Actors.registerSheet("swse", SWSEActorSheet, {makeDefault: true});
    Actors.registerSheet("swse", SWSEManualActorSheet, {makeDefault: false});
    Items.unregisterSheet("core", ItemSheet);
    Items.registerSheet("swse", SWSEItemSheet, {makeDefault: true});
    //ActiveEffects.reg


    await loadTemplates([
        'systems/swse/templates/actor/manual/parts/actor-summary.hbs',
        'systems/swse/templates/actor/manual/parts/actor-ability-scores.hbs',
        'systems/swse/templates/actor/manual/parts/actor-health.hbs',
        'systems/swse/templates/actor/manual/parts/actor-shields.hbs',
        'systems/swse/templates/actor/parts/actor-affiliations.hbs',
        'systems/swse/templates/actor/parts/actor-summary.hbs',
        'systems/swse/templates/actor/parts/actor-weapon-armor-summary.hbs',
        'systems/swse/templates/actor/parts/actor-skills.hbs',
        'systems/swse/templates/actor/parts/actor-classes.hbs',
        'systems/swse/templates/actor/manual/parts/actor-skills.hbs',
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
        'systems/swse/templates/item/parts/modifier.hbs',
        'systems/swse/templates/item/parts/attribute.hbs',
        'systems/swse/templates/item/parts/attributes.hbs',
        'systems/swse/templates/item/parts/mode.hbs',
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
        'systems/swse/templates/common/select.hbs']);

});

function getHitOptionHTML(target, attack, tokenId) {
    let hit = target.system.defense.reflex.total <= attack;

    return `<h4>${target.name}</h4>
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
    let damageString = `${baseDamage}`

    let content = `<div class="subtle-panel">
<div>Attack Roll: ${attack}</div>
<div>${type.titleCase()}: ${damageString}${damageTypeString}</div>
</div>`;
    for(let targetToken of targetTokens.values()){
        //targetToken.update
        let actor = targetToken.document.getActor()
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
                callback: (html)=>{
                    let targets = html.find("[data-type=target]")
                    for(let target of targets){

                        let targetHit = $(target).find("[data-attribute=target-hit]")[0]?.checked

                        let additionalDR = $(target).find("[data-attribute=additional-damage-resistance]")[0].value
                        let bypassDR = $(target).find("[data-attribute=bypass-damage-resistance]")[0]?.checked
                        let additionalShields = $(target).find("[data-attribute=additional-shield-rating]")[0].value
                        let bypassShields =  $(target).find("[data-attribute=bypass-shields]")[0]?.checked
                        let affectDamageThreshold =  $(target).find("[data-attribute=bypass-damage-threshold]")[0]?.checked


                        if(!targetHit){return;}

                        let targetActor = actorMap[target.dataset.target];
                        if(type === "heal"){
                            targetActor.applyHealing({heal: baseDamage})
                        } else {
                            targetActor.applyDamage({
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




Hooks.on("ready", function () {
    game.generated = {};
    game.generated.exoticWeapons = [];
    game.generated.exoticMeleeWeapons = [];
    game.generated.exoticRangedWeapons = [];

    // game.packs.forEach(pack => {
    //     pack.getIndex().then(index => {
    //         index.forEach(i => pack.getDocument(i._id)
    //             .then(entity => {
    //                 ///list all exotic weapons
    //                 if (entity.type === 'weapon') {
    //                     let subTypeKey = entity._source.system.subtype.toLowerCase();
    //                     if (subTypeKey.includes('exotic')) {
    //                         game.generated.exoticWeapons.push(entity.name);
    //                         if(subTypeKey.includes('melee')){
    //                             game.generated.exoticMeleeWeapons.push(entity.name);
    //                         } else {
    //                             game.generated.exoticRangedWeapons.push(entity.name);
    //                         }
    //                     }
    //                 } else if (entity.type === 'template') {
    //                     let exoticWeaponTypes = getInheritableAttribute({
    //                         entity,
    //                         attributeKey: "exoticWeapon",
    //                         reduce: "VALUES"
    //                     })
    //                     game.generated.exoticWeapons.push(...exoticWeaponTypes);
    //                 }
    //             }))
    //     });
    // });
});

Hooks.on("canvasInit", function () {
    canvas.grid.diagonalRule = game.settings.get("swse", "enable5105Measurement");
    SquareGrid.prototype.measureDistances = measureDistances;
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

export async function createAttackMacro(data, slot) {
    let actorId = data.actorId;

    const actor = getActorFromId(actorId);
    if (!actor) return;
    if (!data.attacks || data.attacks.length === 0) return;

    if (!slot) {
        let user = game.users.get(game.userId)
        let hotbar = Object.entries(user.data.hotbar).filter(i => !!i[1]).map(i => i[0])
        let availableKeys = getNumericArray(1, 50).filter(i => !hotbar.includes(`${i}`))
        slot = Math.min(...availableKeys);
    }

    let img = "systems/swse/icon/skill/default.png";

    if (data.img) {
        img = data.img;
    }

    let context = {};
    context.attacks = data.attacks;
    let attackName = data.attacks[0].name
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

function rollVariable(actorId, variable) {
    const actor = getActorFromId(actorId);
    if (!actor) {
        const msg = `${actorId} not found`;
        console.warn(msg);
        return ui.notifications.error(msg);
    }

    return actor.rollVariable(variable);
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