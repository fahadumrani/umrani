import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../../'+p,import.meta.url),'utf8');
test('owner-approved direct tag matches the exact Native Banner embed',async()=>{
 const s=await read('src/main.js');assert.match(s,/script\.src='https:\/\/bauval\.org\/21\/63ea484e1a293480518c8d527b5e81e3'/);assert.match(s,/script\.setAttribute\('data-cfasync','false'\)/);assert.match(s,/script\.async=true/);assert.match(s,/if\(nativeAd.started\)/);
});
test('ad integration preserves container and avoids repeated script injection / short timeout',async()=>{
 const s=await read('src/main.js');const show=s.slice(s.indexOf('function showAdBreak()'),s.indexOf('function openDB()'));
 assert.doesNotMatch(show,/replaceChildren|textContent\s*=\s*["']{2}/);assert.match(s,/,30000\)/);assert.doesNotMatch(s,/new MessageEvent|currentAdDelivery|frame.src='ads/);
});
test('direct Native Banner has CSP permission without opening every script origin',async()=>{
 const html=await read('index.html');assert.match(html,/script-src[^;]*https:\/\/bauval\.org/);assert.match(html,/connect-src[^;]*https:\/\/bauval\.org/);assert.doesNotMatch(html,/script-src[^;]*https:;/);assert.match(html,/img-src[^;]*https:/);
});
