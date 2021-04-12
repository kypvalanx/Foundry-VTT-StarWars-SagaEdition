const SWSEActor = require( "../../../module/actor/actor.mjs");

test('initial SWSE Actor Test', () => {
    let json = {
        "_id": "qgbqktTVhdSzDPdf",
        "name": "new guy",
        "type": "character",
        "data": {
            "health": {
                "value": 10,
                "min": 0,
                "max": 10,
                "temp": null,
                "dr": null,
                "sr": null,
                "condition": null
            },
            "classesfirst": "LQ5XbkGR0C65DNt6",
            "abilities": {
                "str": {
                    "total": 10,
                    "mod": 0,
                    "classLevelBonus": 0,
                    "speciesBonus": 0,
                    "ageBonus": 0,
                    "equipmentBonus": 0,
                    "buffBonus": 0,
                    "customBonus": 0,
                    "bonus": 0,
                    "base": 10
                },
                "dex": {
                    "total": 10,
                    "mod": 0,
                    "classLevelBonus": 0,
                    "speciesBonus": 0,
                    "ageBonus": 0,
                    "equipmentBonus": 0,
                    "buffBonus": 0,
                    "customBonus": 0,
                    "bonus": 0,
                    "base": 10
                },
                "con": {
                    "total": 10,
                    "mod": 0,
                    "classLevelBonus": 0,
                    "speciesBonus": 0,
                    "ageBonus": 0,
                    "equipmentBonus": 0,
                    "buffBonus": 0,
                    "customBonus": 0,
                    "bonus": 0,
                    "base": 10
                },
                "int": {
                    "total": 10,
                    "mod": 0,
                    "classLevelBonus": 0,
                    "speciesBonus": 0,
                    "ageBonus": 0,
                    "equipmentBonus": 0,
                    "buffBonus": 0,
                    "customBonus": 0,
                    "bonus": 0,
                    "base": 10
                },
                "wis": {
                    "total": 10,
                    "mod": 0,
                    "classLevelBonus": 0,
                    "speciesBonus": 0,
                    "ageBonus": 0,
                    "equipmentBonus": 0,
                    "buffBonus": 0,
                    "customBonus": 0,
                    "bonus": 0,
                    "base": 10
                },
                "cha": {
                    "total": 10,
                    "mod": 0,
                    "classLevelBonus": 0,
                    "speciesBonus": 0,
                    "ageBonus": 0,
                    "equipmentBonus": 0,
                    "buffBonus": 0,
                    "customBonus": 0,
                    "bonus": 0,
                    "base": 10
                }
            },
            "biography": "",
            "attributes": {
                "level": {
                    "value": 1
                }
            },
            "defence": {
                "ref": null,
                "fort": null,
                "will": null,
                "dt": null
            },
            "classes": {
                "first": false
            }
        },
        "sort": 100001,
        "flags": {
            "exportSource": {
                "world": "swse-test",
                "system": "swse",
                "coreVersion": "0.7.8",
                "systemVersion": "1.0.0"
            }
        },
        "token": {
            "flags": {},
            "name": "new guy",
            "displayName": 0,
            "img": "icons/svg/mystery-man.svg",
            "tint": null,
            "width": 1,
            "height": 1,
            "scale": 1,
            "lockRotation": false,
            "rotation": 0,
            "vision": false,
            "dimSight": 0,
            "brightSight": 0,
            "dimLight": 0,
            "brightLight": 0,
            "sightAngle": 360,
            "lightAngle": 360,
            "lightAlpha": 1,
            "lightAnimation": {
                "speed": 5,
                "intensity": 5
            },
            "actorId": "qgbqktTVhdSzDPdf",
            "actorLink": false,
            "disposition": -1,
            "displayBars": 0,
            "bar1": {},
            "bar2": {},
            "randomImg": false
        },
        "items": [
            {
                "_id": "MWtZ2YTEnmaR7LN6",
                "name": "jedi",
                "type": "class",
                "data": {
                    "description": "",
                    "attributes": [],
                },
                "sort": 100001,
                "flags": {
                    "core": {
                        "sourceId": "Item.YCmkEG6rNvkcKmcY"
                    }
                },
                "img": "icons/svg/mystery-man.svg",
                "effects": []
            },
            {
                "_id": "D8sgUxumcaczT0dc",
                "name": "jedi",
                "type": "class",
                "data": {
                    "description": "",
                    "attributes": []
                },
                "sort": 100001,
                "flags": {
                    "core": {
                        "sourceId": "Item.YCmkEG6rNvkcKmcY"
                    }
                },
                "img": "icons/svg/mystery-man.svg",
                "effects": []
            },
            {
                "_id": "LQ5XbkGR0C65DNt6",
                "name": "soldier",
                "type": "class",
                "data": {
                    "description": "",
                    "attributes": []
                },
                "sort": 100001,
                "flags": {
                    "core": {
                        "sourceId": "Item.Dni71bddUSumX6ni"
                    }
                },
                "img": "icons/svg/mystery-man.svg",
                "effects": []
            }
        ],
        "effects": []
    }

    let actor = SWSEActor.create(json);
});