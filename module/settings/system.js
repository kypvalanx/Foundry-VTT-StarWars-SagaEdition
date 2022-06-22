


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
}