import { singleLine } from "../utils/formatter.js";

export const CHAT_TITLE_MAX_LENGTH = 34;

export function makeTitle(text) {
  const cleaned = singleLine(text);
  if (!cleaned) return "New Chat";
  return cleaned.length > CHAT_TITLE_MAX_LENGTH
    ? cleaned.slice(0, CHAT_TITLE_MAX_LENGTH) + "…"
    : cleaned;
}
