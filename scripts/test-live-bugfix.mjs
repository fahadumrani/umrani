// Offline regression tests for the live QA findings. Never uses live AI or ads.
import {chromium} from 'playwright';
import {readFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {openStaticSite} from './static-qa.mjs';
const site=await openStaticSite();
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined});
const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const out=process.env.QA_OUTPUT_DIR||fileURLToPath(new URL('../.qa/live-bugs/',import.meta.url));await mkdir(out,{recursive:true});
let adMode='ready',aiCalls=0,rateCalls=0,wikiCalls=0,lastWiki='';
await context.route('https://**/*',async route=>{
 const url=route.request().url();
 if(url.includes('cdn.jsdelivr.net')&&/\.(js|css)$/.test(url)){
  const name=url.includes('dompurify')?'purify.min.js':url.split('/').at(-1);
  return route.fulfill({body:process.env.QA_ASSET_DIR?await readFile(`${process.env.QA_ASSET_DIR}/${name}`):Buffer.from(await(await fetch(url)).arrayBuffer()),contentType:name.endsWith('.css')?'text/css':'text/javascript',headers:{'Access-Control-Allow-Origin':'*'}});
 }
 if(url.includes('inference.dahl.global')){
  const body=route.request().postDataJSON();if(!body.stream)return route.fulfill({json:{choices:[{message:{content:'OK'}}]}});
  aiCalls++;return route.fulfill({json:{choices:[{message:{content:'[Example](https://example.com) [Wikipedia](https://en.wikipedia.org/wiki/Function_(mathematics)) **Bold** `x^2`'}}]}});
 }
 if(url.includes('wikipedia.org/w/api.php')){
  wikiCalls++;lastWiki=new URL(url).searchParams.get('gsrsearch');
  return route.fulfill({json:{query:{pages:[{title:'Pakistan',extract:'A bounded retrieved reference excerpt.',index:1}]}},headers:{'Access-Control-Allow-Origin':'*'}});
 }
 if(url.includes('open.er-api.com')){
  rateCalls++;return route.fulfill({json:{result:'success',base_code:'USD',rates:{PKR:280},time_last_update_unix:Math.floor(Date.now()/1000)},headers:{'Access-Control-Allow-Origin':'*'}});
 }
 if(url.includes('bauval.org')){
  if(adMode==='error')return route.abort();
  const body=adMode==='ready'?`const a=document.createElement('a');a.href='https://example.com';a.textContent='Mock advertisement creative — offline QA';a.style.cssText='display:block;padding:24px;font-size:16px';document.querySelector('[id^="container-"]').appendChild(a);`:'';
  return route.fulfill({body,contentType:'text/javascript'});
 }
 return route.abort();
});
await context.route('**/dist/app.bundle.js*',async route=>{
 const source=await readFile(new URL('../dist/app.bundle.js',import.meta.url),'utf8');
 return route.fulfill({body:source.replace(/\}\)\(\);\s*$/,'window.__qa={state,renderInlineBlocks,showAdBreak,createChat,sendMessage};\n})();'),contentType:'text/javascript'});
});
async function send(text){await page.locator('#messageInput').fill(text);await page.locator('#sendBtn').click();await page.waitForFunction(()=>!window.__qa.state.isStreaming);}
try {
 await page.goto(site.base);await page.waitForFunction(()=>window.__qa?.state.modelsTested&&window.__qa.state.dbReady);
 await send('plot y=x^2 / 2');
 assert.equal(await page.locator('.function-plot figcaption').last().textContent(),'y = 0.5x²');
 await page.locator('#chatArea').evaluate(el=>el.scrollTop=0);await page.screenshot({path:out+'/fixed-division-graph.png'});
 await send('plot y=x^2 from 0 to 0.01');
 const ticks=await page.locator('.function-plot').last().locator('.plot-tick').allTextContents();
 assert.equal(new Set(ticks.slice(0,6)).size,6);assert.equal(ticks[5],'0.01');
 console.log('PASS: fractional equation renders the correct graph and small-range tick labels stay distinct');
 await send('plot y=x^2 / sin(x)');assert.match(await page.locator('.msg.ai .bubble').last().innerText(),/could not safely parse/);assert.equal(aiCalls,0);
 console.log('PASS: unsupported graph expressions do not silently plot a different equation');
 await send('What was the PKR to dollar exchange rate in 2020?');
 assert.match(await page.locator('.msg.ai .bubble').last().innerText(),/historical/);assert.equal(rateCalls,0);assert.equal(aiCalls,0);
 await send('pkr dollar rate next year');assert.match(await page.locator('.msg.ai .bubble').last().innerText(),/prediction/);assert.equal(rateCalls,0);
 await send("what is today's pkr to dollor rate");assert.equal(rateCalls,1);assert.match(await page.locator('.msg.ai .bubble').last().innerText(),/280.00 PKR/);
 console.log('PASS: historical/future intents never fetch the current rate; current feed still works');
 await send('Search Wikipedia for Pakistan and give a brief summary with a source.');
 assert.equal(lastWiki,'Pakistan');assert.equal(aiCalls,0);assert.ok(wikiCalls>0);assert.match(await page.locator('.msg.ai .bubble').last().innerText(),/bounded retrieved reference excerpt/);
 console.log('PASS: explicit Wikipedia request returns retrieved evidence without a model browsing refusal');
 await send('Return a Markdown example link.');
 const reply=page.locator('.msg.ai .bubble').last();assert.equal(await reply.locator('a').first().innerText(),'Example');assert.equal(await reply.locator('a').nth(1).getAttribute('href'),'https://en.wikipedia.org/wiki/Function_(mathematics)');assert.equal(await reply.locator('strong').innerText(),'Bold');assert.equal(await reply.locator('code.inline').innerText(),'x^2');
 const unsafe=await page.evaluate(()=>{const el=window.__qa.renderInlineBlocks('[Bad](javascript:alert(1)) <img src=x onerror=alert(1)> `[Code](https://example.com)`');return {bad:el.querySelectorAll('a,img,script').length,code:el.querySelector('code').textContent};});assert.equal(unsafe.bad,0);assert.equal(unsafe.code,'[Code](https://example.com)');
 const adjacent=await page.evaluate(()=>{const el=window.__qa.renderInlineBlocks('[A](https://a.example)[B](https://b.example)');return [...el.querySelectorAll('a')].map(a=>a.textContent);});assert.deepEqual(adjacent,['A','B']);
 console.log('PASS: labelled/parenthesized/adjacent Markdown links render safely; code and unsafe protocols stay inert');
 await page.waitForFunction(()=>document.querySelector('#adsterraAdShell').dataset.adStatus==='ready');
 assert.equal(await page.locator('#adDeliveryStatus').isVisible(),false);
 assert.equal(await page.locator('#umraniNativeBannerScript').count(),1);
 assert.equal(await page.locator('iframe.ad-frame').count(),0);
 await page.locator('#adsterraCloseButton').click();
 await page.evaluate(()=>window.__qa.showAdBreak());
 assert.equal(await page.locator('#adsterraAdShell').isVisible(),true);
 assert.equal(await page.locator('#umraniNativeBannerScript').count(),1);
 console.log('PASS: direct ad creative renders and survives close/reopen without duplicate scripts');
 for(const width of [390,768]){
  await page.setViewportSize({width,height:844});await page.locator('#menuBtn').click();await page.waitForFunction(()=>document.querySelector('#sidebar').getAttribute('aria-modal')==='true');
  await page.locator('#sidebarClose').focus();await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(()=>document.querySelector('#sidebar').contains(document.activeElement)),true);
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'sidebarClose');
  assert.equal(await page.evaluate(()=>document.querySelector('.main').inert),true);
  await page.screenshot({path:out+`/fixed-drawer-${width}.png`});
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'menuBtn');assert.equal(await page.evaluate(()=>document.querySelector('.main').inert),false);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 console.log('PASS: modal drawer traps focus, inerts the background, restores focus and has no overflow at 390/768px');
 await page.setViewportSize({width:1280,height:720});assert.equal(await page.locator('#sidebar').getAttribute('aria-modal'),null);await page.locator('#sidebarClose').click();assert.equal(await page.locator('#sidebar').getAttribute('aria-hidden'),'true');await page.locator('#menuBtn').click();assert.equal(await page.locator('#sidebar').getAttribute('aria-hidden'),'false');
 assert.deepEqual(errors,[]);console.log('PASS: desktop sidebar behavior remains intact; no uncaught browser errors');
}finally {await browser.close();await site.close();}
