
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
}