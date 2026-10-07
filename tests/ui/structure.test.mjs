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
  assert.match(h, /id="composerModelLabel">Umrani 2\.1</);
});

test("HTML has a loading screen and KaTeX assets", async () => {
  const h = await html();
  assert.match(h, /id="modelLoadingOverlay"/);
  assert.match(h, /class="model-loading-bar"/);
  assert.doesNotMatch(h, /Testing AI models/);
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
  assert.match(m, /frame.setAttribute\("sandbox", "allow-scripts"\)/);
  assert.doesNotMatch(m, /SOCIAL_BAR_SRC|POPUNDER_SRC|loadSocialBar|loadDesktopPopunder/);
  assert.match(h, /id="adsterraAdShell"/);
  assert.match(h, /id="adsterraCloseButton"/);
  assert.match(h, /container-63ea484e1a293480518c8d527b5e81e3/);
  assert.doesNotMatch(h, /id="desktopSmartlink"|araplhn\.org/);
  assert.doesNotMatch(h, /id="adBlockBait"/);
  assert.doesNotMatch(h, /id="adBlockWarning"/);
});

test("ad shows after completed replies and never locks the composer", async () => {
  const m = await main();
  assert.match(m, /adDue = !res\.incomplete;/);
  assert.match(m, /if \(adDue && state\.currentChatId === chat\.id && getChat\(chat\.id\)\) showAdBreak\(\);/);
  assert.doesNotMatch(m, /state\.adBreakActive/);
  assert.doesNotMatch(m, /Advertisement — please wait/);
  assert.match(m, /function showAdBreak\(\)/);
  assert.match(m, /closeButton\.hidden = false;/);
});

test("config keeps ten browser-side accounts as requested", async () => {
  const { API_PROVIDERS } = await import("../../src/config/config.js");
  assert.equal(API_PROVIDERS.length, 10);
  for (const [index, provider] of API_PROVIDERS.entries()) {
    assert.equal(provider.url, "https://inference.dahl.global/v1/chat/completions");
    assert.equal(provider.models.length, 3);
    assert.ok(typeof provider.key === "string" && provider.key.length > 0);
  }
  assert.equal(new Set(API_PROVIDERS.map((provider) => provider.key)).size, 10);
});

test("auto-selects the fastest model without exposing its real id", async () => {
  const m = await main();
  assert.match(m, /const MODEL_POOL = \[PRIMARY_MODEL, FALLBACK_MODEL, SECOND_FALLBACK_MODEL\];/);
  assert.match(m, /const UI_MODEL_NAME = "Umrani 2.1";/);
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

test("uses token-budgeted context without a fixed message cap", async () => {
  const m = await main();
  assert.match(m, /budgetMessages\(apiMessages, CONTEXT_WINDOW_TOKENS, OUTPUT_RESERVE_TOKENS\)/);
  assert.doesNotMatch(m, /MAX_CONTEXT_MESSAGES/);
});

test("renders Mermaid graphs as real diagrams", async () => {
  const h = await html();
  const m = await main();
  const c = await config();
  assert.match(h, /mermaid@10\.9\.1\/dist\/mermaid\.min\.js/);
  assert.match(m, /function isDiagramLang\(/);
  assert.match(m, /function createDiagramBlock\(/);
  assert.match(m, /window\.mermaid\.render/);
  assert.match(c, /Mermaid fences ONLY for valid flowcharts/);
});

test("web search is always on with no toggle", async () => {
  const h = await html();
  const m = await main();
  assert.doesNotMatch(h, /id="webToggle"/);
  assert.doesNotMatch(m, /function toggleWebSearch\(/);
  assert.match(m, /function webSearch\(/);
  assert.match(m, /Searching the web…/);
  assert.match(m, /searchWeb\(query,\{signal:controller.signal\}\)/);
  assert.match(m, /dateContext\(\)/);
});

test("adds a Deep Think toggle that enables step-by-step reasoning", async () => {
  const h = await html();
  const m = await main();
  assert.match(h, /id="deepThinkToggle"/);
  assert.match(m, /function toggleDeepThink\(/);
  assert.match(m, /deepThinkEnabled/);
  assert.match(m, /Deep Thinking is ON/);
  assert.match(m, /DEEP_THINK_KEY/);
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
  assert.match(v, /--bg-code:\s*#F9F9F7;/);
  assert.match(v, /--text-code:\s*#0B0B0B;/);
  const c = await css();
  assert.match(c, /\.code-block \{[\s\S]*?background: var\(--bg-code\)/);
});

test("streaming status sits above the input, not beside the About Developer pill", async () => {
  const h = await html();
  const c = await css();
  assert.doesNotMatch(h, /class="topbar-status"/);
  assert.match(h, /class="stream-status" id="streamStatus"/);
  assert.match(c, /\.stream-status \{/);
  assert.match(c, /\.stream-status \.dot \{/);
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
