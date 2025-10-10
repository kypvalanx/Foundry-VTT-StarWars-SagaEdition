import {refreshActors} from "./helper-functions.mjs";

export function lilLiteralistHomebrewOptions() {
    //1
    game.settings.register("swse", "skillFocusDelay", {
        name: "You do not get the benefits of Skill Focus until level 7.",
        hint: "You may take it before then, but the bonus will not apply to any Skill Checks.",
        scope: "world",
        config: true,
        default: false,
        type: Boolean,
        onChange: () => refreshActors({renderForEveryone: true})

    });

    //2
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
        onChange: () => refreshActors({renderForEveryone: true})

    });

    //3
    game.settings.register("swse", "lilLiteralistHomebrewBonusTrainedSkill", {
        name: "You gain a bonus Trained Knowledge skill at first level (1 bonus Knowledge skill recommended).",
        hint: "Few Knowledge skills have a direct application in game, this allows characters to be more fleshed out and implements the usage of lesser-used skills.",
        scope: "world",
        config: true,
        default: 0,
        type: Number,
        onChange: () => refreshActors({renderForEveryone: true})

    });

    //4
    game.settings.register("swse", "homebrewUseLilLiteralistSkills", {
        name: "Homebrew: Lil'Literalist's Skill",
        hint: "Climb, Jump, and Swim are all incorporated into a new skill called Athletics, a class skill for Jedi, Scouts, and Soldiers.",
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });

    //5
    game.settings.register("swse", "homebrewRanges", {
        name: "Homebrew: Ranges",
        hint: "Want to avoid all combat happening at point-blank range?",
        scope: "world",
        config: true,
        default: "default",
        type: String,
        choices: {
            default: "Vanilla Ranges",
            halfRange: "Lil'Literalist: Cut the weapon ranges in half (except for thrown)",
        }
    });
}

export function darthauthorHomebrewOptions() {
    game.settings.register("swse", "homebrewUseDarthauthorSkills", {
        name: "Homebrew: Darthauthor's Skill",
        hint: "Acrobatics and Jump are now one skill. Climb and Swim are one skill. Gather Information and Persuasion are one skill. Knowledge (Force) is a skill.",
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });
}

export function commonHomebrewOptions() {
    game.settings.register("swse", "enable5105Measurement", {
        name: "Enable counting alternating diagonals as double the distance",
        hint: "Similar to games like Pathfinder",
        scope: "world",
        config: true,
        default: "101010",
        type: String,
        choices: {
            101010: "Diagonals are double move (default)",
            555: "Diagonals are single move",
            5105: "Alternating double distance diagonals"
        },
        onChange: (rule) => (canvas.grid.diagonalRule = rule)
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
}