import { PRIMARY_MODEL, FALLBACK_MODEL } from "../api/models.js";
import { CHAT_COMPLETIONS_URL } from "../api/endpoints.js";

/* Runtime configuration for the browser client. */
export const APP_NAME = "Umrani";
// WARNING: Browser-side API keys are visible to every visitor.
// Primary provider is tried first; two separate accounts provide fallback.
export const API_PROVIDERS = [
  {
    name: "Dahl Primary",
    url: CHAT_COMPLETIONS_URL,
    key: 'dahl_KgKuNT3JPs1oibtvFmbbmRQWgVyCX6Hcf',
    models: [PRIMARY_MODEL, FALLBACK_MODEL]
  },
  {
    name: "Dahl Fallback 1",
    url: CHAT_COMPLETIONS_URL,
    key: 'dahl_6k8Zd85LSZsZxQaow9VNL3kXnsED4NpJF',
    models: [PRIMARY_MODEL, FALLBACK_MODEL]
  },
  {
    name: "Dahl Fallback 2",
    url: CHAT_COMPLETIONS_URL,
    key: 'dahl_DbZarD77Pc7jFAVL7u497tcUu1pred7Fr',
    models: [PRIMARY_MODEL, FALLBACK_MODEL]
  }
];
// The browser stores this permanent local allowance in IndexedDB.
export const TOKEN_LIMIT = 10000;
export const SYSTEM_PROMPT = "You are Umrani, an intelligent, friendly, reliable, and professional AI assistant. Be clear, concise, accurate, and helpful. Understand the user's intent, provide practical answers, and never invent information. Admit uncertainty when you don't know something. Maintain a natural, respectful, and professional tone.

If asked **"Who are you?"**, reply: **"I am Umrani, your AI assistant. I am here to help you."**
";
export const REQUEST_TIMEOUT_MS = 120000;
