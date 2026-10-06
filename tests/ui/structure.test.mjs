import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("HTML points to the modular Umrani entry point and favicon", async () => {
  const html = await readFile(new URL("../../index.html", import.meta.url), "utf8");
  assert.match(html, /styles\/main\.css/);
  assert.match(html, /defer src="dist\/app\.bundle\.js\?v=39"/);
  assert.match(html, /text-anchor='middle'%3EU%3C\/text/);
  assert.match(html, /https:\/\/fahadumrani\.devs\.li\//);
  assert.match(html, /id="adsterraAdShell"/);
  assert.match(html, /id="adsterraCloseButton"/);
  assert.doesNotMatch(html, /id="adBreakOverlay"/);
  assert.match(html, /id="adBlockBait"/);
  assert.match(html, /id="adBlockWarning"/);
  assert.match(html, /id="attachBtn"/);
  assert.match(html, /id="fileInput"/);
  assert.match(html, /id="attachmentBar"/);
  assert.doesNotMatch(html, /src="https:\/\/bauval\.org\/21\/63ea484e1a293480518c8d527b5e81e3"/);
  assert.match(html, /container-63ea484e1a293480518c8d527b5e81e3/);
  assert.doesNotMatch(html, /securepubads\.g\.doubleclick\.net/);
  assert.doesNotMatch(html, /id="watchAdBtn"/);
  assert.doesNotMatch(html, /id="adsterraSocialBarScript"/);
});

test("uses ten Dahl providers with three text models", async () => {
  const config = await readFile(new URL("../../src/config/config.js", import.meta.url), "utf8");
  assert.equal((config.match(/name:\s*"Dahl /g) || []).length, 10);
  assert.equal(
    (config.match(/models:\s*\[PRIMARY_MODEL,\s*FALLBACK_MODEL,\s*SECOND_FALLBACK_MODEL\]/g) || []).length,
    10
  );
  assert.doesNotMatch(config, /TOKEN_LIMIT|TOKEN_RESET_MS/);
  assert.doesNotMatch(config, /GOOGLE_AD_MANAGER|REWARDED_AD/);
});

test("switches model immediately after one failed attempt", async () => {
  const main = await readFile(new URL("../../src/main.js", import.meta.url), "utf8");
  assert.match(main, /for \(const provider of providers\)/);
  assert.match(main, /for \(const model of getProviderModels\(provider\)\)/);
  assert.ok(
    main.indexOf("for (const provider of providers)") <
    main.indexOf("for (const model of getProviderModels(provider))")
  );
  assert.doesNotMatch(main, /for \(const model of modelOrder\)/);
});

test("loads one Social Bar script on desktop and mobile", async () => {
  const main = await readFile(new URL("../../src/main.js", import.meta.url), "utf8");
  const css = await readFile(new URL("../../styles/main.css", import.meta.url), "utf8");
  assert.match(main, /function loadSocialBar\(\)/);
  assert.match(main, /script\.id = "adsterraSocialBarScript"/);
  assert.match(main, /__umraniSocialBarStatus = "loaded"/);
  assert.match(main, /__umraniSocialBarStatus = "error"/);
  assert.match(main, /a67c4a1da3645718e3483de61514fbe8/);
  assert.doesNotMatch(main, /window\.innerWidth <= MOBILE_AD_MAX_WIDTH/);
  assert.match(css, /width: min\(100%, 320px\)/);
  assert.match(css, /width: min\(100%, 288px\)/);
});

test("uses four Adsterra formats on desktop", async () => {
  const html = await readFile(new URL("../../index.html", import.meta.url), "utf8");
  const main = await readFile(new URL("../../src/main.js", import.meta.url), "utf8");
  const css = await readFile(new URL("../../styles/main.css", import.meta.url), "utf8");
  // Native Banner + Smartlink in HTML.
  assert.match(html, /id="container-63ea484e1a293480518c8d527b5e81e3"/);
  assert.match(main, /const NATIVE_BANNER_SRC = "https:\/\/bauval\.org\/21\/63ea484e1a293480518c8d527b5e81e3"/);
  assert.match(main, /function ensureNativeBannerLoaded\(\)/);
  assert.match(html, /id="desktopSmartlink"/);
  assert.match(html, /araplhn\.org\/4\/1a6d91f12807017d4ca192e215b57599/);
  // Social Bar + desktop-only Popunder are installed once from JavaScript.
  assert.match(main, /function loadSocialBar\(\)/);
  assert.match(main, /function loadDesktopPopunder\(\)/);
  assert.match(main, /abscloud\.org\/1\/1082f6d1e3a685e366e87a1a8c047da9/);
  assert.match(main, /if \(window\.innerWidth < DESKTOP_AD_MIN_WIDTH\) return/);
  assert.match(css, /\.desktop-smartlink \{ display: none; \}/);
});

test("lazy-loads Native Banner only after the ad shell is visible", async () => {
  const main = await readFile(new URL("../../src/main.js", import.meta.url), "utf8");
  assert.match(main, /if \(!shell \|\| !container \|\| shell\.hidden\) return/);
  assert.match(main, /shell\.insertBefore\(script, container\)/);
  assert.match(main, /requestAnimationFrame\(ensureNativeBannerLoaded\)/);
  assert.doesNotMatch(main, /initAdBlockDetection\(\)/);
});

test("does not treat an unavailable or no-fill ad as an ad blocker", async () => {
  const main = await readFile(new URL("../../src/main.js", import.meta.url), "utf8");
  const errorHandler = main.slice(
    main.indexOf("script.onerror = () => {"),
    main.indexOf("shell.insertBefore(script, container)")
  );
  assert.match(errorHandler, /__umraniAdsterraStatus = "unavailable"/);
  assert.match(errorHandler, /window\.__umraniSocialBarStatus === "error"/);
  assert.match(errorHandler, /isAdBlockBaitHidden\(\)/);
  assert.match(errorHandler, /scheduleAdClose\(\)/);
  assert.match(main, /function isAdBlockBaitHidden\(\)/);
  assert.match(main, /style\.display === "none"/);
  assert.match(main, /bait\.offsetWidth === 0/);
});

test("keeps AI locked only when all independent ad-block signals agree", async () => {
  const main = await readFile(new URL("../../src/main.js", import.meta.url), "utf8");
  const errorHandler = main.slice(
    main.indexOf("script.onerror = () => {", main.indexOf("function ensureNativeBannerLoaded")),
    main.indexOf("shell.insertBefore(script, container)")
  );
  assert.match(errorHandler, /window\.__umraniSocialBarStatus === "error"/);
  assert.match(errorHandler, /isAdBlockBaitHidden\(\)/);
  assert.match(errorHandler, /if \(state\.adBlockDetected\)/);
  assert.match(errorHandler, /state\.adCloseAllowedAt = 0/);
});

test("composer supports text and code file attachments", async () => {
  const main = await readFile(new URL("../../src/main.js", import.meta.url), "utf8");
  assert.match(main, /MAX_UPLOAD_BYTES = 200 \* 1024/);
  assert.match(main, /MAX_UPLOAD_CHARS = 60000/);
  assert.match(main, /function handleFileSelection/);
  assert.match(main, /function attachmentForApi/);
  assert.match(main, /Images, PDF and DOCX are not supported/);
});

test("code blocks include language-aware downloads", async () => {
  const main = await readFile(new URL("../../src/main.js", import.meta.url), "utf8");
  assert.match(main, /className = "code-copy code-download"/);
  assert.match(main, /javascript: "js"/);
  assert.match(main, /python: "py"/);
  assert.ok(main.includes("new Blob([code]"));
  assert.ok(main.includes("link.download = fileInfo.filename"));
});

test("preserves multiline messages and the active ad shell during re-renders", async () => {
  const main = await readFile(new URL("../../src/main.js", import.meta.url), "utf8");
  assert.match(main, /const text = raw\.trim\(\)/);
  assert.doesNotMatch(main, /const text = singleLine\(raw\)/);
  assert.match(main, /const activeAdShell = state\.adBreakActive/);
  assert.match(main, /if \(activeAdShell\) msgsEl\.appendChild\(activeAdShell\)/);
});

test("finishes SSE streams immediately when the DONE sentinel arrives", async () => {
  const main = await readFile(new URL("../../src/main.js", import.meta.url), "utf8");
  assert.match(main, /let doneSignal = false/);
  assert.match(main, /if \(payload === "\[DONE\]"\)/);
  assert.match(main, /await reader\.cancel\(\)/);
  assert.match(main, /if \(!res\.ok\) \{\s*clearTimeout\(timeout\)/);
});