export const SWSE = {}

SWSE.Combat = {};
SWSE.Combat.range = {
    "Heavy Weapons":	{"point-blank": "0-50 squares",	"short": "51-100 squares",  "medium": "101-250 squares",	"long": "251-500 squares"},
    "Pistols":	        {"point-blank": "0-20 squares",	"short": "21-40 squares",	"medium": "41-60 squares",	    "long": "61-80 squares"},
    "Rifles":	        {"point-blank": "0-30 squares",	"short": "31-60 squares",	"medium": "61-150 squares",	    "long": "151-300 squares"},
    "Simple Weapons":	{"point-blank": "0-20 squares",	"short": "21-40 squares",	"medium": "41-60 squares",	    "long": "61-80 squares"},
    "Thrown Weapons":	{"point-blank": "0-6 squares",	"short": "7-8 squares",	    "medium": "9-10 squares",	    "long": "11-12 squares"}
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