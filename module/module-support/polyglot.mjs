import {getInheritableAttribute} from "../attribute-helper.mjs";
import {filterItemsByTypes} from "../common/util.mjs";

export function initializePolyglot() {

    Hooks.once("polyglot.init", (LanguageProvider) => {
        class SWSELanguageProvider extends LanguageProvider {
            async getLanguages() {
                const langs = {};

                const packs = [];
                packs.push(...game.packs.filter(p => true));

                const languagesSetting = game.settings.get("polyglot", "Languages");
                if (!this.replaceLanguages) {
                    //CONFIG.FICTIONAL.spoken = {};
                    const languages = packs.filter(pack => pack.collection.startsWith("swse.languages"))[0].index;

                    for (const language of languages) {
                        langs[language.name] = {
                            label: language.name,
                            font: languagesSetting[language.name]?.font || this.languages[language.name]?.font || this.defaultFont,
                            rng: languagesSetting[language.name]?.rng ?? "default",
                        };
                    }

                    //console.log(languages)
                }
                // for (let lang in CONFIG.FICTIONAL.spoken) {
                //     langs[lang] = {
                //         label: CONFIG.FICTIONAL.spoken[lang],
                //         font: languagesSetting[lang]?.font || this.languages[lang]?.font || this.defaultFont,
                //         rng: languagesSetting[lang]?.rng ?? "default",
                //     };
                // }
                this.languages = langs;
            }

            getUserLanguages(actor) {
                let known_languages = new Set();
                let literate_languages = new Set();

                const maySpeak = getInheritableAttribute({entity: actor, attributeKey: "maySpeak", reduce: "VALUES"})
                const limitedSpeech = maySpeak.length > 0;

                for (let lang of filterItemsByTypes(actor.items.values(), ["language"])) {
                    if (limitedSpeech && !maySpeak.includes(lang.name)) {
                        literate_languages.add(lang.name)
                    } else {
                        known_languages.add(lang.name)
                    }
                }
                return [known_languages, literate_languages];
            }
        }


        game.polyglot.api.registerSystem(SWSELanguageProvider);
    })


}