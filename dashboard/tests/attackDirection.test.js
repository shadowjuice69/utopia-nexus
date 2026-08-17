import test from "node:test";
import assert from "node:assert/strict";
import { isOutgoingAttack } from "../src/services/attackDirection.js";

test("uses the configured kingdom instead of a hardcoded kingdom", () => {
  assert.equal(isOutgoingAttack({ kd_code: "7:15", attack_type: "march" }, "7:15"), true);
  assert.equal(isOutgoingAttack({ kd_code: "3:2", attack_type: "march" }, "7:15"), false);
});

test("explicit incoming attacks remain incoming", () => {
  assert.equal(isOutgoingAttack({ kd_code: "7:15", attack_type: "incoming" }, "7:15"), false);
});

test("legacy traditional and ambush records remain outgoing", () => {
  assert.equal(isOutgoingAttack({ kd_code: "enemy", attack_type: "traditional" }, "7:15"), true);
  assert.equal(isOutgoingAttack({ kd_code: "enemy", attack_type: "ambush" }, "7:15"), true);
});

test("missing kingdom configuration does not invent an outgoing attack", () => {
  assert.equal(isOutgoingAttack({ kd_code: "7:15", attack_type: "march" }, null), false);
});
