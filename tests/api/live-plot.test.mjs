import test from 'node:test';
import assert from 'node:assert/strict';
import { dateContext, isDateQuestion, isCurrencyQuestion, currencyContext, searchWeb } from '../../src/api/live.js';
import { quadraticData, parabolaRequest } from '../../src/ui/plot.js';

test('device date context includes the current local date and time zone', () => {
  const context = dateContext(new Date('2026-10-07T07:00:00Z'), 'Asia/Karachi');
  assert.match(context, /7 October 2026/); assert.match(context, /Asia\/Karachi/);
  assert.equal(isDateQuestion('what is today date'), true);
  assert.equal(isDateQuestion("what is today's date?"), true);
  assert.equal(isDateQuestion('aaj ki tareekh kya hai'), true);
  assert.equal(isDateQuestion('What was the date of the treaty?'), false);
});
test('USD PKR rate lookup validates freshness, currency base and direction', () => {
  const now = Date.parse('2026-10-07T07:00:00Z');
  const data = { result: 'success', base_code: 'USD', rates: { PKR: 280 }, time_last_update_unix: now/1000 - 100 };
  assert.equal(isCurrencyQuestion("what is today's pkr to dollor rate"), true);
  const rate = currencyContext(data, now);
  assert.equal(rate.rate, 280); assert.equal(rate.inverse, 1/280);
  assert.throws(() => currencyContext({ ...data, time_last_update_unix: now/1000-200000 }, now), /stale/);
  assert.throws(() => currencyContext({ ...data, base_code: 'EUR' }, now));
});
test('public lookup works in static/file mode and builds trusted article URLs', async () => {
  const result = await searchWeb('Pakistan', { fetchFn: async (url) => {
    assert.ok(url.startsWith('https://en.wikipedia.org/w/api.php?'));
    assert.equal(new URL(url).searchParams.get('origin'), '*');
    return new Response(JSON.stringify({ query: { pages: [{ title: 'Pakistan', extract: 'Public source evidence.', index: 1 }] } }));
  }});
  assert.equal(result.available,true);assert.match(result.context,/https:\/\/en.wikipedia.org\/wiki\/Pakistan/);
  assert.match(result.context,/NOT full-web/);
});
test('empty/blocked public lookup is explicitly unavailable, not fake live evidence', async () => {
  for(const response of [new Response('no',{status:503}),new Response('{}'),new Response('{"query":{"pages":[{"title":"No excerpt"}]}}')]){
    const result=await searchWeb('latest news',{fetchFn:async()=>response});
    assert.equal(result.available,false);assert.ok(result.reason);
  }
});
test('Urdu queries use the Urdu API and untrusted URLs cannot override source host',async()=>{
 const result=await searchWeb('پاکستان',{fetchFn:async(url)=>{
  assert.ok(url.startsWith('https://ur.wikipedia.org/'));
  return new Response(JSON.stringify({query:{pages:[{title:'پاکستان',extract:'Evidence',url:'javascript:evil'}]}}));
 }});
 assert.match(result.context,/https:\/\/ur.wikipedia.org\/wiki\//);assert.doesNotMatch(result.context,/javascript:/);
});

test('quadratic curve computes mathematically correct vertex and sample values', () => {
  const result = quadraticData({ type: 'quadratic', a: 1, b: -4, c: 4, xMin: -3, xMax: 7 });
  assert.equal(result.vertexX, 2); assert.equal(result.vertexY, 0);
  assert.equal(result.points[100].x, 2); assert.equal(result.points[100].y, 0);
  assert.equal(result.points.length, 201); assert.equal(result.points[0].y, 25);
});
test('plot specification rejects unsafe and nonfinite inputs', () => {
  for (const spec of [{ type: 'javascript', code: 'alert(1)' }, { type: 'quadratic', a: 0 }, { type: 'quadratic', a: 'Infinity' }, { type: 'quadratic', xMin: 5, xMax: -5 }]) assert.throws(() => quadraticData(spec));
});
test('unqualified parabola request makes its default assumption explicit', () => {
  const result = parabolaRequest('parabola ka graph banao');
  assert.equal(result.assumption, true); assert.equal(result.spec.a, 1);
  const equation = parabolaRequest('plot parabola y=2x^2-4x+1');
  assert.deepEqual([equation.spec.a,equation.spec.b,equation.spec.c], [2,-4,1]);
  assert.equal(parabolaRequest('plot parabola y=(x-2)^2'), null);
  assert.equal(parabolaRequest('plot parabola y=x²−4').spec.c,-4);
  assert.equal(parabolaRequest('plot parabola y=x²sin(x)'),null);
  const ranged=parabolaRequest('plot y=x^2 from -2 to 3');
  assert.equal(ranged.spec.xMin,-2);assert.equal(ranged.spec.xMax,3);
});
