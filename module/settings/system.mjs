

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

    const r = document.querySelector(':root');
    const rs = getComputedStyle(r);
    registerCSSColor("swse", "cssBackgroundColor", "Background Color", "Modifies the Background color of sheets", "client", "#e8e8e8", r, '--color-background');
    registerCSSColor("swse", "cssColorShadowPrimary", "Shadow Color", "Modifies the Shadow color of sheets", "client", "#424ba4", r, '--color-shadow-primary');
    registerCSSColor("swse", "cssColorDarkPrimary", "Text Color", "Modifies the standard text color", "client", "#191813", r, '--color-text-dark-primary');
    registerCSSColor("swse", "cssForegroundColor", "Foreground Color", "Modifies the Foreground color of sheets", "client", "#424ba4", r, '--color-foreground');
    registerCSSColor("swse", "cssMidgroundColor", "Midground Color", "Modifies the Midground color of sheets", "client", "#bcc3fd", r, '--color-midground');
    registerCSSColor("swse", "cssHyperlink", "Hyperlink Color", "Modifies the Hyperlink color of sheets", "client", "#132cff", r, '--color-text-hyperlink');
}