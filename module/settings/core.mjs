import {commonHomebrewOptions, darthauthorHomebrewOptions, lilLiteralistHomebrewOptions} from "./homebrew.mjs";
import {registerCSSColor} from "./helper-functions.mjs";


export function registerSystemSettings() {
    systemOptions();
    optionalRules();


    game.settings.register("swse", "automaticItems", {
        name: "Automatic Feats or Talents",
        hint: `these feats or talents will be granted to new characters automatically, enter as a comma seperated list ex. "FEAT:Toughness,TALENT:Armored Defense"`,
        scope: "world",
        config: true,
        default: "",
        type: String
    });

    game.settings.register("swse", "automaticItemsWhenItemIsAdded", {
        name: "Bonus Feats or Talents",
        hint: `these feats or talents will be granted when the trigger Item is added, enter as a comma seperated list ex. "FEAT:Point-Blank Shot>FEAT:Precise Shot"`,
        scope: "world",
        config: true,
        default: "",
        type: String
    });

    colorConfiguration();


    commonHomebrewOptions();
    lilLiteralistHomebrewOptions();
    darthauthorHomebrewOptions();
}



function colorConfiguration() {
    const r = document.querySelector(':root');

    const colors = [];
    colors.push(registerCSSColor("swse", "cssBackgroundColor", "Background Color", "Modifies the Background color of sheets", "client", "#e8e8e8", r, '--color-background'));
    colors.push(registerCSSColor("swse", "cssColorShadowPrimary", "Shadow Color", "Modifies the Shadow color of sheets", "client", "#424ba4", r, '--color-shadow-primary'));
    colors.push(registerCSSColor("swse", "cssColorDarkPrimary", "Text Color", "Modifies the standard text color", "client", "#191813", r, '--color-text-dark-primary'));
    colors.push(registerCSSColor("swse", "cssForegroundColor", "Foreground Color", "Modifies the Foreground color of sheets", "client", "#424ba4", r, '--color-foreground'));
    colors.push(registerCSSColor("swse", "cssMidgroundColor", "Midground Color", "Modifies the Midground color of sheets", "client", "#bcc3fd", r, '--color-midground'));
    colors.push(registerCSSColor("swse", "cssHyperlink", "Hyperlink Color", "Modifies the Hyperlink color of sheets", "client", "#132cff", r, '--color-text-hyperlink'));
    colors.push(registerCSSColor("swse", "cssHeaderUnderline", "Header Underline", "Modifies the Underline color of Headers", "client", "#010e7c", r, '--color-underline-header'));
    colors.push(registerCSSColor("swse", "cssErrorBackground", "Error Background", "Modifies the Background color of Errors", "client", "#CE0707FF", r, '--color-level-error'));
    colors.push(registerCSSColor("swse", "cssWarningBackground", "Warning Background", "Modifies the Background color of Warnings", "client", "#EE9B3AFF", r, '--color-level-warning'));

    game.settings.register("swse", "resetColorDefaults", {
        name: "Reset Colors",
        hint: "check this to reset character sheet colors",
        scope: "client",
        config: true,
        default: false,
        type: Boolean,

        onChange: () => {
            game.settings.set("swse", "resetColorDefaults", false)
            colors.forEach(c => {
                const setting = game.settings.settings.get(`swse.${c}`);
                //console.log(setting.default)
                game.settings.set("swse", c, setting.default);
            })
        }
    })
}

function systemOptions() {
    game.settings.register("swse", "enableTargetResultsOnAttackCard", {
        name: "Enable Target Results on attack rolls for targeted actors.",
        hint: "Results require that a token is linked to an actor, because Reflex Defense is on that sheet.",
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });

    game.settings.register("swse", "enableAdvancedCompendium", {
        name: "Enable Advanced Compendium Browser.",
        hint: "This may cause performance issues on slower browsers.  A refresh is required for this option to take effect.",
        scope: "world",
        config: true,
        default: true,
        type: Boolean
    });

    game.settings.register("swse", "enableHomebrewContent", {
        name: "Enable Homebrew content from the wiki.",
        hint: "",
        scope: "world",
        config: true,
        default: true,
        type: Boolean
    });

    game.settings.register("swse", "enableNotificationsOnHealthChange", {
        name: "Enable Chat Notifications when you change your total health.",
        hint: "",
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });
}

function optionalRules() {
    game.settings.register("swse", "defaultAttributeGenerationType", {
        name: "Select the default method that new characters will use to select attributes.",
        hint: "This can be overridden on each sheet.",
        scope: "world",
        config: true,
        default: "Point Buy",
        type: String,
        choices: {
            "Roll": "Roll Dice and Assign",
            "Standard Array": "Assign a Standard Array",
            "Point Buy": "Generate with Point Buy",
            "Manual": "Manual Input"
        }
    });
    game.settings.register("swse", "enableEncumbranceByWeight", {
        name: "Enable encumbrance by weight.",
        hint: "",
        scope: "world",
        config: true,
        default: true,
        type: Boolean
    });
}