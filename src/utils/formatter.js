export function singleLine(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}
