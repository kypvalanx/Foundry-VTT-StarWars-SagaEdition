// Import Modules
import { SWSE } from "./config.js";
import {SWSEActor} from "./actor/actor.js";
import {SWSEActorSheet} from "./actor/actor-sheet.js";
import {SWSEItem} from "./item/item.js";
import {SWSEItemSheet} from "./item/item-sheet.js";
import {registerSystemSettings} from "./settings/system.js";
import {generateCompendiums} from "./compendium/generation.js";


Hooks.once('init', async function() {

  game.swse = {
    SWSEActor,
    SWSEItem,
    rollVariable,
    rollItem,
    rollAttack,
    generateCompendiums
  };

  /**
   * Set an initiative formula for the system
   * @type {String}
   */
  CONFIG.Combat.initiative = {
    formula: "1d20",
    decimals: 2
  };

  // Define custom Entity classes
  CONFIG.SWSE = SWSE;
  CONFIG.Actor.entityClass = SWSEActor;
  CONFIG.Item.entityClass = SWSEItem;

  registerSystemSettings();


  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("swse", SWSEActorSheet, { makeDefault: true });
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("swse", SWSEItemSheet, { makeDefault: true });

  // If you need to add Handlebars helpers, here are a few useful examples:
  Handlebars.registerHelper('concat', function() {
    let outStr = '';
    for (const arg of Object.keys(arguments)) {
      if (typeof arguments[arg] != 'object') {
        outStr += arguments[arg];
      }
    }
    return outStr;
  });

  Handlebars.registerHelper('toLowerCase', function(str) {
    return str.toLowerCase();
  });

  Handlebars.registerHelper('notEmpty', function (array, options) {
    console.log(array, options)
    return (array && array.length > 0)? options.fn():"";
  })
});

Handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
  return (arg1 === arg2) ? options.fn(this) : options.inverse(this);
});


Handlebars.registerHelper('unlessBoth', function(arg1, arg2, options) {
  return !(arg1 && arg2) ? options.fn(this) : options.inverse(this);
});

Handlebars.registerHelper('sum', function(arg1, arg2, options) {
  return parseInt(arg1) + parseInt(arg2)
});

Hooks.on("ready", async function() {
  await generateCompendiums();

  game.generated = {};
  game.generated.exoticWeapons= [];
  let pack = game.packs.get('world.swse-items');
  pack.getIndex().then( index => {
  for(let i of index){
    pack.getEntity(i._id).then(entity =>{
    if(entity.data.type === 'weapon'){
      for(let category of entity.data.data.categories){
        if(category.toLowerCase().includes('exotic')){
          game.generated.exoticWeapons.push(entity.name);
          break;
        }
      }
    }});
  }})
});

if(!Map.prototype.computeIfAbsent){
  Map.prototype.computeIfAbsent = function (key, mappingFunction) {
    if(!this.has(key)){
      this.set(key, mappingFunction.call(key))
    }
    return this.get(key);
  };
}


Hooks.on("hotbarDrop", (bar, data, slot) => {

  if (data.type.toLowerCase() !== "skill") return true;
  createSkillMacro(data, slot);
  return false;
});
Hooks.on("hotbarDrop", (bar, data, slot) => {

  if (data.type.toLowerCase() !== "ability") return true;
  createAbilityMacro(data, slot);
  return false;
});

Hooks.on("hotbarDrop", (bar, data, slot) => {

  if (data.type.toLowerCase() !== "attack") return true;
  createAttackMacro(data, slot);
  return false;
});

Hooks.on("hotbarDrop", (bar, data, slot) => {
  if (data.type.toLowerCase() !== "item") return true;
  createItemMacro(data, slot);
  return false;
});


async function createSkillMacro(data, slot) {
  let actorId = data.actor;

  const actor = getActorFromId(actorId);
  if (!actor) return;

  const command = `game.swse.rollVariable("${actorId}", "${(data.skill)}");`;
  const name = `${actor.name}: ${(data.label)}`
  let macro = game.macros.entities.find((m) => m.name === name && m.command === command);
  if (!macro) {
    macro = await Macro.create(
        {
          name: name,
          type: "script",
          img: "systems/swse/icon/skill/default.png",
          command: command,
          flags: { "swse.skillMacro": true },
        },
        { displaySheet: false }
    );
  }

  await game.user.assignHotbarMacro(macro, slot);
}

async function createAbilityMacro(data, slot) {
  let actorId = data.actor;
console.log(data)
  const actor = getActorFromId(actorId);
  if (!actor) return;

  const command = `game.swse.rollVariable("${actorId}", "@${data.ability}");`;
  const name = `${actor.name}: ${(data.ability)}`
  let macro = game.macros.entities.find((m) => m.name === name && m.command === command);
  if (!macro) {
    macro = await Macro.create(
        {
          name: name,
          type: "script",
          img: "systems/swse/icon/skill/default.png",
          command: command,
          flags: { "swse.skillMacro": true },
        },
        { displaySheet: false }
    );
  }

  await game.user.assignHotbarMacro(macro, slot);
}

async function createAttackMacro(data, slot) {
  let actorId = data.actor;
  let attackLabel = data.label;

  const actor = getActorFromId(actorId);
  if (!actor) return;
  let img = "systems/swse/icon/skill/default.png";
  console.log(data)
  if(data.img){
    img = data.img;
  }

  //const skillInfo = actor.getSkillInfo(skillId);
  const command = `game.swse.rollAttack("${actorId}", "${actorId} ${attackLabel}");`;
  const name = `${actor.name}: ${attackLabel}`
  let macro = game.macros.entities.find((m) => m.name === name && m.command === command);
  if (!macro) {
    macro = await Macro.create(
        {
          name: name,
          type: "script",
          img: img,
          command: command,
          flags: { "swse.attackMacro": true },
        },
        { displaySheet: false }
    );
  }

  await game.user.assignHotbarMacro(macro, slot);
}

async function createItemMacro(data, slot) {
  let actorId = data.actorId;

  const actor = getActorFromId(actorId);
  if (!actor) return;

  let img = "systems/swse/icon/skill/default.png";

  if(data.data.img){
    img = data.data.img;
  }


  const command = `game.swse.rollItem("${actorId}", "${(data.data._id)}");`;
  const name = `${actor.name}: ${(data.data.name)}`
  let macro = game.macros.entities.find((m) => m.name === name && m.command === command);
  if (!macro) {
    macro = await Macro.create(
        {
          name: name,
          type: "script",
          img: img,
          command: command,
          flags: { "swse.itemMacro": true },
        },
        { displaySheet: false }
    );
  }

  await game.user.assignHotbarMacro(macro, slot);
}

export const getActorFromId = function (id) {
  const speaker = ChatMessage.getSpeaker();
  let actor = null;
  if (id) {
    actor = game.actors.tokens[id];
    if (!actor) actor = game.actors.get(id);
  }
  if (speaker.token && !actor) actor = game.actors.tokens[speaker.token];
  if (!actor) actor = game.actors.get(speaker.actor);
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

function rollItem(actorId, itemId) {
  const actor = getActorFromId(actorId);
  if (!actor) {
    const msg = `${actorId} not found`;
    console.warn(msg);
    return ui.notifications.error(msg);
  }

  return actor.rollItem(itemId);
}

function rollAttack(actorId, attackId) {
  const actor = getActorFromId(actorId);
  if (!actor) {
    const msg = `${actorId} not found`;
    console.warn(msg);
    return ui.notifications.error(msg);
  }

  return actor.rollAttack(attackId);
}

Hooks.on('renderChatMessage', (chatItem, html) => {
  html.find(".toggle-hide").on("click", (ev) => {
    let nodes = $(ev.currentTarget)[0].parentElement.childNodes;
    for(let node of nodes){
      if(node?.classList?.contains("hideable")){
        console.log(node);
        if(node.classList.contains("hide")){
          node.classList.remove("hide");
        } else {
          node.classList.add("hide");
        }
      }
    }
  });
//add things you want to like to chat messages here
});