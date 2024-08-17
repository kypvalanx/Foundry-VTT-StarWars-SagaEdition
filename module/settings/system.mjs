

export function refreshActors(options = { renderOnly: false, renderForEveryone: false }) {
    game.actors.contents.forEach((o) => {
        if (!options.renderOnly) o.prepareData();
        if (o.sheet != null && o.sheet._state > 0) o.sheet.render();
    });
    Object.values(game.actors.tokens).forEach((o) => {
        if (o) {
            if (!options.renderOnly) o.prepareData();
            if (o.sheet != null && o.sheet._state > 0) o.sheet.render();
        }
    });

    if (options.renderForEveryone) {
        game.socket.emit("swse", "refreshActorSheets");
    }
}

function registerCSSColor(nameSpace, key, name, hint, scope, defaultColor, r, cssProperty) {
    if (window.Ardittristan && window.Ardittristan.ColorSetting) {
        new window.Ardittristan.ColorSetting(nameSpace, key, {
            name,
            hint,
            scope,
            restricted: false,
            defaultColor,
            onChange: (val) => {
                // var r = document.querySelector(':root');
                // var rs = getComputedStyle(r);
                // // Alert the value of the --blue variable
                // alert("The value of --main-bg-color is: " + rs.getPropertyValue('--main-bg-color'));

                r.style.setProperty(cssProperty, val);
            }
        });
    } else {
        game.settings.register(nameSpace, key, {
            name,
            hint: hint + " (install VTTColorSettings for better color picker)",
            scope,
            config: true,
            default: defaultColor,
            type: String,
            onChange: (val) => {
                // var r = document.querySelector(':root');
                // var rs = getComputedStyle(r);
                // // Alert the value of the --blue variable
                // alert("The value of --main-bg-color is: " + rs.getPropertyValue('--main-bg-color'));

                r.style.setProperty(cssProperty, val);
            }
        });
    }


    r.style.setProperty(cssProperty, game.settings.get(nameSpace, key));
    return key;
}

export const registerSystemSettings = function () {

    // game.settings.register("swse", "mergePointBlankShotAndPreciseShot", {
    //     name: "Taking Point-Blank Shot provides the Precise Shot Feat",
    //     scope: "world",
    //     config: true,
    //     default: false,
    //     type: Boolean,
    //     onChange: () => {
    //         game.actors.entities.forEach((o) => {
    //             console.log(o);
    //             o.prepareData()
    //         });
    //         Object.values(game.actors.tokens).forEach((o) => {
    //             o.prepareData()
    //         });
    //     },
    // });


    game.settings.register("swse", "enableTargetResultsOnAttackCard", {
        name: "Enable Target Results on attack rolls for targeted actors.",
        hint: "Results require that a token is linked to an actor, because Reflex Defense is on that sheet.",
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });


    game.settings.register("swse", "enable5105Measurement", {
        name: "Enable counting alternating diagonals as double the distance",
        hint: "Similar to games like Pathfinder",
        scope: "world",
        config: true,
        default: "555",
        type: String,
        choices: {
            555: "Equal distance diagonals",
            5105: "Alternating double distance diagonals"
        },
        onChange: (rule) => (canvas.grid.diagonalRule = rule)
    });

    game.settings.register("swse", "skillFocusCalculation", {
        name: "Enable homebrew alternate skill focus rules",
        hint: "default is a flat +5 from Skill Focus",
        scope: "world",
        config: true,
        default: "default",
        type: String,
        choices: {
            default: "+5 to a skill",
            charLevelUp: "half character level rounded up",
            charLevelDown: "half character level rounded down"
        },
        onChange: () => game.swse.refreshActors({ renderForEveryone: true })

    });

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

    game.settings.register("swse", "enableAdvancedCompendium", {
        name: "Enable Advanced Compendium Browser.",
        hint: "This may cause performance issues on slower browsers.  A refresh is required for this option to take effect.",
        scope: "world",
        config: true,
        default: true,
        type: Boolean
    });

    game.settings.register("swse", "enableEncumbranceByWeight", {
        name: "Enable encumbrance by weight.",
        hint: "",
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

    game.settings.register("swse", "criticalHitType", {
        name: "Critical Hit Mode",
        hint: "allows you to select other types of Critical Hits Calculation.",
        scope: "world",
        config: true,
        default: "Default",
        type: String,
        choices: {
            "Default": "Doubles the value after rolling normal damage",
            "Double Dice": "Doubles dice rolled",
            "Crunchy Crit": "adds max damage to rolled damage",
            "Max Damage": "replaces the roll with max damage"
        }
    });



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

    const r = document.querySelector(':root');
    const rs = getComputedStyle(r);

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
            colors.forEach( c => {
                const setting = game.settings.settings.get(`swse.${c}`);
                //console.log(setting.default)
                game.settings.set("swse", c, setting.default);
            })
        }
    })


    game.settings.register("swse", "homebrewUseLilLiteralistSkills", {
        name: "Homebrew: Lil'Literalist's Skill",
        hint: "Climb, Jump, and Swim are all incorporated into a new skill called Athletics, a class skill for Jedi, Scouts, and Soldiers.",
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });
    game.settings.register("swse", "homebrewUseDarthauthorSkills", {
        name: "Homebrew: Darthauthor's Skill",
        hint: "Acrobatics and Jump are now one skill. Climb and Swim are one skill. Gather Information and Persuasion are one skill. Knowledge (Force) is a skill.",
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });
}
