/**
 * Age 116 thievery data — Utopia War Room wiki is authoritative.
 */

export const AGE_116_SOURCE = Object.freeze({
  age: 116,
  name: 'Utopia War Room — Age 116 Reference',
  url: 'https://shadowjuice69.github.io/utopia-war-room/utopia-wiki.html',
  verified: true,
});

const entry = (name, thievery = {}, notes = []) => Object.freeze({ name, verified: true, thievery: Object.freeze({ ...thievery }), notes: Object.freeze([...notes]) });

export const AGE_116_RACES = Object.freeze({
  Avian: entry('Avian', {}, ['Illuminate Shadows reduces incoming thievery damage by 20%.']),
  'Dark Elf': entry('Dark Elf', { sabotageDamageTakenMultiplier: 1.30 }),
  Dryad: entry('Dryad'), Dwarf: entry('Dwarf'), Elf: entry('Elf'),
  Faery: entry('Faery', { tpaMultiplier: 1.20 }),
  Halfling: entry('Halfling', { tpaMultiplier: 1.30, stealthRecoveryBonusPerTick: 1 }),
  Human: entry('Human'),
  Orc: entry('Orc', { sabotageDamageTakenMultiplier: 1.20 }),
  Undead: entry('Undead'),
});

export const AGE_116_PERSONALITIES = Object.freeze({
  Artisan: entry('Artisan'), Cleric: entry('Cleric'), General: entry('General'),
  Heretic: entry('Heretic', { tpaMultiplier: 1.35, crimeScienceEffectivenessMultiplier: 1.25, thiefLossMultiplier: 0.50 }),
  Mystic: entry('Mystic'), Necromancer: entry('Necromancer'),
  Rogue: entry('Rogue', { tpaMultiplier: 1.25, thievesDensEffectivenessMultiplier: 2.00, crimeScienceEffectivenessMultiplier: 1.40, stealthRecoveryBonusPerTick: 1, allThieveryOperations: true, sabotageThiefLossMultiplier: 0.50 }),
  Sage: entry('Sage'), Tactician: entry('Tactician', { espionageThiefLossMultiplier: 0 }), 'War hero': entry('War hero'), Warrior: entry('Warrior'),
});

export const AGE_116_RITUALS = Object.freeze({
  Ascendency: entry('Ascendency'),
  Barrier: entry('Barrier', { thieveryDamageTakenMultiplier: 0.75 }),
  Benediction: entry('Benediction'), Haste: entry('Haste'),
  Havoc: entry('Havoc', { tpaMultiplier: 1.25, sabotageDamageMultiplier: 1.20 }),
  Onslaught: entry('Onslaught'), Stalwart: entry('Stalwart'),
});

export const AGE_116_DRAGONS = Object.freeze({
  Amethyst: entry('Amethyst', { sabotageSuccessChanceMultiplier: 0.60 }),
  Emerald: entry('Emerald'), Ruby: entry('Ruby'),
  Sapphire: entry('Sapphire', { tpaMultiplier: 0.65, stealthRecoveryBonusPerTick: -1, sabotageDamageTakenMultiplier: 1.125, sabotageDamageDealtMultiplier: 0.875 }),
  Topaz: entry('Topaz'),
});

export const AGE_116_SCIENCE = Object.freeze({ crimeMultiplier: 0.1557, shieldingMultiplier: 0.0350, cunningMultiplier: 0.0314, finesseMultiplier: 0.08685 });

export const AGE_116_SPELLS = Object.freeze({
  Invisibility: Object.freeze({ target: 'self', offensiveTpaMultiplier: 1.10, thiefLossMultiplier: 0.80 }),
  Guile: Object.freeze({ target: 'self', sabotageDamageMultiplier: 1.10 }),
  'Illuminate Shadows': Object.freeze({ target: 'target', thieveryDamageTakenMultiplier: 0.80 }),
  'Clear Sight': Object.freeze({ target: 'self', catchChance: 0.25 }),
});

export const AGE_116_OPERATIONS = Object.freeze({
  spy_on_throne: Object.freeze({ id: 'spy_on_throne', name: 'Spy on Throne', category: 'espionage', relations: 'all', stealthCost: 0.01, meterGain: 0, accurateAtThievesFraction: 0.05 }),
  spy_on_defense: Object.freeze({ id: 'spy_on_defense', name: 'Spy on Defense', category: 'espionage', relations: 'all', stealthCost: 0.01, meterGain: 0, accurateAtThievesFraction: 0.05 }),
  spy_on_exploration: Object.freeze({ id: 'spy_on_exploration', name: 'Spy on Exploration', category: 'espionage', relations: 'all', stealthCost: 0, meterGain: 0, accurateAtThievesFraction: 0.05 }),
  snatch_news: Object.freeze({ id: 'snatch_news', name: 'Snatch News', category: 'espionage', relations: 'all', stealthCost: 0, meterGain: 0, accurateAtThievesFraction: 0.05 }),
  infiltrate: Object.freeze({ id: 'infiltrate', name: 'Infiltrate', category: 'espionage', relations: 'all', stealthCost: 0, meterGain: 0, accurateAtThievesFraction: 0.05 }),
  survey: Object.freeze({ id: 'survey', name: 'Survey', category: 'espionage', relations: 'all', stealthCost: 0, meterGain: 0, accurateAtThievesFraction: 0.05 }),
  spy_on_military: Object.freeze({ id: 'spy_on_military', name: 'Spy on Military', category: 'espionage', relations: 'all', stealthCost: 0, meterGain: 0, accurateAtThievesFraction: 0.05 }),
  spy_on_sciences: Object.freeze({ id: 'spy_on_sciences', name: 'Spy on Sciences', category: 'espionage', relations: 'all', stealthCost: 0, meterGain: 0, accurateAtThievesFraction: 0.05 }),
  sabotage_wizards: Object.freeze({ id: 'sabotage_wizards', name: 'Sabotage Wizards', category: 'sabotage', relations: 'unfriendly', meterGain: 0, notes: ['Reduces current Mana/tick before regeneration.'] }),
  destabilize_guilds: Object.freeze({ id: 'destabilize_guilds', name: 'Destabilize Guilds', category: 'sabotage', relations: 'all', rogueOnly: true, meterGain: 0, durationReduction: 0.25 }),
  rob_granaries: Object.freeze({ id: 'rob_granaries', name: 'Rob the Granaries', category: 'sabotage', relations: 'all', maxPercentNormal: 0.315, maxPercentWar: 0.46, gainsPerThiefNormal: 95, gainsPerThiefWar: 135, meterGain: 0.06 }),
  rob_vaults: Object.freeze({ id: 'rob_vaults', name: 'Rob the Vaults', category: 'sabotage', relations: 'all', maxPercentNormal: 0.052, maxPercentWar: 0.16, gainsPerThiefNormal: 40, gainsPerThiefWar: 106, meterGain: 0.12 }),
  rob_towers: Object.freeze({ id: 'rob_towers', name: 'Rob the Towers', category: 'sabotage', relations: 'all', maxPercentNormal: 0.245, maxPercentWar: 0.35, gainsPerThiefNormal: 18.2, gainsPerThiefWar: 26, meterGain: 0.09 }),
  kidnapping: Object.freeze({ id: 'kidnapping', name: 'Kidnapping', category: 'sabotage', relations: 'all', maxPercentNormal: 0.0185, maxPercentWar: 0.05, gainsPerThiefNormal: 0.132, gainsPerThiefWar: 0.285, meterGain: 0.12 }),
  steal_horses: Object.freeze({ id: 'steal_horses', name: 'Steal Horses', category: 'sabotage', relations: 'hostile', maxPercentNormal: 0.1275, maxPercentWar: 0.136, gainsPerThiefNormal: 0.094, gainsPerThiefWar: 0.10, meterGain: 0.50 }),
  arson: Object.freeze({ id: 'arson', name: 'Arson', category: 'sabotage', relations: 'all', meterGain: 0.24, damageMultiplier: 1.05 }),
  greater_arson: Object.freeze({ id: 'greater_arson', name: 'Greater Arson', category: 'sabotage', relations: 'unfriendly', rogueOnly: true, maxPercentNormal: 0.06, gainsPerThiefNormal: 0.0045, meterGain: 0.30, damageMultiplier: 1.05 }),
  night_strike: Object.freeze({ id: 'night_strike', name: 'Night Strike', category: 'sabotage', relations: 'unfriendly', maxPercentNormal: 0.1625, gainsPerThiefNormal: 0.67, gainsPerThiefWar: 1.0, meterGain: 0.24 }),
  incite_riots: Object.freeze({ id: 'incite_riots', name: 'Incite Riots', category: 'sabotage', relations: 'all', meterGain: 0.18, incomeReduction: 0.20 }),
  steal_war_horses: Object.freeze({ id: 'steal_war_horses', name: 'Steal War Horses', category: 'sabotage', relations: 'unfriendly', rogueOnly: true, maxPercentNormal: 0.20, gainsPerThiefNormal: 0.35, resourcesLostFraction: 0.50, meterGain: 0.18 }),
  bribe_thieves: Object.freeze({ id: 'bribe_thieves', name: 'Bribe Thieves', category: 'sabotage', relations: 'all', meterGain: 0.09, targetTpaReduction: 0.125 }),
  bribe_generals: Object.freeze({ id: 'bribe_generals', name: 'Bribe Generals', category: 'sabotage', relations: 'all', meterGain: 0.09, chance: 0.20, casualtyMultiplier: 1.20 }),
  free_prisoners: Object.freeze({ id: 'free_prisoners', name: 'Free Prisoners', category: 'sabotage', relations: 'all', maxPercentNormal: 0.12, maxPercentWar: 0.17, gainsPerThiefNormal: 0.06, gainsPerThiefWar: 0.07, meterGain: 0.03, damageMultiplier: 1.25 }),
  assassinate_wizards: Object.freeze({ id: 'assassinate_wizards', name: 'Assassinate Wizards', category: 'sabotage', relations: 'unfriendly', rogueOnly: true, maxPercentNormal: 0.012, gainsPerThiefNormal: 0.006, meterGain: 0.36 }),
  propaganda: Object.freeze({ id: 'propaganda', name: 'Propaganda', category: 'sabotage', relations: 'war', rogueOnly: true, meterGain: 0 }),
});

export const AGE_116_DATA = Object.freeze({ source: AGE_116_SOURCE, races: AGE_116_RACES, personalities: AGE_116_PERSONALITIES, rituals: AGE_116_RITUALS, dragons: AGE_116_DRAGONS, science: AGE_116_SCIENCE, spells: AGE_116_SPELLS, operations: AGE_116_OPERATIONS });
