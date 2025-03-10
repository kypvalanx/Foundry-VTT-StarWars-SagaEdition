import {getInheritableAttribute} from "../attribute-helper.mjs";

async function selectItemFromArray(items, dialog, options) {
    const select = "SELECT_ID";
    const default1 = {
        callback: (html) => {
            const find = html.find(`#${select}`);
            const selectedId = find[0].value;
            return items.find(i => i.id === selectedId);
        },
    };
    let dialogConfig = {...default1, ...dialog}
    let itemOptions = items.map(item => {
        let fields = ""
        if (options.fields) {
            for (const field of options.fields) {
                let cursor = item;
                const val = field.split(".").forEach(tok => {
                    cursor = cursor[tok]
                })
                if (val) {
                    fields += ` (${val})`;
                }
            }
        }
        return `<option value="${item.id}">${item.name}${fields}</option>`
    });
    dialogConfig.content += `<select id="${select}">${itemOptions}</select>`
    return await Dialog.prompt(dialogConfig)
}

export class AmmunitionDelegate {
    constructor(item) {
        this.item = item;
    }

//as user i want to load ammo into a queueable weapon
    //as a user i want to be able to fire a queueable weapon and have it automatically reload
    //as a user i want to be able to unload ammunition from the queue and from the active spot
    get current() {
        let ammoQueueCapacity = 0;
        let ammoDeclarations = getInheritableAttribute({entity: this.item, attributeKey: "ammo", reduce: "VALUES"})
        let ammoResponse = [];

        for (const ammoDeclaration of ammoDeclarations) {
            let ammunition = AmmunitionDelegate.parseAmmunitionString(ammoDeclaration);
            let current = this.getAmmunition(ammunition.type);
            ammunition.current = current.value || 0;
            ammunition.queueCapacity = this.getQueueCapacity(ammunition.type);
            ammunition.queue = this.#buildQueue(current.queue, ammunition.queueCapacity);
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
        if (!isAppropriateAmmo(item, type)) return {fail: true}
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

    unQueueAmmunition(key, item) {

        //if so, attempt to add to the queue and show on parent sheet.
    }

    async ejectSpentAmmunition(type, force = true) {
        const ammunition = this.getAmmunition(type);

        if (force || ammunition.value === 0) {
            let queue = ammunition.queue
            if (queue.length > 0 && queue[0]) {
                let spentAmmo = this.item.parent.items.get(queue[0])
                spentAmmo.hide(false)
                await spentAmmo.addChanges([{key: "suffix", value: "(Spent)"},
                    {key: "spent", value: true}])

                await this.setAmmunition(type, {queue: queue.filter(id => id !== queue[0]), value:0});
            }
        }
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
        const ammunition = this.item.system.ammunition || {};
        return ammunition[type] || {};
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
//THIS SHOULD LOAD FROM THE QUEUE FIRST
        if (this.item.parent) {
            const availableAmmunition = this.item.parent.getAvailableAmmunition(type);

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
                //do something here with a popup
                console.error("INSUFFICIENT AMMO")

                new Dialog({
                    title: "Insufficient Ammunition",
                    content: `This character does not have any ammunition of type ${type} in they're inventory.`,
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
            } else {

                await this.setAmmunition(type, {value: this.getCapacity(type)});
            }
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
}

export function isAppropriateAmmo(item, type) {
    if (!item) return false;

    if(item.system.hidden){
        return false;
    }

    if (getInheritableAttribute({entity: item, attributeKey: "spent", reduce: "OR"})) {
        return false;
    }
    const inheritableAttribute = getInheritableAttribute({
        entity: item,
        attributeKey: "actsAs",
        reduce: "VALUES"
    });
    return item.name === type || inheritableAttribute.includes(type);
}