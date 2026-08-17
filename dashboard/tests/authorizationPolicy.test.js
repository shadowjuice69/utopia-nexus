import test from "node:test";
import assert from "node:assert/strict";
import { evaluateAuthorization } from "../src/services/authorizationPolicy.js";

const base = {
  authenticated: true,
  expectedPassword: "NikkoAce",
};

test("registered user gets access with matching province and password", () => {
  const result = evaluateAuthorization({
    ...base,
    provinceName: "Shadow",
    password: "NikkoAce",
    registeredProvince: { name: "Shadow" },
    isOwner: false,
  });

  assert.deepEqual(result, { allowed: true, reason: "registered", owner: false });
});

test("unregistered user is blocked even with the correct password", () => {
  const result = evaluateAuthorization({
    ...base,
    provinceName: "Unknown",
    password: "NikkoAce",
    registeredProvince: null,
    isOwner: false,
  });

  assert.deepEqual(result, { allowed: false, reason: "unregistered", owner: false });
});

test("registered user with the wrong password is blocked", () => {
  const result = evaluateAuthorization({
    ...base,
    provinceName: "Shadow",
    password: "wrong",
    registeredProvince: { name: "Shadow" },
    isOwner: false,
  });

  assert.deepEqual(result, { allowed: false, reason: "password", owner: false });
});

test("owner gets emergency access without registration or dashboard password", () => {
  const result = evaluateAuthorization({
    ...base,
    provinceName: "",
    password: "",
    registeredProvince: null,
    isOwner: true,
  });

  assert.deepEqual(result, { allowed: true, reason: "owner-emergency", owner: true });
});

test("unauthenticated user is always blocked", () => {
  const result = evaluateAuthorization({
    ...base,
    authenticated: false,
    provinceName: "Shadow",
    password: "NikkoAce",
    registeredProvince: { name: "Shadow" },
    isOwner: true,
  });

  assert.deepEqual(result, { allowed: false, reason: "unauthenticated", owner: false });
});
