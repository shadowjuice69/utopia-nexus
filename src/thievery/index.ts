/**
 * Utopia Age 116 thievery calculation engine.
 *
 * This module is deliberately pure: no Supabase, browser, dashboard, or API
 * dependencies. Inputs are explicit so every calculation can be audited.
 *
 * Canonical reference used for the initial implementation:
 * Utopia Guide — Thievery (Age 116), plus Age 116 revised mechanics.
 * Do not silently fill missing mechanics with guesses; callers should surface
 * `warnings` when a game value is not known exactly.
 */

export type OperationCategory = 'espionage' | 'sabotage';
export type Relations = 'none' | 'unfriendly' | 'hostile' | 'war';

export interface ProvinceThieveryStats {
  acres: number;
  thieves: number;
  networth: number;
  thievesDensPct?: number;
  crimeScienceMultiplier?: number;
  racialTpaMultiplier?: number;
  personalityTpaMultiplier?: number;
  honorTpaMultiplier?: number;
  ritualTpaMultiplier?: number;
  invisibilityMultiplier?: number;
  dragonTpaMultiplier?: number;
}

export interface ThieveryOperationSpec {
  id: string;
  name: string;
  category: OperationCategory;
  difficulty: 'very-low' | 'low' | 'medium' | 'high';
  stealthCost: number;
  relations: Relations;
  maxPercent?: number;
  gainsPerThief?: number;
  resourcesLostFraction?: number;
  duration?: boolean;
  notes?: string[];
}

export interface YieldModifiers {
  racialMultiplier?: number;
  personalityMultiplier?: number;
  guileMultiplier?: number;
  arcanaMultiplier?: number;
  targetRacialMultiplier?: number;
  targetPersonalityMultiplier?: number;
  targetIlluminateShadowsMultiplier?: number;
  targetWatchtowersReduction?: number;
  targetShieldingReduction?: number;
  stanceMultiplier?: number;
  warBonus?: number;
}

export interface YieldInput {
  thievesSent: number;
  selfNetworth: number;
  targetNetworth: number;
  gainsPerThief: number;
  resourcesLostFraction?: number;
  modifiers?: YieldModifiers;
}

export interface CalculatorResult<T> {
  value: T;
  warnings: string[];
  assumptions: string[];
}

const POSITIVE = (v: number | undefined, fallback = 1) => v ?? fallback;

function assertFinitePositive(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a finite number >= 0`);
  }
}

/** Raw thieves per acre. */
export function rawTpa(thieves: number, acres: number): number {
  assertFinitePositive('thieves', thieves);
  if (!Number.isFinite(acres) || acres <= 0) throw new Error('acres must be > 0');
  return thieves / acres;
}

/**
 * Thieves' Den offensive TPA bonus for Age 116.
 * Base building effect is 3% TPA per 1% TD; Rogue modifies TD effectiveness.
 */
export function thievesDensTpaMultiplier(
  thievesDensPct: number,
  effectivenessMultiplier = 1,
): number {
  assertFinitePositive('thievesDensPct', thievesDensPct);
  assertFinitePositive('effectivenessMultiplier', effectivenessMultiplier);
  return 1 + (thievesDensPct * 0.03 * effectivenessMultiplier);
}

/**
 * Modified offensive TPA.
 *
 * mTPA = raw TPA × Invisibility × Crime Science × Racial × TD × Honor × Ritual
 *        × Personality × Dragon
 */
export function modifiedTpa(stats: ProvinceThieveryStats): CalculatorResult<number> {
  assertFinitePositive('networth', stats.networth);
  const warnings: string[] = [];
  const assumptions: string[] = [];

  const raw = rawTpa(stats.thieves, stats.acres);
  const td = thievesDensTpaMultiplier(stats.thievesDensPct ?? 0);

  if (stats.thievesDensPct === undefined) warnings.push('Thieves\' Dens percentage not supplied; TD bonus treated as 0%.');
  if (stats.crimeScienceMultiplier === undefined) warnings.push('Crime science multiplier not supplied; treated as 1.00.');
  if (stats.racialTpaMultiplier === undefined) warnings.push('Racial TPA multiplier not supplied; treated as 1.00.');
  if (stats.personalityTpaMultiplier === undefined) warnings.push('Personality TPA multiplier not supplied; treated as 1.00.');
  if (stats.honorTpaMultiplier === undefined) warnings.push('Honor TPA multiplier not supplied; treated as 1.00.');
  if (stats.ritualTpaMultiplier === undefined) warnings.push('Ritual TPA multiplier not supplied; treated as 1.00.');
  if (stats.invisibilityMultiplier === undefined) assumptions.push('Invisibility not active unless supplied.');
  if (stats.dragonTpaMultiplier === undefined) assumptions.push('No dragon TPA penalty unless supplied.');

  const value = raw
    * POSITIVE(stats.invisibilityMultiplier)
    * POSITIVE(stats.crimeScienceMultiplier)
    * POSITIVE(stats.racialTpaMultiplier)
    * td
    * POSITIVE(stats.honorTpaMultiplier)
    * POSITIVE(stats.ritualTpaMultiplier)
    * POSITIVE(stats.personalityTpaMultiplier)
    * POSITIVE(stats.dragonTpaMultiplier);

  return { value, warnings, assumptions };
}

/** Relative networth factor used by thievery yield. */
export function networthFactor(selfNetworth: number, targetNetworth: number): number {
  if (selfNetworth <= 0 || targetNetworth <= 0) {
    throw new Error('Both networth values must be > 0');
  }
  return Math.min(targetNetworth / selfNetworth, selfNetworth / targetNetworth);
}

/**
 * Expected raw thievery yield from the published yield equation.
 * This is NOT a success probability; success chance is a separate game mechanic.
 */
export function thieveryYield(input: YieldInput): CalculatorResult<number> {
  assertFinitePositive('thievesSent', input.thievesSent);
  assertFinitePositive('gainsPerThief', input.gainsPerThief);
  const m = input.modifiers ?? {};
  const lost = input.resourcesLostFraction ?? 0;
  if (lost < 0 || lost > 1) throw new Error('resourcesLostFraction must be between 0 and 1');

  const nw = networthFactor(input.selfNetworth, input.targetNetworth);
  const warBonus = m.warBonus ?? 0;
  const nwTerm = Math.min(1, nw + warBonus);

  const targetWatchtowers = 1 - (m.targetWatchtowersReduction ?? 0);
  const targetShielding = 1 - (m.targetShieldingReduction ?? 0);
  const resourceRetention = 1 - lost;

  const value = input.thievesSent
    * nwTerm
    * input.gainsPerThief
    * resourceRetention
    * POSITIVE(m.racialMultiplier)
    * POSITIVE(m.personalityMultiplier)
    * POSITIVE(m.guileMultiplier)
    * POSITIVE(m.arcanaMultiplier)
    * POSITIVE(m.targetRacialMultiplier)
    * POSITIVE(m.targetPersonalityMultiplier)
    * POSITIVE(m.targetIlluminateShadowsMultiplier)
    * targetWatchtowers
    * targetShielding
    * POSITIVE(m.stanceMultiplier);

  const warnings: string[] = [];
  const assumptions: string[] = [];
  if (m.targetWatchtowersReduction === undefined) assumptions.push('Target Watch Towers reduction not supplied; treated as 0%.');
  if (m.targetShieldingReduction === undefined) assumptions.push('Target Shielding reduction not supplied; treated as 0%.');
  if (m.targetIlluminateShadowsMultiplier === undefined) assumptions.push('Target Illuminate Shadows not active unless supplied.');
  if (m.arcanaMultiplier === undefined) assumptions.push('Arcana/Cunning thievery-damage multiplier not supplied; treated as 1.00.');

  if (nw < 1) warnings.push(`Networth disparity reduces yield to ${formatPercent(nw)} before war bonus.`);
  return { value, warnings, assumptions };
}

/** Optimal thieves for an instant resource operation from the published equation. */
export function optimalThieves(
  targetResources: number,
  maxPercent: number,
  gainsPerThief: number,
  racialMultiplier = 1,
): CalculatorResult<number> {
  assertFinitePositive('targetResources', targetResources);
  if (maxPercent < 0 || maxPercent > 1) throw new Error('maxPercent must be between 0 and 1');
  if (gainsPerThief <= 0 || racialMultiplier <= 0) throw new Error('gainsPerThief and racialMultiplier must be > 0');

  return {
    value: Math.ceil((targetResources * maxPercent) / gainsPerThief / racialMultiplier),
    warnings: [],
    assumptions: ['Result is the published optimal-send equation; actual yield remains subject to networth and target modifiers.'],
  };
}

/**
 * Current Age 116 operation catalog. Values are only entered where the source
 * gives a usable numeric value. Unknown values stay undefined rather than being
 * fabricated.
 */
export const AGE_116_OPERATIONS: Readonly<Record<string, ThieveryOperationSpec>> = {
  spy_on_throne: { id: 'spy_on_throne', name: 'Spy on Throne', category: 'espionage', difficulty: 'very-low', stealthCost: 0.01, relations: 'none' },
  spy_on_defense: { id: 'spy_on_defense', name: 'Spy on Defense', category: 'espionage', difficulty: 'very-low', stealthCost: 0.01, relations: 'none' },
  spy_on_exploration: { id: 'spy_on_exploration', name: 'Spy on Exploration', category: 'espionage', difficulty: 'very-low', stealthCost: 0.02, relations: 'none' },
  snatch_news: { id: 'snatch_news', name: 'Snatch News', category: 'espionage', difficulty: 'low', stealthCost: 0.02, relations: 'none' },
  infiltrate: { id: 'infiltrate', name: 'Infiltrate', category: 'espionage', difficulty: 'low', stealthCost: 0.02, relations: 'none' },
  survey: { id: 'survey', name: 'Survey', category: 'espionage', difficulty: 'low', stealthCost: 0.02, relations: 'none' },
  spy_on_military: { id: 'spy_on_military', name: 'Spy on Military', category: 'espionage', difficulty: 'low', stealthCost: 0.02, relations: 'none' },
  spy_on_sciences: { id: 'spy_on_sciences', name: 'Spy on Sciences', category: 'espionage', difficulty: 'low', stealthCost: 0.02, relations: 'none' },
  kidnap: { id: 'kidnap', name: 'Kidnapping', category: 'sabotage', difficulty: 'medium', stealthCost: 0.03, relations: 'none', maxPercent: 0.0185, gainsPerThief: 0.132, duration: false },
  steal_war_horses: { id: 'steal_war_horses', name: 'Steal War Horses', category: 'sabotage', difficulty: 'medium', stealthCost: 0.03, relations: 'unfriendly', maxPercent: 0.136, gainsPerThief: 0.1, resourcesLostFraction: 0.5, duration: false },
  assassinate_wizards: { id: 'assassinate_wizards', name: 'Assassinate Wizards', category: 'sabotage', difficulty: 'high', stealthCost: 0.03, relations: 'unfriendly', maxPercent: 0.016, gainsPerThief: 0.008, duration: false },
  incite_riots: { id: 'incite_riots', name: 'Incite Riots', category: 'sabotage', difficulty: 'medium', stealthCost: 0.03, relations: 'none', duration: true, notes: ['Age 116 revised income reduction is 20%.'] },
};

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}
