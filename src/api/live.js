import { readJsonLimited } from './response.js';
export function dateContext(now = new Date(), timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC') {
  const formatter = new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeStyle: 'long', timeZone });
  return `Current date/time from the user's device: ${formatter.format(now)}. Timezone: ${timeZone}. UTC: ${now.toISOString()}. Use this supplied date for today/now questions; do not say you cannot know today's date. The device clock may be inaccurate. Live facts other than date need retrieved evidence.`;
}
export function isDateQuestion(query) {
  return /^(?:what\s+(?:date|day)\s+is\s+it\s+today)[?!.\s]*$/i.test(query.trim()) || /^(?:what(?:'s| is)?\s+)?(?:today(?:'s)?\s+(?:date|day)|(?:the\s+)?(?:date|day)\s+today)[?!.\s]*$/i.test(query.trim()) || /^(?:aaj|aj)\s+(?:ki\s+)?(?:date|tareekh|tarikh)\s*(?:kya\s+(?:hai|hy))?[?!.\s]*$/i.test(query.trim());
}
export function isCurrencyQuestion(query) {
  return /(?:pkr|pakistan(?:i)?\s+rupee|روپیہ|روپے)/i.test(query) && /(?:usd|dollar|dollor|ڈالر)/i.test(query) && /(?:rate|exchange|today|aaj|aj|قیمت|ریٹ)/i.test(query);
}
export function currencyContext(data, now = Date.now()) {
  const rate = Number(data?.rates?.PKR);
  const updated = Number(data?.time_last_update_unix) * 1000;
  if (data?.result !== 'success' || data?.base_code !== 'USD' || !Number.isFinite(rate) || rate <= 0 || !Number.isFinite(updated) || updated > now + 300000 || now - updated > 48 * 3600000) throw new Error('Currency feed is unavailable or stale');
  return { rate, inverse: 1 / rate, updated: new Date(updated).toISOString(), source: 'https://www.exchangerate-api.com/', feed: 'https://open.er-api.com/v6/latest/USD' };
}
export async function getCurrencyRate({ fetchFn = fetch, signal } = {}) {
  const response = await fetchFn('https://open.er-api.com/v6/latest/USD', { signal: signal || AbortSignal.timeout(5000), cache: 'no-store' });
  if (!response.ok) throw new Error('Live currency lookup failed');
  return currencyContext(await readJsonLimited(response, 128 * 1024));
}
export function currencyAnswer(rate) {
  return `Latest indicative USD/PKR rate:\n\n**1 USD = ${rate.rate.toFixed(2)} PKR**\n\n**1 PKR = ${rate.inverse.toFixed(6)} USD**\n\nFeed last updated: ${rate.updated.replace('T', ' ').replace('.000Z', ' UTC')}.\n\nSource: ${rate.feed}\n\nThis is an indicative reference feed, not a live bank, interbank dealing or open-market buy/sell quote. Banks and exchange shops may offer different rates.`;
}
// GitHub Pages-compatible public encyclopedia lookup. No proxy, JSONP or keys.
export async function searchWeb(query, { fetchFn = fetch, signal } = {}) {
  const queryText = String(query || '').trim().slice(0, 400);
  if (!queryText) return { available: false, context: '', reason: 'Enter a query for public lookup.' };
  const language = /[\u0600-\u06ff]/.test(queryText) ? 'ur' : 'en';
  const endpoint = `https://${language}.wikipedia.org/w/api.php`;
  const params = new URLSearchParams({ action: 'query', generator: 'search', gsrsearch: queryText,
    gsrlimit: '5', gsrnamespace: '0', prop: 'extracts', exintro: '1', explaintext: '1',
    exchars: '1000', format: 'json', formatversion: '2', origin: '*' });
  try {
    const response = await fetchFn(endpoint + '?' + params, { signal: signal || AbortSignal.timeout(6000), cache: 'no-store' });
    if (!response.ok) throw new Error('Public lookup unavailable');
    const data = await readJsonLimited(response, 256 * 1024);
    const pages = Array.isArray(data.query?.pages) ? data.query.pages : Object.values(data.query?.pages || {});
    const results = pages.sort((a,b)=>(a.index || 0)-(b.index || 0)).filter((page) => typeof page.title === 'string' && typeof page.extract === 'string' && page.extract.trim()).slice(0,5).map((page)=>({
      title: page.title.slice(0,160), snippet: page.extract.slice(0,1000),
      url: `https://${language}.wikipedia.org/wiki/` + encodeURIComponent(page.title.replace(/ /g,'_'))
    }));
    if (data.error || !results.length) return { available: false, context: '', reason: 'Wikipedia lookup returned no usable articles. This static app does not have full Google/Bing or live-news search.' };
    const scope = 'Scope: encyclopedia excerpts only, NOT full-web or verified live-news search. Retrieval time is not an article publication date.';
    let context = scope;
    let included = 0;
    for (const result of results) {
      const article = `\n\n${included+1}. ${result.title}\n${result.snippet.slice(0,700)}\nSource: ${result.url}`;
      if (new TextEncoder().encode(context + article).length > 6500) break;
      context += article; included++;
    }
    if (!included) return { available:false, context:'', reason:'Public results were too large to use safely.' };
    return { available: true, provider: 'Wikipedia encyclopedia lookup', retrievedAt: new Date().toISOString(), context };

  } catch {
    return { available: false, context: '', reason: 'Public lookup failed or was blocked by the network. No fresh evidence was retrieved; no local server is required.' };
  }
}
