export const SWSE = {}

SWSE.Combat = {};
SWSE.Combat.range = {
    "Heavy Weapons":	        {"point-blank": {"string": "0-50 squares", "low":0,"high":50},	"short": {"string": "51-100 squares", "low":51,"high":100},  "medium": {"string": "101-250 squares", "low":101,"high":250},	"long": {"string": "251-500 squares", "low":251,"high":500}},
    "Pistols":	                {"point-blank": {"string": "0-20 squares", "low":0,"high":20},	"short": {"string": "21-40 squares", "low":21,"high":40},	"medium": {"string": "41-60 squares", "low":41,"high":60},	    "long": {"string": "61-80 squares", "low":61,"high":80}},
    "Rifles":	                {"point-blank": {"string": "0-30 squares", "low":0,"high":30},	"short": {"string": "31-60 squares", "low":31,"high":60},	"medium": {"string": "61-150 squares", "low":61,"high":150},	    "long": {"string": "151-300 squares", "low":151,"high":300}},
    "Simple Ranged Weapons":	{"point-blank": {"string": "0-20 squares", "low":0,"high":20},	"short": {"string": "21-40 squares", "low":21,"high":40},	"medium": {"string": "41-60 squares", "low":41,"high":60},	    "long": {"string": "61-80 squares", "low":61,"high":80}},
    "Thrown Weapons":	        {"point-blank": {"string": "0-6 squares", "low":0,"high":6},	"short": {"string": "7-8 squares", "low":7,"high":8},	    "medium": {"string": "9-10 squares", "low":9,"high":10},	    "long": {"string": "11-12 squares", "low":11,"high":12}}
};

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



/**
 * set the available attributes for an item attribute field
 * @type {*[]}
 */
SWSE.RecognizedAttributes = [];

CONFIG.statusEffects.push(...[
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
        id: "shield",
        label: "EFFECT.StatusShield",
        icon: "icons/svg/shield.svg"
    }
])