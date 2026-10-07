import test from 'node:test';
import assert from 'node:assert/strict';
import {parseQuadraticExpression,parabolaRequest,quadraticData,formatPlotTick} from '../../src/ui/plot.js';
import {currencyIntent,normalizeWikiQuery,searchWeb,wikiExcerptAnswer,historicalCurrencyAnswer} from '../../src/api/live.js';
test('quadratic parser supports division, rational coefficients, parentheses and signs',()=>{
 for(const [input,expected] of [['x^2/2',[.5,0,0]],['(x-2)^2',[1,-4,4]],['1/2*x^2+3/4*x-1/8',[.5,.75,-.125]],['-x^2+2x-3',[-1,2,-3]],['x*x',[1,0,0]],['2*(x+1)^2',[2,4,2]],['x² / 2',[.5,0,0]]]){
  const p=parseQuadraticExpression(input);assert.deepEqual([p.a,p.b,p.c],expected,input);
 }
 assert.equal(parabolaRequest('plot y=x^2 / 2').spec.a,.5);
 assert.equal(quadraticData(parabolaRequest('plot y=x^2/2').spec).points.at(-1).y,12.5);
});
test('quadratic parser consumes the entire equation, rejects unsafe/unsupported suffixes',()=>{
 for(const text of ['x^2 / 0','x^2 sin(x)','x^2 / x','x^3','x^2 ++alert(1)','x^2 2','x^2 +','x^2/','x^2;location.href="bad"','2x2','(x^2)^2'])assert.throws(()=>parseQuadraticExpression(text),text);
 for(const text of ['plot y=x^2 / sin(x)','plot y=x^2 range zero to two','plot y=x^2/0'])assert.equal(parabolaRequest(text),null,text);
});
test('small quadratic values have a meaningful nonflat scale; unsafe tiny geometry is rejected',()=>{
 const p=quadraticData(parabolaRequest('plot y=x^2 from 0 to 0.01').spec);
 assert.ok(p.yMax<.001);assert.ok(p.yMax>=.0001);assert.ok(p.yMin<=0);
 assert.throws(()=>quadraticData({type:'quadratic',a:5e-324,b:1}));
});
test('range-aware labels remain distinct and do not contain negative zero',()=>{
 const labels=Array.from({length:6},(_,i)=>formatPlotTick(i*.002,.002));
 assert.equal(new Set(labels).size,6);assert.equal(labels[5],'0.01');assert.equal(formatPlotTick(-1e-16,.002),'0');
 const fine=Array.from({length:6},(_,i)=>formatPlotTick(i*2e-9,2e-9));assert.equal(new Set(fine).size,6);
});
test('historical/future questions cannot route into the latest feed',()=>{
 const now=new Date('2026-10-07T12:00:00Z');
 for(const q of ['What was the PKR to dollar exchange rate in 2020?','PKR USD rate last year','pkr dollar rate yesterday','pkr dollar rate 2025-01-02'])assert.equal(currencyIntent(q,now),'historical');
 for(const q of ['predict pkr dollar rate next year','pkr dollar rate 2030'])assert.equal(currencyIntent(q,now),'forecast');
 assert.equal(currencyIntent("today's pkr to dollor rate",now),'current');assert.equal(currencyIntent('hello',now),null);
 assert.match(historicalCurrencyAnswer(),/will not substitute/);
});
test('Wikipedia request extracts the topic instead of searching boilerplate',()=>{
 assert.equal(normalizeWikiQuery('Search Wikipedia for Pakistan and give a brief summary with a source.'),'Pakistan');
 assert.equal(normalizeWikiQuery('Please look up Wikipedia about quantum physics and provide a source.'),'quantum physics');
 assert.equal(normalizeWikiQuery('Pakistan'),'Pakistan');
});
test('explicit encyclopedia summaries are grounded in bounded results rather than model browsing claims',async()=>{
 const result=await searchWeb('Search Wikipedia for Pakistan and give a brief summary with a source.',{fetchFn:async url=>{
  assert.equal(new URL(url).searchParams.get('gsrsearch'),'Pakistan');
  return new Response(JSON.stringify({query:{pages:[{title:'Pakistan',extract:'A reference excerpt.',index:1}]}}));
 }});
 assert.match(wikiExcerptAnswer(result),/A reference excerpt/);assert.match(wikiExcerptAnswer(result),/https:\/\/en.wikipedia.org\/wiki\/Pakistan/);assert.match(wikiExcerptAnswer(result),/not a full-web/);
 assert.equal(wikiExcerptAnswer({available:false}),null);
});
test('cancelled encyclopedia lookup reports stopped',async()=>{
 const controller=new AbortController();controller.abort();
 const result=await searchWeb('Pakistan',{signal:controller.signal,fetchFn:async()=>{throw new Error('aborted');}});
 assert.equal(result.stopped,true);
});
