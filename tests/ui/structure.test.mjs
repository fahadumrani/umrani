import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = () => readFile(new URL("../../index.html", import.meta.url), "utf8");
const main = () => readFile(new URL("../../src/main.js", import.meta.url), "utf8");
const css = () => readFile(new URL("../../styles/main.css", import.meta.url), "utf8");
const vars = () => readFile(new URL("../../styles/variables.css", import.meta.url), "utf8");
const config = () => readFile(new URL("../../src/config/config.js", import.meta.url), "utf8");

test("HTML has no model selector and shows a single brand label", async () => {
  const h = await html();
  assert.doesNotMatch(h, /id="modelSelect"/);
  assert.doesNotMatch(h, /id="modelHealth"/);
  assert.doesNotMatch(h, /class="model-control"/);
  assert.match(h, /id="composerModelLabel">Umrani 2\.2</);
});

test("HTML has a loading screen and KaTeX assets", async () => {
  const h = await html();
  assert.match(h, /id="modelLoadingOverlay"/);
  assert.match(h, /Testing AI models/);
  assert.match(h, /katex@0\.16\.11\/dist\/katex\.min\.css/);
  assert.match(h, /katex@0\.16\.11\/dist\/katex\.min\.js/);
  assert.match(h, /auto-render\.min\.js/);
});

test("input has no character limit", async () => {
  const h = await html();
  assert.doesNotMatch(h, /maxlength="8000"/);
});

test("only the Native Banner ad remains; smartlink, bait and warning removed", async () => {
  const h = await html();
  const m = await main();
  assert.match(m, /const NATIVE_BANNER_SRC/);
  assert.doesNotMatch(m, /SOCIAL_BAR_SRC|POPUNDER_SRC|loadSocialBar|loadDesktopPopunder/);
  assert.match(h, /id="adsterraAdShell"/);
  assert.match(h, /id="adsterraCloseButton"/);
  assert.match(h, /container-63ea484e1a293480518c8d527b5e81e3/);
  assert.doesNotMatch(h, /id="desktopSmartlink"|araplhn\.org/);
  assert.doesNotMatch(h, /id="adBlockBait"/);
  assert.doesNotMatch(h, /id="adBlockWarning"/);
});

test("ad shows after every reply and never locks the composer", async () => {
  const m = await main();
  assert.match(m, /adDue = true;/);
  assert.match(m, /if \(adDue\) showAdBreak\(\);/);
  assert.doesNotMatch(m, /state\.adBreakActive/);
  assert.doesNotMatch(m, /Advertisement — please wait/);
  assert.match(m, /function showAdBreak\(\)/);
  assert.match(m, /closeButton\.hidden = false;/);
});

test("config keeps ten Dahl providers with three text models", async () => {
  const c = await config();
  assert.equal((c.match(/name:\s*"Dahl /g) || []).length, 10);
  assert.equal(
    (c.match(/models:\s*\[PRIMARY_MODEL,\s*FALLBACK_MODEL,\s*SECOND_FALLBACK_MODEL\]/g) || []).length,
    10
  );
  assert.doesNotMatch(c, /TOKEN_LIMIT|TOKEN_RESET_MS/);
  assert.match(c, /You are Umrani, a smart, friendly, accurate, and professional AI assistant/);
});

test("auto-selects the fastest model without exposing its real id", async () => {
  const m = await main();
  assert.match(m, /const MODEL_POOL = \[PRIMARY_MODEL, FALLBACK_MODEL, SECOND_FALLBACK_MODEL\];/);
  assert.match(m, /const UI_MODEL_NAME = "Umrani 2.2";/);
  assert.match(m, /const healthy = results\.filter\(Boolean\)\.sort\(\(a, b\) => a\.ms - b\.ms\)/);
  assert.match(m, /state\.activeModel = healthy\[0\]\.model/);
  assert.match(m, /function testModelsAndPick\(\)/);
  assert.doesNotMatch(m, /MODEL_OPTIONS|selectModel|checkModelHealth|modelHealthLabel/);
});

test("streaming falls back across models then providers", async () => {
  const m = await main();
  assert.match(m, /const modelOrder = \[/);
  assert.match(m, /for \(const model of modelOrder\)/);
  assert.match(m, /for \(const provider of providers\)/);
  assert.match(m, /state\.activeModel = model;/);
  assert.doesNotMatch(m, /state\.selectedModel/);
});

test("sends full chat context without a message cap", async () => {
  const m = await main();
  assert.match(m, /const recent = chat\.messages\.slice\(\);/);
  assert.doesNotMatch(m, /MAX_CONTEXT_MESSAGES/);
});

test("renders math formulas and derivations via KaTeX", async () => {
  const m = await main();
  assert.match(m, /function renderMath\(targetEl\)/);
  assert.match(m, /window\.renderMathInElement/);
  assert.match(m, /\{ left: "\$\$", right: "\$\$", display: true \}/);
  assert.ok(m.includes('{ left: "\\\\(", right: "\\\\)", display: false }'));
});

test("code blocks use the light app background, not black", async () => {
  const v = await vars();
  assert.match(v, /--bg-code:\s*#FFFFFF;/);
  assert.match(v, /--text-code:\s*#172033;/);
  const c = await css();
  assert.match(c, /\.code-block \{[\s\S]*?background: var\(--bg-code\)/);
});

test("topbar reserves space so the developer pill never overlaps status", async () => {
  const c = await css();
  assert.match(c, /\.topbar \{[\s\S]*?padding-right: 170px/);
  assert.match(c, /\.topbar \{ gap: 6px; padding-left: 10px; padding-right: 58px; \}/);
});

test("shows a Stop button while generating and aborts the stream", async () => {
  const h = await html();
  const m = await main();
  assert.match(h, /id="stopBtn"/);
  assert.match(m, /function stopStreaming\(\)/);
  assert.match(m, /state\.stopRequested = true;/);
  assert.match(m, /stopped\.userStopped = true;/);
  assert.match(m, /const partial = filterThinkingContent\(streamContent\)\.content;/);
  assert.match(m, /dom\.sendBtn\.hidden = state\.isStreaming;/);
  assert.match(m, /if \(dom\.stopBtn\) dom\.stopBtn\.hidden = !state\.isStreaming;/);
});
