/**
 * Utopia thievery calculation engine.
 * Pure calculation module: no dashboard, API, database, or browser dependencies.
 *
 * Calculation logic is age-agnostic. Age-specific race/personality/ritual/dragon
 * values live in src/thievery/age-data/<age>.js so a new age can replace data
 * without rewriting the engine.
 *
 * Unknown or unverified entries are never silently guessed.
 */

import { AGE_116_DATA } from './age-data/116.js';

const positive = (value, fallback = 1) => value ?? fallback;

export const AGE_116_RULES = Object.freeze({
  thievesDens: Object.freeze({
    tpaEffectivenessPerPercent: 0.03,
    thiefLossReductionPerPercent: 0.033,
    maxThiefLossReduction: 0.90,
  }),
  watchTowers: Object.freeze({
    catchChancePerPercent: 0.023,
    maxCatchChance: 1,
    damageReductionPerPercent: undefined,
  }),
  stealth: Object.freeze({
    baseRecoveryPerTick: 3,
    minimumToOperate: 0.05,
  }),
  shieldingScienceMultiplier: 0.0350,
});

export const AGE_DATA = Object.freeze({ 116: AGE_116_DATA });

function assertNonNegative(name, value) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a finite number >= 0`);
}

function getAgeData(age) {
  const data = AGE_DATA[age];
  if (!data) throw new Error(`No verified thievery dataset is loaded for Age ${age}.`);
  if (!data.source?.verified) throw new Error(`Age ${age} dataset is not verified.`);
  return data;
}

function getCheckedEntry(collection, type, name, age) {
  const data = getAgeData(age);
  const entry = data[collection]?.[name];
  if (!entry) throw new Error(`Unknown ${type} "${name}" for Age ${age}.`);
  if (!entry.verified) throw new Error(`${type} "${name}" is not verified for Age ${age}.`);
  return entry;
}

/** The UI can use `verified` as the check-mark state before applying an entry. */
export function raceModifiers(race, age = 116) {
  return getCheckedEntry('races', 'race', race, age);
}

export function personalityModifiers(personality, age = 116) {
  return getCheckedEntry('personalities', 'personality', personality, age);
}

export function ritualModifiers(ritual, age = 116) {
  return getCheckedEntry('rituals', 'ritual', ritual, age);
}

export function dragonModifiers(dragon, age = 116) {
  return getCheckedEntry('dragons', 'dragon', dragon, age);
}

/** Resolve only verified age data into calculation multipliers. */
export function resolveThieveryModifiers({ age = 116, race, personality, ritual, dragon } = {}) {
  const result = {
    racialTpaMultiplier: 1,
    personalityTpaMultiplier: 1,
    crimeScienceMultiplier: 1,
    thievesDensEffectivenessMultiplier: 1,
    thiefLossMultiplier: 1,
    espionageThiefLossMultiplier: 1,
    stealthRecoveryBonusPerTick: 0,
    sabotageDamageMultiplier: 1,
    sabotageSuccessChanceMultiplier: 1,
    sabotageDamageTakenMultiplier: 1,
    sabotageDamageDealtMultiplier: 1,
    thieveryDamageTakenMultiplier: 1,
    allThieveryOperations: false,
    verified: true,
  };

  const entries = [
    race ? raceModifiers(race, age) : null,
    personality ? personalityModifiers(personality, age) : null,
    ritual ? ritualModifiers(ritual, age) : null,
    dragon ? dragonModifiers(dragon, age) : null,
  ].filter(Boolean);

  for (const entry of entries) {
    const t = entry.thievery;
    if (entry.name === race) result.racialTpaMultiplier *= t.tpaMultiplier ?? 1;
    if (entry.name === personality) result.personalityTpaMultiplier *= t.tpaMultiplier ?? 1;
    result.crimeScienceMultiplier *= t.crimeScienceMultiplier ?? 1;
    result.thievesDensEffectivenessMultiplier *= t.thievesDensEffectivenessMultiplier ?? 1;
    result.thiefLossMultiplier *= t.thiefLossMultiplier ?? 1;
    result.espionageThiefLossMultiplier *= t.espionageThiefLossMultiplier ?? 1;
    result.stealthRecoveryBonusPerTick += t.stealthRecoveryBonusPerTick ?? 0;
    result.sabotageDamageMultiplier *= t.sabotageDamageMultiplier ?? 1;
    result.sabotageSuccessChanceMultiplier *= t.sabotageSuccessChanceMultiplier ?? 1;
    result.sabotageDamageTakenMultiplier *= t.sabotageDamageTakenMultiplier ?? 1;
    result.sabotageDamageDealtMultiplier *= t.sabotageDamageDealtMultiplier ?? 1;
    result.thieveryDamageTakenMultiplier *= t.thieveryDamageTakenMultiplier ?? 1;
    result.allThieveryOperations ||= Boolean(t.allThieveryOperations);
  }
  return result;
}

export function rawTpa(thieves, acres) {
  assertNonNegative('thieves', thieves);
  if (!Number.isFinite(acres) || acres <= 0) throw new Error('acres must be > 0');
  return thieves / acres;
}

export function thievesDensTpaMultiplier(thievesDensPct, effectivenessMultiplier = 1) {
  assertNonNegative('thievesDensPct', thievesDensPct);
  assertNonNegative('effectivenessMultiplier', effectivenessMultiplier);
  return 1 + thievesDensPct * AGE_116_RULES.thievesDens.tpaEffectivenessPerPercent * effectivenessMultiplier;
}

export function thievesDensLossReduction(thievesDensPct, effectivenessMultiplier = 1) {
  assertNonNegative('thievesDensPct', thievesDensPct);
  assertNonNegative('effectivenessMultiplier', effectivenessMultiplier);
  return Math.min(AGE_116_RULES.thievesDens.maxThiefLossReduction, thievesDensPct * AGE_116_RULES.thievesDens.thiefLossReductionPerPercent * effectivenessMultiplier);
}

export function watchTowersCatchChance(watchTowersPct) {
  assertNonNegative('watchTowersPct', watchTowersPct);
  return Math.min(AGE_116_RULES.watchTowers.maxCatchChance, watchTowersPct * AGE_116_RULES.watchTowers.catchChancePerPercent);
}

export function watchTowersDamageReduction(watchTowersPct) {
  assertNonNegative('watchTowersPct', watchTowersPct);
  throw new Error('Watch Tower damage-reduction coefficient is not verified from an authoritative current source.');
}

export function modifiedTpa(stats) {
  assertNonNegative('thieves', stats.thieves);
  if (stats.acres <= 0 || stats.networth <= 0) throw new Error('acres and networth must be > 0');
  const warnings = [];
  const assumptions = [];
  const raw = rawTpa(stats.thieves, stats.acres);
  const td = thievesDensTpaMultiplier(stats.thievesDensPct ?? 0, stats.thievesDensEffectivenessMultiplier ?? 1);
  for (const [key, label] of [
    ['thievesDensPct', "Thieves' Dens percentage"], ['crimeScienceMultiplier', 'Crime science multiplier'],
    ['racialTpaMultiplier', 'Racial TPA multiplier'], ['personalityTpaMultiplier', 'Personality TPA multiplier'],
    ['honorTpaMultiplier', 'Honor TPA multiplier'], ['ritualTpaMultiplier', 'Ritual TPA multiplier'],
  ]) if (stats[key] === undefined) warnings.push(`${label} not supplied; neutral value used.`);
  if (stats.invisibilityMultiplier === undefined) assumptions.push('Invisibility is assumed inactive.');
  if (stats.dragonTpaMultiplier === undefined) assumptions.push('No dragon TPA penalty is assumed.');
  if (stats.thievesDensEffectivenessMultiplier === undefined) assumptions.push("Base Thieves' Dens effectiveness is assumed.");
  return {
    value: raw * positive(stats.invisibilityMultiplier) * positive(stats.crimeScienceMultiplier) * positive(stats.racialTpaMultiplier) * td * positive(stats.honorTpaMultiplier) * positive(stats.ritualTpaMultiplier) * positive(stats.personalityTpaMultiplier) * positive(stats.dragonTpaMultiplier),
    warnings, assumptions,
  };
}

export function networthFactor(selfNetworth, targetNetworth) {
  if (selfNetworth <= 0 || targetNetworth <= 0) throw new Error('Both networth values must be > 0');
  return Math.min(targetNetworth / selfNetworth, selfNetworth / targetNetworth);
}

export function thieveryYield(input) {
  assertNonNegative('thievesSent', input.thievesSent);
  if (input.gainsPerThief <= 0) throw new Error('gainsPerThief must be > 0');
  const modifiers = input.modifiers ?? {};
  const lost = input.resourcesLostFraction ?? 0;
  if (lost < 0 || lost > 1) throw new Error('resourcesLostFraction must be between 0 and 1');
  const nw = networthFactor(input.selfNetworth, input.targetNetworth);
  const nwTerm = Math.min(1, nw + (modifiers.warBonus ?? 0));
  const value = input.thievesSent * nwTerm * input.gainsPerThief * (1 - lost) * positive(modifiers.racialMultiplier) * positive(modifiers.personalityMultiplier) * positive(modifiers.guileMultiplier) * positive(modifiers.arcanaMultiplier) * positive(modifiers.targetRacialMultiplier) * positive(modifiers.targetPersonalityMultiplier) * positive(modifiers.targetIlluminateShadowsMultiplier) * (1 - (modifiers.targetWatchtowersReduction ?? 0)) * (1 - (modifiers.targetShieldingReduction ?? 0)) * positive(modifiers.stanceMultiplier);
  const warnings = nw < 1 ? [`Networth disparity reduces yield to ${formatPercent(nw)} before war bonus.`] : [];
  const assumptions = [];
  if (modifiers.targetWatchtowersReduction === undefined) assumptions.push('Target Watch Towers reduction treated as 0%.');
  if (modifiers.targetShieldingReduction === undefined) assumptions.push('Target Shielding reduction treated as 0%.');
  if (modifiers.targetIlluminateShadowsMultiplier === undefined) assumptions.push('Target Illuminate Shadows assumed inactive.');
  if (modifiers.arcanaMultiplier === undefined) assumptions.push('Arcana/Cunning damage multiplier treated as 1.00.');
  return { value, warnings, assumptions };
}

export function optimalThieves(targetResources, maxPercent, gainsPerThief, racialMultiplier = 1) {
  assertNonNegative('targetResources', targetResources);
  if (maxPercent < 0 || maxPercent > 1) throw new Error('maxPercent must be between 0 and 1');
  if (gainsPerThief <= 0 || racialMultiplier <= 0) throw new Error('gainsPerThief and racialMultiplier must be > 0');
  return { value: Math.ceil((targetResources * maxPercent) / gainsPerThief / racialMultiplier), warnings: [], assumptions: ['Actual yield remains subject to networth and target modifiers.'] };
}

export const AGE_116_OPERATIONS = Object.freeze({
  spy_on_throne: { id: 'spy_on_throne', name: 'Spy on Throne', category: 'espionage', difficulty: 'very-low', stealthCost: 0.01, relations: 'none' },
  spy_on_defense: { id: 'spy_on_defense', name: 'Spy on Defense', category: 'espionage', difficulty: 'very-low', stealthCost: 0.01, relations: 'none' },
  spy_on_exploration: { id: 'spy_on_exploration', name: 'Spy on Exploration', category: 'espionage', difficulty: 'low', stealthCost: 0.02, relations: 'none' },
  snatch_news: { id: 'snatch_news', name: 'Snatch News', category: 'espionage', difficulty: 'low', stealthCost: 0.02, relations: 'none' },
  infiltrate: { id: 'infiltrate', name: 'Infiltrate', category: 'espionage', difficulty: 'low', stealthCost: 0.02, relations: 'none' },
  survey: { id: 'survey', name: 'Survey', category: 'espionage', difficulty: 'low', stealthCost: 0.02, relations: 'none' },
  spy_on_military: { id: 'spy_on_military', name: 'Spy on Military', category: 'espionage', difficulty: 'low', stealthCost: 0.02, relations: 'none' },
  spy_on_sciences: { id: 'spy_on_sciences', name: 'Spy on Sciences', category: 'espionage', difficulty: 'low', stealthCost: 0.02, relations: 'none' },
  kidnap: { id: 'kidnap', name: 'Kidnapping', category: 'sabotage', difficulty: 'medium', stealthCost: 0.03, relations: 'none', maxPercent: 0.0185, gainsPerThief: 0.132 },
  steal_war_horses: { id: 'steal_war_horses', name: 'Steal War Horses', category: 'sabotage', difficulty: 'medium', stealthCost: 0.03, relations: 'unfriendly', maxPercent: 0.136, gainsPerThief: 0.1, resourcesLostFraction: 0.5 },
  assassinate_wizards: { id: 'assassinate_wizards', name: 'Assassinate Wizards', category: 'sabotage', difficulty: 'high', stealthCost: 0.03, relations: 'unfriendly', maxPercent: 0.016, gainsPerThief: 0.008 },
  incite_riots: { id: 'incite_riots', name: 'Incite Riots', category: 'sabotage', difficulty: 'medium', stealthCost: 0.03, relations: 'none', duration: true, notes: ['Age 116 revised income reduction: 20%.'] },
});

export function formatPercent(value) {
  return `${(value * 100).toFixed(2)}%`;
}
