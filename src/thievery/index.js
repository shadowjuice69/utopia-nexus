/**
 * Utopia Age 116 thievery calculation engine.
 * Pure calculation module: no dashboard, API, database, or browser dependencies.
 *
 * Source basis: Utopia Guide — Thievery (Age 116) and Age 116 revised mechanics.
 * Unknown mechanics are never silently guessed.
 */

const positive = (value, fallback = 1) => value ?? fallback;

/** Age 116 verified ruleset constants. Percent inputs are whole percentages (e.g. 20 = 20%). */
export const AGE_116_RULES = Object.freeze({
  thievesDens: Object.freeze({
    tpaEffectivenessPerPercent: 0.03,
    thiefLossReductionPerPercent: 0.033,
    maxThiefLossReduction: 0.90,
    rogueEffectivenessMultiplier: 1.75,
  }),
  watchTowers: Object.freeze({
    catchChancePerPercent: 0.023,
    maxCatchChance: 1,
    // The current Age 116 sources verify the 2.3% catch chance, but do not
    // publish a current official numeric damage-reduction coefficient here.
    damageReductionPerPercent: undefined,
  }),
  stealth: Object.freeze({
    baseRecoveryPerTick: 3,
    minimumToOperate: 0.05,
  }),
  shieldingScienceMultiplier: 0.0350,
});

function assertNonNegative(name, value) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a finite number >= 0`);
}

export function rawTpa(thieves, acres) {
  assertNonNegative('thieves', thieves);
  if (!Number.isFinite(acres) || acres <= 0) throw new Error('acres must be > 0');
  return thieves / acres;
}

/** Age 116 base TD effect: +3% thievery effectiveness per 1% TD. */
export function thievesDensTpaMultiplier(thievesDensPct, effectivenessMultiplier = 1) {
  assertNonNegative('thievesDensPct', thievesDensPct);
  assertNonNegative('effectivenessMultiplier', effectivenessMultiplier);
  return 1 + thievesDensPct * AGE_116_RULES.thievesDens.tpaEffectivenessPerPercent * effectivenessMultiplier;
}

/** Age 116 thief-loss reduction: 3.3% per 1% TD, capped at 90%. */
export function thievesDensLossReduction(thievesDensPct, effectivenessMultiplier = 1) {
  assertNonNegative('thievesDensPct', thievesDensPct);
  assertNonNegative('effectivenessMultiplier', effectivenessMultiplier);
  return Math.min(
    AGE_116_RULES.thievesDens.maxThiefLossReduction,
    thievesDensPct * AGE_116_RULES.thievesDens.thiefLossReductionPerPercent * effectivenessMultiplier,
  );
}

/** Age 116 Watch Tower catch chance: 2.3% per 1% WT, capped at 100%. */
export function watchTowersCatchChance(watchTowersPct) {
  assertNonNegative('watchTowersPct', watchTowersPct);
  return Math.min(
    AGE_116_RULES.watchTowers.maxCatchChance,
    watchTowersPct * AGE_116_RULES.watchTowers.catchChancePerPercent,
  );
}

/**
 * Watch Tower damage reduction is intentionally unresolved until a current
 * Age 116 official numeric coefficient is verified. Do not substitute 2.4 here.
 */
export function watchTowersDamageReduction(watchTowersPct) {
  assertNonNegative('watchTowersPct', watchTowersPct);
  throw new Error('Age 116 Watch Tower damage-reduction coefficient is not verified from an authoritative current source.');
}

/**
 * Modified offensive TPA:
 * raw TPA × Invisibility × Crime Science × Racial × TD × Honor × Ritual × Personality × Dragon
 */
export function modifiedTpa(stats) {
  assertNonNegative('thieves', stats.thieves);
  if (stats.acres <= 0 || stats.networth <= 0) throw new Error('acres and networth must be > 0');

  const warnings = [];
  const assumptions = [];
  const raw = rawTpa(stats.thieves, stats.acres);
  const td = thievesDensTpaMultiplier(
    stats.thievesDensPct ?? 0,
    stats.thievesDensEffectivenessMultiplier ?? 1,
  );

  for (const [key, label] of [
    ['thievesDensPct', "Thieves' Dens percentage"],
    ['crimeScienceMultiplier', 'Crime science multiplier'],
    ['racialTpaMultiplier', 'Racial TPA multiplier'],
    ['personalityTpaMultiplier', 'Personality TPA multiplier'],
    ['honorTpaMultiplier', 'Honor TPA multiplier'],
    ['ritualTpaMultiplier', 'Ritual TPA multiplier'],
  ]) {
    if (stats[key] === undefined) warnings.push(`${label} not supplied; neutral value used.`);
  }
  if (stats.invisibilityMultiplier === undefined) assumptions.push('Invisibility is assumed inactive.');
  if (stats.dragonTpaMultiplier === undefined) assumptions.push('No dragon TPA penalty is assumed.');
  if (stats.thievesDensEffectivenessMultiplier === undefined) assumptions.push('Base Thieves\' Dens effectiveness is assumed.');

  return {
    value: raw
      * positive(stats.invisibilityMultiplier)
      * positive(stats.crimeScienceMultiplier)
      * positive(stats.racialTpaMultiplier)
      * td
      * positive(stats.honorTpaMultiplier)
      * positive(stats.ritualTpaMultiplier)
      * positive(stats.personalityTpaMultiplier)
      * positive(stats.dragonTpaMultiplier),
    warnings,
    assumptions,
  };
}

export function networthFactor(selfNetworth, targetNetworth) {
  if (selfNetworth <= 0 || targetNetworth <= 0) throw new Error('Both networth values must be > 0');
  return Math.min(targetNetworth / selfNetworth, selfNetworth / targetNetworth);
}

/** Published thievery-yield equation. This is yield, not success probability. */
export function thieveryYield(input) {
  assertNonNegative('thievesSent', input.thievesSent);
  if (input.gainsPerThief <= 0) throw new Error('gainsPerThief must be > 0');
  const modifiers = input.modifiers ?? {};
  const lost = input.resourcesLostFraction ?? 0;
  if (lost < 0 || lost > 1) throw new Error('resourcesLostFraction must be between 0 and 1');

  const nw = networthFactor(input.selfNetworth, input.targetNetworth);
  const nwTerm = Math.min(1, nw + (modifiers.warBonus ?? 0));
  const value = input.thievesSent
    * nwTerm
    * input.gainsPerThief
    * (1 - lost)
    * positive(modifiers.racialMultiplier)
    * positive(modifiers.personalityMultiplier)
    * positive(modifiers.guileMultiplier)
    * positive(modifiers.arcanaMultiplier)
    * positive(modifiers.targetRacialMultiplier)
    * positive(modifiers.targetPersonalityMultiplier)
    * positive(modifiers.targetIlluminateShadowsMultiplier)
    * (1 - (modifiers.targetWatchtowersReduction ?? 0))
    * (1 - (modifiers.targetShieldingReduction ?? 0))
    * positive(modifiers.stanceMultiplier);

  const warnings = nw < 1 ? [`Networth disparity reduces yield to ${formatPercent(nw)} before war bonus.`] : [];
  const assumptions = [];
  if (modifiers.targetWatchtowersReduction === undefined) assumptions.push('Target Watch Towers reduction treated as 0%.');
  if (modifiers.targetShieldingReduction === undefined) assumptions.push('Target Shielding reduction treated as 0%.');
  if (modifiers.targetIlluminateShadowsMultiplier === undefined) assumptions.push('Target Illuminate Shadows assumed inactive.');
  if (modifiers.arcanaMultiplier === undefined) assumptions.push('Arcana/Cunning damage multiplier treated as 1.00.');
  return { value, warnings, assumptions };
}

/** Published optimal-send equation for instant resource operations. */
export function optimalThieves(targetResources, maxPercent, gainsPerThief, racialMultiplier = 1) {
  assertNonNegative('targetResources', targetResources);
  if (maxPercent < 0 || maxPercent > 1) throw new Error('maxPercent must be between 0 and 1');
  if (gainsPerThief <= 0 || racialMultiplier <= 0) throw new Error('gainsPerThief and racialMultiplier must be > 0');
  return {
    value: Math.ceil((targetResources * maxPercent) / gainsPerThief / racialMultiplier),
    warnings: [],
    assumptions: ['Actual yield remains subject to networth and target modifiers.'],
  };
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
