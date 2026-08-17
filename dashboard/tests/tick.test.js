import test from "node:test";
import assert from "node:assert/strict";
import { getTickState } from "../src/services/tick.js";

const utc = (hour, minute, second = 0) => new Date(Date.UTC(2026, 7, 16, hour, minute, second));

test("tick starts at 1 at 13:00 UTC", () => {
  assert.deepEqual(getTickState(utc(13, 0, 0)), { current: 1, minLeft: 59, secLeft: 59 });
});

test("tick remains 1 through 13:59 UTC", () => {
  assert.equal(getTickState(utc(13, 59, 59)).current, 1);
});

test("tick increments at the top of the hour", () => {
  assert.equal(getTickState(utc(14, 0, 0)).current, 2);
  assert.equal(getTickState(utc(15, 0, 0)).current, 3);
});

test("tick wraps to the final tick before the 13:00 UTC reset", () => {
  assert.equal(getTickState(utc(12, 59, 59)).current, 24);
});
