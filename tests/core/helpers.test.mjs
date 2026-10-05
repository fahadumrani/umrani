import test from "node:test";
import assert from "node:assert/strict";
import { estimateTokens, isRtlText, makeId } from "../../src/utils/helpers.js";
import { singleLine } from "../../src/utils/formatter.js";
import { makeTitle } from "../../src/core/chat.js";

test("creates unique-looking chat ids", () => {
  assert.match(makeId(), /^c[a-z0-9]+$/);
});

test("detects RTL text and estimates tokens", () => {
  assert.equal(isRtlText("یہ اردو ہے"), true);
  assert.equal(isRtlText("This is English"), false);
  assert.ok(estimateTokens("hello world") > 0);
});

test("formats one-line titles", () => {
  assert.equal(singleLine("  hello\n  world "), "hello world");
  assert.equal(makeTitle("  hello\n  world "), "hello world");
});