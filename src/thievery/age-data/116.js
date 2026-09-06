/**
 * Age-specific thievery modifiers.
 *
 * This is deliberately DATA, not engine logic. When Utopia changes an age,
 * add a new age-data/<age>.js dataset rather than rewriting calculations.
 * `verified` is the UI/check-mark gate: only verified entries may be applied
 * automatically by the calculator.
 *
 * Primary source: https://utopia-game.com/wol/chooser/age_details/
 */

export const AGE_116_SOURCE = Object.freeze({
  age: 116,
  name: 'Divine Promise Cornerstone',
  url: 'https://utopia-game.com/wol/chooser/age_details/',
  verified: true,
});

const entry = (name, thievery = {}, notes = []) => Object.freeze({
  name,
  verified: true,
  thievery: Object.freeze({ ...thievery }),
  notes: Object.freeze([...notes]),
});

export const AGE_116_RACES = Object.freeze({
  Avian: entry('Avian'),
  'Dark Elf': entry('Dark Elf', {}, ['+30% Sabotage Damage Received.']),
  Dryad: entry('Dryad'),
  Dwarf: entry('Dwarf'),
  Elf: entry('Elf'),
  Faery: entry('Faery', { tpaMultiplier: 1.20 }),
  Halfling: entry('Halfling', {
    tpaMultiplier: 1.30,
    stealthRecoveryBonusPerTick: 1,
    sabotageThiefLossMultiplier: 0.50,
  }),
  Human: entry('Human'),
  Orc: entry('Orc', {}, ['+20% Sabotage Damage Received.']),
  Undead: entry('Undead'),
});

export const AGE_116_PERSONALITIES = Object.freeze({
  Artisan: entry('Artisan'),
  Cleric: entry('Cleric'),
  General: entry('General'),
  Heretic: entry('Heretic', {
    tpaMultiplier: 1.35,
    crimeScienceMultiplier: 1.25,
    thiefLossMultiplier: 0.50,
  }),
  Mystic: entry('Mystic'),
  Necromancer: entry('Necromancer'),
  Rogue: entry('Rogue', {
    tpaMultiplier: 1.25,
    thievesDensEffectivenessMultiplier: 2.00,
    crimeScienceMultiplier: 1.40,
    stealthRecoveryBonusPerTick: 1,
    allThieveryOperations: true,
  }),
  Sage: entry('Sage'),
  Tactician: entry('Tactician', {
    espionageThiefLossMultiplier: 0,
  }),
  'War hero': entry('War hero'),
  Warrior: entry('Warrior'),
});

export const AGE_116_RITUALS = Object.freeze({
  Ascendency: entry('Ascendency'),
  Barrier: entry('Barrier', { thieveryDamageTakenMultiplier: 0.75 }),
  Benediction: entry('Benediction'),
  Haste: entry('Haste'),
  Havoc: entry('Havoc', { tpaMultiplier: 1.25, sabotageDamageMultiplier: 1.20 }),
  Onslaught: entry('Onslaught'),
  Stalwart: entry('Stalwart'),
});

export const AGE_116_DRAGONS = Object.freeze({
  Amethyst: entry('Amethyst', { sabotageSuccessChanceMultiplier: 0.60 }),
  Emerald: entry('Emerald'),
  Ruby: entry('Ruby'),
  Sapphire: entry('Sapphire', {
    tpaMultiplier: 0.65,
    stealthRecoveryBonusPerTick: -1,
    sabotageDamageTakenMultiplier: 1.125,
    sabotageDamageDealtMultiplier: 0.875,
  }),
  Topaz: entry('Topaz'),
});

export const AGE_116_DATA = Object.freeze({
  source: AGE_116_SOURCE,
  races: AGE_116_RACES,
  personalities: AGE_116_PERSONALITIES,
  rituals: AGE_116_RITUALS,
  dragons: AGE_116_DRAGONS,
});
