import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("HTML points to the modular Umrani entry point and favicon", async () => {
  const html = await readFile(new URL("../../index.html", import.meta.url), "utf8");
  assert.match(html, /styles\/main\.css/);
  assert.match(html, /type="module" src="src\/app\.js\?v=8"/);
  assert.match(html, /text-anchor='middle'%3EU%3C\/text/);
  assert.match(html, /https:\/\/fahadumrani\.devs\.li\//);
});