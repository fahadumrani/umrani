import { readJsonLimited } from "./response.js";
export async function probeProviders(model, providers, { attemptMs = 3000, budgetMs = 12000, isProviderErrorContent = () => false, fetchFn = fetch, now = () => performance.now() } = {}) {
  const deadline = now() + budgetMs;
  for (const provider of providers) {
    if (!provider.models.includes(model)) continue;
    const remaining = deadline - now();
    if (remaining <= 0) break;
    const controller = new AbortController();
    const started = now();
    const timer = setTimeout(() => controller.abort(), Math.min(attemptMs, remaining));
    try {
      const res = await fetchFn(provider.url, {
        method: "POST", headers: { "Content-Type": "application/json", ...(provider.key ? { Authorization: "Bearer " + provider.key } : {}) },
        body: JSON.stringify({ model, messages: [{ role: "user", content: "Reply OK" }], stream: false, max_tokens: 8 }),
        signal: controller.signal
      });
      if (!res.ok) { await res.body?.cancel().catch(() => {}); continue; }
      const data = await readJsonLimited(res, 64 * 1024);
      const content = data?.choices?.[0]?.message?.content;
      if (!data.error && typeof content === "string" && content.trim() && !isProviderErrorContent(content)) return { model, ms: now() - started };
    } catch { /* Try the next configured account within the shared probe budget. */ }
    finally { clearTimeout(timer); }
  }
  return null;
}
