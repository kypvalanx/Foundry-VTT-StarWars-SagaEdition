import {getIndexEntriesByTypes} from "./compendium-util.mjs";
import {meetsPrerequisites} from "../prerequisite.mjs";

const SPECIES = [{"value": "Abinyshi", "display": "Abinyshi"}, {
    "value": "Farghul",
    "display": "Farghul"
}, {"value": "Ryn", "display": "Ryn"}, {"value": "Gungan", "display": "Gungan"}, {
    "value": "Assembler",
    "display": "Assembler"
}, {"value": "Charon", "display": "Charon"}, {"value": "Weequay", "display": "Weequay"}, {
    "value": "Gamorrean",
    "display": "Gamorrean"
}, {"value": "Terrelian", "display": "Terrelian"}, {"value": "Ranat", "display": "Ranat"}, {
    "value": "Dashade",
    "display": "Dashade"
}, {"value": "Gossam", "display": "Gossam"}, {"value": "Amaran", "display": "Amaran"}, {
    "value": "Codru-Ji",
    "display": "Codru-Ji"
}, {"value": "Defel", "display": "Defel"}, {"value": "Gurlanin", "display": "Gurlanin"}, {
    "value": "Klatooinian",
    "display": "Klatooinian"
}, {"value": "Kudon", "display": "Kudon"}, {"value": "Nelvaanian", "display": "Nelvaanian"}, {
    "value": "Ranth",
    "display": "Ranth"
}, {"value": "Shistavanen", "display": "Shistavanen"}, {"value": "Squib", "display": "Squib"}, {
    "value": "Kissai",
    "display": "Kissai"
}, {"value": "Sith Offshoot", "display": "Sith Offshoot"}, {
    "value": "Zuguruk",
    "display": "Zuguruk"
}, {"value": "Yuuzhan Vong", "display": "Yuuzhan Vong"}, {"value": "Bothan", "display": "Bothan"}, {
    "value": "Kaleesh",
    "display": "Kaleesh"
}, {"value": "Kilmaulsi", "display": "Kilmaulsi"}, {
    "value": "Rattataki",
    "display": "Rattataki"
}, {"value": "Trogodile", "display": "Trogodile"}, {"value": "Verpine", "display": "Verpine"}, {
    "value": "Mon Calamari",
    "display": "Mon Calamari"
}, {"value": "Trandoshan", "display": "Trandoshan"}, {"value": "Cerean", "display": "Cerean"}, {
    "value": "Kaminoan",
    "display": "Kaminoan"
}, {"value": "Bith", "display": "Bith"}, {"value": "Chadra-Fan", "display": "Chadra-Fan"}, {
    "value": "Bimm",
    "display": "Bimm"
}, {"value": "Ho'Din", "display": "Ho'Din"}, {"value": "Gran", "display": "Gran"}, {
    "value": "Trodatome",
    "display": "Trodatome"
}, {"value": "Rodisar", "display": "Rodisar"}, {"value": "Quarren", "display": "Quarren"}, {
    "value": "Zabrak",
    "display": "Zabrak"
}, {"value": "Arcona", "display": "Arcona"}, {"value": "Veknoid", "display": "Veknoid"}, {
    "value": "Yarkora",
    "display": "Yarkora"
}, {"value": "Utai", "display": "Utai"}, {"value": "Chagrian", "display": "Chagrian"}, {
    "value": "Iktotchi",
    "display": "Iktotchi"
}, {"value": "Givin", "display": "Givin"}, {"value": "Kel Dor", "display": "Kel Dor"}, {
    "value": "Elomin",
    "display": "Elomin"
}, {"value": "Chiss", "display": "Chiss"}, {"value": "Ebruchi", "display": "Ebruchi"}, {
    "value": "Huralok",
    "display": "Huralok"
}, {"value": "Togorian", "display": "Togorian"}, {"value": "Zygerrian", "display": "Zygerrian"}, {
    "value": "Siniteen",
    "display": "Siniteen"
}, {"value": "Cyclorrian", "display": "Cyclorrian"}, {
    "value": "Imroosian",
    "display": "Imroosian"
}, {"value": "Togruta", "display": "Togruta"}, {"value": "Devaronian", "display": "Devaronian"}, {
    "value": "Pa'lowick",
    "display": "Pa'lowick"
}, {"value": "Gand", "display": "Gand"}, {"value": "Herglic", "display": "Herglic"}, {
    "value": "Blood Carver",
    "display": "Blood Carver"
}, {"value": "Noghri", "display": "Noghri"}, {"value": "Taung", "display": "Taung"}, {
    "value": "Nikto",
    "display": "Nikto"
}, {"value": "Falleen", "display": "Falleen"}, {"value": "Hysalrian", "display": "Hysalrian"}, {
    "value": "Thisspiasian",
    "display": "Thisspiasian"
}, {"value": "Nimbanel", "display": "Nimbanel"}, {"value": "Paigun", "display": "Paigun"}, {
    "value": "Mirialan",
    "display": "Mirialan"
}, {"value": "Ithorian", "display": "Ithorian"}, {"value": "Ewok", "display": "Ewok"}, {
    "value": "Duros",
    "display": "Duros"
}, {"value": "Neimoidian", "display": "Neimoidian"}, {"value": "Kubaz", "display": "Kubaz"}, {
    "value": "Hutt",
    "display": "Hutt"
}, {"value": "Omwati", "display": "Omwati"}, {"value": "Twi'lek", "display": "Twi'lek"}, {
    "value": "Tusken Raider",
    "display": "Tusken Raider"
}, {"value": "Snivvian", "display": "Snivvian"}, {"value": "Devlikk", "display": "Devlikk"}, {
    "value": "Didynon",
    "display": "Didynon"
}, {"value": "Sephi", "display": "Sephi"}, {"value": "Firrerreo", "display": "Firrerreo"}, {
    "value": "Rodian",
    "display": "Rodian"
}, {"value": "Sullustan", "display": "Sullustan"}, {"value": "Reesarian", "display": "Reesarian"}, {
    "value": "Baragwin",
    "display": "Baragwin"
}, {"value": "Aqualish", "display": "Aqualish"}, {"value": "Ortolan", "display": "Ortolan"}, {
    "value": "Cathar",
    "display": "Cathar"
}, {"value": "Wookiee", "display": "Wookiee"}, {"value": "Aki-Aki", "display": "Aki-Aki"}, {
    "value": "Selkath",
    "display": "Selkath"
}, {"value": "Miraluka", "display": "Miraluka"}, {"value": "Yevetha", "display": "Yevetha"}, {
    "value": "Catuman",
    "display": "Catuman"
}, {"value": "Hrakian", "display": "Hrakian"}, {"value": "Human", "display": "Human"}, {
    "value": "Octeroid",
    "display": "Octeroid"
}, {"value": "Zeltron", "display": "Zeltron"}, {"value": "Trianii", "display": "Trianii"}, {
    "value": "Kessurian",
    "display": "Kessurian"
}, {"value": "Tridactyl", "display": "Tridactyl"}, {
    "value": "Dybrinthe",
    "display": "Dybrinthe"
}, {"value": "Geonosian", "display": "Geonosian"}, {"value": "Lannik", "display": "Lannik"}, {
    "value": "Yuzzum",
    "display": "Yuzzum"
}, {"value": "Draethos", "display": "Draethos"}, {"value": "Jawa", "display": "Jawa"}, {
    "value": "Teedo",
    "display": "Teedo"
}, {"value": "Massassi", "display": "Massassi"}, {"value": "Murachaun", "display": "Murachaun"}, {
    "value": "Ubese",
    "display": "Ubese"
}, {"value": "Polis Massan", "display": "Polis Massan"}, {
    "value": "Chevin",
    "display": "Chevin"
}, {"value": "T'landa Til", "display": "T'landa Til"}, {"value": "Medical Droid", "display": "Medical Droid"}]

const SKIP_LINK = ["Weapon Focus", "Dual Weapon Mastery I", "Double Attack", "Martial Arts I", "Dodge", "Weapon Proficiency", "Skill Focus", "Point-Blank Shot"];

export class CompendiumWeb extends Application {

    static _pattern = /\s\([\w#\s]*\)/
    static _payloadPattern = new RegExp(CompendiumWeb._pattern, "g");

    /**
     *
     * @type {[{mutation: function(*): function(*): void,
     *          multiple: boolean,
     *          name: string,
     *          options: function(): [{display: string, value: string}],
     *          selector: string,
     *          type: string}]}
     */
    filters = [
        {
            type: "select",
            multiple: false,
            selector: "provider-filter",
            name: "Filter by Provider Source",
            mutation: (value) => {
                return (index) => {
                    index.hide ||= !index.possibleProviders?.includes(value);
                }
            },
            options: async (types) => {
                return [...await getIndexEntriesByTypes(types)].flatMap(([key, item]) => item.system.possibleProviders).distinct().filter(i => !!i).map(book => {
                    return {value: book, display: book}
                });
            }
        },
        {
            type: "select",
            multiple: false,
            selector: "species-filter",
            name: "Filter by species",
            mutation: (value, exclude) => {
                return (index) => {
                    if (exclude) {
                        index.hide ||= index.species?.includes(value);
                    } else {
                        index.hide ||= !index.species?.includes(value);
                    }
                }
            },
            options: async (types) => {

                return [...await getIndexEntriesByTypes(types)].flatMap(([key, item]) => CompendiumWeb.getPrerequisitesByType(item.system.prerequisite, ["SPECIES"])).map(p => p.requirement).distinct().map(s => {return {display:s, value:s}})

                //return SPECIES;
            },
            allowExclude: true
        },
        {
            type: "select",
            multiple: false,
            selector: "actor-filter",
            name: "Filter out by actor stats",
            mutation:  (value) => {
                return (index) => {
                    const actor = game.actors.get(value)
                    index.hide ||= !(meetsPrerequisites(actor, index.prerequisite)).doesFail;
                    //index.actorHas
                }
            },
            options:  () => {
                return game.actors.filter(a => a.canUserModify(game.user, 'update')).map(a => {
                    return {value: a.id, display: a.name}
                });
            }
        },
        {
            type: "number",
            multiple: false,
            selector: "base-attack-bonus-filter",
            name: "Filter by Base Attack Bonus",
            mutation: (value) => {
                return (index) => {
                    index.hide ||= !(index.baseAttackBonus <= parseInt(value));
                }
            }
        },
        {
            type: "select",
            multiple: false,
            selector: "book-filter",
            name: "Filter by Book",
            mutation: (value) => {
                return (index) => {
                    index.hide ||= index.book !== value;
                }
            },
            options: async (types) => {
                return [...await getIndexEntriesByTypes(types)].map(([key, item]) => item.system.source).distinct().filter(i => !!i).map(book => {
                    return {value: book, display: book.replace("Star Wars Saga Edition", "SWSE").replace("Clone Wars Saga Edition", "CWSE")}
                });
            },
            allowExclude: true
        },
        {
            type: "boolean",
            multiple: false,
            selector: "homebrew-filter",
            name: "Filter out Homebrew",
            mutation: (value) => {
                return (index) => {
                    if(value){
                        index.hide ||= index.homebrew;
                    }
                }
            }
        }
    ]

    constructor(...args) {
        super(...args);

        Hooks.on("renderApplication", async (event, target) => {
            if(event.appId !== this.appId){ //is this really the best way to do this?  weird that applications aren't more contained
                return;
            }

            this.options = args[0];
            this.target = target;

            this.types = ['feat', 'talent']

            if (this.options?.types) {
                this.types = this.options.types;
            }

            await this.addFilters(target,this.types)
            await this.populateFiltersFromArguments(target, this.options);
            await this.renderWeb(event, target, this.types);

            //currently disabled.  will allow arrows to be drawn in the future
            //await this.drawArrows(target)
        })
    }

    async renderWeb(e, target, types) {


        let items = await getIndexEntriesByTypes(types)

        //console.log(items)
        //const skipLinking = this.getSkippedUuids(items);

        const dependencyMap = new Map()
        const invertedDependencyMap = new Map();
        const itemFilterMeta = new Map();

        const rootItems = [];

        for (const item of items.values()) {

            itemFilterMeta.set(item.uuid, this.getMeta(item, target))
            const prerequisites = CompendiumWeb.getPrerequisitesByType(item.system.prerequisite, types)

            if (prerequisites && prerequisites.length > 0) {
                //dependencyMap[item.name] = prerequisites;
                for (const prerequisite of prerequisites) {
                    const requiredItem = this.getItemByPrerequisite(prerequisite, items);
                    if (requiredItem && item) {
                        if (invertedDependencyMap.has(requiredItem.uuid)) {
                            invertedDependencyMap.get(requiredItem.uuid).push(item.uuid)
                        } else {
                            invertedDependencyMap.set(requiredItem.uuid, [item.uuid])
                        }

                        if (dependencyMap.has(item.uuid)) {
                            dependencyMap.get(item.uuid).push(requiredItem.uuid)
                        } else {
                            dependencyMap.set(item.uuid, [requiredItem.uuid])
                        }
                    }
                }
            } else {
                rootItems.push(item);
            }
        }

///combine getmeta with this filtering block in the future.  for now it works and i want to release  perfect is enemy of good and all that


        for (const filter of this.filters) {
            const input = target.find(`.${filter.selector}.value`);
            const value = filter.type === "boolean" ? input.is(":checked") : input.val()
            let exclude = target.find(`.${filter.selector}.exclude`).is(":checked")
            if (value) {
                const test = filter.mutation(value, exclude);
                [...itemFilterMeta].map(([key, meta]) => meta).forEach(test);
            }
        }

        const skipLinking = [...invertedDependencyMap]
            .filter(([key, values]) => values && values.filter(value => this.shouldDraw(value, itemFilterMeta, invertedDependencyMap)).length > 10)
            .map(([key, values]) => key)


        //console.log(skipLinking, skipLinking.length, skipLinking2, skipLinking2.length)

        const rootUuids = rootItems.map(r => r.uuid);
        const groupedIds = []
        const groups = []

        for (const rootUuid of rootUuids) {
            if (groupedIds.includes(rootUuid) || skipLinking.includes(rootUuid)) {
                continue;
            }

            const groupNodes = [rootUuid]
            //const rootNodes = [rootUuid]

            let children = invertedDependencyMap.get(rootUuid)
            if (!children) {
                groups.push({groupNodes})
                continue;
            }

            let newNodes = children;
            while (newNodes.length > 0) {
                let activeNodes = newNodes;
                newNodes = [];
                for (const activeNode of activeNodes) {
                    if (groupedIds.includes(activeNode)) {
                        continue;
                    }
                    const shouldLink = !skipLinking.includes(activeNode);
                    if (shouldLink) {
                        groupedIds.push(activeNode)
                    }
                    groupNodes.push(activeNode)
                    if (dependencyMap.has(activeNode)) {
                        newNodes.push(...dependencyMap.get(activeNode))
                    }
                    if (invertedDependencyMap.has(activeNode) && shouldLink) {
                        newNodes.push(...invertedDependencyMap.get(activeNode))
                    }
                    // if (rootUuids.includes(activeNode)) {
                    //     rootNodes.push(activeNode)
                    // }
                }
            }

            groups.push({groupNodes: groupNodes.distinct()})
        }


        //console.log(groups)

        const depths = new Map()
        let deepestBranch = 0;
        for (const group of groups) {
            for (const groupNode of group.groupNodes) {
                const depth = this.getDepth(groupNode, dependencyMap);
                depths.set(groupNode, depth)

                deepestBranch = Math.max(deepestBranch, depth)
            }
        }

        const root = target.find(".web-viewer");
        root.empty()
        let groupNumber = 0;
        for (const group of groups) {
            root.append(await this.createGroup(group.groupNodes, deepestBranch, depths, items, groupNumber, invertedDependencyMap, itemFilterMeta))
            groupNumber = groupNumber + 1
        }
    }

    getMeta(item) {
        const bab = this.getBabRequirement(item);
        const speciesPrerequisites = this.getSpeciesRequirement(item);


        return {
            possibleProviders: item.system.possibleProviders,
            book: item.system.source,
            homebrew: item.isHomeBrew,
            baseAttackBonus: bab,
            species: speciesPrerequisites,
            prerequisite: item.system.prerequisite
        };
    }

    getDepth(groupNode, dependencyMap) {
        const children = dependencyMap.get(groupNode);
        if (!children || children.length === 0) {
            return 0;
        }
        return Math.max(...children.map(child => this.getDepth(child, dependencyMap))) + 1
    }

    getSkippedUuids(items) {
        return [...items].filter(([key, item]) => SKIP_LINK.includes(item.name)).map(([key, item]) => item.uuid) || []
    }


    /**
     *
     * @param prerequisite
     * @param items
     * @return {*}
     */
    getItemByPrerequisite(prerequisite, items) {
        let key = `${prerequisite.type.toUpperCase()}:${prerequisite.requirement}`;
        if (!items.has(key)) {
            let payloadFree = prerequisite.requirement.replace(CompendiumWeb._payloadPattern, "");
            key = `${prerequisite.type.toUpperCase()}:${payloadFree}`;
        }
        return items.get(key);
    }

    getSpeciesRequirement(item) {
        return CompendiumWeb.getPrerequisitesByType(item.system.prerequisite, ["SPECIES"]).map(p => p.requirement);
    }

    getBabRequirement(item) {
        const babPrerequisites = CompendiumWeb.getPrerequisitesByType(item.system.prerequisite, ["BASE ATTACK BONUS"])

        let babs = babPrerequisites.map(p => parseInt(p.requirement));
        babs.push(0)
        return Math.max(...babs);
    }
    async createGroup(grouping, deepestLevel, levels, items, groupNumber, invertedDependencyMapping, metaMapping) {

        const itemsByLevel = [];
        for (const groupingElement of grouping) {
            const level = levels.get(groupingElement);
            if (itemsByLevel[level]) {
                itemsByLevel[level].push(groupingElement);
            } else {
                itemsByLevel[level] = [groupingElement]
            }
        }

        let shouldDrawGroup = false;
        const webGroup = $(`<div class="web-group"></div>`);
        for (let i = 0; i <= deepestLevel; i++) {

            const webLevel = $(`<div class="web-level"></div>`);
            for (const uuid of itemsByLevel[i] || []) {
                if (!(this.shouldDraw(uuid, metaMapping, invertedDependencyMapping))) continue;
                shouldDrawGroup = true;
                const invertedDependencies = invertedDependencyMapping.get(uuid) || []
                webLevel.append(this.getItemBlock(await fromUuid(uuid), groupNumber, invertedDependencies))
            }

            webGroup.append(webLevel);
        }
        if (shouldDrawGroup)
            return webGroup;

    }

    shouldDraw(uuid, metaMapping, invertedDependencyMapping) {
        const meta = metaMapping.get(uuid);
        if (!meta.hide) {
            return true;
        }
        for (const mapping of invertedDependencyMapping.get(uuid) || []) {
            if (this.shouldDraw(mapping, metaMapping, invertedDependencyMapping)) {
                return true;
            }
        }
        return false;
    }

    getItemBlock(item, groupNumber, invertedDependencies = []) {
        const img = $(`<img src="${item.img}" alt="${item.name}">`);
        // const itemBlock = $(`<div class="icon"></div>`);

        img.attr("title", item.system.prerequisite?.text)
        img.attr("draggable", "true")
        img.attr("id", `${item.uuid.replaceAll("\.", "-")}-${groupNumber}`);
        img.addClass(`${item.uuid.replaceAll("\.", "-")}-${groupNumber}`);
        if (invertedDependencies && invertedDependencies.length > 0) {
            img.attr("data-draw-to", invertedDependencies.map(d => `${d.replaceAll("\.", "-")}-${groupNumber}`).join(","))
            img.addClass("mappable")

        }
        img.attr("data-uuid", item.uuid)
        img.on("dragstart", (event) => this._onDragStart(event))
        img.on("dblclick", (event) => item.sheet.render(true))
        img.addClass(item.type)

        const itemArea = $(`<div class="web-item"></div>`);
        itemArea.append(img)
        if(item.type === "talent"){
            itemArea.append($(`<div class="text talent">${item.system.talentTree}:</div>`))
        }
        itemArea.append($(`<div class="text">${item.name}</div>`))
        return itemArea;
    }

    _onDragStart(event) {
        const dataTransfer = event.dataTransfer || event.originalEvent.dataTransfer
        let dragData = JSON.parse(dataTransfer.getData("text/plain") || "{}");
        dragData.uuid = event.currentTarget.dataset.uuid
        dragData.type = "Item"

        dataTransfer.setData("text/plain", JSON.stringify(dragData));
    }

    static getPrerequisitesByType(prerequisite, type = []) {
        if (!prerequisite) {
            return [];
        }

        const prerequisites = [];
        if (type.map(t => t.toLowerCase()).includes(prerequisite.type.toLowerCase())) {
            prerequisites.push(prerequisite);
        } else if (prerequisite.children) {
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

    async getData(options = {}) {
        return {
            cssId: this.id,
            cssClass: this.options.classes.join(" "),
            user: game.user
        };
    }


    getWebLevel(dependencyMap, name, level) {
        let dependencies = dependencyMap[name];
        if (!dependencies) {
            let payloadFree = name.replace(CompendiumWeb._payloadPattern, "");
            dependencies = dependencyMap[payloadFree]
        }

        if (!dependencies) {
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

    async populateFiltersFromArguments(target, options) {

        if (options.webFilters) {
            for (const webFilter of Object.entries(options.webFilters)) {

                const input = target.find(`.${webFilter[0]}`);
                input.val(webFilter[1]);
            }
        }

    }

    async addFilters(target, types) {
        const root = target.find(".web-filters");
        root.empty()
        for (const filter of this.filters) {
            root.append(await this.createFilter(filter, target, types))
        }
    }

    /**
     *
     * @param filter
     * @param target
     * @param {string} filter.type the type of filter it will be
     * @param {Array.<{value: string, display: string}>} filter.options things that the user can select
     * @param {boolean} filter.multiple selections can the user choose multiple?
     * @param {string} filter.selector the class that this filter object will use to find  the created element.
     *
     * @return {jQuery|HTMLElement}
     */
    async createFilter(filter, target, types) {
        let filterComponent;
        switch (filter.type) {
            case "select":
                filterComponent = $(`<select></select>`)

                if (filter.multiple) {
                    filterComponent.attr("multiple", true)
                }

                filterComponent.append($(`<option value=""> -- </option>`))

                for (const option of (await filter.options(types)).sort((a, b) => a.display > b.display ? 1 : -1) || []) {
                    filterComponent.append($(`<option value="${option.value}">${option.display}</option>`))
                }
                filterComponent.on("change", (event) => this.renderWeb(event, target, this.types))
                break;
            case "number":
                filterComponent = $(`<input type="number">`)

                filterComponent.on("change", (event) => this.renderWeb(event, target, this.types))
                break;
            case "boolean":
                filterComponent = $(`<input type="checkbox">`)

                filterComponent.on("change", (event) => this.renderWeb(event, target, this.types))
                break;
            default:
                filterComponent = $(`<div>unsupported filter type</div>`)
        }
       const containerId = `${filter.selector}`

        filterComponent.addClass(filter.selector)
        filterComponent.addClass("value")
        filterComponent.attr("id", containerId)

        const container = $(`<div class="labeled-input"><label for="${containerId}">${filter.name}</label></div>`);

        container.append(filterComponent)

        const topContainer = $(`<div class="flex-row flex"></div>`);
        topContainer.append(container)
        if (filter.allowExclude) {
            const excludeComponent = $(`<input type="checkbox" class="${filter.selector} exclude">`)
            excludeComponent.on("change", (event) => this.renderWeb(event, target, this.types))

            const excludeContainer = $(`<div class="labeled-input"><label>exclude</label></div>`);
            excludeContainer.append(excludeComponent)
            topContainer.append(excludeContainer)
        }

        return topContainer;
    }
    async drawArrows(target) {
        const found = target.find(".mappable")
        const webviewer = target.find(".web-viewer")
        //const arrows = $(`<div class="arrows"></div>`)
        for (const from of found) {
            let drawto = from.dataset.drawTo?.split(",")
            for (const drawtoElement of drawto) {
                const to = $(target.find(`#${drawtoElement}`))[0]
                if (to) {
                    //this.connect(from, to, "black", 2)
                    //console.log(`<svg width="500" height="500"><line x1="${from.offsetLeft}" y1="${from.offsetTop }" x2="${to.offsetLeft }" y2="${to.offsetTop}" stroke="black"/></svg>`)
                    //arrows.append($(`<svg><line x1="${from.offsetLeft}" y1="${from.offsetTop }" x2="${to.offsetLeft }" y2="${to.offsetTop}" stroke="black"/></svg>`))
                    //new LeaderLine(from, to)
                }
            }
        }
        //webviewer.append(arrows)
    }

    getOffset(el) {
        var rect = el.getBoundingClientRect();
        return {
            left: rect.left + window.pageXOffset,
            top: rect.top + window.pageYOffset,
            width: rect.width || el.offsetWidth,
            height: rect.height || el.offsetHeight
        };
    }

    connect(div1, div2, color, thickness) { // draw a line connecting elements
        const off1 = this.getOffset(div1);
        var off2 = this.getOffset(div2);
        // bottom right
        var x1 = off1.left + off1.width;
        var y1 = off1.top + off1.height;
        // top right
        var x2 = off2.left + off2.width;
        var y2 = off2.top;
        // distance
        var length = Math.sqrt(((x2 - x1) * (x2 - x1)) + ((y2 - y1) * (y2 - y1)));
        // center
        var cx = ((x1 + x2) / 2) - (length / 2);
        var cy = ((y1 + y2) / 2) - (thickness / 2);
        // angle
        var angle = Math.atan2((y1 - y2), (x1 - x2)) * (180 / Math.PI);
        // make hr
        var htmlLine = "<div style='padding:0px; margin:0px; height:" + thickness + "px; background-color:" + color + "; line-height:1px; position:absolute; left:" + cx + "px; top:" + cy + "px; width:" + length + "px; -moz-transform:rotate(" + angle + "deg); -webkit-transform:rotate(" + angle + "deg); -o-transform:rotate(" + angle + "deg); -ms-transform:rotate(" + angle + "deg); transform:rotate(" + angle + "deg);' />";
        //
        // alert(htmlLine);
        document.body.innerHTML += htmlLine;
    }
}