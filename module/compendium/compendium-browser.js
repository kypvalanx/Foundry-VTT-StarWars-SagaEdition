import {getInheritableAttribute} from "../attribute-helper.js";

export const naturalSort = function (arr, propertyKey = "") {
    return arr.sort((a, b) => {
        const propA = propertyKey ? getProperty(a, propertyKey) : a;
        const propB = propertyKey ? getProperty(b, propertyKey) : b;
        return new Intl.Collator(game.settings.get("core", "language"), { numeric: true }).compare(propA, propB);
    });
};


export class SWSECompendiumBrowser extends Application {
    constructor(...args) {
        super(...args);

        this.items = [];

        this.filters = [];
        this.postFilters = [];

        this.activeFilters = {};

        this._data = {
            loaded: false,
            data: {},
            promise: null,
            progress: null,
        };

        /**
         * The bottom scroll treshold (in pixels) at which the browser should start lazy loading some more items.
         *
         * @type {number}
         * @property
         */
        this.lazyLoadTreshold = 80;
        /**
         * The maximum number of items initially visible in regards to lazy loading.
         *
         * @type {number}
         * @property
         */
        this.lazyStart = 80;
        /**
         * The current amount of items visible in regards to lazy loading.
         *
         * @type {number}
         * @property
         */
        this.lazyIndex = 0;
        /**
         * The amount of new items to lazy load when triggered.
         *
         * @type {number}
         * @property
         */
        this.lazyAdd = 20;

        /**
         * A list of packs used, for filtering purposes.
         *
         * @type {Compendium{}}
         * @property
         */
        this.packs = {};

        /**
         * The RegExp to filter item names by.
         *
         * @type {RegExp}
         * @property
         */
        this.filterQuery = /.*/;
        let split = args[0].filterString?.split(" ") || [];
        if(args[0].pack) {
            split.push(("-pack:" + args[0].pack).replace(" ", "_"));
        }
        this.defaultString = split.join(" ")
        this.selectedEntityType = args[0].type || "Item"

        this.do_filter(this.defaultString);

        /**
         * Load cached items
         */
        {
            this._savedItems = [];
            // const cacheVersions = game.settings.get("pf1", "compendiumSaveVersions");
            // const thisVersion = SemanticVersion.fromString(cacheVersions[this.type] || "0.0.1");
            // const needVersion = SemanticVersion.fromString(NEED_NEW_VERSION[this.type]);
            // if (needVersion.isHigherThan(thisVersion)) {
            //     game.settings.set(
            //         "pf1",
            //         "compendiumSaveVersions",
            //         mergeObject(cacheVersions, { [this.type]: game.system.data.version })
            //     );
            // } else {
            //     const settings = game.settings.get("pf1", "compendiumItems");
            //     if (settings[this.type]) {
            //         this._savedItems = settings[this.type];
            //     }
            // }
        }
    }

    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            template: "systems/swse/templates/compendium/compendium-browser.hbs",
            classes: ["swse", "app"],
            width: 720,
            height: window.innerHeight - 60,
            top: 30,
            left: 40,
        });
    }

    shouldForceRefresh() {
        let result = false;

        if (!this._currentCompendiums) {
            this.updateForceRefreshData();
        }

       // const forceRefreshData = game.settings.get("pf1", "compendiumForceRefresh");
        //const diff = getProperty(forceRefreshData, `diff.${this.type}`);

        // Determine difference in used compendiums
        // if (!diff) {
        //     result = true;
        // } else {
        //     let diffCompendiums = [];
        //     for (let o of [...this._currentCompendiums, ...diff]) {
        //         if (!diff.includes(o) || !this._currentCompendiums.includes(o)) diffCompendiums.push(o);
        //     }
        //     if (diffCompendiums.length > 0) result = true;
        // }

        return result;
    }

    updateForceRefreshData(options = { save: false, refresh: true }) {
        // Generate list of usable compendiums
        if (options.refresh) {
            this._currentCompendiums = game.packs
                .filter((o) => {
                    if (o.metadata.entity !== this.entityType) return false;

                    if (this.shouldSkip(o)) return false;

                    return true;
                })
                .map((o) => {
                    return `${o.metadata.package}.${o.metadata.name}`;
                });
        }

        // Save results
        if (options.save) {
            const forceRefreshData = {} //duplicate(game.settings.get("pf1", "compendiumForceRefresh"));
            setProperty(forceRefreshData, `diff.${this.type}`, this._currentCompendiums);
            return true //game.settings.set("pf1", "compendiumForceRefresh", forceRefreshData);
        }
    }

    async _createInitialElements() {
        let items = [];
        for (let a = 0; items.length < this.lazyLoadTreshold && a < this.items.length; a++) {
            const item = this.items[a];
            if (this._passesFilters(item.item)) {
                items.push(item);
            }
            this.lazyIndex = a + 1;
        }

        for (let item of items) {
            await this._addEntryElement(item);
        }
    }
    async _addEntryElement(item) {
        const elem = $(await renderTemplate("systems/swse/templates/compendium/compendium-browser_entry.hbs", item));
        const rootElem = this.element.find(".directory-list");
        rootElem.append(elem);
        this.activateEntryListeners(elem);

        return elem;
    }
    _clearEntryElements() {
        this.element.find(".directory-list").empty();
    }

    activateEntryListeners(elem) {
        // Open sheet
        elem.click((ev) => {
            let li = ev.currentTarget;
            this._onEntry(li.getAttribute("data-collection"), li.getAttribute("data-entry-id"));
        });

        // Make compendium item draggable
        elem[0].setAttribute("draggable", true);
        elem[0].addEventListener("dragstart", this._onDragStart, false);
    }

    async _initLazyLoad() {
        await this._createInitialElements();
        const rootElem = this.element.find(".directory-list");

        // Create function for lazy loading
        const lazyLoad = async () => {
            let createdItems = 0;
            for (let a = this.lazyIndex; a < this.items.length && createdItems < this.lazyAdd; a++) {
                const item = this.items[a];
                if (this._passesFilters(item.item)) {
                    createdItems++;
                    const elem = await this._addEntryElement(item);
                    $(elem).fadeIn(500);
                }
                this.lazyIndex++;
            }
        };

        // Create callback for lazy loading
        $(rootElem).on("scroll", () => {
            const top = rootElem.scrollTop() + rootElem.height();
            const bottom = rootElem[0].scrollHeight - this.lazyLoadTreshold;
            if (top >= bottom) {
                lazyLoad();
            }
        });
    }

    async loadData() {
        return new Promise((resolve) => {
            let promise = this._data.promise;
            if (promise == null) {
                promise = this._gatherData();
                this._data.promise = promise;
            }

            promise.then(async () => {
                this._data.loaded = true;
                this._data.promise = null;
                try {
                    await this.saveEntries();
                } catch (err) {
                    console.error(err);
                    await this.clearEntries();
                }
                resolve(this._data.data);
            });
        });
    }

    async _gatherData() {
        try {
            await this._fetchMetadata();
        } catch (err) {
            console.warn(err);
            this._savedItems = [];
            await this._fetchMetadata();
        }

        this._data.data = {
            filters: this.filters,
            collection: this.items.reduce((cur, o) => {
                cur[o.item._id] = o;
                return cur;
            }, {}),
            labels: {
                itemCount: this.items.length///game.i18n.localize("PF1.TotalItems").format(this.items.length),
            },
        };
    }

    get typeName() {
        switch (this.type) {
            case "spells":
                return game.i18n.localize("PF1.Spells");
            case "items":
                return game.i18n.localize("PF1.Items");
            case "feats":
                return game.i18n.localize("PF1.Features");
            case "bestiary":
                return game.i18n.localize("PF1.Creatures");
            case "classes":
                return game.i18n.localize("PF1.Classes");
            case "races":
                return game.i18n.localize("PF1.Races");
            case "buffs":
                return game.i18n.localize("PF1.Buffs");
        }
        return this.type;
    }

    get type() {
        return this.options.type;
    }

    get title() {
        return [this.typeName, "Browser"].join(" ");
    }

    get entityType() {
        return this.selectedEntityType
    }

    getBasicFilters() {
        return [null];
    }

    /**
     * @param {Compendium} p - The compendium in question.
     * @returns {boolean} Whether the compendium should be skipped.
     */
    shouldSkip(p) {
        // Check disabled status
        const config = game.settings.get("core", "compendiumConfiguration")[p.collection];
        const disabled = getProperty(config, "pf1.disabled") === true;
        if (disabled) return true;

        // Skip if set to private and the user is not a GM
        if (p.private && !game.user.isGM) return true;

        // Don't skip the compendium
        return false;
    }

    _onProgress(progress) {
        progress.loaded++;
        progress.pct = Math.round((progress.loaded * 10) / progress.total) * 10;
        ///SceneNavigation._onLoadProgress(progress.message, progress.pct);
    }

    async loadCompendium(p, filters = [null]) {
        const progress = this._data.progress;

        if (p.metadata.system !== "swse") {
            console.warn(p.metadata.label + " is incompatible with this browser and has been skipped.");
            this._onProgress(progress);
            return;
        }

        // Retrieve compendium contents
        let items = [];
        for (let filter of filters) {
            items.push(...(await p.getDocuments(filter)));
        }

        if (p.translated) {
            items = items.map((item) => p.translate(item));
        }

        // Flush full compendium contents from memory
        p.clear();

        for (let i of items) {
            if (!this._filterItems(i)) continue;
            this.packs[p.collection] = p;
            this.items.push(this._mapEntry(p, i.data));
        }
        this._onProgress(progress);
    }

    async _fetchMetadata() {
        this.items = [];

        if (this.shouldForceRefresh() || this._savedItems.length === 0) {
            // Initialize progress bar
            let packs = [];
            const progress = { pct: 0, message: game.i18n.localize("PF1.LoadingCompendiumBrowser"), loaded: -1, total: 0 };
            for (let p of game.packs.values()) {
                if (p.documentClass.documentName === this.entityType && !this.shouldSkip(p)) {
                    progress.total++;
                    packs.push(p);
                } else {
                    if (Object.hasOwnProperty.call(this.packs, p.collection)) {
                        delete this.packs[p.collection];
                    }
                }
            }

            // Clear filters without applicable packs
            if (packs.length === 0) {
                this.filters = [];
                return;
            }

            this._data.progress = progress;
            this._onProgress(progress);

            // Load compendiums
            for (let p of packs) {
                await this.loadCompendium(p, this.getBasicFilters());
            }

            // Sort items
            this.items = naturalSort(this.items, "item.name");

            // Return if no appropriate items were found
            if (this.items.length === 0) {
                return;
            }
        } else {
            for (let i of this._savedItems) {
                const p = game.packs.get(i.collection._id);
                if (p) {
                    this.items.push(this._mapEntry(p, i.item));
                    this.packs[i.collection._id] = p;
                }
            }
            this._savedItems = [];
        }

        // Gather filter data
        this._fetchGeneralFilters();
    }

    _filterItems(item) {
        // if (this.type === "spells" && item.type !== "spell") return false;
        // if (this.type === "items" && !ItemPF.isInventoryItem(item.type)) return false;
        // if (this.type === "feats" && item.type !== "feat") return false;
        // if (this.type === "classes" && item.type !== "class") return false;
        // if (this.type === "races" && item.type !== "race") return false;
        // if (this.type === "buffs" && item.type !== "buff") return false;
         return true;
    }

    /* ------------------------------------- */
    /*  Mapping Functions                    */
    /* ------------------------------------- */
    _mapFeats(result, item) {
        this.extraFilters = this.extraFilters || {
            tags: {},
            associations: {
                class: {},
            },
        };

        result.item.tags = (item.data.tags || []).reduce((cur, o) => {
            this.extraFilters.tags[o[0]] = true;
            cur.push(o[0]);
            return cur;
        }, []);

        result.item.assocations = {
            class: (item.data.featType === "classFeat" ? getProperty(item.data, "associations.classes") || [] : []).reduce(
                (cur, o) => {
                    this.extraFilters.associations.class[o[0]] = true;
                    cur.push(o[0]);
                    return cur;
                },
                []
            ),
        };
    }

    _mapBestiary(result, item) {
        this.extraFilters = this.extraFilters || {
            "data.details.cr.total": {},
            subTypes: {},
        };
        result.item.creatureType = "";
        result.item.subTypes = [];

        // Add CR filters
        if (item.type === "npc") {
            const cr = getProperty(item, "data.details.cr.total");
            if (cr && !this.extraFilters["data.details.cr.total"][cr]) this.extraFilters["data.details.cr.total"][cr] = true;
        }
        // Get creature (sub)type
        if (item.items) {
            const race = item.items.filter((o) => o.type === "race")[0];
            if (race != null) {
                result.item.creatureType = race.data.data.creatureType;
                result.item.subTypes = race.data.data.subTypes?.map((o) => {
                    this.extraFilters.subTypes[o[0]] = true;
                    return o[0];
                });
            }
        } else {
            item.subTypes?.forEach((o) => {
                this.extraFilters.subTypes[o] = true;
            });
            result.item.creatureType = item.creatureType;
            result.item.subTypes = item.subTypes;
        }
    }

    _mapItems(result, item) {
        this.extraFilters = this.extraFilters || {};

        result.item.weaponProps = Object.entries(getProperty(item.data, "data.properties") || []).reduce((cur, o) => {
            if (o[1]) cur.push(o[0]);
            return cur;
        }, []);
    }

    _mapSpells(result, item) {
        this.extraFilters = this.extraFilters || {
            "learnedAt.class": [],
            "learnedAt.domain": [],
            "learnedAt.subDomain": [],
            "learnedAt.elementalSchool": [],
            "learnedAt.bloodline": [],
            "data.subschool": [],
            spellTypes: [],
        };

        result.item.allSpellLevels = [];

        // Add class/domain/etc filters
        result.item.learnedAt = {
            class: (getProperty(item, "data.learnedAt.class") || []).reduce((cur, o) => {
                this.extraFilters["learnedAt.class"][o[0]] = true;
                if (!result.item.allSpellLevels.includes(o[1])) result.item.allSpellLevels.push(o[1]);
                cur.push(o[0]);
                return cur;
            }, []),
            domain: (getProperty(item, "data.learnedAt.domain") || []).reduce((cur, o) => {
                this.extraFilters["learnedAt.domain"][o[0]] = true;
                if (!result.item.allSpellLevels.includes(o[1])) result.item.allSpellLevels.push(o[1]);
                cur.push(o[0]);
                return cur;
            }, []),
            subDomain: (getProperty(item, "data.learnedAt.subDomain") || []).reduce((cur, o) => {
                this.extraFilters["learnedAt.subDomain"][o[0]] = true;
                if (!result.item.allSpellLevels.includes(o[1])) result.item.allSpellLevels.push(o[1]);
                cur.push(o[0]);
                return cur;
            }, []),
            elementalSchool: (getProperty(item, "data.learnedAt.elementalSchool") || []).reduce((cur, o) => {
                this.extraFilters["learnedAt.elementalSchool"][o[0]] = true;
                if (!result.item.allSpellLevels.includes(o[1])) result.item.allSpellLevels.push(o[1]);
                cur.push(o[0]);
                return cur;
            }, []),
            bloodline: (getProperty(item, "data.learnedAt.bloodline") || []).reduce((cur, o) => {
                this.extraFilters["learnedAt.bloodline"][o[0]] = true;
                if (!result.item.allSpellLevels.includes(o[1])) result.item.allSpellLevels.push(o[1]);
                cur.push(o[0]);
                return cur;
            }, []),
            spellLevel: {
                class: (getProperty(item, "data.learnedAt.class") || []).reduce((cur, o) => {
                    cur[o[0]] = o[1];
                    return cur;
                }, {}),
                domain: (getProperty(item, "data.learnedAt.domain") || []).reduce((cur, o) => {
                    cur[o[0]] = o[1];
                    return cur;
                }, {}),
                subDomain: (getProperty(item, "data.learnedAt.subDomain") || []).reduce((cur, o) => {
                    cur[o[0]] = o[1];
                    return cur;
                }, {}),
                // "elementalSchool": (getProperty(item, "data.learnedAt.elementalSchool") || []).reduce((cur, o) => {
                //   cur[o[0]] = o[1];
                //   return cur;
                // }, {}),
                bloodline: (getProperty(item, "data.learnedAt.bloodline") || []).reduce((cur, o) => {
                    cur[o[0]] = o[1];
                    return cur;
                }, {}),
            },
        };

        // Add subschools
        {
            const subschool = item.data.subschool;
            if (subschool) this.extraFilters["data.subschool"][subschool] = true;
        }
        // Add spell types
        {
            const spellTypes = item.data.types ? item.data.types.split(CONFIG.PF1.re.traitSeparator) : [];
            result.item.spellTypes = spellTypes;
            for (let st of spellTypes) {
                this.extraFilters["spellTypes"][st] = true;
            }
        }
    }

    _mapClasses(result, item) {
        this.extraFilters = this.extraFilters || {
            "data.hd": {},
            "data.skillsPerLevel": {},
        };

        // Add HD
        {
            const hd = item.data.hd;
            if (hd) this.extraFilters["data.hd"][hd] = true;
        }
        // Add skills per level
        {
            const s = item.data.skillsPerLevel;
            if (s) this.extraFilters["data.skillsPerLevel"][s] = true;
        }
    }

    _mapRaces(result, item) {
        this.extraFilters = this.extraFilters || {
            subTypes: {},
        };
        result.item.subTypes = [];

        // Get subtypes
        result.item.subTypes = item.data.subTypes.map((o) => {
            this.extraFilters.subTypes[o[0]] = true;
            return o[0];
        });
    }

    _mapBuffs(result, item) {
        this.extraFilters = this.extraFilters || {
            types: {},
        };

        // Get types
        this.extraFilters.types[item.data.buffType] = true;
    }

    _mapEntry(pack, item) {
        const result = {
            collection: {
                _id: pack.collection,
                label: pack.metadata.label,
            },
            item: {
                _id: item._id,
                name: item.name,
                type: item.type,
                img: item.img,
                data: item.data,
                pack: pack.collection,
                talentTree: item._source?.data?.talentTree,
                groupTypes: item._source?.data?.possibleProviders || [],
                subType: item._source?.data.subtype,
                isExotic: item._source?.data?.subtype?.toLowerCase().includes("exotic")
            },
        };

        // switch (this.type) {
        //     case "feats":
        //         this._mapFeats(result, item);
        //         break;
        //     case "bestiary":
        //         this._mapBestiary(result, item);
        //         break;
        //     case "items":
        //         this._mapItems(result, item);
        //         break;
        //     case "spells":
        //         this._mapSpells(result, item);
        //         break;
        //     case "classes":
        //         this._mapClasses(result, item);
        //         break;
        //     case "races":
        //         this._mapRaces(result, item);
        //         break;
        //     case "buffs":
        //         this._mapBuffs(result, item);
        //         break;
        // }

        return result;
    }

    async getData() {
        this.updateForceRefreshData();
        if (this.shouldForceRefresh() || !this._data.loaded) await this.loadData();
        await this.updateForceRefreshData({ save: true, refresh: false });

        const data = duplicate(this._data.data);
        data.searchString = this.searchString;

        return data;
    }

    async refresh() {
        await this.loadData();
        this.render(false);
    }

    _fetchGeneralFilters() {
        this.filters = [];
    }
    async _render(force, ...args) {
        await super._render(force, ...args);

        this._determineFilteredItemCount();
    }

    activateListeners(html) {
        super.activateListeners(html);

        let search = html.find('input[name="search"]');
        search.keyup(this._onFilterResults.bind(this));
        search.val(this.defaultString)

        html.find('.filter input[type="checkbox"]').change(this._onActivateBooleanFilter.bind(this));

        html.find(".filter h3").click(this._toggleFilterVisibility.bind(this));

        html.find("button.refresh").click(this.refresh.bind(this));

        // Lazy load
        this._initLazyLoad();
    }

    /**
     * Handle opening a single compendium entry by invoking the configured entity class and its sheet
     *
     * @param collectionKey
     * @param entryId
     * @private
     */
    async _onEntry(collectionKey, entryId) {
        const pack = game.packs.find((o) => o.collection === collectionKey);
        const entity = await pack.getDocument(entryId);
        entity.sheet.render(true);
    }

    /**
     * Handle a new drag event from the compendium, create a placeholder token for dropping the item
     *
     * @param event
     * @private
     */
    _onDragStart(event) {
        const li = this,
            packName = li.getAttribute("data-collection"),
            pack = game.packs.find((p) => p.collection === packName);

        // Get the pack
        if (!pack) {
            event.preventDefault();
            return false;
        }

        // Set the transfer data
        event.dataTransfer.setData(
            "text/plain",
            JSON.stringify({
                type: pack.documentClass.documentName,
                pack: pack.collection,
                id: li.getAttribute("data-entry-id"),
            })
        );
    }

    _toggleFilterVisibility(event) {
        event.preventDefault();
        const title = event.currentTarget;
        const content = $(title).siblings(".filter-content")[0];

        if (content.style.display === "none") content.style.display = "block";
        else content.style.display = "none";
    }

    _onFilterResults(event) {
        event.preventDefault();
        let input = event.currentTarget;


        // Filter if we are done entering keys
        let raw_string = input.value;
        this.do_filter(raw_string);
    }

    do_filter(raw_string) {
        // Define filtering function
        let filter = async (query) => {
            this.filterQuery = query;
            await this._filterResults();
        };

        let terms = raw_string.split(" ");
        let filterStrings = [];
        let searchTerms = [];
        for (let term of terms) {
            if (term.startsWith("-")) {
                filterStrings.push(term);
            } else {
                searchTerms.push(term);
            }
        }

        this.postFilters = this.generateFilters(filterStrings);

        let groomedString = searchTerms.join(" ");
        let query = new RegExp(RegExp.escape(groomedString), "i");
        this.searchString = groomedString;
        if (this._filterTimeout) {
            clearTimeout(this._filterTimeout);
            this._filterTimeout = null;
        }
        this._filterTimeout = setTimeout(() => filter(query), 100);
    }

    _onActivateBooleanFilter(event) {
        event.preventDefault();
        let input = event.currentTarget;
        const path = input.closest(".filter").dataset.path;
        const key = input.name;
        const value = input.checked;

        const filter = this._data.data.filters.find((o) => o.path === path);
        if (filter) {
            if (!filter.active) filter.active = {};
        }

        if (value) {
            let index = this.activeFilters[path].indexOf(key);
            if (index < 0) {
                this.activeFilters[path].push(key);
                filter.active[key] = true;
            }
        } else {
            let index = this.activeFilters[path].indexOf(key);
            if (index >= 0) {
                this.activeFilters[path].splice(index, 1);
                if (filter.active[key] != null) delete filter.active[key];
            }
        }

        // Save filter settings
        {
            const settings = game.settings.get("pf1", "compendiumFilters");
            setProperty(settings, `${this.type}.activeFilters`, this.activeFilters);
            game.settings.set("pf1", "compendiumFilters", settings);
        }

        return this._filterResults();
    }

    async _filterResults() {
        this.lazyIndex = 0;
        // Clear entry elements
        this._clearEntryElements();

        // Scroll up
        const rootElem = this.element.find(".directory-list")[0];
        if(rootElem) {
            rootElem.scrollTop = 0;
        }

        // Create new elements
        await this._createInitialElements();

        // Determine filtered item count
        this._determineFilteredItemCount();
    }

    _determineFilteredItemCount() {
        let itemCount = 0;
        for (let item of this.items) {
            if (this._passesFilters(item.item)) {
                itemCount++;
            }
        }
        this.element
            .find('span[data-type="filterItemCount"]')
            .text(itemCount)//game.i18n.localize("PF1.FilteredItems").format(itemCount));
    }

    _passesFilters(item) {
        let matchesProviderGroup = item.groupTypes.map(type => {
            let b = this.filterQuery.test(type);
            return b;
        })
            .reduce((previousValue, currentValue) => previousValue || currentValue, false);


        if (!this.filterQuery.test(item.name)
            && !this.filterQuery.test(item.talentTree)
            && !this.filterQuery.test(item.type)
            && !this.filterQuery.test(item.subType)
        && !matchesProviderGroup) return false;

        let groupedFilters = {};
        this.postFilters.forEach(f => {
            if(!f) return;
            groupedFilters[f.type] = groupedFilters[f.type] || []
            groupedFilters[f.type].push(f)
        });

        for(let key of Object.keys(groupedFilters)){
            if(!groupedFilters[key].map(f => f.test(item)).reduce((previous, next) => previous || next, false)) return false;
        }



        return true;
    }

    getSaveEntries() {
        let result = [];

        let propKeys = ["_id", "name", "img"];

        switch (this.type) {
            case "spells":
                propKeys.push(
                    "data.learnedAt.class",
                    "data.learnedAt.domain",
                    "data.learnedAt.subDomain",
                    "data.learnedAt.elementalSchool",
                    "data.learnedAt.bloodline",
                    "data.school",
                    "data.subschool",
                    "data.types"
                );
                break;
            case "items":
                propKeys.push(
                    "type",
                    "data.properties",
                    "data.weaponType",
                    "data.weaponSubtype",
                    "data.equipmentType",
                    "data.equipmentSubtype",
                    "data.slot",
                    "data.consumableType",
                    "data.subType"
                );
                break;
            case "feats":
                propKeys.push("data.featType", "data.associations.classes", "data.tags");
                break;
            case "bestiary":
                propKeys.push("data.details.cr.total");
                break;
            case "classes":
                propKeys.push(
                    "data.classType",
                    "data.bab",
                    "data.hd",
                    "data.skillsPerLevel",
                    "data.savingThrows.fort.value",
                    "data.savingThrows.ref.value",
                    "data.savingThrows.will.value"
                );
                break;
            case "races":
                propKeys.push("data.creatureType", "data.subTypes");
                break;
        }

        for (let i of this.items) {
            let resultObj = {
                collection: i.collection,
                item: {},
            };

            // Copy parsed properties
            for (let k of Object.keys(i.item)) {
                if (k !== "data") {
                    resultObj.item[k] = i.item[k];
                }
            }

            // Copy specific data properties
            for (let k of propKeys) {
                if (hasProperty(i.item, k)) {
                    setProperty(resultObj, `item.${k}`, getProperty(i.item, k));
                }
            }

            result.push(resultObj);
        }

        return result;
    }

    saveEntries() {
        const entries = this.getSaveEntries();

        const settings = {}//game.settings.get("pf1", "compendiumItems") || {};
        settings[this.type] = entries;

        return false//game.settings.set("pf1", "compendiumItems", settings);
    }

    clearEntries() {
        const settings = {}///game.settings.get("pf1", "compendiumItems") || {};
        settings[this.type] = [];

        return false//game.settings.set("pf1", "compendiumItems", settings);
    }

    generateFilters(filterStrings) {
        return filterStrings.map(filterString => this.generateFilter(filterString))
    }

    generateFilter(filterString){
        if(filterString.startsWith("-type")) {
            let s = filterString.split(":")[1]

            if (s) {
                return {
                    type: 'type',
                    test: (item) => {
                        return new RegExp(RegExp.escape(s), "i").test(item.type)
                    }
                }
            }
        }
        else if(filterString.startsWith("-subtype")){
            let s = filterString.split(":")[1]

            if(s) {
                return {
                    type: 'subtype',
                    test: (item) => {
                        return new RegExp(RegExp.escape(s), "i").test(item.subType)
                    }
                }
            }
        }
        else if(filterString.startsWith("-pack")){
            let s = filterString.split(":")[1]

            if(s) {
                return {
                    type: 'pack',
                    test: (item) => {
                        let regExp = new RegExp(RegExp.escape(s), "i");
                        return regExp.test(item.pack) || regExp.test(item.pack.replace(" ", "_"))
                    }
                }
            }
        } else if(filterString.startsWith("-exotic")){
                return {
                    type: 'exotic',
                    test: (item) => {
                        return !!item.isExotic
                    }
                }
        }
    }
}
