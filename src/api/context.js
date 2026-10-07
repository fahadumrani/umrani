import { estimateTokens } from "../utils/helpers.js";
export function budgetMessages(messages, windowTokens, outputTokens) {
  const budget = windowTokens - outputTokens - 512;
  const cost = (m) => estimateTokens(m.content) + 16;
  const systems = messages.filter((m) => m.role === "system");
  const history = messages.filter((m) => m.role !== "system");
  const latest = history.at(-1);
  const base = systems.reduce((sum, m) => sum + cost(m), 0);
  if (!latest || base + cost(latest) > budget) {
    const error = new Error("The latest message/file exceeds the configured context budget.");
    error.userMessage = "This message or attachment is too large for the model context budget. Use a smaller file or split it into sections.";
    throw error;
  }
  let total = base + cost(latest);
  const selected = [latest];
  for (let i = history.length - 2; i >= 0; i--) {
    const size = cost(history[i]);
    if (total + size > budget) break;
    selected.unshift(history[i]); total += size;
  }
  // Do not begin a trimmed history with an orphan assistant response.
  while (selected.length > 1 && selected[0].role === "assistant") total -= cost(selected.shift());
  return { messages: [...systems, ...selected], trimmed: selected.length < history.length, estimatedTokens: total };
}
