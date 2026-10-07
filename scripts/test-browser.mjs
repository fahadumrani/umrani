// Local-browser QA only. No live AI credentials or ad-network calls are used.
import { chromium } from 'playwright';
import { openStaticSite } from './static-qa.mjs';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const qaDir = process.env.QA_OUTPUT_DIR || fileURLToPath(new URL('../.qa/', import.meta.url));
await mkdir(qaDir, { recursive: true });
import assert from 'node:assert/strict';
const root = new URL('../', import.meta.url);
const site = await openStaticSite();
const base = site.base;
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
let requestCount = 0;
await context.route('https://**/*', async (route) => {
  const url = route.request().url();
  if (url.includes('cdn.jsdelivr.net') && /\.(?:js|css)$/.test(url)) {
    const name = url.includes("dompurify") ? "purify.min.js" : url.split('/').at(-1);
    const body = process.env.QA_ASSET_DIR ? await readFile(`${process.env.QA_ASSET_DIR}/${name}`) : Buffer.from(await (await fetch(url)).arrayBuffer());
    return route.fulfill({ body, contentType: name.endsWith('.css') ? 'text/css' : 'text/javascript', headers: { 'Access-Control-Allow-Origin': '*' } });
  }
  if (url.includes('duckduckgo')) return route.fulfill({ json: { RelatedTopics: [] } });
  if (url.includes('wikipedia.org/w/api.php')) return route.fulfill({ json: { query: { pages: [{ title: 'Test source', extract: 'Mock search evidence', index: 1 }] } }, headers: { 'Access-Control-Allow-Origin': '*' } });
  return route.abort(); // Do not contact ads / external font servers during QA.
});
await context.route('**/dist/app.bundle.js*', async (route) => {
  const source = await readFile(new URL('../dist/app.bundle.js', import.meta.url), 'utf8');
  // Expose internals only in the intercepted TEST response, never in dist/.
  const body = source.replace(/\}\)\(\);\s*$/, 'window.__qa = { state, confirmDialog, buildMessageEl, renderInlineBlocks, renderDiagram, persistChat, deleteStoredChat, streamCompletion, streamWithProvider, stopStreaming, toggleVoice, ensureNativeBannerLoaded, handleFileSelection, clearPendingAttachment, mermaidCache, renderMarkdown, getChat };\n})();');
  return route.fulfill({ body, contentType: 'text/javascript' });
});
await context.route(/inference\.dahl\.global\/v1\/chat\/completions$/, async (route) => {
  if (route.request().url().includes('inference.dahl.global')) {
    const authorization = route.request().headers().authorization || '';
    assert.ok(authorization.startsWith('Bearer ') && authorization.length > 20, 'Direct requests must send the restored account authorization');
  }
  const payload = route.request().postDataJSON();
  if (!payload.stream) return route.fulfill({ json: { choices: [{ message: { content: 'OK' } }] } });
  assert.ok(payload.messages.some((m) => m.role === "system" && m.content.includes("Current date/time from the user")));
  assert.ok(payload.messages.some((m) => m.role === "system" && m.content.includes("Mock search evidence")));
  requestCount++;
  if (requestCount === 1) return route.fulfill({ status: 503, json: { error: { message: 'Primary unavailable' } } });
  // Test non-SSE successful JSON response handling.
  return route.fulfill({ json: { choices: [{ message: { content: '# Heading\nReply in اردو with $x^2$' } }] } });
});
try {
  // Seed old version-1 storage, including a large attachment; migration must preserve it.
  await page.goto(base + 'styles/variables.css');
  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      const req = indexedDB.open('BolanAI', 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('chats', { keyPath: 'id' });
        req.result.createObjectStore('appState', { keyPath: 'key' });
      };
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result; const tx = db.transaction('chats', 'readwrite');
        tx.objectStore('chats').put({ id: 'legacy', title: 'Legacy', messages: [{ role: 'user', content: 'اردو', attachment: { name: 'old.txt', content: 'x'.repeat(50000) } }], updatedAt: 1 });
        tx.oncomplete = () => { db.close(); resolve(); };
      };
    });
  });
  await page.goto(base);
  await page.waitForFunction(() => window.__qa?.state.dbReady && window.__qa.state.modelsTested);
  await page.waitForFunction(() => document.querySelector('#chatList').textContent.includes('Legacy'));
  if (await page.locator('#sidebarClose').isVisible()) await page.locator('#sidebarClose').click();
  assert.equal(await page.evaluate(() => window.__qa.getChat('legacy').messages[0].attachment.content.length), 50000);
  const rows = await page.evaluate(async () => {
    const db = window.__qa.state.db;
    return await Promise.all(['chats', 'messages'].map((name) => new Promise((resolve) => {
      const req = db.transaction(name).objectStore(name).getAll(); req.onsuccess = () => resolve(req.result);
    })));
  });
  assert.equal(rows[0][0].messages, undefined); assert.equal(rows[1].length, 1);
  console.log('PASS: legacy migration preserves attachments and splits metadata/message rows');
  // Real confirmation interaction: card text must not cancel; overlay must cancel.
  await page.evaluate(() => { window.dialogResult = null; window.__qa.confirmDialog('Delete test?').then((v) => window.dialogResult = v); });
  await page.locator('.confirm-card p').click();
  assert.equal(await page.evaluate(() => window.dialogResult), null);
  await page.locator('.confirm-card button').first().click();
  await page.waitForFunction(() => window.dialogResult === false);
  await page.evaluate(() => { window.dialogResult = null; window.__qa.confirmDialog('Delete test?').then((v) => window.dialogResult = v); });
  await page.locator('.confirm-overlay').click({ position: { x: 4, y: 4 } });
  await page.waitForFunction(() => window.dialogResult === false);
  console.log('PASS: dialog card/background click behavior');
  const rendering = await page.evaluate(() => {
    const headings = window.__qa.renderInlineBlocks('# A\n## B\n### C\n#### D\n##### E\n###### F');
    const user = window.__qa.buildMessageEl({ role: 'user', content: 'اردو' });
    return { headings: [...headings.children].map((el) => el.tagName), dir: user.querySelector('.bubble').dir };
  });
  assert.deepEqual(rendering.headings, ['H1','H2','H3','H4','H5','H6']); assert.equal(rendering.dir, 'rtl');
  console.log('PASS: semantic heading levels and user-message RTL');
  const attachmentChecks = await page.evaluate(async () => {
    const qa = window.__qa;
    let resolveFirst;
    const first = qa.handleFileSelection({ name: 'first.txt', type: 'text/plain', size: 3, text: () => new Promise((resolve) => { resolveFirst = resolve; }) });
    const readingBlocksSend = document.getElementById('sendBtn').disabled;
    await qa.handleFileSelection({ name: 'second.txt', type: 'text/plain', size: 3, text: async () => 'two' });
    resolveFirst('one'); await first;
    const replacementWins = qa.state.pendingAttachment.name === 'second.txt';
    let resolveCleared;
    const cleared = qa.handleFileSelection({ name: 'cleared.txt', type: 'text/plain', size: 3, text: () => new Promise((resolve) => { resolveCleared = resolve; }) });
    qa.clearPendingAttachment(); resolveCleared('old'); await cleared;
    return { readingBlocksSend, replacementWins, clearWins: qa.state.pendingAttachment === null && !qa.state.fileReading };
  });
  assert.deepEqual(attachmentChecks, { readingBlocksSend: true, replacementWins: true, clearWins: true });
  console.log('PASS: slow attachment read cannot overwrite a newer selection or undo Clear');

  await page.locator('#menuBtn').click();
  await page.locator('#newChatBtn').click();
  await page.locator('#messageInput').fill('Hello test');
  await page.locator('#sendBtn').click();
  await page.waitForFunction(() => !window.__qa.state.isStreaming && document.querySelector('.msg.ai .bubble')?.textContent.includes('Reply'));
  assert.equal(requestCount, 2);
  assert.ok(await page.locator('.msg.ai .bubble h1').count());
  assert.ok(await page.locator('.msg.ai .katex').count());
  await page.waitForSelector('iframe.ad-frame');
  assert.equal(await page.locator('iframe.ad-frame').getAttribute('sandbox'), 'allow-scripts');
  console.log('PASS: provider fallback, JSON response, KaTeX math, sandboxed ad frame');
  const adFrame = page.frames().find(frame => frame.url().endsWith('/ads.html'));
  assert.ok(adFrame);assert.equal(await adFrame.evaluate(() => window.origin),'null');
  const directAd=await context.newPage();
  await directAd.goto(base+'ads.html');
  await directAd.waitForFunction(()=>document.body.textContent.includes('only run in the isolated'));
  assert.equal(await directAd.locator('script[src^="https://bauval"]').count(),0);
  await directAd.close();
  console.log('PASS: static ad isolation and direct-navigation execution guard');

  // Real Mermaid render with explicit DOMPurify defense.
  await page.evaluate(() => {
    const container = document.createElement('div'); container.id = 'qaDiagram'; document.body.appendChild(container);
    window.__qa.renderDiagram(container, 'graph TD\n A[Start] --> B[End]', 1);
  });
  await page.waitForSelector('#qaDiagram svg', { timeout: 15000 });
  assert.equal(await page.locator('#qaDiagram script, #qaDiagram foreignObject, #qaDiagram [onload]').count(), 0);
  const sanitized = await page.evaluate(() => {
    const fragment = DOMPurify.sanitize('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><foreignObject>bad</foreignObject><a href="javascript:alert(1)">X</a></svg>', { USE_PROFILES: { svg: true, svgFilters: true }, RETURN_DOM_FRAGMENT: true, FORBID_TAGS: ['foreignObject','script','iframe'], FORBID_ATTR: ['href','xlink:href','target'] });
    const container = document.createElement('div'); container.append(fragment); return container.innerHTML;
  });
  assert.doesNotMatch(sanitized, /onload|<script|foreignObject|javascript:/);
  console.log('PASS: actual Mermaid SVG render and malicious SVG sanitization');
  await page.evaluate(() => {
    const qa = window.__qa;
    for (const [id, code] of [['qaSpace1','graph TD\n A[hello world]'], ['qaSpace2','graph TD\n A[hello  world]']]) {
      const container = document.createElement('div'); container.id = id; document.body.appendChild(container);
      qa.renderDiagram(container, code, 2);
    }
    const big = document.createElement('div'); big.id = 'qaBigDiagram'; document.body.appendChild(big);
    qa.renderDiagram(big, 'x'.repeat(32001), 3);
  });
  await page.waitForSelector('#qaSpace1 svg'); await page.waitForSelector('#qaSpace2 svg');
  assert.ok(await page.evaluate(() => window.__qa.mermaidCache.has('graph TD\n A[hello world]') && window.__qa.mermaidCache.has('graph TD\n A[hello  world]')));
  assert.match(await page.locator('#qaBigDiagram').textContent(), /too large/);
  console.log('PASS: diagram cache preserves meaningful whitespace and rejects oversized input');

  // Mock fetch for fast deterministic total-deadline and stop cancellation tests.
  const timeoutResult = await page.evaluate(async () => {
    const original = window.fetch; let attempts = 0;
    window.fetch = async (_, options) => new Promise((_, reject) => {
      attempts++;
      options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    });
    const started = performance.now(); const state = window.__qa.state;
    state.requestDeadline = started + 70; state.stopRequested = false;
    try { await window.__qa.streamCompletion([{ role: 'user', content: 'test' }]); }
    catch { /* expected */ }
    finally { window.fetch = original; state.controller = null; }
    return { elapsed: performance.now() - started, attempts };
  });
  assert.ok(timeoutResult.attempts >= 1 && timeoutResult.attempts <= 2); assert.ok(timeoutResult.elapsed < 500);
  console.log('PASS: whole fallback chain obeys a shared deadline');
  const streamChecks = await page.evaluate(async () => {
    const original = window.fetch; const qa = window.__qa;
    try {
      window.fetch = async () => new Response('data: {"choices":[{"delta":{"content":"SSE reply"}}]}\n\ndata: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } });
      const sse = await qa.streamWithProvider([{ role: 'user', content: 'test' }], { url: '/api/chat/0' }, 'test', 1000);
      window.fetch = async (_, options) => new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))));
      qa.state.isStreaming = true; qa.state.stopRequested = false;
      qa.state.requestDeadline = performance.now() + 1000;
      const timer = setTimeout(() => qa.stopStreaming(), 20);
      let stopped = false;
      try { await qa.streamCompletion([{ role: 'user', content: 'test' }]); }
      catch (e) { stopped = e.userStopped === true; }
      finally { clearTimeout(timer); }
      return { content: sse.content, stopped };
    } finally { window.fetch = original; qa.state.isStreaming = false; qa.state.stopRequested = false; qa.state.controller = null; }
  });
  assert.equal(streamChecks.content, 'SSE reply'); assert.equal(streamChecks.stopped, true);
  console.log('PASS: SSE parsing and user Stop abort without further fallback');
  const responseChecks = await page.evaluate(async () => {
    const original = window.fetch; const qa = window.__qa;
    const run = () => qa.streamWithProvider([{ role: 'user', content: 'test' }], { url: '/api/chat/0' }, 'test', 1000);
    try {
      window.fetch = async () => new Response('data: {"choices":\r\ndata: [{"delta":{"content":"ha"}}]}\r\n\r\ndata: {"choices":[{"delta":{"content":"ha"}}]}\r\n\r\ndata: [DONE]\r\n\r\n', { headers: { 'content-type': 'text/event-stream' } });
      const multiline = await run();
      window.fetch = async () => new Response('data: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } });
      let emptyRejected = false;
      try { await run(); } catch { emptyRejected = true; }
      window.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: 'x'.repeat(2 * 1024 * 1024) } }] }), { headers: { 'content-type': 'application/json' } });
      let oversizedJsonRejected = false;
      try { await run(); } catch { oversizedJsonRejected = true; }
      window.fetch = async () => new Response(new ReadableStream({ start(c) { const bytes = new TextEncoder().encode(':keepalive\n'.repeat(70000)); for (let i = 0; i < 3; i++) c.enqueue(bytes); c.close(); } }), { headers: { 'content-type': 'text/event-stream' } });
      let oversizedSseRejected = false;
      try { await run(); } catch { oversizedSseRejected = true; }
      return { multiline: multiline.content, emptyRejected, oversizedJsonRejected, oversizedSseRejected };
    } finally { window.fetch = original; qa.state.controller = null; }
  });
  assert.deepEqual(responseChecks, { multiline: 'haha', emptyRejected: true, oversizedJsonRejected: true, oversizedSseRejected: true });
  console.log('PASS: multiline SSE, repeated tiny tokens, empty response and JSON/SSE size limits');

  const beforeOversized = requestCount;
  await page.locator('#messageInput').fill('x'.repeat(18000));
  await page.locator('#sendBtn').click();
  await page.waitForFunction(() => !window.__qa.state.isStreaming && document.querySelector('#toast').textContent.includes('too large'));
  assert.equal(requestCount, beforeOversized);
  console.log('PASS: oversized current context is rejected before any AI call');

  // Count IDB message writes on a second persist: unchanged attachment is not written.
  const deltaWrites = await page.evaluate(async () => {
    const chat = window.__qa.getChat('legacy'); let messageWrites = 0;
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(...args) { if (this.name === 'messages') messageWrites++; return original.apply(this, args); };
    try {
      chat.messages.push({ role: 'assistant', content: 'new', timestamp: 2 });
      await window.__qa.persistChat(chat);
      await window.__qa.persistChat(chat);
    } finally { IDBObjectStore.prototype.put = original; }
    return messageWrites;
  });
  assert.equal(deltaWrites, 1);
  await page.evaluate(() => window.__qa.deleteStoredChat('legacy'));
  assert.equal(await page.evaluate(() => new Promise((resolve) => {
    const req = window.__qa.state.db.transaction('messages').objectStore('messages').index('chatId').count('legacy'); req.onsuccess = () => resolve(req.result);
  })), 0);
  console.log('PASS: delta persistence avoids rewriting attachments; delete cascades messages');
  await page.reload();
  await page.waitForFunction(() => window.__qa?.state.dbReady && window.__qa.state.modelsTested);
  assert.ok(await page.locator('.msg.ai').count());
  assert.deepEqual(errors, []);
  console.log('PASS: saved chat reload, no uncaught browser errors');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#menuBtn').click();
  await page.locator('#newChatBtn').click();
  await page.locator('#messageInput').fill('mobile check');
  const mobileLayout = await page.evaluate(() => {
    const button = document.getElementById('sendBtn').getBoundingClientRect();
    return { overflow: document.documentElement.scrollWidth > innerWidth, sendVisible: button.left >= 0 && button.right <= innerWidth && button.bottom <= innerHeight };
  });
  assert.deepEqual(mobileLayout, { overflow: false, sendVisible: true });
  await page.locator('#sendBtn').click();
  await page.waitForFunction(() => !window.__qa.state.isStreaming && document.querySelector('.msg.ai .bubble')?.textContent.includes('Reply'));
  assert.deepEqual(errors, []);
  console.log('PASS: mobile viewport, sidebar navigation and send flow');
  assert.ok(await page.evaluate(() => document.querySelector('.composer-zone').contains(document.getElementById('deepThinkToggle')) && document.querySelector('.composer-footer').contains(document.getElementById('composerModelLabel'))));
  const composerSize = await page.locator('#messageInput').boundingBox(); assert.ok(composerSize.height >= 44 && composerSize.height <= 64);
  assert.equal(await page.locator(".lookup-scope").count(),0);
  console.log('PASS: reference composer preserves footer controls and removes search footer');
  const beforeDate = requestCount;
  await page.locator('#messageInput').fill('what is today date'); await page.locator('#sendBtn').click();
  await page.waitForFunction(() => !window.__qa.state.isStreaming && [...document.querySelectorAll('.msg.ai .bubble')].at(-1)?.textContent.includes('Based on your device clock'));
  assert.equal(requestCount, beforeDate);
  console.log('PASS: date question answered using device date without model refusal');
  await page.waitForSelector('iframe.ad-frame');
  assert.equal(await page.locator('#adsterraAdShell').count(),1);
  console.log('PASS: reusable ad shell survives repeat replies and feed rerenders');
  await context.route('https://open.er-api.com/**', async (route) => route.fulfill({ json: { result: 'success', base_code: 'USD', rates: { PKR: 280 }, time_last_update_unix: Math.floor(Date.now()/1000) } }));
  await page.locator('#messageInput').fill("what is today's pkr to dollor rate"); await page.locator('#sendBtn').click();
  await page.waitForFunction(() => !window.__qa.state.isStreaming && [...document.querySelectorAll('.msg.ai .bubble')].at(-1)?.textContent.includes('280.00 PKR'));
  assert.equal(requestCount, beforeDate);
  console.log('PASS: fresh timestamped USD/PKR reference feed, correct conversion directions');
  await page.locator('#messageInput').fill('parabola ka graph banao'); await page.locator('#sendBtn').click();
  await page.waitForSelector('.function-plot .plot-curve');
  await page.waitForFunction(() => !window.__qa.state.isStreaming);
  assert.equal(requestCount, beforeDate);
  assert.ok(await page.locator('.function-plot svg').count());
  console.log('PASS: unqualified parabola produces a real computed x–y curve');
  // Invalid Mermaid and partial streamed fences must never alter body flex layout.
  const beforeMainWidth = await page.locator('.main').evaluate((element) => element.getBoundingClientRect().width);
  await page.evaluate(() => {
    const broken=document.createElement('div');broken.id='qaInvalidDiagram';document.querySelector('#messages').appendChild(broken);
    window.__qa.renderDiagram(broken,'this is not a mermaid diagram at all',10);
    const partial=document.createElement('div');partial.id='qaPartialDiagram';document.querySelector('#messages').appendChild(partial);
    window.__qa.renderMarkdown(partial,'```mermaid\n graph TD\n A[');
  });
  await page.waitForFunction(() => document.getElementById('qaInvalidDiagram').textContent.includes('Could not render'));
  assert.equal(await page.locator('.mermaid-render-host').count(),0);
  assert.equal(await page.locator('body > div[id^="dumrani-mmd-"]').count(),0);
  assert.equal(await page.locator('#qaPartialDiagram svg:not(.ui-icon)').count(),0);
  assert.equal(await page.locator('.main').evaluate((element) => element.getBoundingClientRect().width), beforeMainWidth);
  console.log('PASS: invalid/partial Mermaid cannot leak error graphics or collapse app layout');
  if (await page.locator('#adsterraCloseButton').isVisible()) await page.locator('#adsterraCloseButton').click();
  await page.evaluate(() => { document.getElementById('qaInvalidDiagram')?.remove(); document.getElementById('qaPartialDiagram')?.remove(); const area=document.getElementById('chatArea'); area.scrollTop=area.scrollHeight; });
  await page.waitForTimeout(600);
  await page.screenshot({path:join(qaDir, 'ui-mobile.png'),fullPage:false});
  await page.setViewportSize({width:1280,height:900});
  await page.waitForTimeout(600);
  await page.screenshot({path:join(qaDir, 'ui-desktop.png'),fullPage:false});


} finally { await browser.close(); await site.close(); }
