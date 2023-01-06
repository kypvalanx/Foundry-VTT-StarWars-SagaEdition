// Import Modules
import {SWSE} from "./config.js";
import {SWSEActor} from "./actor/actor.js";
import {SWSEActorSheet} from "./actor/actor-sheet.js";
import {SWSEManualActorSheet} from "./actor/manual-actor-sheet.js";
import {SWSEItem} from "./item/item.js";
import {SWSEItemSheet} from "./item/item-sheet.js";
import {refreshActors, registerSystemSettings} from "./settings/system.js";
import {registerHandlebarsHelpers} from "./settings/helpers.js";
import {deleteEmptyCompendiums, generateCompendiums} from "./compendium/generation.js";
import {getInheritableAttribute} from "./attribute-helper.js";
import {runTests} from "../module_test/runTests.js";
import {makeAttack} from "./actor/attack.js";
import {measureDistances} from "./measure.js";
import {SWSECompendiumBrowser} from "./compendium/compendium-browser.js";
import {SWSECompendiumDirectory} from "./compendium/compendium-directory.js";


Hooks.once('init', async function () {

    game.swse = {
        SWSEActor,
        SWSEItem,
        rollVariable,
        rollItem,
        makeAttack,
        generateCompendiums, deleteEmptyCompendiums,
        runTests,
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


    // Define custom Entity classes
    CONFIG.SWSE = SWSE;
    CONFIG.Actor.documentClass = SWSEActor;
    CONFIG.Item.documentClass = SWSEItem;

    registerSystemSettings();
    registerHandlebarsHelpers();
    if(game.settings.get("swse", "enableAdvancedCompendium")){
        CONFIG.ui.compendium = SWSECompendiumDirectory;
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


    await loadTemplates([
        'systems/swse/templates/actor/manual/parts/actor-summary.hbs',
        'systems/swse/templates/actor/manual/parts/actor-ability-scores.hbs',
        'systems/swse/templates/actor/manual/parts/actor-health.hbs',
        'systems/swse/templates/actor/manual/parts/actor-shields.hbs',
        'systems/swse/templates/actor/parts/actor-affiliations.hbs',
        'systems/swse/templates/actor/parts/actor-summary.hbs',
        'systems/swse/templates/actor/parts/actor-weapon-armor-summary.hbs',
        'systems/swse/templates/actor/parts/actor-skills.hbs',
        'systems/swse/templates/actor/manual/parts/actor-skills.hbs',
        'systems/swse/templates/actor/parts/actor-ability-scores.hbs',
        'systems/swse/templates/actor/parts/actor-health.hbs',
        'systems/swse/templates/actor/parts/actor-shields.hbs',
        'systems/swse/templates/actor/parts/actor-condition.hbs',
        'systems/swse/templates/actor/parts/actor-portrait.hbs',
        'systems/swse/templates/actor/parts/actor-darkside.hbs',
        'systems/swse/templates/actor/parts/actor-defenses.hbs',
        'systems/swse/templates/actor/parts/actor-defense-block.hbs',
        'systems/swse/templates/actor/manual/parts/actor-defenses.hbs',
        'systems/swse/templates/actor/manual/parts/actor-defense-block.hbs',
        'systems/swse/templates/actor/parts/equipable-item.hbs',
        'systems/swse/templates/actor/parts/item-list.hbs',
        'systems/swse/templates/actor/vehicle/vehicle-summary.hbs',
        'systems/swse/templates/actor/vehicle/vehicle-stations.hbs',
        'systems/swse/templates/actor/vehicle/vehicle-station.hbs',
        'systems/swse/templates/actor/vehicle/vehicle-skills.hbs',
        'systems/swse/templates/actor/vehicle/vehicle-attacks-summary.hbs',
        'systems/swse/templates/actor/parts/attack/attack-dialogue.hbs',
        'systems/swse/templates/actor/parts/attack/single-attack.hbs',
        'systems/swse/templates/actor/parts/attack/weapon-block.hbs',
        'systems/swse/templates/item/parts/levels.hbs',
        'systems/swse/templates/item/parts/providedItem.hbs',
        'systems/swse/templates/item/parts/providedItems.hbs',
        'systems/swse/templates/item/parts/summary.hbs',
        'systems/swse/templates/item/parts/prerequisites.hbs',
        'systems/swse/templates/item/parts/prerequisite.hbs',
        'systems/swse/templates/item/parts/attribute.hbs',
        'systems/swse/templates/item/parts/attributes.hbs',
        'systems/swse/templates/item/parts/mode.hbs',
        'systems/swse/templates/actor/vehicle/crew-quality.hbs',
        'systems/swse/templates/actor/vehicle/vehicle-template.hbs',
        'systems/swse/templates/actor/parts/actor-type.hbs',
        'systems/swse/templates/actor/vehicle/vehicle-health.hbs',
        'systems/swse/templates/credits/credit-chip.hbs',
        'systems/swse/templates/settings/setting.hbs']);

});


Hooks.on("ready", function () {
    game.generated = {};
    game.generated.exoticWeapons = [];
    game.generated.exoticMeleeWeapons = [];
    game.generated.exoticRangedWeapons = [];

    game.packs.forEach(pack => {
        pack.getIndex().then(index => {
            index.forEach(i => pack.getDocument(i._id)
                .then(entity => {
                    ///list all exotic weapons
                    if (entity.type === 'weapon') {
                        let subTypeKey = entity._source.system.subtype.toLowerCase();
                        if (subTypeKey.includes('exotic')) {
                            game.generated.exoticWeapons.push(entity.name);
                            if(subTypeKey.includes('melee')){
                                game.generated.exoticMeleeWeapons.push(entity.name);
                            } else {
                                game.generated.exoticRangedWeapons.push(entity.name);
                            }
                        }
                    } else if (entity.type === 'template') {
                        let exoticWeaponTypes = getInheritableAttribute({
                            entity,
                            attributeKey: "exoticWeapon",
                            reduce: "VALUES"
                        })
                        game.generated.exoticWeapons.push(...exoticWeaponTypes);
                    }
                }))
        });
    });
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
String.prototype.titleCase = function () {
    if (!this.length) return this;
    return this.toLowerCase().split(' ').reduce((parts, word) => {
        if (!word) return parts;
        const title = word.replace(word[0], word[0].toUpperCase());
        parts.push(title);
        return parts;
    }, []).join(' ').split('(').reduce((parts, word) => {
        if (!word) return parts;
        const title = word.replace(word[0], word[0].toUpperCase());
        parts.push(title);
        return parts;
    }, []).join('(');
};

//
// String.prototype.titleCase = function() {
//   if (!this.length) return this;
//   return this.toLowerCase().split(' ').map(function (word) {
//     return word.replace(word[0], word[0].toUpperCase());
//   }).join(' ').split('(').map(function (word) {
//     return word.replace(word[0], word[0].toUpperCase());
//   }).join('(');
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
    let macro = game.macros.entities.find((m) => m.name === name && m.command === command);
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
    return actor.attack({type: (itemIds.length === 1 ? "singleAttack" : "fullAttack"), items: itemIds});
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