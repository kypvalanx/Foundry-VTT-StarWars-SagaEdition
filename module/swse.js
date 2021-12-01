// Import Modules
import {SWSE} from "./config.js";
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
    // rollAttack,
    generateCompendiums
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
  Handlebars.registerHelper('toTitleCase', function(str) {
    return str.titleCase();
  });

  Handlebars.registerHelper('notEmpty', function (array, options) {
    console.log(array, options)
    return (array && array.length > 0)? options.fn():"";
  })

  Handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
    return (arg1 === arg2) ? options.fn(this) : options.inverse(this);
  });

  Handlebars.registerHelper('ifLast', function(arg1, arg2, options) {
    return (arg1 + 1 === arg2.length) ? options.fn(this) : options.inverse(this);
  });

  Handlebars.registerHelper('unlessEquals', function(arg1, arg2, options) {
    return (arg1 !== arg2) ? options.fn(this) : options.inverse(this);
  });


  Handlebars.registerHelper('unlessBoth', function(arg1, arg2, options) {
    return !(arg1 && arg2) ? options.fn(this) : options.inverse(this);
  });

  Handlebars.registerHelper('sum', function(arg1, arg2, options) {
    let number = parseInt(arg1|| 0) + parseInt(arg2||0);
    return number
  });

  Handlebars.registerHelper('times', function(n, block) {
    let accum = '';
    for(let i = 0; i < n; ++i)
      accum += block.fn(i);
    return accum;
  });


  await loadTemplates([
      'systems/swse/templates/actor/parts/actor-affiliations.hbs',
    'systems/swse/templates/actor/parts/actor-summary.hbs',
    'systems/swse/templates/actor/parts/actor-weapon-armor-summary.hbs',
    'systems/swse/templates/actor/parts/actor-skills.hbs',
    'systems/swse/templates/actor/parts/actor-attributes.hbs',
    'systems/swse/templates/actor/parts/actor-health.hbs',
    'systems/swse/templates/actor/parts/actor-condition.hbs',
    'systems/swse/templates/actor/parts/actor-portrait.hbs',
    'systems/swse/templates/actor/parts/actor-darkside.hbs',
    'systems/swse/templates/actor/parts/actor-defenses.hbs',
    'systems/swse/templates/item/parts/attributes.hbs',
    'systems/swse/templates/item/parts/mode.hbs']);

});


Hooks.on("ready", async function() {
  await generateCompendiums();

  game.generated = {};
  game.generated.exoticWeapons= [];
  let pack = await game.packs.find(p => p.metadata.label === "SWSE Items");
  pack.getIndex().then( index => {
  for(let i of index){
    pack.getDocument(i._id).then(entity =>{
    if(entity.data.type === 'weapon'){
      for(let category of entity.data._source.data.categories){
        if(category.value.toLowerCase().includes('exotic')){
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

Array.prototype.distinct = function() {
  return this.filter((value, index, self) => self.indexOf(value) === index)
}


String.prototype.titleCase = function() {
  if (!this.length) return this;
  return this.toLowerCase().split(' ').map(function (word) {
    return word.replace(word[0], word[0].toUpperCase());
  }).join(' ').split('(').map(function (word) {
    return word.replace(word[0], word[0].toUpperCase());
  }).join('(');
};


Hooks.on("hotbarDrop", (bar, data, slot) => {

  let type = data.type.toLowerCase();
  if (type === "skill" || type === "ability") {
    createVariableMacro(data, slot).then(() => {});
    return false;

  }
  if (type === "attack" || type === "item") {
    createItemMacro(data, slot).then(() => {});
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
          flags: { "swse.skillMacro": true },
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

  if(data.img){
    img = data.img;
  }
  let id;
  if(data.label === 'Unarmed Attack'){
    id = 'Unarmed Attack';
  } else {
    id = data.data._id;
  }

  const command = `game.swse.rollItem("${actorId}", "${id}");`;
  const name = `${actor.name}: ${data?.data?.name || data.label}`
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

  return actor.rollOwnedItem(itemId);
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
export const dieSize = [2, 3, 4, 6, 8, 10, 12];
export const sizeArray = ["Colossal", "Gargantuan", "Huge", "Large", "Medium", "Small", "Tiny", "Diminutive", "Fine"];
export const d20 = "1d20";