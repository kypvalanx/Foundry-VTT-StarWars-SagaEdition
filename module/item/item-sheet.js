/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
import {SWSEItem} from "./item.js";

export class SWSEItemSheet extends ItemSheet {

  /**
   * A convenience reference to the Item entity
   * @type {SWSEItem}
   */
  get item() {
    return this.object;
  }

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
  getData(options) {
    return super.getData(options);
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
      let li = $(ev.currentTarget);
      if(!li.hasClass("item")) {
        li = li.parents(".item");
      }
      const item = this.actor.items.get(li.data("itemId"));
      item.sheet.render(true);
    });

    // Delete Inventory Item
    html.find('.item-delete').click(ev => {
      const li = $(ev.currentTarget).parents(".item");
      let itemToDelete = this.item.data.data.items.filter(item => item._id === li.data("itemId"))[0];
      let ownedItem = this.item.actor.items.get(itemToDelete._id);
      this.item.revokeOwnership(ownedItem);
    });

    //AddItemAttribute
    html.find('.attribute-add').click(ev => {
      let attributes = this.item.data.data.attributes
      let cursor = 0;
      while (attributes[cursor]){
        cursor++;
      }
      this.createItemAttribute(cursor)
    });
    //deleteItemAttribute
    html.find('.attribute-delete').click(ev => {
      let id = $(ev.currentTarget).data('attributeId')
      let changedAttributes = {};
      let cursor = 0;
      for(const [key, value] of Object.entries(this.item.data.data.attributes)){
        if(key !== `${id}`){
          changedAttributes[cursor] = value;
        } else {
          changedAttributes[cursor] = null;
        }
        cursor++;
      }

      this.item.setAttributes(changedAttributes);
      this.render();
    });

    html.find('.value-plus').click(ev => {
      let target = $(ev.currentTarget)
      let name = ev.currentTarget.name;
      let toks = name.split('.');
      let cursor = this.object.data;
      for(let tok of toks){
        cursor = cursor[tok];
      }
      let update = {}
      update[name] = cursor+1;
      if(typeof target.data("high") === "number"){
        update[name] = Math.min(update[name], target.data("high"));
      }
      this.object.update(update);
    });

    html.find('.value-minus').click(ev => {
      let target = $(ev.currentTarget)
      let name = ev.currentTarget.name;
      let toks = name.split('.');
      let cursor = this.object.data;
      for(let tok of toks){
        cursor = cursor[tok];
      }
      let update = {}
      update[name] = cursor-1;
      if(typeof target.data("low") === "number"){
        update[name] = Math.max(update[name], target.data("low"));
      }
      this.object.update(update);
    });

    // Add general text box (span) handler
    html.find("span.text-box.direct").on("click", (event) => {
      this._onSpanTextInput(event, null, "text"); // this._adjustItemPropertyBySpan.bind(this)
    });


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
    let dragData = {};
    const li = event.currentTarget;

    // Create drag data
    dragData.itemId= this.item.id;
    dragData.owner= this.item.actor;
    dragData.actorId= this.item.actor.id;
    dragData.sceneId= this.item.actor.isToken ? canvas.scene?.id : null;
    dragData.tokenId= this.item.actor.isToken ? this.actor.token.id : null;

    // Owned Items
    if ( li.dataset.itemId ) {
      dragData.modId= li.dataset.itemId;
      dragData.type = "Item";
    }

    event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
    //super._onDragStart(event);
  }
  /* -------------------------------------------- */
  /** @override */
  async _onDrop(event) {
    // Try to extract the droppedItem
    //console.log(event)
    let droppedItem;
    try {
      droppedItem = JSON.parse(event.dataTransfer.getData("text/plain"));

      //console.log(droppedItem)
    } catch (err) {
      return false;
    }

    let actor = this.actor;
    let ownedItem = actor.items.get(droppedItem.data._id);

    let itemType = this.item.type;
    // if(droppedItem.data.type ==='upgrade'){
    //   if((itemType === 'armor' && ownedItem.modSubType === "Armor Upgrade") ||
    //       (itemType === 'weapon' && ownedItem.modSubType === "Weapons Upgrade")){
    //     await this.item.takeOwnership(ownedItem);
    //   }
    //
    // }else
      if(droppedItem.data.type ==='template'){

      if(this._canAttach(droppedItem.data.data.attributes.application)){
        await this.item.takeOwnership(ownedItem);
      } else{
        //debugger
      }

    }else{
      if((itemType === 'armor' && ownedItem.modSubType === "Armor Upgrade") ||
          (itemType === 'weapon' && ownedItem.modSubType === "Weapons Upgrade")){
        await this.item.takeOwnership(ownedItem);
      }
      console.log("can't add this to an item");
    }
  }

  _canAttach(application) {
    if(!application){
      return true;
    }
    application = (application + "").trim();

    let hasParens = this.hasParens(application);
    if(hasParens){
      return this._canAttach(hasParens[1]);
    }

    let ors = this._findZeroDepth(application, " OR ");
    if(ors.length > 0){
      for(let or of ors){
        for(let i = or.start; i < or.end; i++){
          application = application.substring(0, i)+ 'X' + application.substring(i+1)
        }
      }

      let toks = application.split("XXXX");
      let isTruthy = false;
      for(let tok of toks){
        isTruthy = isTruthy || this._canAttach(tok)
      }
      return isTruthy;
    }

    let ands = this._findZeroDepth(application, " AND ");
    if(ands.length>0){      for(let or of ors){
      for(let i = ands.start; i < ands.end; i++){
        application = application.substring(0, i)+ 'X' + application.substring(i+1)
      }
    }

      let toks = application.split("XXXXX");
      let isTruthy = true;
      for(let tok of toks){
        isTruthy = isTruthy && this._canAttach(tok)
      }
      return isTruthy;
    }

    if(application === 'WEAPON'){
      return this.object.data.type === 'weapon';
    }
    if(application === 'ARMOR'){
      return this.object.data.type === 'armor';
    }
    if(application === 'ION'){
      return this.object.data.data.weapon.type === 'Energy (Ion)';
    }
    if(application === 'STUN'){
      return this.object.data.data.weapon.stun?.isAvailable;
    }
    return false;
  }

  hasParens(application) {
    if(!application.startsWith("(")){
      return false;
    }
    let depth = 0;
    for(let i = 0; i < application.length; i++){
      let char = application.charAt(i);
      if(char === '('){
        depth++;
      }else if (char === ')'){
        depth--;
      }
      if(depth === 0){
        return application.length-1 === i;
      }

    }

    return false;
  }

  _findZeroDepth(term , search) {
    let found = [];
    let depth = 0;
    for(let i = 0; i < term.length; i++){
      let char = term.charAt(i);
      if(char === '('){
        depth++;
      } else if(char === ')'){
        depth--;
      }else if(term.substring(i).startsWith(search) && depth === 0){
        found.push({start:i, end:i+search.length})
      }
    }
    return found;
  }

  createItemAttribute(cursor) {
    let content = `<label>Key:</label>
            <input id="key"><br/>
        <label>Type:</label>
            <select name="type" id="type">
                <option>String</option>
                <option>Boolean</option>
                <option>List</option>
                <option>Object</option>
            </select><br/>
        <label>Value:</label>
            <input id="value">
        `;

    let options = {
      title: "New Attribute",
          content,
        callback: async (html) => {
          let key = html.find("#key")[0].value;
          let type = html.find("#type")[0].value;
          let value = html.find("#value")[0].value;
          this.item.setAttribute(cursor, {key, type, value});
    }
    }

    Dialog.prompt(options);
  }
}
