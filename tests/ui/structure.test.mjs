import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("HTML points to the modular Umrani entry point and favicon", async () => {
  const html = await readFile(new URL("../../index.html", import.meta.url), "utf8");
  assert.match(html, /styles\/main\.css/);
  assert.match(html, /defer src="dist\/app\.bundle\.js\?v=19"/);
  assert.match(html, /text-anchor='middle'%3EU%3C\/text/);
  assert.match(html, /https:\/\/fahadumrani\.devs\.li\//);
  assert.match(html, /id="adsterraAdShell"/);
  assert.match(html, /id="adsterraCloseButton"/);
  assert.match(html, /id="openDisplayAdBtn"/);
  assert.match(html, /id="tokenLimitInfo"/);
  assert.match(html, /id="adBlockBait"/);
  assert.match(html, /id="adBlockWarning"/);
  assert.doesNotMatch(html, /securepubads\.g\.doubleclick\.net/);
  assert.doesNotMatch(html, /id="watchAdBtn"/);
  assert.match(html, /https:\/\/bauval\.org\/14\/a67c4a1da3645718e3483de61514fbe8/);
});

test("uses three Dahl providers and a 10,000-token browser limit", async () => {
  const config = await readFile(new URL("../../src/config/config.js", import.meta.url), "utf8");
  assert.match(config, /TOKEN_LIMIT\s*=\s*10000/);
  assert.equal((config.match(/name:\s*"Dahl /g) || []).length, 3);
  assert.equal((config.match(/models:\s*\[PRIMARY_MODEL,\s*FALLBACK_MODEL\]/g) || []).length, 3);
  assert.doesNotMatch(config, /TOKEN_RESET_MS/);
  assert.doesNotMatch(config, /GOOGLE_AD_MANAGER|REWARDED_AD/);
});