export function makeId() {
  return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export function isRtlText(str) {
  return /[\u0600-\u06FF\u0590-\u05FF\u0750-\u077F]/.test(str || "");
}

export function estimateTokens(text) {
  // Conservative byte-based bound for byte-level tokenizers. Replace with the
  // exact model tokenizer if verified budgets / higher utilization are needed.
  return new TextEncoder().encode(String(text || "")).length;
}
