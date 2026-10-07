import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const load=(file)=>readFile(new URL('../../'+file,import.meta.url),'utf8');
test('editorial tokens include exact light/dark surfaces and safe font fallbacks',async()=>{
 const v=await load('styles/variables.css');
 for(const value of ['#FCFCFB','#F9F9F7','#0B0B0B','#D97757','#151515','#20201F','#F0EFEC']) assert.ok(v.includes(value));
 for(const selector of ['[data-mode="dark"]','[data-theme="dark"]','.dark']) assert.ok(v.includes(selector));
 assert.match(v,/--font-main: anthropic-sans, system-ui/);assert.match(v,/--font-display: anthropic-serif, Georgia/);
 assert.ok(!v.includes('@import'));
});
test('legacy chromatic palette is restricted to brand-only tokens',async()=>{
 const v=await load('styles/variables.css');const c=await load('styles/main.css');
 assert.match(v,/--brand-purple: #7C3AED/);assert.match(v,/--brand-teal: #14B8A6/);
 assert.doesNotMatch(c,/#6D28D9|#22C55E|#EC4899|#F0FDF4|#172033|#475569|#7C8798/i);
 for(const selector of ['.brand-mark','.msg.ai .avatar','.model-loading-logo']) {
  const block=c.slice(c.indexOf(selector+' {')).split('}')[0];
  assert.ok(block.includes('linear-gradient(135deg, var(--brand-purple), var(--brand-teal))'));
 }
 assert.match(c,/\.empty-logo \{[\s\S]*?color: var\(--brand-purple\);[\s\S]*?background: var\(--brand-soft\)/);
});
test('generated CSS tokens stay synchronized and functional visibility rules remain',async()=>{
 const v=await load('styles/variables.css');const c=await load('styles/main.css');
 assert.ok(c.includes(v));assert.match(c,/\[hidden\] \{ display: none !important; \}/);
 assert.match(c,/prefers-reduced-motion/);assert.match(c,/\.composer:focus-within \{ border-color: var\(--accent\); \}/);
});

test('light theme remains the default even on dark-preferring devices',async()=>{
 const v=await load('styles/variables.css');
 assert.match(v,/:root \{\s*color-scheme: light;/);
 assert.doesNotMatch(v,/prefers-color-scheme/);
 const h=await load('index.html');
 assert.match(h,/<span class="topbar-title">Umrani AI<\/span>/);
 const c=await load('styles/main.css');
 assert.doesNotMatch(c,/\.brand-ai \{/);
});
