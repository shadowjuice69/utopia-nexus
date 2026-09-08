export const AGE_116 = 116;

const race = (name, bonuses, penalties, spells, unique, warDoctrine, military = []) => ({
  name, bonuses, penalties, spells, unique, warDoctrine, military,
});

const personality = (name, bonuses, spells, unique, starting = []) => ({
  name, bonuses, penalties: [], spells, unique, starting,
});

export const AGE_116_RACES = {
  Avian: race(
    "Avian",
    ["-25% attack travel time", "-25% military wages", "-25% military training time"],
    ["+30% rune cost (excluding Ritual)", "Cannot use Stables or War Horses"],
    ["Town Watch", "Illuminate Shadows", "Weaken Ritual"],
    "Dive Bomb — Offensive specialists gain +2 offensive strength during war; no net-worth effect.",
    ["-2% attack time, scaling -1% per Avian province (max -10%)", "-2% military wages, scaling -1% per Avian province (max -12.5%)"],
    ["Soldiers 3/0", "Griffins 12/0", "Harpies 0/10", "Drakes 16/2", "Mercenaries 8/0", "Prisoners 8/0", "War Horses unavailable"]
  ),
  "Dark Elf": race(
    "Dark Elf",
    ["+30% combat instant spell damage", "+30% offensive WPA", "Train Thieves with Credits"],
    ["-15% birth rate", "+30% sabotage damage received"],
    ["Blizzard", "Mage's Fury", "Weaken Ritual", "Mind Focus", "Fools Gold"],
    "Mystic Enthusiasts — successful offensive instant spells refund 30% of rune cost.",
    ["+2% instant spell damage, scaling +2% per Dark Elf province (max +12.5%)", "-2% rune costs, scaling -1% per Dark Elf province (max -12.5%)"],
    ["Soldiers 3/0", "Night Rangers 14/0", "Druids 0/12", "Drows 16/2", "Mercenaries 8/0", "Prisoners 8/0", "War Horses 2/0"]
  ),
  Dryad: race(
    "Dryad",
    ["+20% birth rate", "+12.5% defensive military efficiency", "-40% own casualties when defending"],
    ["+10% attack travel time", "Combat spell mana cost increased by 1", "Cannot use Forts"],
    ["Greater Protection", "Aggression", "Clear Sight"],
    "Overgrowth — maximum population +25% for 3 days; 23 Utopian Day cooldown.",
    ["+2% defensive military efficiency, scaling +1% per Dryad province (max +10%)", "-2% defensive military casualties, scaling -1% per Dryad province (max -12.5%)"],
    ["Soldiers 3/0", "Huldras 10/0", "Nymphs 0/11", "Will O The Wisps 16/3", "Mercenaries 8/0", "Prisoners 8/0", "War Horses 2/0"]
  ),
  Dwarf: race(
    "Dwarf",
    ["+30% building efficiency", "-50% building construction cost", "-50% building construction time"],
    ["+90% food consumption", "Cannot accelerate construction"],
    ["Miner's Mystique", "Town Watch", "Reflect Magic", "Weaken Ritual"],
    "Architect's Revenge — incoming Raze damage reduced 15%; your Raze attacks destroy 20% additional buildings.",
    ["-2% construction costs, scaling -1% per Dwarf province (max -12.5%)", "+2% building efficiency, scaling +1% per Dwarf province (max +12.5%)"],
    ["Soldiers 3/0", "Warriors 10/0", "Axemen 0/10", "Berserkers 15/7", "Mercenaries 8/0", "Prisoners 8/0", "War Horses 2/0"]
  ),
  Elf: race(
    "Elf",
    ["+30% offensive spell duration", "+40% WPA", "+1% extra mana per tick in war"],
    ["+35% draft cost"],
    ["Pitfalls", "Weaken Ritual", "Vermin", "Sloth", "Reflect Magic", "Chastity"],
    "Arcane Mastery — offensive spell durations +2 days; Chastity reduces natural peasant growth by 70% with halved duration.",
    ["-2% instant spell damage received, scaling -2% per Elf province (max -12.5%)", "+2% spell duration, scaling +2% per Elf province (max +12.5%)"],
    ["Soldiers 3/0", "Rangers 10/0", "Archers 0/13", "Elf Lords 14/4", "Mercenaries 8/0", "Prisoners 8/0", "War Horses 2/0"]
  ),
  Faery: race(
    "Faery",
    ["+20% WPA", "+30% self-spell duration", "+20% TPA", "+1% extra mana per tick"],
    ["-5% maximum population", "+15% own casualties attacking", "+15% own casualties defending"],
    ["Fountain of Knowledge", "Tree of Gold", "Revelation", "Weaken Ritual", "Illuminate Shadows", "Reflect Magic", "Greater Protection"],
    "Leyline Interference — enemy spells against you have a 15% chance to fail completely.",
    ["+2% defensive wizard effectiveness, scaling +2% per Faery province (max +12.5%)", "-2% enemy thievery damage, scaling -2% per Faery province (max -12.5%)"],
    ["Soldiers 3/0", "Magicians 10/0", "Druids 0/10", "Beastmasters 4/16", "Mercenaries 8/0", "Prisoners 8/0", "War Horses 2/0"]
  ),
  Halfling: race(
    "Halfling",
    ["+12.5% maximum population", "+30% TPA", "+1% extra stealth per tick"],
    ["-25% draft rate"],
    ["Greater Protection", "Weaken Ritual", "Tree of Gold", "Invisibility"],
    "Silent Assault — 50% fewer thievery losses during sabotage operations.",
    ["+2% sabotage damage, scaling +2% per Halfling province (max +12.5%)", "-2% thief losses, scaling -2% per Halfling province (max -12.5%)"],
    ["Soldiers 3/0", "Strongarms 11/0", "Slingers 0/10", "Brutes 10/13", "Mercenaries 8/0", "Prisoners 8/0", "War Horses 2/0"]
  ),
  Human: race(
    "Human",
    ["+20% draft rate", "+30% income", "-30% military training cost"],
    ["+25% military wages"],
    ["Fountain of Knowledge", "Invisibility", "Guile", "Weaken Ritual"],
    "Civil Administration — prisoners produce +2 gold/tick; mercenary costs reduced 40%.",
    ["+2% specialist credits gained, scaling +1% per Human province (max +12.5%)", "-2% training costs, scaling -1% per Human province (max -12.5%)"],
    ["Soldiers 3/0", "Swordsmen 15/0", "Archers 0/12", "Knights 15/5", "Mercenaries 8/0", "Prisoners 8/0", "War Horses 3/0"]
  ),
  Orc: race(
    "Orc",
    ["+10% battle gains", "+5% battle gains in war", "-40% draft cost", "+15% enemy casualties when attacking", "+15% enemy casualties when defending"],
    ["+20% combat instant spell damage received", "+20% sabotage damage received"],
    ["Bloodlust", "Weaken Ritual", "Wrath", "Aggression"],
    "Carnage — every successful attack applies one random bonus: destroy 25% enemy resources, +25% enemy wages for 4–6 ticks, or -30% military casualties.",
    ["+2% offensive military efficiency, scaling +1% per Orc province (max +10%)", "+2% Raze damage, scaling +1% per Orc province (max +12.5%)"],
    ["Soldiers 3/0", "Goblins 13/0", "Trolls 0/10", "Ogres 18/3", "Mercenaries 8/0", "Prisoners 8/0", "War Horses 2/0"]
  ),
  Undead: race(
    "Undead",
    ["-100% food consumption", "-45% own casualties attacking", "-45% own casualties defending", "Always carries and is immune to plague"],
    ["Cannot use Hospitals"],
    ["Animate Dead", "Weaken Ritual", "Vermin", "Ghost Workers"],
    "Death March — 25% of military casualties return as Soldiers on attack.",
    ["-2% enemy battle gains, scaling -1% per Undead province (max -12.5%)", "+2% plague spread chance, scaling +1% per Undead province (max +12.5%)"],
    ["Soldiers 3/0", "Skeletons 11/0", "Zombies 0/10", "Ghouls 16/4", "Mercenaries 8/0", "Prisoners 8/0", "War Horses 2/0"]
  ),
};

export const AGE_116_PERSONALITIES = {
  Artisan: personality("Artisan", ["-25% building construction cost", "+25% flat rate capacity", "+25% flat rate building production", "+25% Alchemy effectiveness", "+25% Artisan effectiveness", "+25% Bookkeeping effectiveness", "+25% Production effectiveness", "+25% Housing effectiveness", "+25% Tools effectiveness", "Greed immunity", "Incite Riot immunity"], ["Ghost Workers", "Greater Protection", "Fools Gold"], "Masterful Craftsmanship — 25% chance to recover 50% of a building cost as building credits.", ["+200 starting build credits", "+600 starting soldiers", "+600 starting specialist training credits"]),
  Cleric: personality("Cleric", ["-40% combat instant spell damage received", "+25% Heroism effectiveness", "+25% Resilience effectiveness", "+25% Siege effectiveness", "+25% Strategy effectiveness", "+25% Tactics effectiveness", "+25% Valor effectiveness", "Elite +1 defensive strength", "Defensive specialist +1 strength"], ["Salvation", "Revelation", "Divine Shield", "Illuminate Shadows", "Heroes Inspiration"], "Divine Favour — self-spells have a 50% chance to double duration.", ["+800 starting soldiers", "+800 starting specialist training credits"]),
  General: personality("General", ["-25% military training cost", "+1 army general", "+25% Heroism effectiveness", "+25% Resilience effectiveness", "+25% Siege effectiveness", "+25% Strategy effectiveness", "+25% Tactics effectiveness", "+25% Valor effectiveness", "-25% military training time", "Elite +2 offensive strength", "Elites can be trained with specialist credits at double cost"], ["Wrath", "Mist"], "Generals Authority — attacks with 2+ generals cause +15% enemy military casualties.", ["+800 starting soldiers", "+800 starting specialist training credits"]),
  Heretic: personality("Heretic", ["+50% guild land effect", "+35% offensive WPA", "+25% Cunning effectiveness", "+25% Finesse effectiveness", "+25% Channeling effectiveness", "+25% Shielding effectiveness", "+25% Sorcery effectiveness", "+25% Crime effectiveness", "-50% thief losses", "+35% offensive TPA", "Immune to Expose Thieves"], ["Nightmare", "Fools Gold", "Vermin", "Magic Ward"], "Arcane Frenzy — after each successful attack, gain +1 mana and +1 stealth for 5 days; does not stack.", ["+400 starting thieves", "+400 starting wizards"]),
  Mystic: personality("Mystic", ["+100% guild land effect", "+25% WPA", "+40% Channeling effectiveness", "+1% extra mana per tick"], ["Meteor Showers", "Chastity", "Pitfalls", "Fools Gold"], "Focused Channeling — while mana is above 40%, all spells gain +20% wizard effectiveness.", ["+800 starting wizards"]),
  Necromancer: personality("Necromancer", ["+25% WPA", "+7.5% military efficiency", "-40% rune cost excluding Ritual", "+40% Channeling effectiveness"], ["Animate Dead", "Mind Focus", "Soul Blight", "Guile", "Nightmare", "Lightning Strike"], "Dark Pact — after successful attacks, convert 10% of enemy killed units to Wizards, 20% to Soldiers, and 10% to Peasants.", ["+400 starting specialist training credits", "+400 starting wizards"]),
  Rogue: personality("Rogue", ["+40% Crime effectiveness", "+25% TPA", "+100% Thieves' Den effectiveness", "+1% extra stealth per tick", "Access all thievery operations"], [], "Shadow Persistence — may perform thievery operations while overpopulated.", ["+800 starting thieves"]),
  Sage: personality("Sage", ["-50% losses on Learn attacks", "+20% science book production", "+15% science effectiveness", "+20% scientist spawn rate"], ["Revelation", "Fountain of Knowledge"], "Focused Resolve — in war, gain +1% science efficiency per day up to +15%; resets when war ends.", ["+800 starting soldiers", "+2 starting scientists", "+800 starting specialist training credits"]),
  Tactician: personality("Tactician", ["-20% attack travel time", "+40% draft rate", "+40% Siege effectiveness", "+40% specialist training credits", "No thief losses on espionage operations"], ["Clear Sight"], "Interdiction — successful attacks in war destroy 15% of enemy gold, runes, and food.", ["+800 starting soldiers", "+800 starting specialist training credits"]),
  "War hero": personality("War hero", ["+10% battle gains in war", "+100% honor bonus", "-25% honor losses", "+40% Valor effectiveness", "Offensive specialist +2 strength"], ["Quick Feet", "Righteous Aggressor", "Heroes Inspiration"], "Hero's Culling — Massacres kill an additional 7% peasants and 2.5% thieves and wizards.", ["+800 starting soldiers", "+800 starting specialist training credits"]),
  Warrior: personality("Warrior", ["+15% offensive military efficiency", "+5 prisoner and mercenary offensive strength", "+35% Tactics effectiveness", "May send 1 mercenary or prisoner per 4 regular troops"], [], "Battle Cry — successful attacks destroy 1.5% of target total population.", ["+800 starting soldiers", "+800 starting specialist training credits"]),
};

export const AGE_116_RULES = {
  age: AGE_116,
  source: "https://utopia-game.com/wol/chooser/age_details/",
  races: AGE_116_RACES,
  personalities: AGE_116_PERSONALITIES,
};

export function resolveAge116Profile(raceName, personalityName) {
  const r = AGE_116_RACES[raceName] || null;
  const p = AGE_116_PERSONALITIES[personalityName] || null;
  if (!r && !p) return null;

  const spells = [...new Set([...(r?.spells || []), ...(p?.spells || [])])];
  const thievery = personalityName === "Rogue"
    ? { access: "all", operations: [] }
    : { access: "standard", operations: [] };

  return {
    age: AGE_116,
    race: r,
    personality: p,
    bonuses: [...(r?.bonuses || []), ...(p?.bonuses || [])],
    penalties: [...(r?.penalties || []), ...(p?.penalties || [])],
    uniqueAbilities: [r?.unique, p?.unique].filter(Boolean),
    spells,
    thievery,
    military: r?.military || [],
    warDoctrines: r?.warDoctrine || [],
    source: AGE_116_RULES.source,
  };
}
