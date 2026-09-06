import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGE_116_OPERATIONS,
  rawTpa,
  thievesDensTpaMultiplier,
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

test('Rogue TD effectiveness doubles the base TD effect when supplied', () => {
  assert.equal(thievesDensTpaMultiplier(20, 2), 2.2);
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
    modifiers: {
      racialMultiplier: 1.2,
      targetWatchtowersReduction: 0.1,
    },
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
