export function makeId() {
  return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export function isRtlText(str) {
  return /[\u0600-\u06FF\u0590-\u05FF\u0750-\u077F]/.test(str || "");
}

export function estimateTokens(text) {
  if (!text) return 0;
  const s = String(text);
  const arabChars = (s.match(/[\u0600-\u06FF\u0750-\u077F]/g) || []).length;
  const other = s.length - arabChars;
  return Math.ceil(arabChars / 1.3) + Math.ceil(other / 4);
}
