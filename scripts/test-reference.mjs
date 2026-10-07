// Mock-only QA for the reference layout and real reply tools.
import {chromium} from 'playwright';
import {openStaticSite} from './static-qa.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=process.env.QA_OUTPUT_DIR||new URL('../.qa/reference/',import.meta.url).pathname;
await mkdir(out,{recursive:true});const site=await openStaticSite();
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined});
const context=await browser.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce'});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
let modelCalls=0;
await context.route('https://**/*',async route=>{
 const url=route.request().url();
 if(url.includes('cdn.jsdelivr.net') && /\.(js|css)$/.test(url)) {
 const name=url.includes('dompurify')?'purify.min.js':url.split('/').at(-1);
 const body=process.env.QA_ASSET_DIR?await readFile(`${process.env.QA_ASSET_DIR}/${name}`):Buffer.from(await(await fetch(url)).arrayBuffer());
 return route.fulfill({body,contentType:name.endsWith('.css')?'text/css':'text/javascript',headers:{'Access-Control-Allow-Origin':'*'}});
 }
 if(url.includes('inference.dahl.global')){const payload=route.request().postDataJSON();if(payload.stream)modelCalls++;return route.fulfill({json:{choices:[{message:{content:payload.stream?'A fresh reply.':'OK'}}]}})}
 if(url.includes('wikipedia.org'))return route.fulfill({json:{query:{pages:[]}}});
 return route.abort();
});
await context.route('**/dist/app.bundle.js*',async route=>{
 const src=await readFile(new URL('../dist/app.bundle.js',import.meta.url),'utf8');
 return route.fulfill({body:src.replace(/\}\)\(\);\s*$/,'window.__qa={state,getChat,renderActiveChat,renderChatList,createChat,sendMessage,stopStreaming};\n})();'),contentType:'text/javascript'});
});
try{
 await page.goto(site.base);
 await page.waitForFunction(()=>window.__qa?.state.modelsTested && document.querySelector('#sidebar').getAttribute('aria-hidden')==='false');
 assert.ok(await page.evaluate(()=>document.body.classList.contains('sidebar-expanded')));
 assert.ok(await page.locator('#overlay').isHidden());
 assert.ok((await page.locator('.main').boundingBox()).x>250);
 await page.locator('#newChatBtn').click();
 assert.ok(await page.evaluate(()=>document.body.classList.contains('sidebar-expanded')),'new chat does not collapse the desktop sidebar');
 await page.locator('#messageInput').fill('what is today date');await page.locator('#sendBtn').click();
 await page.waitForFunction(()=>!window.__qa.state.isStreaming && document.querySelector('.msg.ai .bubble')?.textContent.includes('Based on your device clock'));
 await page.evaluate(()=>{
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copied=text}}});
  Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{speak:u=>{window.__spoken=u.text},cancel:()=>{window.__cancelled=(window.__cancelled||0)+1}}});
 });
 assert.equal(await page.locator('.reply-actions button').count(),5);
 await page.locator('.reply-actions [data-action="copy"]').click();
 assert.ok((await page.evaluate(()=>window.__copied)).includes('Based on your device clock'));
 await page.locator('.reply-actions [data-action="volume"]').click();
 assert.ok((await page.evaluate(()=>window.__spoken)).includes('Based on your device clock'));
 await page.locator('.reply-actions [data-action="volume"]').click();
 assert.ok(await page.evaluate(()=>window.__cancelled>=2));
 console.log('PASS: reply copy/read-aloud are functional and user-initiated');
 await page.locator('.reply-actions [data-action="thumbUp"]').click();
 await page.waitForFunction(()=>window.__qa.getChat(window.__qa.state.currentChatId).messages.at(-1).feedback===1);
 const rating=await page.evaluate(()=>new Promise(resolve=>{
  const qa=window.__qa,chat=qa.getChat(qa.state.currentChatId);const req=qa.state.db.transaction('messages').objectStore('messages').get([chat.id,1]);req.onsuccess=()=>resolve(req.result.message.feedback);
 }));assert.equal(rating,1);
 await page.locator('.reply-actions [data-action="thumbDown"]').click();
 assert.equal(await page.locator('.reply-actions [data-action="thumbUp"]').getAttribute('aria-pressed'),'false');
 assert.equal(await page.locator('.reply-actions [data-action="thumbDown"]').getAttribute('aria-pressed'),'true');
 console.log('PASS: helpful/unhelpful feedback is mutually exclusive and stored only in local history');
 await page.locator('#messageInput').fill('a draft');await page.locator('.reply-actions [data-action="regenerate"]').click();
 assert.equal(await page.locator('#messageInput').inputValue(),'a draft');assert.equal(modelCalls,0);
 await page.locator('#messageInput').fill('');
 await page.evaluate(()=>{const qa=window.__qa;window.__oldReply=qa.getChat(qa.state.currentChatId).messages.at(-1)});
 await page.locator('.reply-actions [data-action="regenerate"]').click();
 await page.waitForFunction(()=>!window.__qa.state.isStreaming && window.__qa.getChat(window.__qa.state.currentChatId).messages.at(-1)!==window.__oldReply);
 assert.deepEqual(await page.evaluate(()=>window.__qa.getChat(window.__qa.state.currentChatId).messages.map(m=>m.role)),['user','assistant']);
 assert.equal(modelCalls,0);
 console.log('PASS: regeneration replaces only the latest reply without duplicating user history or consuming a draft');
 await page.evaluate(async()=>{const qa=window.__qa,chat=qa.getChat(qa.state.currentChatId);chat.messages[0].content='x'.repeat(600000);window.__oldReply=chat.messages.at(-1);await qa.sendMessage({regenerate:true,target:window.__oldReply})});
 assert.ok(await page.evaluate(()=>window.__qa.getChat(window.__qa.state.currentChatId).messages.at(-1)===window.__oldReply));
 assert.equal(modelCalls,0);
 console.log('PASS: failed regeneration preserves the original answer and history');
 const cancelled=await page.evaluate(async()=>{
  const qa=window.__qa,chat=qa.getChat(qa.state.currentChatId),old=chat.messages.at(-1),original=window.fetch;
  chat.messages[0].content='Tell me about a comet';
  window.fetch=async(url,opts={})=>{
   if(String(url).includes('wikipedia.org'))return new Response(JSON.stringify({query:{pages:[]}}),{headers:{'content-type':'application/json'}});
   return new Promise((resolve,reject)=>{if(opts.signal?.aborted)reject(new DOMException('Aborted','AbortError'));else opts.signal?.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true})});
  };
  const timer=setTimeout(()=>qa.stopStreaming(),60);
  try {await qa.sendMessage({regenerate:true,target:old});return {retained:chat.messages.at(-1)===old,roles:chat.messages.map(m=>m.role),streaming:qa.state.isStreaming};}
  finally{clearTimeout(timer);window.fetch=original;}
 });
 assert.deepEqual(cancelled,{retained:true,roles:['user','assistant'],streaming:false});
 console.log('PASS: Stop during regeneration restores the previous answer and releases the request lock');
 await page.evaluate(()=>{
  const q=window.__qa;
  const demo={id:'demo',title:'Welcome',messages:[{role:'user',content:'hi',timestamp:1},{role:'assistant',content:'Hi! How can I help you today?',timestamp:2}],createdAt:1,updatedAt:2};
  q.state.chats=[demo,...['Quadratic graphs','Writing help','Project ideas','Getting started'].map((title,i)=>({id:'demo'+i,title,messages:[],createdAt:1,updatedAt:1}))];
  q.state.currentChatId=demo.id;q.renderChatList();q.renderActiveChat();document.querySelector('#toast').hidden=true;
 });
 const css=await readFile(new URL('../styles/main.css',import.meta.url),'utf8');
 async function capture(name){
  await page.screenshot({path:`${out}/${name}.png`});
  const html=await page.evaluate(style=>{const root=document.documentElement.cloneNode(true);root.querySelectorAll('script,link,meta[http-equiv],iframe').forEach(e=>e.remove());const s=document.createElement('style');s.textContent=style;root.querySelector('head').append(s);return '<!DOCTYPE html>'+root.outerHTML},css);
  assert.ok(!html.includes('Bearer ')&&!html.includes('API_PROVIDERS'));await writeFile(`${out}/${name}.html`,html);
 }
 await capture('desktop-expanded');await page.locator('#sidebarClose').click();assert.equal(await page.evaluate(()=>document.activeElement.id),'menuBtn');await capture('desktop-collapsed');
 await page.setViewportSize({width:390,height:844});await capture('mobile');
 await page.locator('#menuBtn').click();await page.waitForFunction(()=>document.querySelector('#sidebar').getBoundingClientRect().left===0);await capture('mobile-drawer');
 await page.locator('#sidebarClose').click();await page.setViewportSize({width:1280,height:800});
 await page.locator('#menuBtn').click();await page.evaluate(()=>{document.documentElement.dataset.mode='dark'});await capture('dark-desktop');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 console.log('PASS: persistent/collapsed desktop, mobile drawer and dark layouts; no overflow or uncaught errors');
}finally{await browser.close();await site.close();}
