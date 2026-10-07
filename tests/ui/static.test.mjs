import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { searchWeb } from '../../src/api/live.js';
const read=(path)=>readFile(new URL('../../'+path,import.meta.url),'utf8');
test('static bundle has no local API or server requirement',async()=>{
 const bundle=await read('dist/app.bundle.js');
 assert.doesNotMatch(bundle,/\/api\/search|localhost|127\.0\.0\.1|server\.mjs/);
 for(const name of ['server.mjs','start-local.bat','.env.example','CNAME'])await assert.rejects(access(new URL('../../'+name,import.meta.url)));
});
test('root and repository-subpath assets use relative URLs',async()=>{
 const html=await read('index.html');
 for(const attribute of html.matchAll(/(?:src|href)="([^"]+)"/g)){
  const url=attribute[1];if(/^https?:/.test(url))continue;
  assert.ok(!url.startsWith('/'),url);
 }
 assert.doesNotMatch(html,/class="lookup-scope"|Search: Wikipedia lookup/);
 assert.match(html,/id="messageInput" rows="1"/);
});
test('static ads do not execute third-party scripts on direct navigation',async()=>{
 const html=await read('ads.html'),loader=await read('vendor/ad-frame-loader.js');
 assert.doesNotMatch(html,/<script[^>]+src="https:\/\/bauval/);
 assert.match(loader,/window\.top === window\.self/);assert.match(loader,/window\.origin !== 'null'/);
 assert.ok(loader.indexOf("window.origin")<loader.indexOf('script.src'));
});
test('multilingual lookup evidence remains inside the context byte budget',async()=>{
 const result=await searchWeb('پاکستان',{fetchFn:async()=>new Response(JSON.stringify({query:{pages:Array.from({length:5},(_,i)=>({title:'پاکستان '+i,extract:'اردو '.repeat(300),index:i+1}))}}))});
 assert.equal(result.available,true);assert.ok(new TextEncoder().encode(result.context).length<=6500);
});
