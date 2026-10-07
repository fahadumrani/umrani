import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=f=>readFile(new URL('../../'+f,import.meta.url),'utf8');
test('reference layout excludes marked Share/account/Greeting dropdown controls',async()=>{
 const h=await read('index.html');
 assert.match(h,/<body class="sidebar-expanded">/);
 assert.doesNotMatch(h,/Share<|account-menu|profile-dropdown|Greeting<|Sonnet/);
 assert.match(h,/<span class="topbar-title">Umrani AI<\/span>/);
 assert.match(h,/class="composer-footer"/);assert.match(h,/placeholder="Write a message…"/);
});
test('reference keeps existing real composer controls and safe reply actions',async()=>{
 const h=await read('index.html'); const m=await read('src/main.js'); const a=await read('src/ui/reply-actions.js');
 for(const id of ['messageInput','attachBtn','micBtn','sendBtn','stopBtn','deepThinkToggle','composerModelLabel'])assert.equal((h.match(new RegExp(`id="${id}"`,'g'))||[]).length,1);
 assert.match(m,/createReplyActions\(\{/);assert.match(a,/saved on this device/);assert.match(a,/SpeechSynthesisUtterance/);
 assert.doesNotMatch(a,/fetch\(|XMLHttpRequest|innerHTML = text/);
});
test('regeneration retains the original on failure and never duplicates the user turn',async()=>{
 const m=await read('src/main.js');
 assert.match(m,/if \(!regenerate\) chat.messages.push\(userMsg\)/);
 assert.match(m,/chat.messages = regenerationOriginal/);
 assert.match(m,/const recent = regenerate \? chat.messages.slice\(0, -1\)/);
 assert.match(m,/Send or clear your draft\/attachment before regenerating/);
});
