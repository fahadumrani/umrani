import { PRIMARY_MODEL, FALLBACK_MODEL, SECOND_FALLBACK_MODEL } from "../api/models.js";
export const APP_NAME = "Umrani";
import { CHAT_COMPLETIONS_URL } from "../api/endpoints.js";
// User-requested browser credentials. Every visitor can inspect/copy these keys.
export const API_PROVIDERS = [
  {
    name: "Dahl Primary",
    url: CHAT_COMPLETIONS_URL,
    key: 'dahl_KgKuNT3JPs1oibtvFmbbmRQWgVyCX6Hcf',
    models: [PRIMARY_MODEL, FALLBACK_MODEL, SECOND_FALLBACK_MODEL]
  },
  {
    name: "Dahl Fallback 1",
    url: CHAT_COMPLETIONS_URL,
    key: 'dahl_6k8Zd85LSZsZxQaow9VNL3kXnsED4NpJF',
    models: [PRIMARY_MODEL, FALLBACK_MODEL, SECOND_FALLBACK_MODEL]
  },
  {
    name: "Dahl Fallback 2",
    url: CHAT_COMPLETIONS_URL,
    key: 'dahl_DbZarD77Pc7jFAVL7u497tcUu1pred7Fr',
    models: [PRIMARY_MODEL, FALLBACK_MODEL, SECOND_FALLBACK_MODEL]
  },
  {
    name: "Dahl Fallback 3",
    url: CHAT_COMPLETIONS_URL,
    key: 'dahl_Hb4rueqVPipwe84fyMYW175FHmdctDo3Y',
    models: [PRIMARY_MODEL, FALLBACK_MODEL, SECOND_FALLBACK_MODEL]
  },
  {
    name: "Dahl Fallback 4",
    url: CHAT_COMPLETIONS_URL,
    key: 'dahl_79M37eUF1MvFJYc3FUMyKi18CTmppsXcy',
    models: [PRIMARY_MODEL, FALLBACK_MODEL, SECOND_FALLBACK_MODEL]
  },
  {
    name: "Dahl Fallback 5",
    url: CHAT_COMPLETIONS_URL,
    key: 'dahl_MLZeTs3EAL8gXriVJ5cKDBbgA382CQLn4',
    models: [PRIMARY_MODEL, FALLBACK_MODEL, SECOND_FALLBACK_MODEL]
  },
  {
    name: "Dahl Fallback 6",
    url: CHAT_COMPLETIONS_URL,
    key: 'dahl_AFvMRrBnpWcLZLyNk1rhQXMkKFMR33rYF',
    models: [PRIMARY_MODEL, FALLBACK_MODEL, SECOND_FALLBACK_MODEL]
  },
  {
    name: "Dahl Fallback 7",
    url: CHAT_COMPLETIONS_URL,
    key: 'dahl_FtTKYKTAEWuSDc4bKrN1vMfxVwu8f9zHH',
    models: [PRIMARY_MODEL, FALLBACK_MODEL, SECOND_FALLBACK_MODEL]
  },
  {
    name: "Dahl Fallback 8",
    url: CHAT_COMPLETIONS_URL,
    key: 'dahl_MZHvPJbU67VwgzZr3iiT4g2mtoRqXW1bw',
    models: [PRIMARY_MODEL, FALLBACK_MODEL, SECOND_FALLBACK_MODEL]
  },
  {
    name: "Dahl Fallback 9",
    url: CHAT_COMPLETIONS_URL,
    key: 'dahl_EZdwBLKNJqLoX3RvyrJe7eANrL3vvEQrp',
    models: [PRIMARY_MODEL, FALLBACK_MODEL, SECOND_FALLBACK_MODEL]
  }
];
export const SYSTEM_PROMPT = "You are Umrani, a smart, friendly, accurate, and professional AI assistant. Understand the user's intent, give clear and useful answers, never make up information, and admit uncertainty when necessary. Start in professional English, then respond in the same language and style the user uses. Keep answers concise by default and explain complex topics clearly. Use Mermaid fences ONLY for valid flowcharts/structural diagrams, not mathematical function curves. For a parabola or quadratic graph, use a plot code block containing JSON: {\"type\":\"quadratic\",\"a\":1,\"b\":0,\"c\":0,\"xMin\":-5,\"xMax\":5}, with every JSON key and string double-quoted. The renderer computes y=a*x*x+b*x+c safely. Use the requested coefficients/range; if no equation is supplied, explicitly say you assume y=x². Do not try to express a parabola using Mermaid. For unsupported functions, explain the limitation instead of emitting invalid Mermaid. Use supplied current date and retrieved web evidence rather than claiming you have no knowledge of today.";
export const REQUEST_TIMEOUT_MS = 15000;
export const REQUEST_BUDGET_MS = 90000;
// Conservative deployment policy, NOT a claim about provider context windows.
// Verify these values against your providers before increasing them.
export const CONTEXT_WINDOW_TOKENS = 16384;
export const OUTPUT_RESERVE_TOKENS = 2048;
