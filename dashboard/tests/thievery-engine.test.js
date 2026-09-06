import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGE_DATA,
  AGE_116_OPERATIONS,
  AGE_116_RULES,
  raceModifiers,
  personalityModifiers,
  resolveThieveryModifiers,
  rawTpa,
  thievesDensTpaMultiplier,
  thievesDensLossReduction,
  watchTowersCatchChance,
  watchTowersDamageReduction,
  modifiedTpa,
  networthFactor,
  relativeSize,
  thieveryYield,
  optimalThieves,
  operationSuccessMetrics,
  stealthRecoveryPerTick,
  crimeScienceBonus,
} from '../../src/thievery/index.js';

const AGE_116_DATA = AGE_DATA[116];

test('raw TPA is thieves divided by land', () => assert.equal(rawTpa(1500, 1000), 1.5));
test('Age 116 TD gives +3% TPA per percent', () => assert.equal(thievesDensTpaMultiplier(20), 1.6));
test('Age 116 Rogue doubles TD effectiveness', () => assert.equal(thievesDensTpaMultiplier(20, 2), 2.2));
test('Age 116 TD thief loss reduction is 3.6% per TD capped at 90%', () => { assert.equal(thievesDensLossReduction(20), 0.72); assert.equal(thievesDensLossReduction(100), 0.90); });
test('Age 116 WT catch chance is 2.2% per percent WT', () => { assert.equal(watchTowersCatchChance(10), 0.22); assert.equal(watchTowersCatchChance(100), 1); });
test('WT damage reduction is 2.4% per WT capped at 62.5%', () => { assert.equal(watchTowersDamageReduction(10), 0.24); assert.equal(watchTowersDamageReduction(100), 0.625); });
test('all Age 116 race entries are verified', () => { assert.equal(Object.keys(AGE_116_DATA.races).length, 10); for (const item of Object.values(AGE_116_DATA.races)) assert.equal(item.verified, true); });
test('all Age 116 personality entries are verified', () => { assert.equal(Object.keys(AGE_116_DATA.personalities).length, 11); for (const item of Object.values(AGE_116_DATA.personalities)) assert.equal(item.verified, true); });
test('Age 116 race/personality TPA comes from data', () => { assert.equal(raceModifiers('Faery').thievery.tpaMultiplier, 1.20); assert.equal(raceModifiers('Halfling').thievery.tpaMultiplier, 1.30); assert.equal(personalityModifiers('Heretic').thievery.tpaMultiplier, 1.35); assert.equal(personalityModifiers('Rogue').thievery.thievesDensEffectivenessMultiplier, 2.00); });
test('verified modifiers resolve correctly', () => { const mods = resolveThieveryModifiers({ race: 'Faery', personality: 'Rogue' }); assert.equal(mods.racialTpaMultiplier, 1.20); assert.equal(mods.personalityTpaMultiplier, 1.25); assert.equal(mods.crimeScienceEffectivenessMultiplier, 1.40); assert.equal(mods.thievesDensEffectivenessMultiplier, 2.00); assert.equal(mods.allThieveryOperations, true); });
test('unknown age entries are rejected', () => { assert.throws(() => raceModifiers('FutureRace'), /Unknown race/); assert.throws(() => personalityModifiers('FuturePersonality'), /Unknown personality/); });
test('modified TPA composes verified multiplicative inputs', () => { const result = modifiedTpa({ acres: 1000, thieves: 1500, thievesDensPct: 20, crimeScienceMultiplier: 1.1, racialTpaMultiplier: 1.25, personalityTpaMultiplier: 1, honorTpaMultiplier: 1, ritualTpaMultiplier: 1, invisibilityMultiplier: 1.2, dragonTpaMultiplier: 1 }); assert.ok(Math.abs(result.value - 3.96) < 1e-12); });
test('relative size uses the lower relative-NW ratio plus war bonus', () => { assert.equal(networthFactor(100000, 60000), 0.6); assert.equal(relativeSize(100000, 60000), 0.6); assert.equal(relativeSize(100000, 60000, 1), 1.6); });
test('published yield equation applies modifiers', () => { const result = thieveryYield({ thievesSent: 1000, selfNetworth: 100000, targetNetworth: 80000, gainsPerThief: 0.1, resourcesLostFraction: 0.5, modifiers: { racialMultiplier: 1.2, targetWatchtowersReduction: 0.1 } }); assert.equal(result.value, 4.32); });
test('optimal thieves follows the published equation', () => assert.equal(optimalThieves(10000, 0.136, 0.1, 1.2), 11334));
test('randomization follows the wiki endpoints', () => { assert.equal(operationSuccessMetrics(2, 1, { thievesSent: 10, totalThieves: 1000 }).randomizationPercent, 0.25); assert.equal(operationSuccessMetrics(2, 1, { thievesSent: 500, totalThieves: 1000 }).randomizationPercent, 0.03); });
test('stealth recovery includes Age 116 Halfling/Rogue bonuses', () => { assert.equal(stealthRecoveryPerTick({}), 3); assert.equal(stealthRecoveryPerTick({ race: 'Halfling' }), 4); assert.equal(stealthRecoveryPerTick({ personality: 'Rogue' }), 4); });
test('Age 116 operation changes are represented', () => { assert.equal(AGE_116_OPERATIONS.rob_vaults.maxPercentWar, 0.16); assert.equal(AGE_116_OPERATIONS.kidnapping.maxPercentWar, 0.05); assert.equal(AGE_116_OPERATIONS.incite_riots.incomeReduction, 0.20); assert.equal(AGE_116_OPERATIONS.bribe_thieves.targetTpaReduction, 0.125); assert.equal(AGE_116_OPERATIONS.free_prisoners.damageMultiplier, 1.25); assert.equal(AGE_116_OPERATIONS.destabilize_guilds.durationReduction, 0.25); assert.equal(AGE_116_OPERATIONS.arson.damageMultiplier, 1.05); });
test('Age 116 science formula is wired', () => { assert.equal(AGE_116_RULES.scienceExponent, 1 / 2.125); assert.ok(crimeScienceBonus(10000) > 0); });
