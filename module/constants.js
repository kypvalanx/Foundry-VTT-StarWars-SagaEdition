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
}

export const uniqueKey = ["damage", "stunDamage"]

export const weaponGroup = {
    "Ranged Weapons":["Heavy Weapons", "Pistols", "Rifles", "Simple Ranged Weapons", "Exotic Ranged Weapons"],
    "Melee Weapons":["Advanced Melee Weapons", "Lightsabers", "Simple Melee Weapons", "Exotic Melee Weapons"]
}


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
    "background": ["event", "occupation", "planet of origin"]
}

export const GM_BONUSES = [
    {display: "Health Points", value:"hitPointEq"}
]