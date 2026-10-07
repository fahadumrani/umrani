import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { budgetMessages } from '../../src/api/context.js';
import { probeProviders } from '../../src/api/probe.js';
import { estimateTokens } from '../../src/utils/helpers.js';

const user = (content) => ({ role: 'user', content });
test('context preserves short history and multilingual estimates are conservative', () => {
  const messages = [{ role: 'system', content: 'You are helpful' }, user('hello'), { role: 'assistant', content: 'Hi' }, user('اردو')];
  assert.deepEqual(budgetMessages(messages, 2000, 256).messages, messages);
  assert.equal(estimateTokens('اردو'), Buffer.byteLength('اردو'));
});
test('context trims old messages, not saved originals; rejects oversized current attachment', () => {
  const messages = [user('x'.repeat(600)), { role: 'assistant', content: 'old reply' }, user('latest')];
  const result = budgetMessages(messages, 1100, 256);
  assert.deepEqual(result.messages, [user('latest')]);
  assert.equal(result.trimmed, true);
  assert.equal(messages.length, 3);
  assert.throws(() => budgetMessages([user('x'.repeat(1000))], 1100, 256), /exceeds/);
});
test('probe skips unsupported model and falls back after HTTP and payload errors', async () => {
  const providers = [ { url: 'skip', models: ['other'] }, ...['primary', 'bad-payload', 'healthy'].map((url) => ({ url, models: ['m'] })) ];
  const calls = [];
  const result = await probeProviders('m', providers, { fetchFn: async (url) => {
    calls.push(url);
    if (url === 'primary') return { ok: false };
    return { ok: true, json: async () => url === 'bad-payload' ? { error: 'bad' } : { choices: [{ message: { content: 'OK' } }] } };
  }});
  assert.deepEqual(calls, ['primary', 'bad-payload', 'healthy']);
  assert.equal(result.model, 'm');
});
test('probe timeout can fall back, and shared budget bounds attempts', async () => {
  const providers = ['slow', 'healthy'].map((url) => ({ url, models: ['m'] }));
  const result = await probeProviders('m', providers, { attemptMs: 10, budgetMs: 200, fetchFn: async (url, options) => {
    if (url === 'slow') return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new Error('Timeout'))));
    return { ok: true, json: async () => ({ choices: [{ message: { content: 'OK' } }] }) };
  }});
  assert.equal(result.model, 'm');
  let clock = 0; let attempts = 0;
  const failed = await probeProviders('m', providers, { budgetMs: 10, now: () => clock, fetchFn: async () => { attempts++; clock = 11; return { ok: false }; } });
  assert.equal(failed, null); assert.equal(attempts, 1);
});
test('CSP and pinned rendering dependencies retain SRI; mutable ad source is explicitly allowed', async () => {
  const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /script-src[^;]*https:\/\/bauval\.org/);
  assert.doesNotMatch(html, /fonts.googleapis.com|<script>/);
  for (const tag of html.match(/<(?:script|link)\b[^>]+(?:cdn\.jsdelivr\.net|vendor\/purify)[^>]*>/g) || []) {
    assert.match(tag, /integrity="sha384-[A-Za-z0-9+/=]+"/);
    assert.match(tag, /crossorigin="anonymous"/);
  }
});
test('bundle retains requested credentials but has no JSONP or raw SVG sink', async () => {
  const bundle = await readFile(new URL('../../dist/app.bundle.js', import.meta.url), 'utf8');
  assert.doesNotMatch(bundle, /container\.innerHTML\s*=\s*svg|function jsonp\(/);
  assert.match(bundle, /securityLevel: "strict"/);
  assert.match(bundle, /DOMPurify\.sanitize/);
});
