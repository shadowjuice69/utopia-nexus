import test from "node:test";
import assert from "node:assert/strict";
import { isOutgoingAttack } from "../src/services/attackDirection.js";

test("classifies an attack using the configured kingdom code", () => {
  assert.equal(isOutgoingAttack({ kd_code: "7:15", attack_type: "siege" }, "7:15"), true);
  assert.equal(isOutgoingAttack({ kd_code: "3:2", attack_type: "siege" }, "7:15"), false);
});

test("incoming attacks remain incoming even when the kingdom code matches", () => {
  assert.equal(isOutgoingAttack({ kd_code: "7:15", attack_type: "incoming" }, "7:15"), false);
});

test("legacy traditional and ambush attack records remain outgoing", () => {
  assert.equal(isOutgoingAttack({ attack_type: "traditional" }, "7:15"), true);
  assert.equal(isOutgoingAttack({ attack_type: "ambush" }, "7:15"), true);
});

test("unknown kingdom context does not incorrectly mark generic attacks as outgoing", () => {
  assert.equal(isOutgoingAttack({ attack_type: "siege", kd_code: "7:15" }, null), false);
});
