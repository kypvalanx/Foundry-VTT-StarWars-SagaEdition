export const dieSize = ["1", "1d2", "1d3", "1d4", "1d6", "1d8", "2d6", "2d8", "3d6", "3d8"];
export const dieSize_vanilla = ["1", "1d2", "1d3", "1d4", "1d6", "1d8", "1d10", "1d12"];
export const dieType = ["1", "2", "3", "4", "6", "8", "10", "12"];
export const sizeArray = ["Fine", "Diminutive", "Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan", "Colossal", "Colossal (Frigate)", "Colossal (Cruiser)", "Colossal (Station)"];
export const d20 = "1d20";
export const defaultSkills = ["Acrobatics", "Climb", "Deception", "Endurance", "Gather Information", "Initiative", "Jump",
    "Knowledge (Bureaucracy)", "Knowledge (Galactic Lore)", "Knowledge (Life Sciences)", "Knowledge (Physical Sciences)",
    "Knowledge (Social Sciences)", "Knowledge (Tactics)", "Knowledge (Technology)", "Mechanics", "Perception",
    "Persuasion", "Pilot", "Ride", "Stealth", "Survival", "Swim", "Treat Injury", "Use Computer", "Use the Force"];
export const defaultVehicleSkills = ["Pilot (Pilot)", "Initiative (Pilot)", "Stealth (Pilot)", "Deception (Pilot)", "Pilot (Copilot)", "Use Computer (Commander)", "Knowledge (Tactics) (Commander)", "Mechanics (System Operator)", "Use Computer (System Operator)", "Mechanics (Engineer)"];

export function getGroupedSkillMap() {
    if (game.settings.get("swse", "homebrewUseLilLiteralistSkills")) {
        return HOMEBREW_LILLITERALIST_SKILLS;
    }

    if (game.settings.get("swse", "homebrewUseDarthauthorSkills")) {
        return HOMEBREW_DARTHAUTHOR_SKILLS;
    }
    return undefined;
}

export function skills(actorType = "character") {
    let skills = actorType === "character" ? [...defaultSkills] : [...defaultVehicleSkills];
    let groupedSkillMap = getGroupedSkillMap();

    if (groupedSkillMap) {
        const grouped = [];
        for (const [key, value] of groupedSkillMap) {
            skills.push(key)
            if (value.grouped) {
                grouped.push(...value.grouped)
            }
        }
        if (grouped) {
            skills = skills.filter(s => !grouped.includes(s))
        }
    }

    return skills;
}

export const skillDetails = {
    "Acrobatics": {
        value: 0,
        attribute: "dex",
        uut: true,
        acp: true,
        link: "https://swse.fandom.com/wiki/Acrobatics"
    },
    "Climb": {
        value: 0,
        attribute: "str",
        uut: true,
        acp: true,
        link: "https://swse.fandom.com/wiki/Climb"
    },
    "Deception": {
        value: 0,
        attribute: "cha",
        uut: true,
        acp: false,
        link: "https://swse.fandom.com/wiki/Deception"
    },
    "Endurance": {
        value: 0,
        attribute: "con",
        uut: true,
        acp: true,
        link: "https://swse.fandom.com/wiki/Endurance"
    },
    "Gather Information": {
        value: 0,
        attribute: "cha",
        uut: true,
        acp: false,
        link: "https://swse.fandom.com/wiki/Gather_Information"
    },
    "Initiative": {
        value: 0,
        attribute: "dex",
        uut: true,
        acp: true,
        link: "https://swse.fandom.com/wiki/Initiative"
    },
    "Jump": {
        value: 0,
        attribute: "str",
        uut: true,
        acp: true,
        link: "https://swse.fandom.com/wiki/Jump"
    },
    "Knowledge (Bureaucracy)": {
        value: 0,
        attribute: "int",
        uut: true,
        acp: false,
        link: "https://swse.fandom.com/wiki/Knowledge"
    },
    "Knowledge (Galactic Lore)": {
        value: 0,
        attribute: "int",
        uut: true,
        acp: false,
        link: "https://swse.fandom.com/wiki/Knowledge"
    },
    "Knowledge (Life Sciences)": {
        value: 0,
        attribute: "int",
        uut: true,
        acp: false,
        link: "https://swse.fandom.com/wiki/Knowledge"
    },
    "Knowledge (Physical Sciences)": {
        value: 0,
        attribute: "int",
        uut: true,
        acp: false,
        link: "https://swse.fandom.com/wiki/Knowledge"
    },
    "Knowledge (Social Sciences)": {
        value: 0,
        attribute: "int",
        uut: true,
        acp: false,
        link: "https://swse.fandom.com/wiki/Knowledge"
    },
    "Knowledge (Tactics)": {
        value: 0,
        attribute: "int",
        uut: true,
        acp: false,
        link: "https://swse.fandom.com/wiki/Knowledge"
    },
    "Knowledge (Technology)": {
        value: 0,
        attribute: "int",
        uut: true,
        acp: false,
        link: "https://swse.fandom.com/wiki/Knowledge"
    },
    "Mechanics": {
        value: 0,
        attribute: "int",
        uut: false,
        acp: false,
        link: "https://swse.fandom.com/wiki/Mechanics"
    },
    "Perception": {
        value: 0,
        attribute: "wis",
        uut: true,
        acp: false,
        link: "https://swse.fandom.com/wiki/Perception"
    },
    "Persuasion": {
        value: 0,
        attribute: "cha",
        uut: true,
        acp: false,
        link: "https://swse.fandom.com/wiki/Persuasion"
    },
    "Pilot": {
        value: 0,
        attribute: "dex",
        uut: true,
        acp: false,
        link: "https://swse.fandom.com/wiki/Pilot"
    },
    "Ride": {
        value: 0,
        attribute: "dex",
        uut: true,
        acp: false,
        link: "https://swse.fandom.com/wiki/Ride"
    },
    "Stealth": {
        value: 0,
        attribute: "dex",
        uut: true,
        acp: true,
        link: "https://swse.fandom.com/wiki/Stealth"
    },
    "Survival": {
        value: 0,
        attribute: "wis",
        uut: true,
        acp: false,
        link: "https://swse.fandom.com/wiki/Survival"
    },
    "Swim": {
        value: 0,
        attribute: "str",
        uut: true,
        acp: true,
        link: "https://swse.fandom.com/wiki/Swim"
    },
    "Treat Injury": {
        value: 0,
        attribute: "wis",
        uut: true,
        acp: false,
        link: "https://swse.fandom.com/wiki/Treat_Injury"
    },
    "Use Computer": {
        value: 0,
        attribute: "int",
        uut: true,
        acp: false,
        link: "https://swse.fandom.com/wiki/Use_Computer"
    },
    "Use the Force": {
        value: 0,
        attribute: "cha",
        uut: false,
        acp: false,
        link: "https://swse.fandom.com/wiki/Use_the_Force"
    }
}

export const HEAVY_LOAD_SKILLS = ["acrobatics",
    "climb",
    "endurance",
    "initiative",
    "jump",
    "stealth",
    "swim"]

export const lightsaberForms = ["Ataru",
    "Djem So",
    "Jar'Kai",
    "Juyo",
    "Makashi",
    "Niman",
    "Shien",
    "Shii-Cho",
    "Sokan",
    "Soresu",
    "Trakata",
    "Vaapad",
    "Dun Möch",
    "Maho-Kai",
    "Tripzest"];

export const COLORS = {
    "red": "#FF0000",
    "green": "#00FF00",
    "cyan": "#00FFFF",
    "blue": "#0000FF",
    "crimson": "#DC143C",
    "dark crimson": "#402327",
    "aquamarine": "#7fffd4",
    "purple": "#663399",
    "orange": "#BB4411",
    "silver": "#999999"

}

export const crewPositions = ['Pilot', 'Copilot', 'Gunner', 'Commander', 'System Operator', 'Engineer'];

export const crewSlotResolution = {
    'Pilot': (crew) => (crew > 0) ? 1 : 0,
    'Copilot': (crew) => (crew > 1) ? 1 : 0,
    'Commander': (crew) => (crew > 2) ? 1 : 0,
    'System Operator': (crew) => (crew > 2) ? 1 : 0,
    'Engineer': (crew) => (crew > 2) ? 1 : 0,
};
export const vehicleActorTypes = ["vehicle", "npc-vehicle"];
export const characterActorTypes = ["character", "npc"];

export const crewQuality = {
    "Untrained": {"Attack Bonus": -5, "Check Modifier": 0, "CL Modifier": -1},
    "Normal": {"Attack Bonus": 0, "Check Modifier": 5, "CL Modifier": 0},
    "Skilled": {"Attack Bonus": 2, "Check Modifier": 6, "CL Modifier": 1},
    "Expert": {"Attack Bonus": 5, "Check Modifier": 8, "CL Modifier": 2},
    "Ace": {"Attack Bonus": 10, "Check Modifier": 12, "CL Modifier": 4}
};

export const uniqueKey = ["damage", "stunDamage"];

export const weaponGroup = {
    "Ranged Weapons": ["Heavy Weapons", "Pistols", "Rifles", "Simple Ranged Weapons", "Exotic Ranged Weapons", "Ranged Natural Weapons", 'Weapon Systems'],
    "Melee Weapons": ["Advanced Melee Weapons", "Lightsabers", "Simple Melee Weapons", "Exotic Melee Weapons", "Melee Natural Weapons"]
};

export const EQUIPABLE_TYPES = ["armor", "weapon", "equipment", "upgrade", "trait", "vehicleSystem"];
export const LIMITED_TO_ONE_TYPES = ["feat", "talent"]


export const RANGED_WEAPON_TYPES = ["pistols", "rifles", "exotic ranged weapons", "ranged weapons", "grenades", "heavy weapons", "simple ranged weapons"];
export const LIGHTSABER_WEAPON_TYPES = ["lightsabers", "lightsaber"];
export const SIMPLE_WEAPON_TYPES = ['simple melee weapons', 'simple ranged weapons', 'simple melee weapon', 'simple ranged weapon', "grenades"];

export const SUBTYPES = {
    "weapon": ["Advanced Melee Weapons", "Exotic Melee Weapons", "Exotic Ranged Weapons", "Grenades", "Heavy Weapons", "Lightsabers", "Mines", "Pistols", "Rifles", "Simple Melee Weapons", "Simple Ranged Weapons", "Explosives"],
    "armor": ["Light Armor", "Medium Armor", "Heavy Armor", "Droid Accessories (Droid Armor)"],
    "equipment": ["Equipment", "Communications Devices", "Computers and Storage Devices", "Cybernetic Devices", "Detection and Surveillance Devices", "Life Support", "Medical Gear", "Hazard", "Survival Gear", "Tools", "Weapon and Armor Accessories", "Advanced Cybernetics", "Implants", "Sith Artifacts", "Locomotion Systems", "Processor Systems", "Appendages", "Droid Accessories (Sensor Systems)", "Droid Accessories (Translator Units)", "Droid Accessories (Miscellaneous Systems)", "Droid Accessories (Communications Systems)", "Droid Accessories (Droid Stations)", "Droid Accessories (Shield Generator Systems)", "Droid Accessories (Hardened Systems)"],
    "upgrade": ["Weapon Upgrade", "Armor Upgrade", "Universal Upgrade", "Armor Trait", "Device Trait",
        "Droid Trait",
        "Vehicle Trait",
        "Weapon Trait",
        "Dark Armor Trait",
        "Sith Weapon Trait",
        "Sith Abomination Trait", "Lightsaber Crystals", "Lightsaber Modifications"],
    "template": ["Vehicle Templates", "Weapon Templates", "Armor Templates", "Droid Templates", "General Templates"],
    "vehicleSystem": ["Starship Accessories", "Weapon Systems", "Defense Systems", "Movement Systems", "Droid Accessories (Droid Stations)"],
    "background": ["event", "occupation", "planet of origin"],
    "class": ["Nonheroic", "Heroic", "Prestige"],
    "species": ["Organic", "Droid"],
    "beastattack": ["Melee Natural Weapons", "Ranged Natural Weapons"]
}

export const GM_BONUSES = [
    {display: "Ace Pilot Talent Trees", key: "provides", value: "Ace Pilot Talent Trees:#integer#"},
    {display: "Assassin Talent Trees", key: "provides", value: "Assassin Talent Trees:#integer#"},
    {display: "Bounty Hunter Talent Trees", key: "provides", value: "Bounty Hunter Talent Trees:#integer#"},
    {display: "Charlatan Talent Trees", key: "provides", value: "Charlatan Talent Trees:#integer#"},
    {display: "Corporate Agent Talent Trees", key: "provides", value: "Corporate Agent Talent Trees:#integer#"},
    {display: "Crime Lord Talent Trees", key: "provides", value: "Crime Lord Talent Trees:#integer#"},
    {display: "Droid Commander Talent Trees", key: "provides", value: "Droid Commander Talent Trees:#integer#"},
    {display: "Elite Trooper Talent Trees", key: "provides", value: "Elite Trooper Talent Trees:#integer#"},
    {display: "Enforcer Talent Trees", key: "provides", value: "Enforcer Talent Trees:#integer#"},
    {display: "Force Adept Talent Trees", key: "provides", value: "Force Adept Talent Trees:#integer#"},
    {display: "Force Disciple Talent Trees", key: "provides", value: "Force Disciple Talent Trees:#integer#"},
    {display: "Force Powers", key: "provides", value: "Force Powers:#integer#"},
    {display: "Force Prodigy Bonus Feats", key: "provides", value: "Force Prodigy Bonus Feats:#integer#"},
    {display: "Force Secret", key: "provides", value: "Force Secret:#integer#"},
    {display: "Force Talent Trees", key: "provides", value: "Force Talent Trees:#integer#"},
    {display: "Force Technique", key: "provides", value: "Force Technique:#integer#"},
    {display: "General Feats", key: "provides", value: "General Feats:#integer#"},
    {display: "Gladiator Talent Trees", key: "provides", value: "Gladiator Talent Trees:#integer#"},
    {display: "Gunslinger Talent Trees", key: "provides", value: "Gunslinger Talent Trees:#integer#"},
    {display: "Health Points", key: "hitPointEq", value: "#integer#"},
    {display: "Imperial Knight Talent Trees", key: "provides", value: "Imperial Knight Talent Trees:#integer#"},
    {display: "Improviser Talent Trees", key: "provides", value: "Improviser Talent Trees:#integer#"},
    {display: "Independent Droid Talent Trees", key: "provides", value: "Independent Droid Talent Trees:#integer#"},
    {display: "Infiltrator Talent Trees", key: "provides", value: "Infiltrator Talent Trees:#integer#"},
    {display: "Jedi Bonus Feats", key: "provides", value: "Jedi Bonus Feats:#integer#"},
    {display: "Jedi Knight Talent Trees", key: "provides", value: "Jedi Knight Talent Trees:#integer#"},
    {display: "Jedi Master Talent Trees", key: "provides", value: "Jedi Master Talent Trees:#integer#"},
    {display: "Jedi Talent Trees", key: "provides", value: "Jedi Talent Trees:#integer#"},
    {display: "Martial Arts Master Talent Trees", key: "provides", value: "Martial Arts Master Talent Trees:#integer#"},
    {display: "Master Privateer Talent Trees", key: "provides", value: "Master Privateer Talent Trees:#integer#"},
    {display: "Medic Talent Trees", key: "provides", value: "Medic Talent Trees:#integer#"},
    {display: "Melee Duelist Talent Trees", key: "provides", value: "Melee Duelist Talent Trees:#integer#"},
    {display: "Military Engineer Talent Trees", key: "provides", value: "Military Engineer Talent Trees:#integer#"},
    {display: "Noble Bonus Feats", key: "provides", value: "Noble Bonus Feats:#integer#"},
    {display: "Noble Talent Trees", key: "provides", value: "Noble Talent Trees:#integer#"},
    {display: "Officer Talent Trees", key: "provides", value: "Officer Talent Trees:#integer#"},
    {display: "Outlaw Talent Trees", key: "provides", value: "Outlaw Talent Trees:#integer#"},
    {display: "Pathfinder Talent Trees", key: "provides", value: "Pathfinder Talent Trees:#integer#"},
    {display: "Saboteur Talent Trees", key: "provides", value: "Saboteur Talent Trees:#integer#"},
    {display: "Scoundrel Bonus Feats", key: "provides", value: "Scoundrel Bonus Feats:#integer#"},
    {display: "Scoundrel Talent Trees", key: "provides", value: "Scoundrel Talent Trees:#integer#"},
    {display: "Scout Bonus Feats", key: "provides", value: "Scout Bonus Feats:#integer#"},
    {display: "Scout Talent Trees", key: "provides", value: "Scout Talent Trees:#integer#"},
    {display: "Shaper Talent Trees", key: "provides", value: "Shaper Talent Trees:#integer#"},
    {display: "Sith Apprentice Talent Trees", key: "provides", value: "Sith Apprentice Talent Trees:#integer#"},
    {display: "Sith Lord Talent Trees", key: "provides", value: "Sith Lord Talent Trees:#integer#"},
    {display: "Soldier Bonus Feats", key: "provides", value: "Soldier Bonus Feats:#integer#"},
    {display: "Soldier Talent Trees", key: "provides", value: "Soldier Talent Trees:#integer#"},
    {display: "Technician Bonus Feats", key: "provides", value: "Technician Bonus Feats:#integer#"},
    {display: "Technician Talent Trees", key: "provides", value: "Technician Talent Trees:#integer#"},
    {display: "Trained Skills", key: "trainedSkills", value: "#integer#"},
    {display: "Vanguard Talent Trees", key: "provides", value: "Vanguard Talent Trees:#integer#"},
    {display: "Fortitude Defense Bonus", key: "fortitudeDefenseBonus", value: "#integer#"},
    {display: "Reflex Defense Bonus", key: "reflexDefenseBonus", value: "#integer#"},
    {display: "Will Defense Bonus", key: "willDefenseBonus", value: "#integer#"}
]

//fortitudeDefenseBonus
export const NEW_LINE = `
`;

export const DROID_COST_FACTOR = {
    "Colossal": 20,
    "Gargantuan": 10,
    "Huge": 5,
    "Large": 2,
    "Medium": 1,
    "Small": 2,
    "Tiny": 5,
    "Diminutive": 10,
    "Fine": 20
}
export const SIZE_CARRY_CAPACITY_MODIFIER = {
    "Colossal": 20,
    "Gargantuan": 10,
    "Huge": 5,
    "Large": 2,
    "Medium": 1,
    "Small": 0.75,
    "Tiny": 0.5,
    "Diminutive": 0.25,
    "Fine": 0.01
}

export const GRAVITY_CARRY_CAPACITY_MODIFIER = {
    "Normal": 1,
    "High": 0.5,
    "Low": 2,
    "Zero": 10,
}

export const ITEM_ONLY_ATTRIBUTES = [
    "damage",
    "damageType",
    "takeMultipleTimes",
    "isThrowable",
    "ammo",
    "itemMod",
    "overheatLimit",
    "prefix",
    "suffix",
    "cooldownTime"
]

export const CLASSES_BY_STARTING_FEAT = {
    "Shake It Off": ["Scout"],
    "Weapon Proficiency (Heavy Weapons)": ["Nonheroic"],
    "Force Sensitivity": ["Jedi", "Force Prodigy"],
    "Armor Proficiency (Light)": ["Soldier", "Nonheroic"],
    "Weapon Proficiency (Lightsabers)": ["Jedi"],
    "Weapon Proficiency (Rifles)": ["Scout", "Soldier", "Nonheroic"],
    "Skill Training": ["Nonheroic"],
    "Linguist": ["Noble"],
    "Weapon Proficiency (Pistols)": ["Noble", "Scoundrel", "Scout", "Soldier", "Nonheroic"],
    "Tech Specialist": ["Technician"],
    "Skill Focus": ["Nonheroic"],
    "Weapon Proficiency (Simple Weapons)": ["Jedi", "Noble", "Scoundrel", "Scout", "Soldier", "Technician", "Force Prodigy", "Nonheroic"],
    "Force Training": ["Force Prodigy"],
    "Point-Blank Shot": ["Scoundrel"],
    "Armor Proficiency (Medium)": ["Soldier", "Nonheroic"],
    "Weapon Proficiency (Advanced Melee Weapons)": ["Nonheroic"]
}

export const KNOWN_WEIRD_UNITS = [
    "Eldewn and Elsae Sarvool"
]
export const HOMEBREW_DARTHAUTHOR_SKILLS = new Map([
    [
        "Athletics",
        {
            grouped: ["Climb", "Swim"],
            classes: ["Scout", "Soldier", "Force Prodigy"],
            attribute: "str",
            uut: true
        }
    ],
    [
        "Agility",
        {
            grouped: ["Jump", "Acrobatics"],
            classes: ["Scout", "Soldier", "Jedi", "Scoundrel", "Force Prodigy"],
            attribute: "dex",
            uut: true
        }
    ],
    [
        "Diplomacy",
        {
            grouped: ["Gather Information", "Persuasion"],
            classes: ["Noble", "Scoundrel", "Technician"],
            attribute: "cha",
            uut: true
        }
    ],
    [
        "Knowledge (Force)",
        {
            classes: ["Jedi", "Noble", "Scoundrel", "Scout", "Soldier", "Technician", "Force Prodigy"],
            attribute: "int",
            uut: false
        }
    ]
]);
export const HOMEBREW_LILLITERALIST_SKILLS = new Map([["Athletics", {
    grouped: ["Jump", "Climb", "Swim"],
    classes: ["Scout", "Soldier", "Jedi"],
    attribute: "str",
    uut: true
}]]);