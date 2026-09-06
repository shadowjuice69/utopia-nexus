/**
 * Utopia thievery engine.
 * Source of truth for this project: Utopia War Room Age 116 wiki.
 * https://shadowjuice69.github.io/utopia-war-room/utopia-wiki.html
 *
 * The engine deliberately does not invent an exact success-probability curve:
 * the wiki specifies success as a function of offensive/defensive modified TPA,
 * but does not publish a numeric probability equation. We therefore expose the
 * ratio and all verified modifiers without fabricating a percentage.
 */
import { AGE_116_DATA } from './age-data/116.js';

const AGE_116_RULES = Object.freeze({
  tdTpaPerPercent: 0.03,
  tdLossReductionPerPercent: 0.036,
  maxTdLossReduction: 0.90,
  wtCatchPerPercent: 0.022,
  wtDamageReductionPerPercent: 0.024,
  maxWtDamageReduction: 0.625,
  stealthRecoveryPerTick: 3,
  minStealthToOperate: 0.05,
  scienceExponent: 1 / 2.125,
});

export { AGE_116_RULES };
export const AGE_DATA = Object.freeze({ 116: AGE_116_DATA });
export const AGE_116_OPERATIONS = AGE_116_DATA.operations;

const finite = (name, value) => {
  if (!Number.isFinite(value)) throw new Error(`${name} must be a finite number.`);
  return value;
};
const nonNegative = (name, value) => {
  finite(name, value);
  if (value < 0) throw new Error(`${name} must be >= 0.`);
};
const multiplier = (value) => value ?? 1;

function ageData(age = 116) {
  const data = AGE_DATA[age];
  if (!data?.source?.verified) throw new Error(`No verified thievery data for Age ${age}.`);
  return data;
}
function verified(collection, name, type, age = 116) {
  const item = ageData(age)[collection]?.[name];
  if (!item) throw new Error(`Unknown ${type} "${name}" for Age ${age}.`);
  if (!item.verified) throw new Error(`${type} "${name}" is not verified for Age ${age}.`);
  return item;
}

export function raceModifiers(race, age = 116) { return verified('races', race, 'race', age); }
export function personalityModifiers(personality, age = 116) { return verified('personalities', personality, 'personality', age); }
export function ritualModifiers(ritual, age = 116) { return verified('rituals', ritual, 'ritual', age); }
export function dragonModifiers(dragon, age = 116) { return verified('dragons', dragon, 'dragon', age); }

/** Science bonus from the wiki's published science formula. */
export function scienceBonus(books, scienceMultiplier, modifiers = {}) {
  nonNegative('books', books);
  if (scienceMultiplier <= 0) throw new Error('scienceMultiplier must be > 0.');
  return books ** AGE_116_RULES.scienceExponent
    * scienceMultiplier
    * multiplier(modifiers.raceMultiplier)
    * multiplier(modifiers.personalityMultiplier)
    * multiplier(modifiers.amnesiaMultiplier)
    * multiplier(modifiers.scientificInsightsMultiplier)
    * multiplier(modifiers.librariesMultiplier);
}

export function crimeScienceBonus(books, { raceMultiplier = 1, personalityMultiplier = 1, amnesiaMultiplier = 1, scientificInsightsMultiplier = 1, librariesMultiplier = 1 } = {}) {
  return scienceBonus(books, AGE_116_DATA.science.crimeMultiplier, { raceMultiplier, personalityMultiplier, amnesiaMultiplier, scientificInsightsMultiplier, librariesMultiplier });
}

export function shieldingScienceBonus(books, modifiers = {}) {
  return scienceBonus(books, AGE_116_DATA.science.shieldingMultiplier, modifiers);
}

export function cunningScienceBonus(books, modifiers = {}) {
  return scienceBonus(books, AGE_116_DATA.science.cunningMultiplier, modifiers);
}

export function rawTpa(thieves, acres) {
  nonNegative('thieves', thieves);
  if (acres <= 0) throw new Error('acres must be > 0.');
  return thieves / acres;
}

export function thievesDensTpaMultiplier(thievesDensPct, effectivenessMultiplier = 1) {
  nonNegative('thievesDensPct', thievesDensPct);
  nonNegative('effectivenessMultiplier', effectivenessMultiplier);
  return 1 + thievesDensPct * AGE_116_RULES.tdTpaPerPercent * effectivenessMultiplier;
}

export function thievesDensLossReduction(thievesDensPct) {
  nonNegative('thievesDensPct', thievesDensPct);
  return Math.min(AGE_116_RULES.maxTdLossReduction, thievesDensPct * AGE_116_RULES.tdLossReductionPerPercent);
}

export function watchTowersCatchChance(watchTowersPct) {
  nonNegative('watchTowersPct', watchTowersPct);
  return Math.min(1, watchTowersPct * AGE_116_RULES.wtCatchPerPercent);
}

export function watchTowersDamageReduction(watchTowersPct) {
  nonNegative('watchTowersPct', watchTowersPct);
  return Math.min(AGE_116_RULES.maxWtDamageReduction, watchTowersPct * AGE_116_RULES.wtDamageReductionPerPercent);
}

export function resolveThieveryModifiers({ age = 116, race, personality, ritual, dragon, invisibility = false, guile = false } = {}) {
  const result = {
    racialTpaMultiplier: 1,
    personalityTpaMultiplier: 1,
    ritualTpaMultiplier: 1,
    dragonTpaMultiplier: 1,
    crimeScienceEffectivenessMultiplier: 1,
    thievesDensEffectivenessMultiplier: 1,
    thiefLossMultiplier: 1,
    espionageThiefLossMultiplier: 1,
    sabotageThiefLossMultiplier: 1,
    stealthRecoveryBonusPerTick: 0,
    sabotageDamageMultiplier: 1,
    sabotageSuccessChanceMultiplier: 1,
    sabotageDamageTakenMultiplier: 1,
    sabotageDamageDealtMultiplier: 1,
    allThieveryOperations: false,
  };
  const selected = [race ? raceModifiers(race, age) : null, personality ? personalityModifiers(personality, age) : null, ritual ? ritualModifiers(ritual, age) : null, dragon ? dragonModifiers(dragon, age) : null].filter(Boolean);
  for (const item of selected) {
    const t = item.thievery || {};
    if (item.name === race) result.racialTpaMultiplier *= t.tpaMultiplier ?? 1;
    if (item.name === personality) result.personalityTpaMultiplier *= t.tpaMultiplier ?? 1;
    if (item.name === ritual) result.ritualTpaMultiplier *= t.tpaMultiplier ?? 1;
    if (item.name === dragon) result.dragonTpaMultiplier *= t.tpaMultiplier ?? 1;
    result.crimeScienceEffectivenessMultiplier *= t.crimeScienceEffectivenessMultiplier ?? 1;
    result.thievesDensEffectivenessMultiplier *= t.thievesDensEffectivenessMultiplier ?? 1;
    result.thiefLossMultiplier *= t.thiefLossMultiplier ?? 1;
    result.espionageThiefLossMultiplier *= t.espionageThiefLossMultiplier ?? 1;
    result.sabotageThiefLossMultiplier *= t.sabotageThiefLossMultiplier ?? 1;
    result.stealthRecoveryBonusPerTick += t.stealthRecoveryBonusPerTick ?? 0;
    result.sabotageDamageMultiplier *= t.sabotageDamageMultiplier ?? 1;
    result.sabotageSuccessChanceMultiplier *= t.sabotageSuccessChanceMultiplier ?? 1;
    result.sabotageDamageTakenMultiplier *= t.sabotageDamageTakenMultiplier ?? 1;
    result.sabotageDamageDealtMultiplier *= t.sabotageDamageDealtMultiplier ?? 1;
    result.allThieveryOperations ||= Boolean(t.allThieveryOperations);
  }
  if (invisibility) {
    result.racialTpaMultiplier *= AGE_116_DATA.spells.Invisibility.offensiveTpaMultiplier;
    result.thiefLossMultiplier *= AGE_116_DATA.spells.Invisibility.thiefLossMultiplier;
  }
  if (guile) result.sabotageDamageMultiplier *= AGE_116_DATA.spells.Guile.sabotageDamageMultiplier;
  return result;
}

export function modifiedTpa(stats) {
  const raw = rawTpa(stats.thieves, stats.acres);
  const td = thievesDensTpaMultiplier(stats.thievesDensPct ?? 0, stats.thievesDensEffectivenessMultiplier ?? 1);
  const value = raw
    * multiplier(stats.invisibilityMultiplier)
    * multiplier(stats.crimeScienceMultiplier)
    * multiplier(stats.racialTpaMultiplier)
    * multiplier(stats.personalityTpaMultiplier)
    * td
    * multiplier(stats.honorTpaMultiplier)
    * multiplier(stats.ritualTpaMultiplier)
    * multiplier(stats.dragonTpaMultiplier);
  return { value, raw, tdMultiplier: td, warnings: [], assumptions: [] };
}

export function relativeSize(selfNetworth, targetNetworth, warBonus = 0) {
  if (selfNetworth <= 0 || targetNetworth <= 0) throw new Error('Both networth values must be > 0.');
  nonNegative('warBonus', warBonus);
  return Math.min(targetNetworth / selfNetworth, selfNetworth / targetNetworth) + warBonus;
}
export const networthFactor = (selfNetworth, targetNetworth) => Math.min(targetNetworth / selfNetworth, selfNetworth / targetNetworth);

/** Exact wiki yield equation. */
export function thieveryYield(input) {
  nonNegative('thievesSent', input.thievesSent);
  if (input.gainsPerThief <= 0) throw new Error('gainsPerThief must be > 0.');
  const lost = input.resourcesLostFraction ?? 0;
  if (lost < 0 || lost > 1) throw new Error('resourcesLostFraction must be 0..1.');
  const mods = input.modifiers ?? {};
  const wt = mods.targetWatchtowersReduction ?? 0;
  const shielding = mods.targetShieldingReduction ?? 0;
  if (wt < 0 || wt > 1 || shielding < 0 || shielding > 1) throw new Error('Target reductions must be 0..1.');
  const size = relativeSize(input.selfNetworth, input.targetNetworth, mods.warBonus ?? 0);
  const value = input.thievesSent * size * input.gainsPerThief * (1 - lost)
    * multiplier(mods.racialMultiplier)
    * multiplier(mods.personalityMultiplier)
    * multiplier(mods.scienceMultiplier)
    * multiplier(mods.guileMultiplier)
    * multiplier(mods.cunningMultiplier)
    * multiplier(mods.targetRacialMultiplier)
    * multiplier(mods.targetPersonalityMultiplier)
    * multiplier(mods.targetIlluminateShadowsMultiplier)
    * (1 - wt)
    * (1 - shielding)
    * multiplier(mods.stanceMultiplier);
  return { value, relativeSize: size, warnings: [], assumptions: [] };
}

export function optimalThieves(targetResources, maxPercent, gainsPerThief, raceMultiplier = 1) {
  nonNegative('targetResources', targetResources);
  if (maxPercent < 0 || maxPercent > 1) throw new Error('maxPercent must be 0..1.');
  if (gainsPerThief <= 0 || raceMultiplier <= 0) throw new Error('gainsPerThief and raceMultiplier must be > 0.');
  return Math.ceil((targetResources * maxPercent) / gainsPerThief / raceMultiplier);
}

export function stealthAfterOperation(currentStealth, operationId, age = 116) {
  if (currentStealth < 0 || currentStealth > 1) throw new Error('currentStealth must be 0..1.');
  const op = ageData(age).operations[operationId];
  if (!op) throw new Error(`Unknown operation "${operationId}".`);
  return Math.max(0, currentStealth - (op.stealthCost ?? 0));
}

export function stealthRecoveryPerTick({ race, personality, dragon, age = 116 } = {}) {
  const mods = resolveThieveryModifiers({ race, personality, dragon, age });
  return AGE_116_RULES.stealthRecoveryPerTick + mods.stealthRecoveryBonusPerTick;
}

export function thiefLosses({ thievesSent, baseLosses, thievesDensPct = 0, personalityLossMultiplier = 1, operationCategory = 'sabotage', invisibility = false, age = 116 } = {}) {
  nonNegative('thievesSent', thievesSent);
  nonNegative('baseLosses', baseLosses);
  const tdReduction = thievesDensLossReduction(thievesDensPct);
  let loss = baseLosses * (1 - tdReduction) * personalityLossMultiplier;
  if (operationCategory === 'espionage') loss = 0;
  if (invisibility) loss *= AGE_116_DATA.spells.Invisibility.thiefLossMultiplier;
  return Math.max(0, loss);
}

/**
 * Success is intentionally returned as a ratio, not a fabricated probability.
 * The wiki only states that operation success is based on Off Mod TPA / Def Mod TPA.
 */
export function operationSuccessMetrics(offensiveModifiedTpa, defensiveModifiedTpa, { thievesSent = 0, totalThieves = 0, dragonSuccessMultiplier = 1 } = {}) {
  if (offensiveModifiedTpa < 0 || defensiveModifiedTpa <= 0) throw new Error('TPA values are invalid.');
  const sendFraction = totalThieves > 0 ? thievesSent / totalThieves : null;
  const randomizationPercent = sendFraction === null ? null : sendFraction >= 0.50 ? 0.03 : sendFraction <= 0.01 ? 0.25 : 0.25 - ((sendFraction - 0.01) / 0.49) * 0.22;
  return {
    tpaRatio: offensiveModifiedTpa / defensiveModifiedTpa,
    sendFraction,
    randomizationPercent,
    sabotageSuccessMultiplier: dragonSuccessMultiplier,
    successProbability: null,
    note: 'The authoritative wiki does not publish a numeric success-probability curve; no percentage is fabricated.',
  };
}

export function formatPercent(value) { return `${(value * 100).toFixed(2)}%`; }
