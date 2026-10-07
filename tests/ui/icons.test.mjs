import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ICON_PATHS,iconSvg} from '../../src/ui/icons.js';
const read=(file)=>readFile(new URL('../../'+file,import.meta.url),'utf8');
test('every standalone icon matches the local runtime source',async()=>{
 for(const name of Object.keys(ICON_PATHS)) {
  const asset=await read(`assets/icons/${name}.svg`);
  assert.equal(asset.trim(),iconSvg(name,24).replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" '));
  assert.match(asset,/viewBox="0 0 24 24"/);
  assert.match(asset,/aria-hidden="true" focusable="false"/);
 }
});
test('icon generator rejects unknown identifiers, injected classes and invalid sizes',()=>{
 for(const name of ['unknown','__proto__','<script>']) assert.throws(()=>iconSvg(name));
 for(const size of [0,100,-1,'20',20.5]) assert.throws(()=>iconSvg('copy',size));
 assert.throws(()=>iconSvg('copy',20,'" onload="evil()'));
});
test('AI branding is present in header and sidebar without changing the app title',async()=>{
 const h=await read('index.html');const c=await read('styles/main.css');
 assert.match(h,/<span class="topbar-title">Umrani AI<\/span>/);
 assert.match(h,/<span class="brand-name">Umrani AI<\/span>/);
 assert.match(h,/<title>Umrani<\/title>/);
 assert.match(c,/@media \(max-width: 640px\) \{ \.topbar-title \{ display: inline-flex; \} \}/);
});
test('build synchronizes static, standalone and dynamic icons without remote dependencies',async()=>{
 const b=await read('scripts/build.mjs');const m=await read('src/main.js');const icons=await read('src/ui/icons.js');
 assert.ok(b.includes('import "./build-icons.mjs"'));
 assert.ok(m.includes('iconSvg("brand", 17)'));assert.ok(m.includes('setIconLabel(dom.deepThinkToggle'));
 assert.doesNotMatch(icons,/https?:\/\/|fetch\(|XMLHttpRequest|\.innerHTML\s*=\s*label/);
 const favicon=await read('assets/icons/umrani-mark.svg');assert.ok(favicon.includes('#7C3AED') && favicon.includes('#06B6D4'));
});
