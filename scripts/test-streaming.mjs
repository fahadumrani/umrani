// Mocked stream-continuity regressions. Never calls production AI/ads.
import {chromium} from 'playwright';
import {openStaticSite} from './static-qa.mjs';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const site=await openStaticSite();const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined});
const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await context.route('https://**/*',async r=>{
 const url=r.request().url();
 if(url.includes('inference.dahl.global'))return r.fulfill({json:{choices:[{message:{content:'OK'}}]}});
 if(url.includes('cdn.jsdelivr.net')&&/\.(js|css)$/.test(url)){
 const name=url.includes('dompurify')?'purify.min.js':url.split('/').at(-1);const body=process.env.QA_ASSET_DIR?await readFile(`${process.env.QA_ASSET_DIR}/${name}`):Buffer.from(await(await fetch(url)).arrayBuffer());return r.fulfill({body,contentType:name.endsWith('.css')?'text/css':'text/javascript',headers:{'Access-Control-Allow-Origin':'*'}});
 }
 return r.abort();
});
await context.route('**/dist/app.bundle.js*',async r=>{
 const s=await readFile(new URL('../dist/app.bundle.js',import.meta.url),'utf8');
 return r.fulfill({body:s.replace(/\}\)\(\);\s*$/,'window.__qa={state,getChat,createChat,sendMessage,openChat,beginStreamRender,endStreamRender,streamingTick,updateStreamBubble,streamWithProvider,streamCompletion,stopStreaming};\n})();'),contentType:'text/javascript'});
});
try{
 await page.goto(site.base);await page.waitForFunction(()=>window.__qa?.state.dbReady&&window.__qa.state.modelsTested);
 const continuity=await page.evaluate(async()=>{
  const q=window.__qa,chat=await q.createChat(),old=window.fetch; q.beginStreamRender(chat.id);
  const emit=x=>new TextEncoder().encode('data: '+JSON.stringify(x)+'\n\n');let pipe;
  window.fetch=async()=>new Response(new ReadableStream({start(c){pipe=c}}),{headers:{'content-type':'text/event-stream'}});
  const task=q.streamWithProvider([],{url:'test-only'},'mock',1000);
  pipe.enqueue(emit({choices:[{delta:{content:'A visible opening sentence.'}}]}));await new Promise(r=>setTimeout(r,100));
  const before=document.querySelector('#streamMsg .bubble')?.textContent;
  pipe.enqueue(emit({choices:[{delta:{reasoning_content:'PRIVATE REASONING'}}]}));await new Promise(r=>setTimeout(r,90));
  const during=document.querySelector('#streamMsg .bubble')?.textContent,status=document.querySelector('#streamStatus').textContent;
  pipe.enqueue(emit({choices:[{delta:{content:' Here is the rest.'}}]}));await new Promise(r=>setTimeout(r,100));
  const after=document.querySelector('#streamMsg .bubble')?.textContent;
  pipe.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));pipe.close();await task;q.endStreamRender();window.fetch=old;
  return {before,during,status,after};
 });
 assert.equal(continuity.before,'A visible opening sentence.');assert.equal(continuity.during,continuity.before);assert.ok(continuity.status.includes('Generating'));assert.equal(continuity.after,'A visible opening sentence. Here is the rest.');
 console.log('PASS: answer text survives late reasoning events; status never moves back to Thinking');
 const empty=await page.evaluate(async()=>{
 const q=window.__qa,chat=q.getChat(q.state.currentChatId);q.beginStreamRender(chat.id);q.streamingTick('Keep this answer visible.');await new Promise(r=>setTimeout(r,80));q.streamingTick('',true);await new Promise(r=>setTimeout(r,80));const text=document.querySelector('#streamMsg .bubble').textContent;q.endStreamRender();return text;
 });assert.equal(empty,'Keep this answer visible.');console.log('PASS: empty/reasoning-only updates never blank an existing answer');
 const retry=await page.evaluate(async()=>{
 const q=window.__qa,old=window.fetch,chat=q.getChat(q.state.currentChatId);q.beginStreamRender(chat.id);let attempts=0,flash=false;
 q.state.requestDeadline=performance.now()+2000;q.state.stopRequested=false;
 window.fetch=async()=>{attempts++;if(attempts===1)return new Response('data: '+JSON.stringify({choices:[{delta:{content:'This model is at concurrency capacity.'}}]})+'\n\n',{headers:{'content-type':'text/event-stream'}});flash=!!document.querySelector('#streamMsg');return new Response('{"choices":[{"message":{"content":"The fallback answer."}}]}',{headers:{'content-type':'application/json'}})};
 try{return {res:await q.streamCompletion([]),attempts,flash}}finally{q.endStreamRender();window.fetch=old;q.state.controller=null;}
 });assert.equal(retry.attempts,2);assert.equal(retry.flash,false);assert.equal(retry.res.content,'The fallback answer.');console.log('PASS: pre-answer fallback still works and capacity notices never flash as answer text');
 const partial=await page.evaluate(async()=>{
 const q=window.__qa,old=window.fetch,chat=q.getChat(q.state.currentChatId);q.beginStreamRender(chat.id);let attempts=0;const opening='This useful opening should not disappear.';
 q.state.requestDeadline=performance.now()+2000;q.state.stopRequested=false;
 window.fetch=async()=>{attempts++;return new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('data: '+JSON.stringify({choices:[{delta:{content:opening}}]})+'\n\n'));setTimeout(()=>c.error(new Error('Test connection failure')),120)}}),{headers:{'content-type':'text/event-stream'}})};
 try{const res=await q.streamCompletion([]);return {res,attempts,visible:document.querySelector('#streamMsg .bubble')?.textContent};}finally{q.endStreamRender();window.fetch=old;q.state.controller=null;}
 });assert.equal(partial.attempts,1);assert.equal(partial.res.incomplete,true);assert.equal(partial.visible,partial.res.content);console.log('PASS: network failure after answer text preserves the partial reply instead of erasing/restarting it');
 const saved=await page.evaluate(async()=>{
 const q=window.__qa,old=window.fetch;await q.createChat();
 window.fetch=async(url)=>String(url).includes('wikipedia.org')?new Response('{"query":{"pages":[]}}'):new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Preserved partial reply."}}]}\n\n'));setTimeout(()=>c.error(new Error('Test broken stream')),100)}}),{headers:{'content-type':'text/event-stream'}});
 try{document.querySelector('#messageInput').value='Tell me about a comet';await q.sendMessage();const chat=q.getChat(q.state.currentChatId);return {msg:chat.messages.at(-1),notice:document.querySelector('.reply-notice')?.textContent,animation:getComputedStyle(document.querySelector('.msg.ai')).animationName,adHidden:document.querySelector('#adsterraAdShell').hidden}}finally{window.fetch=old}
 });assert.equal(saved.msg.content,'Preserved partial reply.');assert.equal(saved.msg.incomplete,true);assert.ok(saved.notice.includes('interrupted'));assert.equal(saved.animation,'none');assert.equal(saved.adHidden,true);
 await page.reload();await page.waitForFunction(()=>window.__qa?.state.modelsTested&&document.querySelector('.reply-notice')?.textContent.includes('interrupted'));
 assert.equal(await page.locator('.msg.ai .bubble').textContent(),'Preserved partial reply.');console.log('PASS: interrupted marker and partial answer persist across reload; no final opacity-zero replay/ad');
 const regen=await page.evaluate(async()=>{
 const q=window.__qa,chat=q.getChat(q.state.currentChatId),original=chat.messages.at(-1),old=window.fetch;
 window.fetch=async(url)=>String(url).includes('wikipedia.org')?new Response('{"query":{"pages":[]}}'):new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Another unfinished attempt."}}]}\n\n'));setTimeout(()=>c.error(new Error('Broken regeneration')),100)}}),{headers:{'content-type':'text/event-stream'}});
 try{await q.sendMessage({regenerate:true,target:original});return chat.messages.at(-1)===original;}finally{window.fetch=old}
 });assert.equal(regen,true);console.log('PASS: failed partial regeneration keeps the original answer');
 const ownership=await page.evaluate(async()=>{
 const q=window.__qa,a=q.getChat(q.state.currentChatId),b={id:'other',title:'Other',messages:[]};q.state.chats.push(b);q.beginStreamRender(a.id);q.streamingTick('This belongs to the previous chat.');q.state.currentChatId=b.id;q.updateStreamBubble();await new Promise(r=>setTimeout(r,100));const wrong=!!document.querySelector('#streamMsg');q.endStreamRender();q.beginStreamRender(b.id);q.streamingTick('Old scheduled update');q.endStreamRender();q.beginStreamRender(b.id);q.streamingTick('Current request answer.');await new Promise(r=>setTimeout(r,100));const text=document.querySelector('#streamMsg .bubble')?.textContent;q.endStreamRender();return {wrong,text};
 });assert.equal(ownership.wrong,false);assert.equal(ownership.text,'Current request answer.');console.log('PASS: chat-owner and request-epoch guards prevent stale/wrong-chat painting');
 const flush=await page.evaluate(async()=>{const q=window.__qa;q.beginStreamRender(q.state.currentChatId);q.streamingTick('First');await new Promise(r=>setTimeout(r,35));q.streamingTick('First and last chunk');await new Promise(r=>setTimeout(r,150));const text=document.querySelector('#streamMsg .bubble')?.textContent;q.endStreamRender();return text;});assert.equal(flush,'First and last chunk');assert.deepEqual(errors,[]);console.log('PASS: throttled final chunk is painted even without another delta; no uncaught errors');
}finally{await browser.close();await site.close()}
