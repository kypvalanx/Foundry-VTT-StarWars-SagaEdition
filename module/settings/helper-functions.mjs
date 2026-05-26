export function refreshActors(options = {renderOnly: false, renderForEveryone: false}) {
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

export function registerCSSColor(nameSpace, key, name, hint, scope, defaultColor, r, cssProperty) {
    if (window.Ardittristan && window.Ardittristan.ColorSetting) {
        new window.Ardittristan.ColorSetting(nameSpace, key, {
            name,
            hint,
            scope,
            restricted: false,
            defaultColor,
            onChange: (val) => {
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
                r.style.setProperty(cssProperty, val);
            }
        });
    }

    r.style.setProperty(cssProperty, game.settings.get(nameSpace, key));
    return key;
}