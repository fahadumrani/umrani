import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const qaDir = process.env.QA_OUTPUT_DIR || fileURLToPath(new URL('../.qa/', import.meta.url));
await mkdir(qaDir, { recursive: true });
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
const page=await browser.newPage({viewport:{width:1280,height:900}});
let modelCalls=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('https://**/*',async route=>{
 const url=route.request().url();
 if(url.includes('cdn.jsdelivr.net') && /\.(js|css)$/.test(url)) {
  const name=url.includes('dompurify')?'purify.min.js':url.split('/').at(-1);
  const body=process.env.QA_ASSET_DIR?await readFile(`${process.env.QA_ASSET_DIR}/${name}`):Buffer.from(await(await fetch(url)).arrayBuffer());
  return route.fulfill({body,contentType:name.endsWith('.css')?'text/css':'text/javascript',headers:{'Access-Control-Allow-Origin':'*'}});
 }
 if(url.includes('inference.dahl.global')) {
  const request=route.request().postDataJSON();if(request.stream)modelCalls++;
  const content=request.stream?'Wikipedia lookup evidence is limited to encyclopedia articles.':'OK';
  return route.fulfill({json:{choices:[{message:{content}}]}});
 }
 if(url.includes('wikipedia.org/w/api.php'))return route.fulfill({json:{query:{pages:[{title:'Pakistan',extract:'Public encyclopedia evidence.',index:1}]}},headers:{'Access-Control-Allow-Origin':'*'}});
 if(url.includes('open.er-api.com'))return route.fulfill({json:{result:'success',base_code:'USD',rates:{PKR:280},time_last_update_unix:Math.floor(Date.now()/1000)},headers:{'Access-Control-Allow-Origin':'*'}});
 return route.abort();
});
try {
 await page.goto(new URL('../index.html',import.meta.url).href);
 await page.waitForFunction(()=>document.getElementById('modelLoadingOverlay').hidden);
 assert.ok(await page.evaluate(()=>getComputedStyle(document.querySelector('.main')).display==='flex' && document.querySelector('.main').getBoundingClientRect().width>700 && document.querySelector('.main').getBoundingClientRect().right<=innerWidth));
 assert.ok(await page.evaluate(()=>document.querySelector('.composer-zone').contains(document.getElementById('deepThinkToggle'))));
 console.log('PASS: file-open mode preserves full-width layout and composer controls');
 async function ask(text,expected) {
  await page.locator('#messageInput').fill(text);await page.locator('#sendBtn').click();
  await page.waitForFunction(expected=>[...document.querySelectorAll('.msg.ai .bubble')].at(-1)?.textContent.includes(expected) && document.getElementById('stopBtn').hidden,expected);
 }
 await ask('what is today date','Based on your device clock');assert.equal(modelCalls,0);
 await ask("what is today's pkr to dollor rate",'280.00 PKR');assert.equal(modelCalls,0);
 console.log('PASS: file mode answers date and timestamped currency without a model refusal');
 await ask('parabola ka graph banao','assuming');await page.waitForSelector('.function-plot .plot-curve');assert.equal(modelCalls,0);
 console.log('PASS: file mode plots an actual quadratic curve');
 await ask('latest Pakistan news','Wikipedia lookup evidence');assert.equal(modelCalls,1);
 assert.equal(await page.locator('.lookup-scope').count(),0);
 console.log('PASS: public encyclopedia lookup works without a server and discloses its scope');
 if (await page.locator('#adsterraCloseButton').isVisible()) await page.locator('#adsterraCloseButton').click();
 await page.waitForTimeout(1000);
 assert.ok(await page.locator('.msg.ai').last().evaluate(element=>Number(getComputedStyle(element).opacity)>.99));
 await page.screenshot({path:join(qaDir, 'ui-file-mode.png')});assert.deepEqual(errors,[]);
} finally {await browser.close();}
