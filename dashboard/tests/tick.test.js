import test from "node:test";
import assert from "node:assert/strict";
import { getTickState } from "../src/services/tick.js";

const ANCHOR = Date.parse("2026-09-07T17:00:00-05:00");
const atHours = (hours, minute = 0, second = 0) =>
  new Date(ANCHOR + (hours * 3600000) + (minute * 60000) + (second * 1000));

test("current anchor is Tick 5", () => {
  const state = getTickState(atHours(0));
  assert.equal(state.current, 5);
  assert.equal(state.minLeft, 60);
  assert.equal(state.secLeft, 0);
  assert.equal(state.year, 6);
  assert.equal(state.month, "February");
  assert.equal(state.day, 5);
});

test("tick remains 5 through the hour", () => {
  assert.equal(getTickState(atHours(0, 59, 59)).current, 5);
});

test("tick increments at the top of the hour", () => {
  assert.equal(getTickState(atHours(1)).current, 6);
  assert.equal(getTickState(atHours(2)).current, 7);
});

test("tick wraps to the next year after the final day", () => {
  assert.equal(getTickState(atHours(167)).current, 4);
  assert.equal(getTickState(atHours(168)).current, 5);
  assert.equal(getTickState(atHours(168)).year, 7);
  assert.equal(getTickState(atHours(168)).month, "January");
  assert.equal(getTickState(atHours(168)).day, 5);
});
