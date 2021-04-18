/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
import {SWSEItem} from "./item.js";

export class SWSEItemSheet extends ItemSheet {

  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["swse", "sheet", "item"],
      width: 520,
      height: 480,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }]
    });
  }

  /** @override */
  get template() {
    const path = "systems/swse/templates/item";
    // Return a single sheet for all item types.
    //return `${path}/item-sheet.hbs`;
    // Alternatively, you could use the following return statement to do a
    // unique item sheet by type, like `weapon-sheet.html`.

    console.log(this.item)

    let type = this.item.data.type;
    if(type === 'species'){
      return `${path}/species-sheet.hbs`;
    }    
    if(type === 'feat'){
      return `${path}/feat-sheet.hbs`;
    }    
    if(type === 'talent'){
      return `${path}/talent-sheet.hbs`;
    }
    if(type === 'armor'){
      return `${path}/item-sheet.hbs`;
    }
    if(type === 'weapon'){
      return `${path}/item-sheet.hbs`;
    }
    if(type === 'equipment'){
      return `${path}/item-sheet.hbs`;
    }
    if(type === 'upgrade'){
      return `${path}/item-sheet.hbs`;
    }
    
    return `${path}/feat-sheet.hbs`;
    //return `${path}/${this.item.data.type}-sheet.html`; //TODO add sheets for each type
  }

  /* -------------------------------------------- */

  /** @override */
  getData() {
    const data = super.getData();
    return data;
  }

  /* -------------------------------------------- */

  /** @override */
  setPosition(options = {}) {
    const position = super.setPosition(options);
    const sheetBody = this.element.find(".sheet-body");
    const bodyHeight = position.height - 192;
    sheetBody.css("height", bodyHeight);
    return position;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    html.find('.tab').each((i, li) => {
      li.addEventListener("drop", (ev) => this._onDrop(ev));
    });

    // Item Dragging
    html.find("li.draggable").each((i, li) => {
      if (li.classList.contains("inventory-header")) return;
      li.setAttribute("draggable", true);
      li.addEventListener("dragstart", (ev) => this._onDragStart(ev), false);
    });

    // Update Inventory Item
    html.find('.item-edit').click(ev => {
      const li = $(ev.currentTarget).parents(".item");
      console.log(li);
      const item = new SWSEItem(this.item.getOwnedItem(li.data("itemId")));
      console.log(item);
      item.sheet.render(true);
    });

    // Delete Inventory Item
    html.find('.item-delete').click(ev => {
      const li = $(ev.currentTarget).parents(".item");
      let itemToDelete = this.item.data.data.items.filter(item => item._id === li.data("itemId"))[0];
      let ownedItem = this.item.actor.getOwnedItem(itemToDelete._id);
      console.log(ownedItem)
      this.item.revokeOwnership(ownedItem);
    });

    html.find('.value-plus').click(ev => {
      let name = ev.currentTarget.name;
      let toks = name.split('.');
      let cursor = this.object.data;
      for(let tok of toks){
        cursor = cursor[tok];
      }
      let update = {}
      update[name] = cursor+1;
      this.object.update(update);
    });

    html.find('.value-minus').click(ev => {
      let name = ev.currentTarget.name;
      let toks = name.split('.');
      let cursor = this.object.data;
      for(let tok of toks){
        cursor = cursor[tok];
      }
      let update = {}
      update[name] = cursor-1;
      this.object.update(update);
    });

    // html.find('.add-attack').click(ev => {
    //   this.object.addAttack().then(this.render(true));
    // });
    //
    // html.find('.remove-attack').click(ev => {
    //   const li = $(ev.currentTarget).parents(".attribute");
    //   this.object.removeAttack(li.data("attribute")).then(this.render(true));
    // });
    //
    // html.find('.add-category').click(ev => {
    //   this.object.addCategory().then(this.render(true));
    //   console.log(this.object)
    // });
    //
    // html.find('.remove-category').click(ev => {
    //   const li = $(ev.currentTarget).parents(".attribute");
    //   this.object.removeCategory(li.data("attribute")).then(this.render(true));
    //   console.log(this.object)
    // });


    // html.find('form').each((i, li) => {
    //       li.addEventListener("drop", (ev) => this._onDrop(ev));
    //     });


    // Roll handlers, click handlers, etc. would go here.
  }


  /** @override */
  _canDragStart(selector) {
    return true;
  }
  /* -------------------------------------------- */
  /** @override */
  _canDragDrop(selector) {
    return true;
  }

  /** @override */
  _onDragStart(event) {
    const li = event.currentTarget;

    // Create drag data
    const dragData = {
      itemId: this.item.id,
      owner: this.item.actor,
      sceneId: this.item.actor.isToken ? canvas.scene?.id : null,
      tokenId: this.item.actor.isToken ? this.actor.token.id : null,
      modId: li.dataset.itemId
    };

    // Owned Items
    if ( li.dataset.itemId ) {
      const item = this.item.data.mods.find(i => {return i._id ===li.dataset.itemId});
      dragData.type = "Item";
      dragData.data = item;
    }

    event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
    //super._onDragStart(event);
  }
  /* -------------------------------------------- */
  /** @override */
  async _onDrop(event) {
    // Try to extract the data
    //console.log(event)
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData("text/plain"));

      //console.log(data)
    } catch (err) {
      return false;
    }
    if(data.data.type ==='upgrade'){
      let itemType = this.item.type;
      console.log(data)
      if((itemType === 'armor' && data.data.data.upgrade.type.includes("Armor Upgrade")) ||
          (itemType === 'weapon' && data.data.data.upgrade.type.includes("Weapon Upgrade"))){
        let actor = this.actor;
        let ownedItem = actor.getOwnedItem(data.data._id);
        await this.item.takeOwnership(ownedItem);
      }

    }else{
      console.log("can't add this to an item");
    }
  }
}
