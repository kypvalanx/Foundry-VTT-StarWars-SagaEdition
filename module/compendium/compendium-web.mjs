import {getCompendium, getIndexEntriesByTypes} from "./compendium-util.mjs";

export class CompendiumWeb extends Application{

    static _pattern = /\s\([\w#\s]*\)/
    static _payloadPattern = new RegExp(CompendiumWeb._pattern, "g");

    constructor(...args) {
        super(...args);

        const app = this;

        Hooks.on("renderApplication", (event, target) => this.renderWeb(event, target))
    }

    async renderWeb(e, t) {

        let items = await getIndexEntriesByTypes( ['feat', 'talent'])


            const dependencyMap = {}
            // let html = "<ol>"
            for (const item of items.values()) {
                //html += `<li>${item.name}</li>`

                const prerequisites = CompendiumWeb.getPrerequisitesByType(item.system.prerequisite, ["FEAT", "TALENT"])

                if (prerequisites && prerequisites.length > 0) {
                    dependencyMap[item.name] = prerequisites;
                }
            }


            let groupings = new Set();
            let levels = new Map();
            let deepestLevel = 0;

            for (const item of items.values()) {

                const {level, lowestNodes, allNodes} = this.getWebLevel(dependencyMap, item.name, 0)

                deepestLevel = Math.max(deepestLevel, level)
                levels.set(item.name, level);

                const group = new Set(allNodes);

                groupings.add(group);
            }


            const root = t.find(".web-viewer");
            root.empty()
            for (const grouping of groupings.values()) {
                this.createGroup(root, grouping, deepestLevel, levels, items)
            }
    }

    createGroup(webviewer, grouping, deepestLevel, levels, items) {


        let webLevels = "";
        const itemsByLevel = [];
        for (const groupingElement of grouping) {
            const level = levels.get(groupingElement);
            if(itemsByLevel[level]){
                itemsByLevel[level].push(groupingElement);
            } else {
                itemsByLevel[level] = [groupingElement]
            }
        }

        const webGroup = $(`<div class="web-group"></div>`);
        for (let i = 0; i <= deepestLevel; i++) {

            const webLevel = $(`<div class="web-level"></div>`);
            for (const item of itemsByLevel[i] || []) {
                webLevel.append(this.getItemBlock(items.get(item)))
            }

            webGroup.append( webLevel);
        }

        webviewer.append(webGroup)
        //return `<div class="web-group">${webLevels}</div>`;
    }

    getItemBlock(item) {
        const itemBlock = $(`<div>${item.name}</div>`);

        itemBlock.attr("title", item.system.prerequisite?.text)
        itemBlock.attr("draggable", "true")
        itemBlock.attr("data-uuid", item.uuid)
        itemBlock.on("dragstart", (event) => this._onDragStart(event))

        const itemArea = $(`<div class="web-item"></div>`);
        itemArea.append(itemBlock)
        return itemArea;
    }

    _onDragStart(event) {
        const dataTransfer = event.dataTransfer || event.originalEvent.dataTransfer
        let dragData = JSON.parse(dataTransfer.getData("text/plain") || "{}");
        dragData.uuid = event.currentTarget.dataset.uuid
        dragData.type = "Item"

        dataTransfer.setData("text/plain", JSON.stringify(dragData));
    }

    static getPrerequisitesByType(prerequisite,  type = []) {
        if(!prerequisite){
            return [];
        }

        const prerequisites = [];
        if(type.includes(prerequisite.type)){
            prerequisites.push(prerequisite);
        } else if(prerequisite.children){
            for (const child of prerequisite.children) {
                prerequisites.push(...CompendiumWeb.getPrerequisitesByType(child, type))
            }
        }
        return prerequisites;
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            template: "systems/swse/templates/compendium/compendium-web.hbs",
            id: null,
            popOut: true,
            width: 300,
            height: "auto",
            classes: ["web", "swse"],
            resizable: true,
            baseApplication: "CompendiumWeb"
        });
    }
    get id() {
        return `${this.options.id}${this._original ? "-popout" : ""}`;
    }

    // async _render(force = false, options = {}) {
    //     console.log(options)
    //     return super._render(force, options);
    // }

    async getData(options={}) {
        return {
            cssId: this.id,
            cssClass: this.options.classes.join(" "),
            user: game.user
        };
    }



    getWebLevel(dependencyMap, name, level) {
        let dependencies = dependencyMap[name];
        if(!dependencies){
            let payloadFree = name.replace(CompendiumWeb._payloadPattern, "");
            dependencies = dependencyMap[payloadFree]
        }

        if(!dependencies){
            return {level, lowestNodes: [name], allNodes: [name]};
        }

        let resultingLevel = 0
        let nodes = [];
        let allNodes = [name];
        for (const dependency of dependencies) {
            const webLevel = this.getWebLevel(dependencyMap, dependency.requirement, level + 1)
            resultingLevel = Math.max(webLevel.level, resultingLevel);
            nodes.push(...webLevel.lowestNodes);
            allNodes.push(...webLevel.allNodes);
        }

        return {level: resultingLevel, lowestNodes: nodes.distinct(), allNodes: allNodes.distinct()}
    }
}