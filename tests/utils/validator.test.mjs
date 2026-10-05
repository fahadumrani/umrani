import test from "node:test";
import assert from "node:assert/strict";
import { isNonEmptyString } from "../../src/utils/validator.js";

test("validates non-empty strings", () => {
  assert.equal(isNonEmptyString("hello"), true);
  assert.equal(isNonEmptyString("   "), false);
  assert.equal(isNonEmptyString(null), false);
});