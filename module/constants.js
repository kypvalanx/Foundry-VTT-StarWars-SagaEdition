export const dieSize = ["1", "1d2", "1d3", "1d4", "1d6", "1d8", "2d6", "2d8", "3d6", "3d8"];
export const dieType = ["1", "2", "3", "4", "6", "8", "10", "12"];
export const sizeArray = ["Fine", "Diminutive", "Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan", "Colossal", "Colossal (Frigate)", "Colossal (Cruiser)", "Colossal (Station)"];
export const d20 = "1d20";
export const skills = ["Acrobatics", "Climb", "Deception", "Endurance", "Gather Information", "Initiative", "Jump",
    "Knowledge (Bureaucracy)", "Knowledge (Galactic Lore)", "Knowledge (Life Sciences)", "Knowledge (Physical Sciences)",
    "Knowledge (Social Sciences)", "Knowledge (Tactics)", "Knowledge (Technology)", "Mechanics", "Perception",
    "Persuasion", "Pilot", "Ride", "Stealth", "Survival", "Swim", "Treat Injury", "Use Computer", "Use the Force"];
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

export const crewPositions = ['Pilot', 'Copilot', 'Gunner', 'Commander', 'System Operator', 'Engineer', 'Astromech Droid'];
export const vehicleActorTypes = ["vehicle", "npc-vehicle"];

export const crewQuality = {
    "Untrained":{"Attack Bonus":-5, "Check Modifier": 0, "CL Modifier":-1},
    "Normal":   {"Attack Bonus": 0, "Check Modifier": 5, "CL Modifier": 0},
    "Skilled":  {"Attack Bonus": 2, "Check Modifier": 6, "CL Modifier": 1},
    "Expert":   {"Attack Bonus": 5, "Check Modifier": 8, "CL Modifier": 2},
    "Ace":      {"Attack Bonus":10, "Check Modifier":12, "CL Modifier": 4}
};

export const uniqueKey = ["damage", "stunDamage"];

export const weaponGroup = {
    "Ranged Weapons":["Heavy Weapons", "Pistols", "Rifles", "Simple Ranged Weapons", "Exotic Ranged Weapons", "Ranged Natural Weapons"],
    "Melee Weapons":["Advanced Melee Weapons", "Lightsabers", "Simple Melee Weapons", "Exotic Melee Weapons", "Melee Natural Weapons"]
};


export const RANGED_WEAPON_TYPES = ["pistols", "rifles", "exotic ranged weapons", "ranged weapons", "grenades",
    "heavy weapons", "simple ranged weapons"];
export const LIGHTSABER_WEAPON_TYPES = ["lightsabers", "lightsaber"];
export const SIMPLE_WEAPON_TYPES = ['simple melee weapons', 'simple ranged weapons', 'simple melee weapon', 'simple ranged weapon', "grenades"];

export const SUBTYPES = {
    "weapon": ["Advanced Melee Weapons", "Exotic Melee Weapons", "Exotic Ranged Weapons", "Grenades", "Heavy Weapons", "Lightsabers", "Mines", "Pistols", "Rifles", "Simple Melee Weapons", "Simple Ranged Weapons", "Explosives"],
    "armor": ["Light Armor", "Medium Armor", "Heavy Armor", "Droid Accessories (Droid Armor)"],
    "equipment": ["Equipment", "Communications Devices", "Computers and Storage Devices", "Cybernetic Devices", "Detection and Surveillance Devices", "Life Support", "Medical Gear", "Hazard", "Survival Gear", "Tools", "Weapons and Armor Accessories", "Advanced Cybernetics", "Implants", "Sith Artifacts", "Locomotion Systems", "Processor Systems", "Appendages", "Droid Accessories (Sensor Systems)", "Droid Accessories (Translator Units)", "Droid Accessories (Miscellaneous Systems)", "Droid Accessories (Communications Systems)", "Droid Accessories (Droid Stations)", "Droid Accessories (Shield Generator Systems)", "Droid Accessories (Hardened Systems)"],
    "upgrade": ["Weapons Upgrade", "Armor Upgrade"],
    "template": ["Vehicle Templates", "Weapon Templates", "Armor Templates", "Droid Templates", "General Templates"],
    "vehicleSystem": ["Starship Accessories", "Weapon Systems", "Defense Systems", "Movement Systems", "Droid Accessories (Droid Stations)"],
    "background": ["event", "occupation", "planet of origin"],
    "class": ["Nonheroic", "Heroic", "Prestige"],
    "species": ["Organic", "Droid"],
    "beastattack": ["Melee Natural Weapons", "Ranged Natural Weapons"]
}

export const GM_BONUSES = [
    {display: "Ace Pilot Talent Trees", key:"provides", value:"Ace Pilot Talent Trees:#integer#"},
    {display: "Assassin Talent Trees", key:"provides", value:"Assassin Talent Trees:#integer#"},
    {display: "Bounty Hunter Talent Trees", key:"provides", value:"Bounty Hunter Talent Trees:#integer#"},
    {display: "Charlatan Talent Trees", key:"provides", value:"Charlatan Talent Trees:#integer#"},
    {display: "Corporate Agent Talent Trees", key:"provides", value:"Corporate Agent Talent Trees:#integer#"},
    {display: "Crime Lord Talent Trees", key:"provides", value:"Crime Lord Talent Trees:#integer#"},
    {display: "Droid Commander Talent Trees", key:"provides", value:"Droid Commander Talent Trees:#integer#"},
    {display: "Elite Trooper Talent Trees", key:"provides", value:"Elite Trooper Talent Trees:#integer#"},
    {display: "Enforcer Talent Trees", key:"provides", value:"Enforcer Talent Trees:#integer#"},
    {display: "Force Adept Talent Trees", key:"provides", value:"Force Adept Talent Trees:#integer#"},
    {display: "Force Disciple Talent Trees", key:"provides", value:"Force Disciple Talent Trees:#integer#"},
    {display: "Force Powers", key:"provides", value:"Force Powers:#integer#"},
    {display: "Force Prodigy Bonus Feats", key:"provides", value:"Force Prodigy Bonus Feats:#integer#"},
    {display: "Force Secret", key:"provides", value:"Force Secret:#integer#"},
    {display: "Force Talent Trees", key:"provides", value:"Force Talent Trees:#integer#"},
    {display: "Force Technique", key:"provides", value:"Force Technique:#integer#"},
    {display: "General Feats", key:"provides", value:"General Feats:#integer#"},
    {display: "Gladiator Talent Trees", key:"provides", value:"Gladiator Talent Trees:#integer#"},
    {display: "Gunslinger Talent Trees", key:"provides", value:"Gunslinger Talent Trees:#integer#"},
    {display: "Health Points", key:"hitPointEq", value:"#integer#"},
    {display: "Imperial Knight Talent Trees", key:"provides", value:"Imperial Knight Talent Trees:#integer#"},
    {display: "Improviser Talent Trees", key:"provides", value:"Improviser Talent Trees:#integer#"},
    {display: "Independent Droid Talent Trees", key:"provides", value:"Independent Droid Talent Trees:#integer#"},
    {display: "Infiltrator Talent Trees", key:"provides", value:"Infiltrator Talent Trees:#integer#"},
    {display: "Jedi Bonus Feats", key:"provides", value:"Jedi Bonus Feats:#integer#"},
    {display: "Jedi Knight Talent Trees", key:"provides", value:"Jedi Knight Talent Trees:#integer#"},
    {display: "Jedi Master Talent Trees", key:"provides", value:"Jedi Master Talent Trees:#integer#"},
    {display: "Jedi Talent Trees", key:"provides", value:"Jedi Talent Trees:#integer#"},
    {display: "Martial Arts Master Talent Trees", key:"provides", value:"Martial Arts Master Talent Trees:#integer#"},
    {display: "Master Privateer Talent Trees", key:"provides", value:"Master Privateer Talent Trees:#integer#"},
    {display: "Medic Talent Trees", key:"provides", value:"Medic Talent Trees:#integer#"},
    {display: "Melee Duelist Talent Trees", key:"provides", value:"Melee Duelist Talent Trees:#integer#"},
    {display: "Military Engineer Talent Trees", key:"provides", value:"Military Engineer Talent Trees:#integer#"},
    {display: "Noble Bonus Feats", key:"provides", value:"Noble Bonus Feats:#integer#"},
    {display: "Noble Talent Trees", key:"provides", value:"Noble Talent Trees:#integer#"},
    {display: "Officer Talent Trees", key:"provides", value:"Officer Talent Trees:#integer#"},
    {display: "Outlaw Talent Trees", key:"provides", value:"Outlaw Talent Trees:#integer#"},
    {display: "Pathfinder Talent Trees", key:"provides", value:"Pathfinder Talent Trees:#integer#"},
    {display: "Saboteur Talent Trees", key:"provides", value:"Saboteur Talent Trees:#integer#"},
    {display: "Scoundrel Bonus Feats", key:"provides", value:"Scoundrel Bonus Feats:#integer#"},
    {display: "Scoundrel Talent Trees", key:"provides", value:"Scoundrel Talent Trees:#integer#"},
    {display: "Scout Bonus Feats", key:"provides", value:"Scout Bonus Feats:#integer#"},
    {display: "Scout Talent Trees", key:"provides", value:"Scout Talent Trees:#integer#"},
    {display: "Shaper Talent Trees", key:"provides", value:"Shaper Talent Trees:#integer#"},
    {display: "Sith Apprentice Talent Trees", key:"provides", value:"Sith Apprentice Talent Trees:#integer#"},
    {display: "Sith Lord Talent Trees", key:"provides", value:"Sith Lord Talent Trees:#integer#"},
    {display: "Soldier Bonus Feats", key:"provides", value:"Soldier Bonus Feats:#integer#"},
    {display: "Soldier Talent Trees", key:"provides", value:"Soldier Talent Trees:#integer#"},
    {display: "Technician Bonus Feats", key:"provides", value:"Technician Bonus Feats:#integer#"},
    {display: "Technician Talent Trees", key:"provides", value:"Technician Talent Trees:#integer#"},
    {display: "Trained Skills", key:"trainedSkills", value:"#integer#"},
    {display: "Vanguard Talent Trees", key:"provides", value:"Vanguard Talent Trees:#integer#"}
]