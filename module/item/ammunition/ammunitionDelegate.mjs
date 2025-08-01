import {getInheritableAttribute} from "../../attribute-helper.mjs";
import {SWSEItemSheet} from "../item-sheet.mjs";
import {selectItemFromArray} from "../../common/helpers.mjs";

export async function onAmmunition(event){
    event.preventDefault();
    const a = event.currentTarget;
    const ammoType = a.dataset.ammoType;
    const action = a.dataset.action;
    const itemId = a.dataset.itemId;
    const item = ammunitionItem.call(this, itemId);
    switch (action) {
        case "ammunition-reload":
            await item.ammunition.reload(ammoType);
            break;
        case "ammunition-eject":
            await item.ammunition.eject(ammoType);
            break;
        case "ammunition-increase":
            await item.ammunition.increaseAmmunition(ammoType);
            break;
        case "ammunition-decrease":
            await item.ammunition.decreaseAmmunition(ammoType);
            break;
    }
}

function ammunitionItem(itemId) {
    if(this instanceof SWSEItemSheet){
        return this.object
    }
    let split = itemId.split(".");
    return this.object.items.get(itemId) || this.object.items.get(split[split.length - 1]);
}

export class ItemAmmunitionDelegate {
    /**
     * Constructs an instance of the class with a specified item.
     *
     * @param {SWSEItem} item - The item to be initialized or assigned to this instance.
     * @return {Object} A new instance of the class containing the specified item.
     */
    constructor(item) {
        /**
         * Represents an item or a property within the current context.
         * It is used for accessing or manipulating values associated with this specific reference.
         */
        this.item = item;
    }

    isAppropriateAmmunition(type){
        if (!this.item) return false;

        if(this.item.system.hidden){
            return false;
        }

        if (getInheritableAttribute({entity: this.item, attributeKey: "spent", reduce: "OR"})) {
            return false;
        }
        const inheritableAttribute = getInheritableAttribute({
            entity: this.item,
            attributeKey: "actsAs",
            reduce: "VALUES"
        });
        return this.item.name === type || inheritableAttribute.includes(type);
    }
//as user i want to load ammo into a queueable weapon
    //as a user i want to be able to fire a queueable weapon and have it automatically reload
    //as a user i want to be able to unload ammunition from the queue and from the active spot
    get current() {
        let ammoDeclarations = getInheritableAttribute({entity: this.item, attributeKey: "ammo", reduce: "VALUES"})
        let ammoResponse = [];

        for (const ammoDeclaration of ammoDeclarations) {
            let ammunition = ItemAmmunitionDelegate.parseAmmunitionString(ammoDeclaration);
            let current = this.getAmmunition(ammunition.type);
            ammunition.current = current.value || 0;
            ammunition.queueCapacity = this.getQueueCapacity(ammunition.type);
            ammunition.queue = this.#buildQueue(current.queue, ammunition.queueCapacity);
            ammunition.itemId = this.item.id;
            ammunition.next = this.#nextRound(ammunition.queue, ammunition.type)
            ammoResponse.push(ammunition);
        }

        return ammoResponse;
    }

    static parseAmmunitionString(ammoString) {
        const toks = ammoString.split(":")
        if (toks.length === 2) {
            return {type: toks[0], capacity: toks[1]}
        }

        console.warn("UNKNOWN AMMO STRING", ammoString);
        return {error: "UNKNOWN AMMO STRING", ammoString}
    }


    async queueAmmunition(type, item) {
        if (!item || !item.ammunition.isAppropriateAmmunition(type)) return {fail: true}

        let queue = this.getAmmunition(type).queue || [];
        if (this.ammoCapacity(type) <= queue.length) {
            return {fail: true, message: "NO ROOM IN QUEUE"}
        }

        if (item.system.quantity === 1 || !item.system.quantity) {
            await this.#addToQueue(type, item);
            item.hide();
        } else {
            await item.decreaseQuantity()
            let copy = JSON.parse(JSON.stringify(item));
            let added = (await this.item.parent.createEmbeddedDocuments("Item", [copy]))[0];
            await added.decreaseQuantity(added.system.quantity - 1)
            await this.#addToQueue(type, added);
            added.hide()
        }
        return {fail: false}
    }

    async #addToQueue(type, item) {
        let queue = this.getAmmunition(type).queue || [];
        queue.push(item.id);
        await this.setAmmunition(type, {queue})
    }

    ammoCapacity(type) {
        let ammoCapacity = 0;
        for (const value of getInheritableAttribute({
            entity: this.item,
            attributeKey: "ammoCapacity",
            reduce: "VALUES"
        })) {
            if (value.split(":")[0] === type) {
                ammoCapacity += parseInt(value.split(":")[1]);
            }
        }
        return Math.max(1, ammoCapacity);
    }

    async ejectSpentAmmunition(type, force = true) {
        const ammunition = this.getAmmunition(type);

        let queue = ammunition.queue || []
        if (!((force || ammunition.value === 0) && queue.length > 0 && queue[0])) {
            return;
        }
        let spentAmmo = this.item.parent.items.get(queue[0])
        spentAmmo.hide(false)
        await spentAmmo.addChanges([
            {key: "suffix", value: "(Spent)"},
            {key: "spent", value: true}
        ])
        const capacity = queue.length > 1 ? this.getCapacity(type) : 0;
        await this.setAmmunition(type, {queue: queue.filter(id => id !== queue[0]), value: capacity});
    }

    async decreaseAmmunition(type, count = 1) {
        const remainingRounds = this.getAmmunition(type).value || 0;

        if (count > remainingRounds) {
            return {status: "NOT ENOUGH AMMO", remainingRounds};
        }
        let remaining = remainingRounds - count
        await this.setAmmunition(type, {value: remaining});

        return {status: "SUCCESS", remaining}
    }

    async setAmmunition(type, ammunition) {
        let data = {};
        data[`system.ammunition.${type}`] = ammunition
        await this.item.safeUpdate(data);
    }

    getAmmunition(type) {
        const ammunition = this.ammunition;
        return ammunition[type] || {};
    }

    get ammunition(){
        return this.item.system.ammunition || {};
    }

    async increaseAmmunition(type, count = 1) {
        let currentAmmo = this.getAmmunition(type).value || 0;

        const remaining = count + currentAmmo;
        if (remaining > this.getCapacity(type)) {
            return {status: "MORE THAN CAPACITY", remaining};
        }

        await this.setAmmunition(type, {value: remaining});

        return {status: "SUCCESS", remaining}
    }

    async eject(type){
        const queue = this.getAmmunition(type).queue;
        for (const queuedAmmo of queue) {
            let ammoItem = this.item.parent.items.get(queuedAmmo);
            ammoItem?.hide(false);
        }
        await this.setAmmunition(type, {queue: []});
    }

    async reload(type) {
        let queue = this.getAmmunition(type).queue || [];
        if (this.ammoCapacity(type) <= queue.length) {
            return;
        }

//THIS SHOULD LOAD FROM THE QUEUE FIRST
        if (!this.item.parent) {
            return;
        }

        const availableAmmunition = this.item.parent.ammunitionDelegate.getAvailableAmmunition(type);
        let ammoItem;
        if (availableAmmunition.length === 1) {
            ammoItem = availableAmmunition[0];
        } else if (availableAmmunition.length > 1) {
            ammoItem = await selectItemFromArray(availableAmmunition, {
                title: "Select Ammo to Load",
                content: "Select Ammo to Load"
            }, {fields: ["system.quantity"]});
        }
        let result = await this.queueAmmunition(type, ammoItem);
        if (result.fail) {
            if (result.message === "NO ROOM IN QUEUE") {
                new Dialog({
                    title: "Weapon is Full",
                    content: `There is no additional space in the ${this.item.name} for ${ammoItem.name}.`,
                    buttons: {
                        ok: {
                            label: "Ok", callback: () => {
                                return false;
                            }
                        }
                    },
                    default: "ok"
                }).render(true)
            } else {
                //do something here with a popup
                console.error("INSUFFICIENT AMMO")

                new Dialog({
                    title: "Insufficient Ammunition",
                    content: `You does not have any ${type} ammunition in your.  Clicking "Ignore" will reload your weapon, but weapons with special ammunition might not work as expected.`,
                    buttons: {
                        ok: {
                            label: "Ok", callback: () => {
                                return false;
                            }
                        },
                        ignore: {
                            label: "Ignore", callback: async () => {

                                await this.setAmmunition(type, {value: this.getCapacity(type)});
                                return true;
                            }
                        }
                    },
                    default: "ok"
                }).render(true)
            }
        } else {
            await this.setAmmunition(type, {value: this.getCapacity(type)});
        }
    }

    getCapacity(type) {
        let ammoItem = getInheritableAttribute({entity: this.item, attributeKey: "ammo", reduce:"VALUES"})
            .find(i => i.split(":")[0] === type)
        return ammoItem ? parseInt(ammoItem.split(":")[1]) : 0;
    }

    getQueueCapacity(type) {
        let ammoItem = getInheritableAttribute({entity: this.item, attributeKey: "ammoCapacity", reduce:"VALUES"})
            .find(i => i.split(":")[0] === type)
        return ammoItem ? parseInt(ammoItem.split(":")[1]) : 0;
    }

    #buildQueue(queue, queueCapacity) {
        if(!queue) return [];
        let generatedQueue = [];
        queueCapacity = Math.max(queueCapacity, 1)
        for (let i = 0; i < queueCapacity; i++) {
            generatedQueue.push(this.#buildQueueItem(queue[i]))
        }
        return generatedQueue;
    }

    #buildQueueItem(queueElement) {
        if(queueElement) {
            let item = this.item.parent.items.get(queueElement);
            if(item){
                return {empty: false, name: item.name, id: item.id};
            }
        }
        return {empty: true};
    }

    #nextRound(queue, type) {
        if(queue && queue.length > 0 && queue[0]){
            return queue[0].name
        }
        return type;
    }

    get hasAmmunition() {
        return (this.item?.changes || []).filter(c => c.key === "ammo").length > 0;
    }

}


export class ActorAmmunitionDelegate {

    constructor(actor) {
        this.actor = actor;
    }

    get ammunition(){
        return this.actor.getCached("ammunition", () => {
            return this.actor.itemTypes['equipment'].filter(item => item.system.subtype === "Ammunition");
        })
    }

    getAvailableAmmunition(type) {
        return this.actor.items.filter(item => {
            return item.ammunition.isAppropriateAmmunition(type) && !item.system?.hide ;
        });
    }
}