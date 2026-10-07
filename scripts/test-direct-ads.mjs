// Direct Native Banner lifecycle regressions. All ad/AI/data requests mocked.
import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {openStaticSite} from './static-qa.mjs';
const site=await openStaticSite(),browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined});
try{
 for(const mode of ['ready','slow','empty','error']){
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();let calls=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await context.route('https://**/*',async route=>{
   const url=route.request().url();
   if(url.includes('inference.dahl.global'))return route.fulfill({json:{choices:[{message:{content:'OK'}}]}});
   if(url.includes('wikipedia.org'))return route.fulfill({json:{query:{pages:[]}}});
   if(url.includes('cdn.jsdelivr.net')){const n=url.split('/').at(-1);return route.fulfill({body:process.env.QA_ASSET_DIR?await readFile(`${process.env.QA_ASSET_DIR}/${n}`):Buffer.from(await(await fetch(url)).arrayBuffer()),contentType:n.endsWith('.css')?'text/css':'text/javascript',headers:{'Access-Control-Allow-Origin':'*'}});}
   if(url.includes('bauval.org')){
    calls++;if(mode==='error')return route.abort();
    const paint=`const a=document.createElement('a');a.href='https://example.com';a.textContent='Offline mock native creative';a.style.cssText='display:block;padding:24px';document.querySelector('[id^="container-"]').appendChild(a);`;
    const body=mode==='ready'?paint:mode==='slow'?`setTimeout(()=>{${paint}},12000);`:'';
    return route.fulfill({body,contentType:'text/javascript'});
   }
   return route.abort();
  });
  await context.route('**/dist/app.bundle.js*',async route=>{
   const s=await readFile(new URL('../dist/app.bundle.js',import.meta.url),'utf8');return route.fulfill({body:s.replace(/\}\)\(\);\s*$/,'window.__qa={state,showAdBreak,renderActiveChat,createChat};\n})();'),contentType:'text/javascript'});
  });
  await page.goto(site.base);await page.waitForFunction(()=>window.__qa?.state.modelsTested&&window.__qa.state.dbReady);
  await page.evaluate(()=>window.__qa.createChat());await page.clock.install();
  await page.evaluate(()=>window.__qa.showAdBreak());
  await page.waitForFunction(()=>document.querySelector('#umraniNativeBannerScript')||document.querySelector('#adsterraAdShell').dataset.adStatus==='error');
  if(mode==='ready'){
   await page.waitForFunction(()=>document.querySelector('#adsterraAdShell').dataset.adStatus==='ready');
   const settings=await page.locator('#umraniNativeBannerScript').evaluate(s=>({async:s.async,cf:s.dataset.cfasync,url:s.src}));assert.equal(settings.async,true);assert.equal(settings.cf,'false');assert.equal(settings.url,'https://bauval.org/21/63ea484e1a293480518c8d527b5e81e3');
   await page.locator('#adsterraCloseButton').click();assert.equal(await page.locator('#adsterraAdShell').isVisible(),false);
   await page.evaluate(()=>{window.__qa.renderActiveChat();window.__qa.showAdBreak()});await page.waitForFunction(()=>!document.querySelector('#adsterraAdShell').hidden);
   assert.equal(await page.locator('#umraniNativeBannerScript').count(),1);assert.equal(calls,1);assert.ok(await page.locator('.native-ad-container a').count());
   await page.clock.fastForward(31000);assert.equal(await page.locator('#adsterraAdShell').getAttribute('data-ad-status'),'ready');
   assert.equal(await page.locator('iframe.ad-frame').count(),0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   console.log('PASS: official native tag renders once, survives close/rerender, and has no sandbox/overflow/early hiding');
  }else if(mode==='slow'){
   await page.clock.fastForward(9000);assert.equal(await page.locator('#adsterraAdShell').getAttribute('data-ad-status'),'loading');
   await page.clock.fastForward(5000);await page.waitForFunction(()=>document.querySelector('#adsterraAdShell').dataset.adStatus==='ready');assert.equal(calls,1);
   console.log('PASS: delayed creative is not killed by the old eight-second timeout');
  }else if(mode==='empty'){
   await page.clock.fastForward(31000);await page.waitForFunction(()=>document.querySelector('#adsterraAdShell').dataset.adStatus==='no-fill');assert.equal(await page.locator('#adsterraAdShell').isVisible(),false);
   await page.evaluate(()=>{const a=document.createElement('a');a.href='https://example.com';a.textContent='Late mock creative';a.style.cssText='display:block;padding:24px';document.querySelector('.native-ad-container').appendChild(a)});
   await page.waitForFunction(()=>document.querySelector('#adsterraAdShell').dataset.adStatus==='ready');assert.equal(await page.locator('#adsterraAdShell').isVisible(),true);assert.equal(calls,1);
   await page.locator('#adsterraCloseButton').click();await page.evaluate(()=>document.querySelector('.native-ad-container a').textContent='Updated late creative');await page.waitForTimeout(100);assert.equal(await page.locator('#adsterraAdShell').isVisible(),false);
   console.log('PASS: empty inventory hides cleanly; late content recovers without reloading or overriding user close');
  }else{
   await page.waitForFunction(()=>document.querySelector('#adsterraAdShell').dataset.adStatus==='error');assert.equal(await page.locator('#adsterraAdShell').isVisible(),false);assert.equal(await page.locator('#umraniNativeBannerScript').count(),0);
   console.log('PASS: blocked/script-error state hides gracefully without claiming ad delivery');
  }
  assert.deepEqual(errors,[]);await page.close();await context.close();
 }
}finally{await browser.close();await site.close()}
