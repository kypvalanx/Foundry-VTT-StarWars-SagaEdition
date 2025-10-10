export const SWSE = {}

SWSE.Combat = {};

Object.defineProperty(SWSE.Combat, "range", {
    get: () => {
        const rangeType = game.settings.get("swse", "homebrewRanges")

        if(rangeType === "halfRange"){
            return {
                "Heavy Weapons": {
                    "point-blank": { "string": "0-25 squares", "low": 0, "high": 25 },
                    "short":       { "string": "26-50 squares", "low": 26, "high": 50 },
                    "medium":      { "string": "51-125 squares", "low": 51, "high": 125 },
                    "long":        { "string": "126-250 squares", "low": 126, "high": 250 }
                },

                "Pistols": {
                    "point-blank": { "string": "0-10 squares", "low": 0, "high": 10 },
                    "short":       { "string": "11-20 squares", "low": 11, "high": 20 },
                    "medium":      { "string": "21-30 squares", "low": 21, "high": 30 },
                    "long":        { "string": "31-40 squares", "low": 31, "high": 40 }
                },

                "Rifles": {
                    "point-blank": { "string": "0-15 squares", "low": 0, "high": 15 },
                    "short":       { "string": "16-30 squares", "low": 16, "high": 30 },
                    "medium":      { "string": "31-75 squares", "low": 31, "high": 75 },
                    "long":        { "string": "76-150 squares", "low": 76, "high": 150 }
                },

                "Simple Ranged Weapons": {
                    "point-blank": { "string": "0-10 squares", "low": 0, "high": 10 },
                    "short":       { "string": "11-20 squares", "low": 11, "high": 20 },
                    "medium":      { "string": "21-30 squares", "low": 21, "high": 30 },
                    "long":        { "string": "31-40 squares", "low": 31, "high": 40 }
                },
                "Thrown Weapons":	        {"point-blank": {"string": "0-6 squares", "low":0,"high":6},	"short": {"string": "7-8 squares", "low":7,"high":8},	    "medium": {"string": "9-10 squares", "low":9,"high":10},	    "long": {"string": "11-12 squares", "low":11,"high":12}},
                "Melee Weapons":	        {"point-blank": {"string": "0-1 squares", "low":0,"high":1}}
            }
        }


        return {
            "Heavy Weapons":	        {"point-blank": {"string": "0-50 squares", "low":0,"high":50},	"short": {"string": "51-100 squares", "low":51,"high":100},  "medium": {"string": "101-250 squares", "low":101,"high":250},	"long": {"string": "251-500 squares", "low":251,"high":500}},
            "Pistols":	                {"point-blank": {"string": "0-20 squares", "low":0,"high":20},	"short": {"string": "21-40 squares", "low":21,"high":40},	"medium": {"string": "41-60 squares", "low":41,"high":60},	    "long": {"string": "61-80 squares", "low":61,"high":80}},
            "Rifles":	                {"point-blank": {"string": "0-30 squares", "low":0,"high":30},	"short": {"string": "31-60 squares", "low":31,"high":60},	"medium": {"string": "61-150 squares", "low":61,"high":150},	    "long": {"string": "151-300 squares", "low":151,"high":300}},
            "Simple Ranged Weapons":	{"point-blank": {"string": "0-20 squares", "low":0,"high":20},	"short": {"string": "21-40 squares", "low":21,"high":40},	"medium": {"string": "41-60 squares", "low":41,"high":60},	    "long": {"string": "61-80 squares", "low":61,"high":80}},
            "Thrown Weapons":	        {"point-blank": {"string": "0-6 squares", "low":0,"high":6},	"short": {"string": "7-8 squares", "low":7,"high":8},	    "medium": {"string": "9-10 squares", "low":9,"high":10},	    "long": {"string": "11-12 squares", "low":11,"high":12}},
            "Melee Weapons":	        {"point-blank": {"string": "0-1 squares", "low":0,"high":1}}
        }
    }
});


SWSE.Combat.rangePenalty = {"point-blank": 0,	"short": -2,  "medium": -5,	"long": -10}

SWSE.Abilities = {};
SWSE.Abilities.abilities = {
    str: "SWSE.AbilityStr",
    dex: "SWSE.AbilityDex",
    con: "SWSE.AbilityCon",
    int: "SWSE.AbilityInt",
    wis: "SWSE.AbilityWis",
    cha: "SWSE.AbilityCha",
};
SWSE.Abilities.abilitiesShort = {
    str: "SWSE.AbilityShortStr",
    dex: "SWSE.AbilityShortDex",
    con: "SWSE.AbilityShortCon",
    int: "SWSE.AbilityShortInt",
    wis: "SWSE.AbilityShortWis",
    cha: "SWSE.AbilityShortCha",
};
SWSE.Abilities.droidSkip = {
    str: false,
    dex: false,
    con: true,
    int: false,
    wis: false,
    cha: false,
};



SWSE.Abilities.standardScorePackage = [15,14,13,12,10,8];

SWSE.Abilities.abilityCost = {
    8:  0,
    9:  1,
    10: 2,
    11: 3,
    12: 4,
    13: 5,
    14: 6,
    15: 8,
    16: 10,
    17: 13,
    18: 16
}

SWSE.Abilities.defaultAbilityRoll = "4d6kh3";
SWSE.Abilities.defaultPointBuyTotal = 28;
SWSE.Abilities.droidPointBuyTotal = 21;

SWSE.conditionTrack = ["0", "-1", "-2", "-5", "-10", "OUT"]



/**
 * set the available attributes for an item attribute field
 * @type {*[]}
 */
SWSE.RecognizedAttributes = [];

export function initializeStatusEffects(config){
    config.statusEffects.push(...[
        {
            id: "condition-1",
            label: "EFFECT.StatusCondition-1",
            icon: "systems/swse/icon/status/condition-1.png",
            changes: [{key: "condition", value:"-1"}]
        },
        {
            id: "condition-2",
            label: "EFFECT.StatusCondition-2",
            icon: "systems/swse/icon/status/condition-2.png",
            changes: [{key: "condition", value:"-2"}]
        },
        {
            id: "condition-5",
            label: "EFFECT.StatusCondition-5",
            icon: "systems/swse/icon/status/condition-5.png",
            changes: [{key: "condition", value:"-5"}]
        },
        {
            id: "condition-10",
            label: "EFFECT.StatusCondition-10",
            icon: "systems/swse/icon/status/condition-10.png",
            changes: [{key: "condition", value:"-10"}, {key: "speedMultiplier", value: "0.5"}]
        },
        {
            id: "conditionHelpless",
            label: "EFFECT.StatusConditionHelpless",
            icon: "systems/swse/icon/status/helpless.png",
            changes: [{key: "condition", value:"OUT"}, {key: "dexterityMax", value: "0"}, {key: "dexterityMaxBonus", value: "0"}]
        },
        {
            id: "gravityLow",
            label: "EFFECT.StatusGravityLow",
            icon: "systems/swse/icon/status/low-gravity.png",
            changes: [
                {key: "gravity", value:"Low"},
                {key: "speedMultiplier", value: "1.25:min 1"},
                {key: "carryCapacityMultiplier", value: "2"},
                {key: "skillBonus", value: "str:2"},
                {key: "toHitModifier", value: "-2"}
            ]
        },
        {
            id: "gravityHigh",
            label: "EFFECT.StatusGravityHigh",
            icon: "systems/swse/icon/status/high-gravity.png",
            changes: [
                {key: "gravity", value:"High"},
                {key: "speedMultiplier", value: "0.75:min 1"},
                {key: "carryCapacityMultiplier", value: "0.5"},
                {key: "skillBonus", value: "str:-2"},
                {key: "toHitModifier", value: "-2"}
            ]
        },
        {
            id: "gravityZero",
            label: "EFFECT.StatusGravityZero",
            icon: "systems/swse/icon/status/zero-gravity.png",
            changes: [
                {key: "gravity", value:"Zero"},
                {key: "speed", value: "Base Speed/Walking Speed/Wheeled Speed/Tracked Speed/Hovering Speed -> Flying Speed"},
                {key: "carryCapacityMultiplier", value: "10"},
                {key: "skillBonus", value: "all:-5"},
                {key: "toHitModifier", value: "-5"}
            ]
        },
        {
            id: "shield",
            label: "EFFECT.StatusShield",
            icon: "icons/svg/shield.svg"
        },
        {
            id: "cover",
            label: "EFFECT.StatusCover",
            icon: "systems/swse/icon/status/cover.png",
            changes: [{key: "dexterityBonus", value:"5"}]
        },
        {
            id: "improvedCover",
            label: "EFFECT.StatusImprovedCover",
            icon: "systems/swse/icon/status/improved-cover.png",
            changes: [{key: "dexterityBonus", value:"10"}]
        },
        {
            id: "totalCover",
            label: "EFFECT.StatusTotalCover",
            icon: "systems/swse/icon/status/total-cover.png"
        }
    ])
}
