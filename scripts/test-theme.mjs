// Mock-only UI QA. Never sends credentials to real services.
import { chromium } from 'playwright';
import { openStaticSite } from './static-qa.mjs';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=process.env.QA_OUTPUT_DIR || new URL('../.qa/theme/',import.meta.url).pathname;
await mkdir(out,{recursive:true});
const css=await readFile(new URL('../styles/main.css',import.meta.url),'utf8');
const site=await openStaticSite();
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH || undefined});
let groups=0;
try {
for(const mode of ['light','dark']) for(const [width,height] of [[1920,900],[1280,720],[768,1024],[390,844],[320,740]]) {
 const context=await browser.newContext({viewport:{width,height},colorScheme:mode,reducedMotion:'reduce'});
 const errors=[]; const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await context.route('https://**/*',async route=>{
  const url=route.request().url();
  if(url.includes('inference.dahl.global')) return route.fulfill({json:{choices:[{message:{content:'OK'}}]},headers:{'Access-Control-Allow-Origin':'*'}});
  if(url.includes('cdn.jsdelivr.net') && /\.(js|css)$/.test(url)) {
   const name=url.includes('dompurify')?'purify.min.js':url.split('/').at(-1);
   const body=process.env.QA_ASSET_DIR?await readFile(`${process.env.QA_ASSET_DIR}/${name}`):Buffer.from(await(await fetch(url)).arrayBuffer());
   return route.fulfill({body,contentType:name.endsWith('.css')?'text/css':'text/javascript',headers:{'Access-Control-Allow-Origin':'*'}});
  }
  return route.abort();
 });
 await context.route('**/dist/app.bundle.js*',async route=>{
 const source=await readFile(new URL('../dist/app.bundle.js',import.meta.url),'utf8');
 return route.fulfill({body:source.replace(/\}\)\(\);\s*$/,'window.__qa={state,buildMessageEl,confirmDialog};\n})();'),contentType:'text/javascript'});
 });
 await page.goto(site.base);await page.waitForFunction(()=>window.__qa?.state.modelsTested);
 assert.equal((await page.locator('.topbar-title').textContent()).trim(),'Umrani AI');
 assert.ok(await page.locator(width>900?'.sidebar .brand-name':'.topbar-title').isVisible());
 assert.equal(await page.locator('#deepThinkToggle svg[data-icon="brain"]').count(),1);
 const expected=mode==='dark'?'rgb(21, 21, 21)':'rgb(252, 252, 251)';
 assert.equal(await page.locator('.main').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(252, 252, 251)','light default regardless of system preference');
 assert.equal(await page.locator('.topbar-title .brand-ai').count(),0);
 assert.equal(await page.locator('.topbar-title').evaluate(e=>getComputedStyle(e).fontSize),width<=640?'20px':Math.min(30,Math.max(24,width*.016))+'px');
 for(const attribute of ['data-mode','data-theme']) {
  await page.evaluate(a=>document.documentElement.setAttribute(a,'light'),attribute);
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.main')).backgroundColor==='rgb(252, 252, 251)');
  assert.equal(await page.locator('.main').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(252, 252, 251)');
  await page.evaluate(a=>document.documentElement.setAttribute(a,'dark'),attribute);
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.main')).backgroundColor==='rgb(21, 21, 21)');
  assert.equal(await page.locator('.main').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(21, 21, 21)',JSON.stringify({mode,width,attribute,html:await page.locator('html').evaluate(e=>({attrs:[...e.attributes].map(a=>[a.name,a.value]),token:getComputedStyle(e).getPropertyValue('--bg-main')}))}));
  await page.evaluate(a=>document.documentElement.removeAttribute(a),attribute);
 }
 await page.evaluate(()=>document.documentElement.classList.add('dark'));
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('.main')).backgroundColor==='rgb(21, 21, 21)');
 assert.equal(await page.locator('.main').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(21, 21, 21)');
 await page.evaluate(m=>{document.documentElement.classList.remove('dark');document.documentElement.dataset.mode=m},mode);
 await page.waitForFunction(c=>getComputedStyle(document.querySelector('.main')).backgroundColor===c,expected);
 const logos=await page.evaluate(()=>Object.fromEntries(['.brand-mark','.empty-logo','.model-loading-logo'].map(s=>{const e=document.querySelector(s),c=getComputedStyle(e);return[s,{w:c.width,h:c.height,color:c.color,bg:c.backgroundImage,fill:c.backgroundColor}]})));
 assert.equal(logos['.brand-mark'].w,'34px');assert.equal(logos['.empty-logo'].w,'64px');assert.equal(logos['.model-loading-logo'].w,'60px');
 assert.ok(logos['.brand-mark'].bg.includes('rgb(124, 58, 237)') && logos['.brand-mark'].bg.includes('rgb(20, 184, 166)'));
 assert.equal(logos['.empty-logo'].color,'rgb(124, 58, 237)');assert.equal(logos['.empty-logo'].fill,'rgba(124, 58, 237, 0.1)');
 await page.screenshot({path:`${out}/${mode}-${width}-empty.png`});
 const noOverflow=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no document horizontal overflow');
 await noOverflow();
 await page.locator('#messageInput').focus();
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('.composer')).borderTopColor==='rgb(217, 119, 87)');
 assert.equal(await page.locator('.composer').evaluate(e=>getComputedStyle(e).borderTopColor),'rgb(217, 119, 87)');
 await page.locator('#deepThinkToggle').click();assert.equal(await page.locator('#deepThinkToggle').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#deepThinkToggle svg[data-icon="brain"]').count(),1);
 await page.locator('#deepThinkToggle').click();assert.equal(await page.locator('#deepThinkToggle').getAttribute('aria-pressed'),'false');
 if(width>900) await page.locator('#sidebarClose').click();
 await page.locator('#menuBtn').click();await page.locator('.sidebar.open').waitFor();
 await page.waitForFunction(()=>Math.abs(document.querySelector('.sidebar').getBoundingClientRect().left)<1);
 assert.equal(await page.locator('.sidebar').evaluate(e=>getComputedStyle(e).backgroundColor),mode==='dark'?'rgb(11, 11, 11)':'rgb(249, 249, 247)');
 await noOverflow();await page.screenshot({path:`${out}/${mode}-${width}-sidebar.png`});await page.locator('#sidebarClose').click();
 await page.evaluate(()=>{
  document.querySelector('#emptyState').hidden=true;
  const feed=document.querySelector('#messages');feed.replaceChildren();
  for(const msg of [{role:'user',content:'Explain this JavaScript example.'},{role:'assistant',content:'## A simple starting point\nKeep the interface calm and readable.\n```javascript\nconst message = "Hello, Umrani";\nconsole.log(message);\n```\nRead more: https://example.com'}]) feed.append(window.__qa.buildMessageEl(msg));
 });
 // buildMessageEl uses role === user, otherwise AI. Use a short visible chat for delivered screenshots.
 await noOverflow();
 assert.equal(await page.locator('.code-copy svg[data-icon="copy"]').count(),1);assert.equal(await page.locator('.code-download svg[data-icon="download"]').count(),1);
 assert.equal(await page.locator('.code-block').evaluate(e=>getComputedStyle(e).backgroundColor),mode==='dark'?'rgb(32, 32, 31)':'rgb(249, 249, 247)');
 assert.equal(await page.locator('.msg.ai .bubble').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
 await page.evaluate(()=>document.querySelector('#messageInput').blur());
 await page.screenshot({path:`${out}/${mode}-${width}-chat.png`});
 if(width===1280) {
  const html=await page.evaluate(style=>{
   const clone=document.documentElement.cloneNode(true);clone.querySelectorAll('script,link,meta[http-equiv],iframe').forEach(e=>e.remove());
   const sheet=document.createElement('style');sheet.textContent=style;clone.querySelector('head').append(sheet);
   return '<!DOCTYPE html>'+clone.outerHTML;
  },css);
  assert.ok(!html.includes('Bearer ') && !html.includes('API_PROVIDERS'));
  await writeFile(`${out}/${mode}-preview.html`,html);
 }
 await page.evaluate(()=>{
 const feed=document.querySelector('#messages');feed.replaceChildren();
 feed.append(window.__qa.buildMessageEl({role:'user',content:'اردو میں جواب دیں',attachment:{name:'example.txt',size:500}}));
 feed.append(window.__qa.buildMessageEl({role:'assistant',content:'یہ ایک آزمائشی پیغام ہے۔\n```mermaid\nflowchart LR\nA[Question] --> B[Answer]\n```'}));
 const shell=document.querySelector('#adsterraAdShell');shell.hidden=false;shell.classList.add('inline-ad-mode');feed.append(shell);
 document.querySelector('#attachmentBar').hidden=false;document.querySelector('#attachmentName').textContent='example.txt';
 document.querySelector('#streamStatus').hidden=false;document.querySelector('#stopBtn').hidden=false;
 document.querySelector('#sendBtn').hidden=true;
 });
 await page.waitForSelector('.diagram-body svg');
 const bounds=await page.locator('.diagram-body svg').evaluate(e=>{const b=e.getBBox(),v=e.viewBox.baseVal;return {left:b.x>=v.x-1,top:b.y>=v.y-1,right:b.x+b.width<=v.x+v.width+1,bottom:b.y+b.height<=v.y+v.height+1}});
 assert.ok(Object.values(bounds).every(Boolean),'all diagram nodes fit inside the SVG viewBox');

 const diagramColors=await page.locator('.diagram-body .node rect').first().evaluate(e=>({fill:getComputedStyle(e).fill,stroke:getComputedStyle(e).stroke}));
 assert.equal(diagramColors.fill,mode==='dark'?'rgb(32, 32, 31)':'rgb(249, 249, 247)');
 assert.equal(await page.locator('.msg.user .bubble').getAttribute('dir'),'rtl');
 await noOverflow();await page.screenshot({path:`${out}/${mode}-${width}-states.png`});
 await page.evaluate(()=>{
 const d=document.querySelector('.diagram-body');d.replaceChildren();d.classList.add('diagram-error');d.textContent='Could not render diagram.';
 document.querySelector('#attachmentBar').hidden=true;document.querySelector('#streamStatus').hidden=true;
 document.querySelector('#stopBtn').hidden=true;document.querySelector('#sendBtn').hidden=false;
 window.__qa.confirmDialog('Delete this chat?');
 });
 assert.equal(await page.locator('.diagram-error').evaluate(e=>getComputedStyle(e).color),mode==='dark'?'rgb(244, 154, 137)':'rgb(181, 53, 40)');
 assert.equal(await page.locator('.confirm-card').evaluate(e=>getComputedStyle(e).backgroundColor),mode==='dark'?'rgb(32, 32, 31)':'rgb(255, 255, 255)');
 await page.screenshot({path:`${out}/${mode}-${width}-error-dialog.png`});await noOverflow();
 await page.locator('.confirm-actions button').first().click();
 await page.evaluate(()=>document.querySelector('#modelLoadingOverlay').hidden=false);
 await page.screenshot({path:`${out}/${mode}-${width}-loading.png`});await noOverflow();
 assert.deepEqual(errors,[]);
 console.log(`PASS: ${mode} ${width}x${height}: empty/chat/RTL/code/Mermaid/sidebar/ads/attachment/loading/error/focus/toggle; no overflow; brand colors/sizes preserved`);groups++;
 await context.close();
}
console.log(`PASS: ${groups} theme viewport groups; Light default under both OS preferences and all explicit dark selectors verified.`);
} finally {await browser.close();await site.close();}
