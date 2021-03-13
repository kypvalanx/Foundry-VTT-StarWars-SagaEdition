
export const registerSystemSettings = function () {

    game.settings.register("swse", "mergePointBlankShotAndPreciseShot", {
        name: "Taking Point-Blank Shot provides the Precise Shot Feat",
        scope: "world",
        config: true,
        default: false,
        type: Boolean,
        onChange: () => {
            game.actors.entities.forEach((o) => {
                console.log(o);
                o.prepareData()
            });
            Object.values(game.actors.tokens).forEach((o) => {
                o.prepareData()
            });
        },
    });
}