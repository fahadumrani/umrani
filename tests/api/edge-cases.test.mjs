import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyChunk } from '../../src/api/client.js';
import { readJsonLimited, SseEvents } from '../../src/api/response.js';
import { probeProviders } from '../../src/api/probe.js';
import { budgetMessages } from '../../src/api/context.js';
import { estimateTokens } from '../../src/utils/helpers.js';

test('tiny repeated deltas are not dropped', () => {
  for (const [chunk, previous] of [['ha','ha'],['1','1'],[' ',' ']]) assert.equal(classifyChunk(chunk, previous), 'fresh');
});
test('stream classifier preserves case and meaningful whitespace', () => {
  assert.equal(classifyChunk('EXAMPLE CONTENT', 'example content'), 'fresh');
  assert.equal(classifyChunk('A   code value', 'A code value'), 'fresh');
  assert.equal(classifyChunk('Answer: one more', 'Answer: one '), 'cumulative');
});
test('SSE parser reconstructs multiline JSON, comments and split CRLF', () => {
  const events = []; const parser = new SseEvents((event) => events.push(event));
  parser.push(': keepalive\r\ndata: {"choices":\r');
  parser.push('\ndata: [{"delta":{"content":"اردو"}}]}\r\n\r');
  parser.push('\ndata: [DONE]\r\n\r\n');
  assert.equal(events.length, 2);
  assert.equal(JSON.parse(events[0]).choices[0].delta.content, 'اردو');
  assert.equal(events[1], '[DONE]');
});
test('SSE parser flushes an unterminated final event only once', () => {
  const events = []; const parser = new SseEvents((event) => events.push(event));
  parser.push('data: hello'); assert.deepEqual(events, []);
  parser.push('', true); parser.push('', true);
  assert.deepEqual(events, ['hello']);
});
test('SSE parser rejects oversized buffers and aggregate events', () => {
  assert.throws(() => new SseEvents(() => {}, 10).push('x'.repeat(11)), /buffer/);
  const parser = new SseEvents(() => {}, 10);
  parser.push('data: 123\n'); parser.push('data: 456\n'); parser.push('data: 789\n');
  assert.throws(() => parser.push('data: 00\n'), /event/);
});
test('bounded JSON reader preserves split UTF-8 and rejects invalid JSON', async () => {
  const bytes = new TextEncoder().encode('{"content":"اردو"}');
  const response = new Response(new ReadableStream({ start(c) { c.enqueue(bytes.slice(0, 14)); c.enqueue(bytes.slice(14)); c.close(); } }));
  assert.deepEqual(await readJsonLimited(response), { content: 'اردو' });
  await assert.rejects(readJsonLimited(new Response('not json')), SyntaxError);
});
test('bounded JSON reader cancels a response exceeding its limit', async () => {
  let cancelled = false;
  const response = new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(11)); }, cancel() { cancelled = true; } }));
  await assert.rejects(readJsonLimited(response, 10), /safe size/);
  assert.equal(cancelled, true);
});
test('probe falls back on oversized responses and sends the account authorization header', async () => {
  const providers = ['first','second'].map((url) => ({ url, models: ['m'], key: 'test-only-placeholder' }));
  let attempts = 0;
  const result = await probeProviders('m', providers, { fetchFn: async (_, options) => {
    assert.equal(options.headers.Authorization, 'Bearer test-only-placeholder'); attempts++;
    if (attempts === 1) return new Response(JSON.stringify({ extra: 'x'.repeat(70000) }));
    return new Response(JSON.stringify({ choices: [{ message: { content: 'OK' } }] }));
  }});
  assert.equal(result.model, 'm'); assert.equal(attempts, 2);
});
test('reported context estimate excludes removed orphan assistant messages', () => {
  const messages = [{ role: 'user', content: 'x'.repeat(800) }, { role: 'assistant', content: 'older' }, { role: 'user', content: 'latest' }];
  const result = budgetMessages(messages, 1100, 256);
  assert.deepEqual(result.messages, [messages[2]]);
  assert.equal(result.estimatedTokens, estimateTokens('latest') + 16);
});
