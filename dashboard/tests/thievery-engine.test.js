import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGE_116_DATA,
  AGE_116_OPERATIONS,
  AGE_116_RULES,
  raceModifiers,
  personalityModifiers,
  resolveThieveryModifiers,
  rawTpa,
  thievesDensTpaMultiplier,
  thievesDensLossReduction,
  watchTowersCatchChance,
  modifiedTpa,
  networthFactor,
  thieveryYield,
  optimalThieves,
} from '../../src/thievery/index.js';

test('raw TPA is thieves divided by acres', () => {
  assert.equal(rawTpa(1500, 1000), 1.5);
});

test('Age 116 Thieves Dens base bonus is 3% per percent TD', () => {
  assert.equal(thievesDensTpaMultiplier(20), 1.6);
});

test('Age 116 Rogue gets +100% Thieves Dens effectiveness', () => {
  assert.equal(thievesDensTpaMultiplier(20, 2), 2.2);
});

test('Age 116 Thieves Dens loss reduction is 3.3% per percent TD capped at 90%', () => {
  assert.equal(thievesDensLossReduction(20), 0.66);
  assert.equal(thievesDensLossReduction(100), 0.90);
});

test('Age 116 Watch Tower catch chance is 2.3% per percent WT', () => {
  assert.equal(watchTowersCatchChance(10), 0.23);
  assert.equal(watchTowersCatchChance(100), 1);
});

test('every Age 116 race is present and check-mark verified', () => {
  assert.equal(Object.keys(AGE_116_DATA.races).length, 10);
  for (const race of Object.values(AGE_116_DATA.races)) assert.equal(race.verified, true);
});

test('every Age 116 personality is present and check-mark verified', () => {
  assert.equal(Object.keys(AGE_116_DATA.personalities).length, 11);
  for (const personality of Object.values(AGE_116_DATA.personalities)) assert.equal(personality.verified, true);
});

test('race and personality bonuses come from age data, not calculator constants', () => {
  assert.equal(raceModifiers('Faery').thievery.tpaMultiplier, 1.20);
  assert.equal(raceModifiers('Halfling').thievery.tpaMultiplier, 1.30);
  assert.equal(personalityModifiers('Heretic').thievery.tpaMultiplier, 1.35);
  assert.equal(personalityModifiers('Rogue').thievery.thievesDensEffectivenessMultiplier, 2.00);
});

test('verified race/personality data resolves into calculator modifiers', () => {
  const mods = resolveThieveryModifiers({ race: 'Faery', personality: 'Rogue' });
  assert.equal(mods.racialTpaMultiplier, 1.20);
  assert.equal(mods.personalityTpaMultiplier, 1.25);
  assert.equal(mods.crimeScienceMultiplier, 1.40);
  assert.equal(mods.thievesDensEffectivenessMultiplier, 2.00);
  assert.equal(mods.verified, true);
});

test('unknown race/personality is rejected instead of guessed', () => {
  assert.throws(() => raceModifiers('FutureRace'), /Unknown race/);
  assert.throws(() => personalityModifiers('FuturePersonality'), /Unknown personality/);
});

test('modified TPA composes the published multiplicative modifiers', () => {
  const result = modifiedTpa({
    acres: 1000,
    thieves: 1500,
    networth: 100000,
    thievesDensPct: 20,
    crimeScienceMultiplier: 1.1,
    racialTpaMultiplier: 1.25,
    personalityTpaMultiplier: 1,
    honorTpaMultiplier: 1,
    ritualTpaMultiplier: 1,
    invisibilityMultiplier: 1.2,
    dragonTpaMultiplier: 1,
  });
  assert.ok(Math.abs(result.value - 3.96) < 1e-12);
});

test('networth factor uses the lower relative-NW ratio', () => {
  assert.equal(networthFactor(100000, 60000), 0.6);
  assert.equal(networthFactor(60000, 100000), 0.6);
});

test('published yield equation applies NW and modifiers', () => {
  const result = thieveryYield({
    thievesSent: 1000,
    selfNetworth: 100000,
    targetNetworth: 80000,
    gainsPerThief: 0.1,
    resourcesLostFraction: 0.5,
    modifiers: { racialMultiplier: 1.2, targetWatchtowersReduction: 0.1 },
  });
  assert.equal(result.value, 4.32);
});

test('optimal thieves uses the published resource/send equation and rounds up', () => {
  assert.equal(optimalThieves(10000, 0.136, 0.1, 1.2).value, 11334);
});

test('operation catalog does not invent missing numeric mechanics', () => {
  assert.equal(AGE_116_OPERATIONS.steal_war_horses.gainsPerThief, 0.1);
  assert.equal(AGE_116_OPERATIONS.incite_riots.gainsPerThief, undefined);
  assert.equal(AGE_116_OPERATIONS.incite_riots.notes[0], 'Age 116 revised income reduction: 20%.');
});
