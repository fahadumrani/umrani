/* ==========================================================
   Umrani — app.js
   Frontend-only AI chatbot. Vanilla JS. IndexedDB persistence.
   Google Ad Manager Rewarded Ads for Web (Google Publisher Tag).
   Sections:
     1. Configuration
     2. DOM references
     3. Application state
     4. IndexedDB
     5. Theme
     6. Chat management
     7. UI rendering
     8. Message handling
     9. API / streaming
    10. Token state
    11. Rewarded ads
    12. Voice input
    13. Event listeners
    14. Initialization
   ========================================================== */

import {
  API_PROVIDERS, APP_NAME, TOKEN_LIMIT,
  GOOGLE_AD_MANAGER_NETWORK_CODE, REWARDED_AD_UNIT_PATH,
  REWARDED_AD_FALLBACK_MS, SYSTEM_PROMPT, REQUEST_TIMEOUT_MS
} from "./config/config.js";
import { makeId, isRtlText, estimateTokens } from "./utils/helpers.js";
import { singleLine } from "./utils/formatter.js";
import { makeTitle } from "./core/chat.js";
import { MAX_CONTEXT_MESSAGES } from "./core/memory.js";
import { STORAGE_DATABASE } from "./core/storage.js";
import { HISTORY_STORE, APP_STATE_STORE } from "./core/history.js";
import { SYSTEM_ROLE, USER_ROLE, AI_ROLE } from "./core/ai.js";
import { classifyChunk, cleanFinalResponse, collapseRepeatedResponse, trimRunawayRepetition } from "./api/client.js";
import {
  SIDEBAR_ELEMENT_ID, SIDEBAR_CLOSE_ELEMENT_ID, MENU_BUTTON_ELEMENT_ID,
  NEW_CHAT_BUTTON_ELEMENT_ID, SEARCH_CHATS_ELEMENT_ID, CHAT_LIST_ELEMENT_ID
} from "./ui/sidebar.js";
import {
  CHAT_AREA_ELEMENT_ID, MESSAGES_ELEMENT_ID, EMPTY_STATE_ELEMENT_ID,
  STREAM_STATUS_ELEMENT_ID, COMPOSER_ELEMENT_ID, MESSAGE_INPUT_ELEMENT_ID,
  SEND_BUTTON_ELEMENT_ID, MIC_BUTTON_ELEMENT_ID
} from "./ui/chat.js";
import { STREAM_MESSAGE_ELEMENT_ID } from "./ui/messages.js";
import {
  LOCK_OVERLAY_ELEMENT_ID, WATCH_AD_BUTTON_ELEMENT_ID, LOCK_MESSAGE_ELEMENT_ID,
  LOCK_ERROR_ELEMENT_ID
} from "./ui/modal.js";
import { TOAST_ELEMENT_ID } from "./ui/notifications.js";

function getProviderModels(provider) {
  if (!provider || !Array.isArray(provider.models)) return [];
  return provider.models.filter((model) => (
    typeof model === "string" && !model.startsWith("YOUR_")
  ));
}

function isProviderConfigured(provider) {
  return Boolean(
    provider &&
    typeof provider.url === "string" &&
    !provider.url.startsWith("YOUR_") &&
    typeof provider.key === "string" &&
    !provider.key.startsWith("YOUR_") &&
    getProviderModels(provider).length > 0
  );
}

/* ==========================================================
   2. DOM REFERENCES
   ========================================================== */
const dom = {};
function initDom() {
  dom.sidebar = document.getElementById(SIDEBAR_ELEMENT_ID);
  dom.overlay = document.getElementById("overlay");
  dom.menuBtn = document.getElementById(MENU_BUTTON_ELEMENT_ID);
  dom.sidebarClose = document.getElementById(SIDEBAR_CLOSE_ELEMENT_ID);
  dom.newChatBtn = document.getElementById(NEW_CHAT_BUTTON_ELEMENT_ID);
  dom.searchChats = document.getElementById(SEARCH_CHATS_ELEMENT_ID);
  dom.chatList = document.getElementById(CHAT_LIST_ELEMENT_ID);
  dom.chatArea = document.getElementById(CHAT_AREA_ELEMENT_ID);
  dom.messages = document.getElementById(MESSAGES_ELEMENT_ID);
  dom.emptyState = document.getElementById(EMPTY_STATE_ELEMENT_ID);
  dom.streamStatus = document.getElementById(STREAM_STATUS_ELEMENT_ID);
  dom.messageInput = document.getElementById(MESSAGE_INPUT_ELEMENT_ID);
  dom.sendBtn = document.getElementById(SEND_BUTTON_ELEMENT_ID);
  dom.micBtn = document.getElementById(MIC_BUTTON_ELEMENT_ID);
  dom.lockOverlay = document.getElementById(LOCK_OVERLAY_ELEMENT_ID);
  dom.watchAdBtn = document.getElementById(WATCH_AD_BUTTON_ELEMENT_ID);
  dom.lockMsg = document.getElementById(LOCK_MESSAGE_ELEMENT_ID);
  dom.lockError = document.getElementById(LOCK_ERROR_ELEMENT_ID);
  dom.toast = document.getElementById(TOAST_ELEMENT_ID);
  dom.composer = document.getElementById(COMPOSER_ELEMENT_ID);
}
/* ==========================================================
   3. APPLICATION STATE
   ----------------------------------------------------------
   Central in-memory state. Persistent parts (chats, token state)
   are mirrored to IndexedDB; small prefs (theme) to localStorage.
   ========================================================== */
const state = {
  db: null,
  dbReady: false,
  currentChatId: null,
  chats: [],              // cached chat summaries + full messages when active
  isStreaming: false,
  isLocked: false,
  tokensUsed: 0,
  limitReached: false,
  rewardedAdReady: false,
  rewardedAdEvent: null,   // stored rewardedSlotReady event
  rewardedAdRequestActive: false,
  killRewardedSlot: null,  // cleanup fn from GPT listener registration
  activeRequestChatId: null,
  controller: null,        // AbortController for current request
  rewardGranted: false,    // true only inside rewardedSlotGranted window
};

/* ==========================================================
   4. INDEXEDDB
   ----------------------------------------------------------
   Database : "BolanAI"
   Store 1  : "chats"     — keyPath "id"
   Store 2  : "appState"  — keyPath "key"  (token state, last chat)
   Token state lives in appState and is separate from chat data,
   so New Chat / Delete Chat / theme changes never reset tokens.
   ========================================================== */
function openDB() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      showToast("Your browser does not support IndexedDB. Chat history will not be saved.");
      reject(new Error("IndexedDB unsupported"));
      return;
    }
    const req = indexedDB.open(STORAGE_DATABASE, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("chats")) {
        db.createObjectStore("chats", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("appState")) {
        db.createObjectStore("appState", { keyPath: "key" });
      }
    };
    req.onsuccess = (e) => { state.db = e.target.result; state.dbReady = true; resolve(state.db); };
    req.onerror = (e) => { console.error("IndexedDB open error", e); reject(e); };
    req.onblocked = () => { /* another tab holds old version; wait */ };
  });
}

function dbPut(storeName, value) {
  return new Promise((resolve, reject) => {
    if (!state.dbReady) return reject(new Error("DB not ready"));
    const tx = state.db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const req = store.put(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.onerror = () => reject(tx.error || new Error("tx error"));
  });
}

function dbGet(storeName, key) {
  return new Promise((resolve, reject) => {
    if (!state.dbReady) return reject(new Error("DB not ready"));
    const tx = state.db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result == null ? undefined : req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbGetAll(storeName) {
  return new Promise((resolve, reject) => {
    if (!state.dbReady) return reject(new Error("DB not ready"));
    const tx = state.db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function dbDelete(storeName, key) {
  return new Promise((resolve, reject) => {
    if (!state.dbReady) return reject(new Error("DB not ready"));
    const tx = state.db.transaction(storeName, "readwrite");
    const req = tx.objectStore(storeName).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
/* ==========================================================
   5. THEME
   ----------------------------------------------------------
   Dark mode removed — the app is always light mode.
   ========================================================== */

/* ==========================================================
   Utilities: toast, requestAnimationFrame scroll, RTL detect,
   client-side token estimation.
   ========================================================== */
let toastTimer = null;
function showToast(message, ms = 2800) {
  if (!dom.toast) return;
  dom.toast.textContent = message;
  dom.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { dom.toast.hidden = true; }, ms);
}

/* ==========================================================
   10. TOKEN STATE (persistent, silent)
   ----------------------------------------------------------
   Stored in IndexedDB appState under key "tokenState".
   Survives refresh and browser reopen. Only rewardedSlotGranted
   can reset it. The limit/usage is NEVER drawn to the UI.
   ========================================================== */
async function loadTokenState() {
  try {
    const rec = await dbGet(APP_STATE_STORE, "tokenState");
    if (rec) {
      state.tokensUsed = Math.max(0, Number(rec.tokensUsed) || 0);
      state.limitReached = !!rec.limitReached;
    } else {
      // First use: give the user a full free allowance and PERSIST it
      // immediately so refresh/browser-reopen can never re-grant a
      // second "new user" allowance on a modified count.
      state.tokensUsed = 0;
      state.limitReached = false;
      await saveTokenState();
    }
  } catch (err) {
    console.warn("Failed to load token state", err);
    state.tokensUsed = 0;
    state.limitReached = false;
  }
  state.isLocked = state.limitReached;
  if (state.isLocked) lockUI(true);
}

async function saveTokenState() {
  try {
    await dbPut(APP_STATE_STORE, {
      key: "tokenState",
      tokensUsed: state.tokensUsed,
      limitReached: state.limitReached,
      lastUpdated: Date.now()
    });
  } catch (err) {
    console.warn("Failed to save token state", err);
  }
}
/* ==========================================================
   6. CHAT MANAGEMENT
   ========================================================== */
async function loadChats() {
  try {
    const all = await dbGetAll(HISTORY_STORE);
    state.chats = (all || []).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } catch (err) {
    console.warn("Failed to load chats", err);
    state.chats = [];
  }
}

function getChat(id) {
  return state.chats.find((c) => c.id === id) || null;
}

async function createChat() {
  const now = Date.now();
  const chat = {
    id: makeId(),
    title: "New Chat",
    messages: [],
    createdAt: now,
    updatedAt: now
  };
  state.chats.unshift(chat);
  try {
    await dbPut(HISTORY_STORE, chat);
  } catch (err) {
    console.warn("Failed to persist new chat", err);
  }
  state.currentChatId = chat.id;
  renderChatList();
  renderActiveChat();
  closeSidebar();
  persistLastChat();
  updateComposerState();
  dom.messageInput.focus();
  dom.searchChats.value = "";
  return chat;
}

async function openChat(id) {
  if (state.currentChatId === id) return;
  // If a request is streaming, it keeps writing to its own chat id.
  const chat = getChat(id);
  if (!chat) return;
  state.currentChatId = id;
  // cancel any streaming UI tied to old chat (in-flight request continues to its chat)
  renderChatList();
  renderActiveChat();
  persistLastChat();
  updateComposerState();
  closeSidebar();
}

async function deleteChat(id) {
  const chat = getChat(id);
  if (!chat) return;
  // Ask confirmation via a lightweight in-UI dialog.
  const ok = await confirmDialog('Delete this chat? This cannot be undone.');
  if (!ok) return;
  try {
    await dbDelete(HISTORY_STORE, id);
  } catch (err) {
    console.warn("Failed to delete chat", err);
    showToast("Could not delete this chat. Please try again.");
    return;
  }
  state.chats = state.chats.filter((c) => c.id !== id);
  if (state.currentChatId === id) {
    state.currentChatId = null;
    renderActiveChat();
    persistLastChat();
    updateComposerState();
  }
  renderChatList();
}

function renderChatList(filterText) {
  const list = dom.chatList;
  list.textContent = "";
  const q = (filterText || "").trim().toLowerCase();
  let items = state.chats;

  if (q) {
    items = items.filter((c) => {
      if ((c.title || "").toLowerCase().includes(q)) return true;
      return (c.messages || []).some((m) => String(m.content || "").toLowerCase().includes(q));
    });
  }

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "chat-list-empty";
    empty.textContent = q ? "No chats found" : "No chats yet";
    list.appendChild(empty);
    return;
  }

  const frag = document.createDocumentFragment();
  for (const chat of items) {
    // NOTE: a real <button> cannot contain the delete <button>, so the
    // row is a div with role="button" (keyboard accessible) and the
    // delete control is a real button inside it.
    const row = document.createElement("div");
    row.className = "chat-item" + (chat.id === state.currentChatId ? " active" : "");
    row.setAttribute("role", "button");
    row.tabIndex = 0;
    row.setAttribute("aria-label", "Open chat: " + chat.title);

    const title = document.createElement("span");
    title.className = "ci-title";
    title.textContent = chat.title || "New Chat";

    const del = document.createElement("button");
    del.className = "ci-del";
    del.type = "button";
    del.setAttribute("aria-label", "Delete chat: " + chat.title);
    del.innerHTML =
      '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M10 11v6M14 11v6"/></svg>';
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteChat(chat.id);
    });
    del.addEventListener("keydown", (e) => e.stopPropagation());

    row.appendChild(title);
    row.appendChild(del);

    const open = () => openChat(chat.id);
    row.addEventListener("click", open);
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });
    frag.appendChild(row);
  }
  list.appendChild(frag);
}

async function persistLastChat() {
  try {
    if (state.currentChatId) {
      await dbPut(APP_STATE_STORE, { key: "lastChatId", value: state.currentChatId, updatedAt: Date.now() });
    } else {
      await dbDelete(APP_STATE_STORE, "lastChatId");
    }
  } catch (err) {
    /* non-critical */
  }
}

async function restoreLastChat() {
  try {
    const rec = await dbGet(APP_STATE_STORE, "lastChatId");
    if (rec && rec.value && getChat(rec.value)) {
      state.currentChatId = rec.value;
    }
  } catch (err) {
    /* non-critical */
  }
}
/* ==========================================================
   7. UI RENDERING
   ----------------------------------------------------------
   ALL message content is inserted with textContent or safe DOM
   construction — never raw innerHTML from AI/user input. Markdown
   is parsed into DOM nodes; every URL is sanitized and opened with
   target="_blank" rel="noopener noreferrer".
   ========================================================== */
function renderActiveChat() {
  const chat = getChat(state.currentChatId);
  const msgsEl = dom.messages;
  msgsEl.textContent = "";

  if (!chat) {
    dom.emptyState.hidden = false;
    return;
  }
  dom.emptyState.hidden = true;

  const frag = document.createDocumentFragment();
  for (const m of chat.messages || []) {
    if (m.role === SYSTEM_ROLE) continue;
    if (m.role === AI_ROLE && !m.content) continue; // empty placeholders
    frag.appendChild(buildMessageEl(m));
  }
  msgsEl.appendChild(frag);
  scrollToBottom(false);
}

// Build one message bubble using safe DOM APIs.
function buildMessageEl(msg) {
  const wrap = document.createElement("div");
  wrap.className = "msg " + (msg.role === USER_ROLE ? "user" : "ai");

  if (msg.role !== USER_ROLE) {
    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.innerHTML =
      '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4z"/></svg>';
    wrap.appendChild(avatar);
  }

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  const content = String(msg.content || "");
  bubble.setAttribute("dir", isRtlText(content) ? "rtl" : "ltr");

  if (msg.role === USER_ROLE) {
    bubble.textContent = content;
  } else {
    // AI messages use the same safe markdown renderer as streaming,
    // so saved messages keep code blocks/lists/bold after reload or
    // chat switching (plain text lost all formatting before).
    renderMarkdown(bubble, content);
  }

  wrap.appendChild(bubble);
  return wrap;
}

/* ---------- Safe markdown-like renderer for AI text ---------- */
function renderMarkdown(targetEl, text) {
  targetEl.classList.add("md");
  targetEl.textContent = "";
  const lines = String(text).split("\n");
  const blocks = [];
  let i = 0;
  let codeBuf = null;

  // Split into fenced code blocks vs. text runs.
  for (; i < lines.length; i++) {
    const lm = lines[i].match(/^\s*```([\w+-]*)\s*$/);
    if (lm) {
      if (codeBuf) {
        blocks.push({ type: "code", lang: codeBuf.lang, lines: codeBuf.lines });
        codeBuf = null;
      } else {
        codeBuf = { lang: lm[1] || "", lines: [] };
      }
      continue;
    }
    if (codeBuf) { codeBuf.lines.push(lines[i]); continue; }
    const prev = blocks[blocks.length - 1];
    // Extend the current text block instead of pushing a cumulative copy
    // for every line. Pushing the growing text here made every multi-line
    // answer render as: line 1, line 1+2, line 1+2+3, ... (the reported
    // triple/repeated response bug).
    if (prev && prev.type === "text") {
      prev.text += "\n" + lines[i];
    } else {
      blocks.push({ type: "text", text: lines[i] });
    }
  }
  if (codeBuf) blocks.push({ type: "code", lang: codeBuf.lang, lines: codeBuf.lines });

  for (const b of blocks) {
    if (b.type === "code") {
      targetEl.appendChild(createCodeBlock(b.lang, b.lines.join("\n")));
    } else {
      targetEl.appendChild(renderInlineBlocks(b.text));
    }
  }
}

// Render a text run: headings, quotes, lists (proper multi-line
// grouping), blank-line separation, then plain paragraphs.
function renderInlineBlocks(text) {
  const container = document.createElement("div");
  const lines = String(text).split("\n");
  let i = 0;
  let listEl = null; // current <ul> or <ol>

  while (i < lines.length) {
    const t = lines[i].trim();

    // Blank line: closes any open list, skipped from output.
    if (!t) { listEl = null; i++; continue; }

    // Headings # .. ######
    const h = t.match(/^#{1,6}\s+(.*)$/);
    if (h) {
      listEl = null;
      const hd = document.createElement("h3");
      appendInline(hd, h[1]);
      container.appendChild(hd);
      i++;
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(t) && !/^>>/.test(t)) {
      listEl = null;
      const q = document.createElement("blockquote");
      appendInline(q, t.replace(/^>\s?/, ""));
      container.appendChild(q);
      i++;
      continue;
    }

    // Unordered list item (consecutive items share one <ul>)
    const ulm = t.match(/^[-*+]\s+(.*)$/);
    if (ulm) {
      if (!listEl || listEl.tagName !== "UL") {
        listEl = document.createElement("ul");
        container.appendChild(listEl);
      }
      const li = document.createElement("li");
      appendInline(li, ulm[1]);
      listEl.appendChild(li);
      i++;
      continue;
    }

    // Ordered list item (consecutive items share one <ol>)
    const olm = t.match(/^\d+[.)]\s+(.*)$/);
    if (olm) {
      if (!listEl || listEl.tagName !== "OL") {
        listEl = document.createElement("ol");
        container.appendChild(listEl);
      }
      const li = document.createElement("li");
      appendInline(li, olm[1]);
      listEl.appendChild(li);
      i++;
      continue;
    }

    // Plain paragraph: gather consecutive plain lines into one <p>.
    listEl = null;
    const paraLines = [t];
    i++;
    while (i < lines.length) {
      const nt = lines[i].trim();
      if (!nt ||
          /^#{1,6}\s+/.test(nt) || /^>\s?/.test(nt) ||
          /^[-*+]\s+/.test(nt) || /^\d+[.)]\s+/.test(nt)) {
        break;
      }
      paraLines.push(nt);
      i++;
    }
    const p = document.createElement("p");
    appendInline(p, paraLines.join(" "));
    container.appendChild(p);
  }
  return container;
}

// Append parsed inline runs (code spans, bold, links) via safe DOM.
function appendInline(node, text) {
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|https?:\/\/[^\s<>"')\]]+)/;
  const parts = String(text).split(pattern);
  for (const part of parts) {
    if (!part) continue;
    if (/^`.+`$/.test(part)) {
      const code = document.createElement("code");
      code.className = "inline";
      code.textContent = part.slice(1, -1);
      node.appendChild(code);
    } else if (/^\*\*.+\*\*$/.test(part)) {
      const strong = document.createElement("strong");
      strong.textContent = part.slice(2, -2);
      node.appendChild(strong);
    } else if (/^https?:\/\//.test(part)) {
      const a = document.createElement("a");
      a.href = part;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = part;
      node.appendChild(a);
    } else {
      node.appendChild(document.createTextNode(part));
    }
  }
}
// Build a styled code block with language label, copy + collapse.
function createCodeBlock(lang, code) {
  const wrap = document.createElement("div");
  wrap.className = "code-block";

  const head = document.createElement("div");
  head.className = "code-head";
  const label = document.createElement("span");
  label.textContent = lang ? lang : "code";
  const copyBtn = document.createElement("button");
  copyBtn.className = "code-copy";
  copyBtn.type = "button";
  copyBtn.textContent = "Copy";
  copyBtn.addEventListener("click", async () => {
    try {
      await copyText(code);
      copyBtn.textContent = "Copied";
      setTimeout(() => { copyBtn.textContent = "Copy"; }, 1800);
    } catch (err) {
      showToast("Could not copy");
    }
  });

  const body = document.createElement("div");
  body.className = "code-body";
  body.textContent = code;

  head.appendChild(label);
  head.appendChild(copyBtn);
  wrap.appendChild(head);
  wrap.appendChild(body);

  const shouldClamp = code.split("\n").length > 30;
  if (shouldClamp) {
    let expanded = false;
    const more = document.createElement("button");
    more.className = "code-more";
    more.type = "button";
    more.textContent = "Expand code";
    more.addEventListener("click", () => {
      expanded = !expanded;
      body.classList.toggle("expanded", expanded);
      more.textContent = expanded ? "Collapse code" : "Expand code";
    });
    wrap.appendChild(more);
  }
  return wrap;
}

async function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.top = "0";
  ta.style.left = "0";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

/* ---------- Typing indicator ---------- */
function showTyping() {
  removeTyping();
  const el = document.createElement("div");
  el.className = "msg ai";
  el.id = "typingMsg";
  const typing = document.createElement("div");
  typing.className = "typing";
  typing.setAttribute("role", "status");
  typing.innerHTML = "<span></span><span></span><span></span>";
  el.appendChild(typing);
  dom.messages.appendChild(el);
  scrollToBottom(false);
}

function removeTyping() {
  const el = document.getElementById("typingMsg");
  if (el) el.remove();
}

/* ---------- Auto-scroll (respect user scroll-up) ---------- */
let userScrolledUp = false;
function markUserScroll() {
  const el = dom.chatArea;
  const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
  userScrolledUp = dist > 120;
}
function scrollToBottom(force) {
  if (force || !userScrolledUp) {
    dom.chatArea.scrollTop = dom.chatArea.scrollHeight;
  }
}

/* ---------- Sidebar drawer helpers ---------- */
function openSidebar() {
  dom.sidebar.classList.add("open");
  dom.overlay.hidden = false;
  requestAnimationFrame(() => dom.overlay.classList.add("show"));
}
function toggleSidebar() {
  if (dom.sidebar.classList.contains("open")) {
    closeSidebar();
  } else {
    openSidebar();
  }
}
function closeSidebar() {
  dom.sidebar.classList.remove("open");
  dom.overlay.classList.remove("show");
  dom.overlay.hidden = true;
}

/* ---------- Lightweight confirm dialog (in-UI, no alert()) ---------- */
function confirmDialog(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    // ".show" immediately: .overlay defaults to opacity 0 — without it
    // the dialog would be invisible (clicks would still land).
    overlay.className = "overlay confirm-overlay show";
    overlay.style.zIndex = "105";
    overlay.addEventListener("click", () => {
      document.removeEventListener("keydown", onKey);
      overlay.remove();
      resolve(false);
    });

    const card = document.createElement("div");
    card.className = "confirm-card";
    card.setAttribute("role", "alertdialog");
    card.setAttribute("aria-modal", "true");

    const p = document.createElement("p");
    p.textContent = message;

    const actions = document.createElement("div");
    actions.className = "confirm-actions";

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Cancel";
    const ok = document.createElement("button");
    ok.type = "button";
    ok.className = "danger";
    ok.textContent = "Delete";

    const onKey = (e) => {
      if (e.key === "Escape") {
        document.removeEventListener("keydown", onKey);
        overlay.remove();
        resolve(false);
      }
    };
    document.addEventListener("keydown", onKey);

    cancel.addEventListener("click", () => {
      document.removeEventListener("keydown", onKey);
      overlay.remove();
      resolve(false);
    });
    ok.addEventListener("click", () => {
      document.removeEventListener("keydown", onKey);
      overlay.remove();
      resolve(true);
    });

    actions.appendChild(cancel);
    actions.appendChild(ok);
    card.appendChild(p);
    card.appendChild(actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    cancel.focus();
  });
}

/* ---------- Composer enable/disable ---------- */
function updateComposerState() {
  const locked = state.isLocked || state.limitReached;
  // Typing stays possible while streaming; only SENDING is blocked
  // (prevents duplicate sends without freezing the composer).
  dom.messageInput.disabled = locked;
  const canSend = !locked && !state.isStreaming &&
    dom.messageInput.value.trim().length > 0;
  dom.sendBtn.disabled = !canSend;
  if (locked) dom.composer.classList.add("locked");
  else dom.composer.classList.remove("locked");
}
/* ==========================================================
   8. MESSAGE HANDLING / SEND
   ----------------------------------------------------------
   Validates, checks lock/config, guards against duplicate sends,
   saves user message, streams the assistant reply, saves it,
   updates token usage, and re-enables the composer.
   ========================================================== */
async function sendMessage() {
  const raw = dom.messageInput.value;
  const text = singleLine(raw);

  if (!text) {
    showToast("Please type a message first.");
    return;
  }
  if (state.isStreaming) {
    showToast("Please wait for the current reply to finish.");
    return;
  }
  if (state.isLocked || state.limitReached) {
    showLock();
    return;
  }
  if (!API_PROVIDERS.some(isProviderConfigured)) {
    showToast("Set your API URL, key, and model in the configuration module to start chatting.");
    return;
  }

  // Lock SYNCHRONOUSLY before ANY await: rapid extra clicks or Enter
  // repeats used to slip past this check while an IndexedDB save was
  // pending, sending the same message 2-3 times (duplicate replies).
  state.isStreaming = true;
  state.activeRequestChatId = state.currentChatId || null;
  dom.messageInput.value = "";
  dom.sendBtn.disabled = true;
  autoGrowInput(); // reset the composer height + composer state immediately

  let chat;
  try {
    chat = getChat(state.currentChatId);
    if (!chat) {
      chat = await createChat();
    }
    if (!state.currentChatId) state.currentChatId = chat.id;

    const userMsg = { role: USER_ROLE, content: text, timestamp: Date.now() };

    chat.messages.push(userMsg);
    chat.updatedAt = Date.now();
    if (!chat.title || chat.title === "New Chat") {
      chat.title = makeTitle(text || "New Chat");
    }
    await persistChat(chat);
  } catch (err) {
    state.isStreaming = false;
    updateComposerState();
    console.error("Could not start the chat", err);
    showToast("Could not start the chat. Please try again.");
    return;
  }

  renderActiveChat();
  renderChatList();

  state.activeRequestChatId = chat.id;
  updateComposerState();
  showTyping();
  dom.streamStatus.hidden = false;
  beginStreamRender(chat.id);

  // Build context: system + recent messages from THIS chat only.
  const apiMessages = [{ role: SYSTEM_ROLE, content: SYSTEM_PROMPT }];
  const recent = chat.messages.slice(-MAX_CONTEXT_MESSAGES);
  for (const m of recent) {
    apiMessages.push({ role: m.role === USER_ROLE ? USER_ROLE : AI_ROLE, content: m.content });
  }

  const assistantMsg = { role: AI_ROLE, content: "", timestamp: Date.now() };
  chat.messages.push(assistantMsg);

  try {
    const res = await streamCompletion(apiMessages);
    // Final safety net: collapse any growing repeated stanzas so the saved
    // reply is a single clean response.
    const rawContent = res.content || "";
    // A few OpenAI-compatible gateways have been observed returning the
    // complete answer three times in one successful stream.  That is not a
    // transport retry, so provider fallback cannot help; collapse it before
    // saving or rendering the assistant message.
    const content = collapseRepeatedResponse(rawContent) ||
      cleanFinalResponse(rawContent) || rawContent;
    const usageTotal = res.usageTotal;
    assistantMsg.content = content || "No response.";
    chat.updatedAt = Date.now();
    await persistChat(chat);

    // Token accounting: use API usage when present, else estimate.
    const added = (typeof usageTotal === "number") ? usageTotal : estimateTokens(content);
    state.tokensUsed += added;
    await saveTokenState();
    if (state.tokensUsed >= TOKEN_LIMIT && !state.limitReached) {
      state.limitReached = true;
      state.isLocked = true;
      await saveTokenState();
      updateComposerState();
      broadcastTokenSync();
      showLock();
    }
  } catch (err) {
    if (assistantMsg.content === "") {
      const idx = chat.messages.indexOf(assistantMsg);
      if (idx > -1) chat.messages.splice(idx, 1);
      chat.updatedAt = Date.now();
      await persistChat(chat);
    }
    renderActiveChat();
    showFriendlyError(err);
  } finally {
    state.isStreaming = false;
    state.activeRequestChatId = null;
    removeTyping();
    dom.streamStatus.hidden = true;
    // Stop the live-stream painter BEFORE the final re-render below —
    // otherwise a pending rAF re-creates the stream bubble and the
    // response appears twice.
    endStreamRender();
    updateComposerState();
    renderChatList();
  }
  renderActiveChat();
}
async function persistChat(chat) {
  // Guard: if this chat was deleted mid-request, do not write it back.
  if (!getChat(chat.id)) return;
  try {
    await dbPut(HISTORY_STORE, chat);
  } catch (err) {
    console.warn("Failed to persist chat", err);
  }
}

/* ==========================================================
   9. API / STREAMING
   ----------------------------------------------------------
   POST to the configured provider (PRIMARY, then fallbacks) with
   Bearer auth and { stream: true }.
   Reads the body with ReadableStream + TextDecoder, parses SSE
   "data:" lines, tolerates malformed chunks, stops at "[DONE]".
   ========================================================== */
function mapApiError(status, providerName) {
  // Simple, user-friendly message for every error — no technical detail.
  return "Server error. Please try again.";
}

function showFriendlyError(err) {
  const msg = "Server error. Please try again.";
  showToast(msg, 5000);
  // Full details stay in the console for troubleshooting.
  console.debug("Request error:", err && err.message ? err.message : err, err);
}

function streamCompletion(apiMessages) {
  // Configured providers, tried in order: PRIMARY first, then fallbacks.
  const providers = API_PROVIDERS.filter(isProviderConfigured);

  return (async () => {
    let lastErr = null;
    const tried = [];

    for (const provider of providers) {
      const models = getProviderModels(provider);
      for (const model of models) {
        tried.push(provider.name + " / " + model);

        // Start each attempt with a clean slate: discard any partial
        // output the previous (failed) attempt left in the live bubble.
        streamContent = "";
        resetStreamBubble();

        try {
          const result = await streamWithProvider(apiMessages, provider, model);
          console.log("Umrani responded via provider '" + provider.name + "' (model '" + model + "').");
          return result;
        } catch (err) {
          lastErr = err;
          console.warn("Attempt '" + provider.name + "' / '" + model + "' failed, trying next:",
            err && (err.message || err.userMessage) ? (err.message || err.userMessage) : err);
        }
      }
    }

      // No attempts at all — nothing was configured properly.
      if (tried.length === 0) {
        throw { userMessage: "No AI provider is configured. Please set your API details in the configuration module." };
      }

      // Every provider AND every fallback model failed.
      const detail = tried.join(" → ");
      console.error("All AI attempts failed:", detail, lastErr);
      const fail = new Error("All AI attempts failed (" + detail + ").");
      // Surface the most actionable hint: the last failure's message,
      // otherwise a clear generic one.
      if (lastErr && lastErr.userMessage) {
        fail.userMessage = lastErr.userMessage;
      } else {
        fail.userMessage = "All AI services are currently unavailable. Please try again in a moment.";
      }
      throw fail;
  })();
}

// Send one request to one provider using one model, and stream the reply.
// Resolves { content, usageTotal } or rejects on HTTP / network / timeout.
function streamWithProvider(apiMessages, provider, model) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    state.controller = controller;
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    fetch(provider.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + provider.key },
      body: JSON.stringify({ model: model, messages: apiMessages, stream: true }),
      signal: controller.signal
    })
    .then(async (res) => {
      if (!res.ok) {
        let status = res.status;
        try {
          const j = await res.json().catch(() => null);
          if (j && j.error && j.error.message) {
            reject({ userMessage: mapApiError(status, provider.name) + " (" + status + ")", status });
            return;
          }
        } catch (e) { /* ignore */ }
        reject({ userMessage: mapApiError(status, provider.name), status });
        return;
      }
      if (!res.body || !res.body.getReader) {
        // No stream available: read full JSON body.
        try {
          const j = await res.json();
          const content = (j.choices && j.choices[0] && j.choices[0].message
            ? j.choices[0].message.content : "") || "";
          const usage = (j.usage && j.usage.total_tokens) || null;
          clearTimeout(timeout);
          resolve({ content, usageTotal: usage });
        } catch (e) {
          clearTimeout(timeout);
          reject(new Error("Invalid JSON from AI service"));
        }
        return;
      }
      // Streaming SSE parse.
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buf = "";
      let content = "";
      let usageTotal = null;
      let settled = false;      // true once this attempt has finished
      let lastRepCheckLen = 0;  // guard throttle: content length last checked

      // ONE callback for every parsed SSE payload — used by the mid-stream
      // loop and the tail flush, so a delta can never be appended twice.
      const onParsed = function (delta, usage) {
        if (settled) return;
        if (delta) {
          removeTyping(); // typing dots never linger while content is flowing
          const kind = classifyChunk(delta, content);
          if (kind === "cumulative") {
            // Server sent "everything so far + new text" — REPLACE.
            content = delta;
            streamContent = content;
            updateStreamBubble();
          } else if (kind !== "duplicate") {
            content += delta;      // append only the NEW delta
            streamingTick(delta);  // render into the SAME streaming bubble
          }
          // "duplicate" chunks (identical re-sends) are ignored.
          guardAgainstRepetition();
        }
        if (typeof usage === "number") usageTotal = usage;
      };

      // Stop runaway repetition: some servers repeat the same sentence
      // many times inside one stream. Keep the text up to the first
      // occurrence, stop reading, and resolve with the clean content.
      function guardAgainstRepetition() {
        if (settled) return;
        if (content.length - lastRepCheckLen < 64) return; // throttle
        lastRepCheckLen = content.length;
        const trimmed = collapseRepeatedResponse(content) ||
          trimRunawayRepetition(content) || cleanFinalResponse(content);
        if (!trimmed) return;
        settled = true;
        try { controller.abort(); } catch (e) { /* reader will error */ }
        clearTimeout(timeout);
        content = trimmed;
        streamContent = trimmed;      // same bubble now shows the clean text
        updateStreamBubble();
        console.warn("Umrani: repeated text detected in the AI response; trimmed to the first occurrence.");
        resolve({ content: trimmed, usageTotal });
      }

      (async function pump() {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done || settled) break;
            buf += decoder.decode(value, { stream: true });
            let nlIdx;
            while ((nlIdx = buf.indexOf("\n")) !== -1 && !settled) {
              const line = buf.slice(0, nlIdx).trim();
              buf = buf.slice(nlIdx + 1);
              if (!line || !line.startsWith("data:")) continue;
              const payload = line.slice(5).trim();
              if (payload === "[DONE]") { continue; }
              parseChunk(payload, onParsed);
            }
            if (settled || buf.indexOf("[DONE]") !== -1) { buf = ""; break; }
          }
          if (!settled && buf.trim()) {
            const payload = buf.trim().startsWith("data:") ? buf.trim().slice(5).trim() : buf.trim();
            if (payload && payload !== "[DONE]") {
              parseChunk(payload, onParsed);
            }
          }
          clearTimeout(timeout);
          if (!settled) resolve({ content, usageTotal });
        } catch (err) {
          clearTimeout(timeout);
          if (settled) return; // repetition guard already resolved this request
          // Normalise timeouts/aborts so the fallback can try the next provider.
          if (err && err.name === "AbortError") {
            reject({ name: "AbortError", userMessage: "The AI service took too long to respond." });
          } else {
            reject(err);
          }
        }
      })();
    })
    .catch((err) => {
      clearTimeout(timeout);
      if (!err || typeof err !== "object") { reject(new Error(String(err))); return; }
      // fetch() rejects with a TypeError like "Failed to fetch" — make it
      // friendly so the fallback loop can surface a meaningful final message.
      if (!err.userMessage) {
        const raw = err.message || "";
        if (/failed to fetch|networkerror|load failed/i.test(raw)) {
          reject({ name: (err && err.name) || "FetchError", userMessage: "Could not reach this AI service. Trying the next option." });
        } else {
          reject(err);
        }
      } else {
        reject(err);
      }
    });
  });
}

// Remove any live streaming bubble so the next provider starts empty.
function resetStreamBubble() {
  const el = document.getElementById(STREAM_MESSAGE_ELEMENT_ID);
  if (el && el.parentNode) el.parentNode.removeChild(el);
}

// Parse one SSE data payload safely. callback(delta, usageTotal)
function parseChunk(payload, cb) {
  try {
    const obj = JSON.parse(payload);
    let delta = null;
    if (obj.choices && obj.choices[0] && obj.choices[0].delta) {
      delta = obj.choices[0].delta.content || "";
    }
    if (obj.choices && obj.choices[0] && obj.choices[0].message && !delta) {
      delta = obj.choices[0].message.content || ""; // non-stream fallback
    }
    if (typeof delta !== "string" || !delta) delta = null;
    const usage = (obj.usage && typeof obj.usage.total_tokens === "number")
      ? obj.usage.total_tokens : null;
    cb(delta, usage);
  } catch (e) {
    console.debug("Malformed SSE chunk skipped:", payload);
    cb(null, null);
  }
}
/* ==========================================================
   Streaming render hooks (incremental typewriter style)
   ----------------------------------------------------------
   appends deltas to the ACTIVE chat's last AI bubble using the
   safe markdown renderer; if the user switched chat mid-stream,
   content keeps accumulating in memory and is saved to the correct
   chat when the request finishes (never attached to the wrong chat).
   ========================================================== */
let streamContent = "";
let streamChatId = null;
let streamRafPending = false;
let lastStreamRender = 0;
let streamActive = false; // true only while a response is being streamed
const STREAM_RENDER_INTERVAL_MS = 60; // throttle full markdown re-renders

function beginStreamRender(chatId) {
  streamChatId = chatId;
  streamContent = "";
  streamRafPending = false;
  lastStreamRender = 0;
  streamActive = true;
}

// Called once a request has fully finished (success or failure). After
// this, NO pending rAF may paint or re-create the live bubble — that
// stale paint used to duplicate the whole response after renderActiveChat.
function endStreamRender() {
  streamActive = false;
  streamRafPending = false;
}

function streamingTick(delta) {
  streamContent += delta;
  removeTyping();
  if (!streamActive) return;
  if (state.currentChatId !== streamChatId) {
    // Streaming belongs to another chat — don't touch active chat DOM.
    return;
  }
  if (streamRafPending) return;
  streamRafPending = true;
  requestAnimationFrame(() => {
    streamRafPending = false;
    if (!streamActive) return; // stream already finished — stale paint
    const now = performance.now();
    // Throttle: skip if last paint was too recent. The final render
    // after the stream completes always paints the full content, so
    // nothing is ever lost by skipping.
    if (now - lastStreamRender < STREAM_RENDER_INTERVAL_MS) return;
    lastStreamRender = now;
    updateStreamBubble();
  });
}

function updateStreamBubble() {
  if (!streamActive) return; // never paint/re-create after the stream ended
  // Find or create the live streaming AI message element.
  let el = document.getElementById(STREAM_MESSAGE_ELEMENT_ID);
  if (!el) {
    el = document.createElement("div");
    el.className = "msg ai";
    el.id = "streamMsg";
    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.innerHTML =
      '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4z"/></svg>';
    const bubble = document.createElement("div");
    bubble.className = "bubble md";
    el.appendChild(avatar);
    el.appendChild(bubble);
    dom.messages.appendChild(el);
  }
  const bubble = el.querySelector(".bubble");
  if (!bubble) return;
  bubble.setAttribute("dir", isRtlText(streamContent) ? "rtl" : "ltr");
  while (bubble.firstChild) bubble.removeChild(bubble.firstChild);
  renderMarkdown(bubble, streamContent);
  scrollToBottom(false);
}

/* ==========================================================
   Lock UI (shown when the internal limit is reached)
   ----------------------------------------------------------
   Full-screen, LIGHT background. No token numbers anywhere.
   Reward unlocks ONLY from rewardedSlotGranted.
   ========================================================== */
function lockUI(locked) {
  state.isLocked = locked;
  updateComposerState();
}

function showLock() {
  dom.lockOverlay.hidden = false;
  dom.lockError.hidden = true;
  dom.watchAdBtn.disabled = !state.rewardedAdReady;
  if (!state.rewardedAdReady) {
    dom.watchAdBtn.textContent = "Loading ad…";
  } else {
    dom.watchAdBtn.textContent = "Watch Ad";
  }
  // Ensure a rewarded slot is requested once at limit time.
  prepareRewardedAd();
}

function hideLock() {
  dom.lockOverlay.hidden = true;
  // unlock the composer for the next message
  state.isLocked = false;
  updateComposerState();
  dom.messageInput.focus();
}

/* ==========================================================
   Multi-tab token sync (BroadcastChannel, browser-native)
   ----------------------------------------------------------
   Lets a reward granted in one tab unlock the app in other tabs,
   and prevents a stale (below-limit) tab from sending requests.
   ========================================================== */
let bc = null;
function initBroadcastChannel() {
  if (!("BroadcastChannel" in window)) return;
  try {
    bc = new BroadcastChannel("umrani-token-state");
    bc.onmessage = (e) => {
      if (!e || !e.data) return;
      if (e.data.type === "locked") {
        state.limitReached = true;
        state.isLocked = true;
        lockUI(true);
        showLock();
      } else if (e.data.type === "unlocked") {
        state.limitReached = false;
        state.tokensUsed = 0;
        state.isLocked = false;
        hideLock();
        updateComposerState();
        saveTokenState();
      }
    };
  } catch (err) {
    bc = null;
  }
}

function broadcastTokenSync() {
  if (!bc) return;
  try {
    bc.postMessage(state.limitReached ? { type: "locked" } : { type: "unlocked" });
  } catch (err) { /* ignore */ }
}
/* ==========================================================
   11. REWARDED ADS (Google Ad Manager, via Google Publisher Tag)
   ----------------------------------------------------------
   Genuine GPT rewarded web integration. Rules enforced here:
   - Only ONE rewarded slot request at a time.
   - "rewardedSlotReady" stores the event; nothing is granted yet.
   - User clicks "Watch Ad" -> evt.makeRewardedVisible().
   - "rewardedSlotGranted" is the ONLY path to reset tokens/unlock.
   - "rewardedSlotClosed" destroys the slot; no grant = stays locked.
   - No timers, no Continue button, no fake countdowns.
   - If GPT fails to load (ad blocker / network), show the ad-blocker
     message and keep the AI locked. We never bypass blockers.
   ========================================================== */
const ADBLOCKER_MSG = "Please disable your ad blocker to continue using Umrani. After disabling your ad blocker, refresh this page.";

function initGptRewarded() {
  if (!("googletag" in window) || !window.googletag || !window.googletag.cmd) {
    // GPT script blocked or failed: no rewarded capability.
    return;
  }
  window.googletag.cmd.push(function () {
    // Prepared lazily on demand (when lock screen appears) to avoid
    // unnecessary ad requests.
  });
}

function destroyRewardedSlot() {
  if (typeof state.killRewardedSlot === "function") {
    try { state.killRewardedSlot(); } catch (e) { /* ignore */ }
  }
  state.killRewardedSlot = null;
  state.rewardedAdEvent = null;
  state.rewardedAdReady = false;
  state.rewardedAdRequestActive = false;
  state.rewardGranted = false;
}

/* Request a rewarded slot ONCE. Guards against duplicate requests
   from repeated clicks / re-renders / repeated lock checks. */
function prepareRewardedAd() {
  if (state.rewardedAdRequestActive || state.rewardedAdReady) return;

  // Honest handling: without real Ad Manager values, ads cannot load.
  if (GOOGLE_AD_MANAGER_NETWORK_CODE.indexOf("YOUR_") === 0 ||
      REWARDED_AD_UNIT_PATH.indexOf("YOUR_") === 0) {
    state.rewardedAdReady = false;
    showAdProblem("Rewarded ads are not configured yet. The developer must add their Google Ad Manager network code and rewarded ad unit in the configuration module.");
    return;
  }
  if (!window.googletag || !window.googletag.cmd) {
    showAdBlockerMessage();
    return;
  }

  state.rewardedAdRequestActive = true;

  window.googletag.cmd.push(() => {
    try {
      const slot = googletag.defineOutOfPageSlot(
        REWARDED_AD_UNIT_PATH,
        googletag.enums.OutOfPageFormat.REWARDED
      );
      if (!slot) {
        state.rewardedAdRequestActive = false;
        showAdProblem("The rewarded ad slot could not be created. Please check your Ad Manager ad unit path in the configuration module.");
        return;
      }
      slot.addService(googletag.pubads());

      const onReady = (evt) => {
        if (evt && evt.slot && evt.slot !== slot) return;
        state.rewardedAdReady = true;
        state.rewardedAdEvent = evt;
        state.rewardedAdRequestActive = false;
        if (!dom.lockOverlay.hidden) {
          dom.watchAdBtn.disabled = false;
          dom.watchAdBtn.textContent = "Watch Ad";
        }
      };
      const onGranted = (evt) => {
        if (evt && evt.slot && evt.slot !== slot) return;
        // ONLY genuine Google reward unlocks the AI.
        // Guard against duplicate/double reward events (rule: no double rewards).
        if (state.rewardGranted) return;
        state.rewardGranted = true;
        unlockAfterReward();
      };
      const onClosed = (evt) => {
        if (evt && evt.slot && evt.slot !== slot) return;
        // Clean up slot + listeners; keep locked unless granted.
        try { evt.destroySlot && evt.destroySlot(); } catch (e) { /* ignore */ }
        try {
          googletag.pubads().removeEventListener("rewardedSlotReady", onReady);
          googletag.pubads().removeEventListener("rewardedSlotGranted", onGranted);
          googletag.pubads().removeEventListener("rewardedSlotClosed", onClosed);
          googletag.pubads().removeEventListener("slotRenderEnded", onRenderEnded);
        } catch (e) { /* ignore */ }
        state.rewardedAdReady = false;
        state.rewardedAdRequestActive = false;
        if (!state.rewardGranted) {
          // Closed without reward: stay locked, allow a fresh request.
          if (!dom.lockOverlay.hidden) {
            dom.watchAdBtn.disabled = false;
            dom.watchAdBtn.textContent = "Watch Ad";
          }
          setTimeout(prepareRewardedAd, REWARDED_AD_FALLBACK_MS);
        }
        state.rewardGranted = false;
      };
      const onRenderEnded = (evt) => {
        if (!evt || evt.slot !== slot) return;
        // If this slot rendered EMPTY (no ad served), GPT gave us no
        // rewarded content to show — treat it as provider/ad-block
        // failure: stay locked, tell the user, allow one retry.
        if (evt && evt.slot === slot && !evt.isEmpty) return;
        state.rewardedAdReady = false;
        if (!state.rewardGranted && !dom.lockOverlay.hidden) {
          state.rewardedAdRequestActive = false;
          showAdBlockerMessage();
        }
      };

      googletag.pubads().addEventListener("rewardedSlotReady", onReady);
      googletag.pubads().addEventListener("rewardedSlotGranted", onGranted);
      googletag.pubads().addEventListener("rewardedSlotClosed", onClosed);
      googletag.pubads().addEventListener("slotRenderEnded", onRenderEnded);

      state.killRewardedSlot = function cleanup() {
        try {
          googletag.pubads().removeEventListener("rewardedSlotReady", onReady);
          googletag.pubads().removeEventListener("rewardedSlotGranted", onGranted);
          googletag.pubads().removeEventListener("rewardedSlotClosed", onClosed);
          googletag.pubads().removeEventListener("slotRenderEnded", onRenderEnded);
          googletag.destroySlots([slot]);
        } catch (e) { /* ignore */ }
      };

      googletag.pubads().enableSingleRequest();
      googletag.enableServices();
      googletag.display(slot);
    } catch (err) {
      console.warn("Rewarded ad error", err);
      state.rewardedAdRequestActive = false;
      showAdBlockerMessage();
    }
  });
}
/* Called ONLY from the genuine rewardedSlotGranted event. */
function unlockAfterReward() {
  state.tokensUsed = 0;
  state.limitReached = false;
  state.isLocked = false;
  saveTokenState();
  hideLock();
  updateComposerState();
  destroyRewardedSlot();
  broadcastTokenSync();
  showToast("You're all set — keep chatting!");
}

function showAdBlockerMessage() {
  state.rewardedAdReady = false;
  dom.watchAdBtn.disabled = true;
  dom.watchAdBtn.textContent = "Watch Ad";
  dom.lockError.textContent = ADBLOCKER_MSG;
  dom.lockError.hidden = false;
}

function showAdProblem(msg) {
  state.rewardedAdReady = false;
  dom.watchAdBtn.disabled = true;
  dom.lockError.textContent = msg;
  dom.lockError.hidden = false;
}

/* "Watch Ad" — user opt-in. Shows the real Google rewarded ad via
   the stored rewardedSlotReady event. No timers, no fake flows. */
function onWatchAdClick() {
  if (state.rewardedAdReady && state.rewardedAdEvent &&
      typeof state.rewardedAdEvent.makeRewardedVisible === "function") {
    dom.watchAdBtn.disabled = true;
    try {
      state.rewardedAdEvent.makeRewardedVisible();
    } catch (err) {
      console.warn("makeRewardedVisible failed", err);
      showAdBlockerMessage();
    }
    return;
  }
  // Ad not ready yet: request/prep it (single-flight guarded).
  if (!state.rewardedAdRequestActive) {
    dom.watchAdBtn.disabled = true;
    dom.watchAdBtn.textContent = "Loading ad…";
    prepareRewardedAd();
  }
}

/* ==========================================================
   12. VOICE INPUT (Web Speech API)
   ----------------------------------------------------------
   Starts only on explicit user action. Recognized text is placed
   into the composer for review BEFORE sending. Handles unsupported
   browsers and permission denial gracefully.
   ========================================================== */
let recognition = null;
let isListening = false;

function getSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  return SR ? new SR() : null;
}

function initVoice() {
  recognition = getSpeechRecognition();
  if (!recognition) {
    dom.micBtn.disabled = true;
    dom.micBtn.title = "Voice input is not supported in this browser";
    return;
  }
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = "en-US"; // user may speak Urdu/Roman Urdu; browsers with ur-PK will use it

  recognition.onstart = () => {
    isListening = true;
    dom.micBtn.classList.add("listening");
    dom.micBtn.setAttribute("aria-label", "Stop voice input");
    showToast("Listening… speak now", 1200);
  };

  recognition.onresult = (e) => {
    let text = "";
    for (let i = 0; i < e.results.length; i++) {
      if (e.results[i].isFinal) text += e.results[i][0].transcript;
    }
    text = text.trim();
    if (text) {
      const existing = dom.messageInput.value;
      dom.messageInput.value = existing ? existing + " " + text : text;
      dom.messageInput.dispatchEvent(new Event("input"));
      dom.messageInput.focus();
    }
  };

  recognition.onerror = (e) => {
    isListening = false;
    dom.micBtn.classList.remove("listening");
    dom.micBtn.setAttribute("aria-label", "Voice input");
    if (e && e.error === "not-allowed") {
      showToast("Microphone permission denied. Please allow microphone access to use voice input.");
    } else if (e && e.error === "no-speech") {
      showToast("No speech detected. Please try again.");
    } else if (e && e.error === "network") {
      showToast("Voice input needs an internet connection.");
    } else {
      showToast("Voice input could not start. Please try again.");
    }
  };

  recognition.onend = () => {
    isListening = false;
    dom.micBtn.classList.remove("listening");
    dom.micBtn.setAttribute("aria-label", "Voice input");
  };
}

function toggleVoice() {
  if (!recognition) {
    showToast("Voice input is not supported in this browser.");
    return;
  }
  if (isListening) {
    try { recognition.stop(); } catch (e) { /* ignore */ }
    return;
  }
  try {
    recognition.start();
  } catch (err) {
    // start() can throw if already active
    showToast("Voice input is already active.");
  }
}
/* ==========================================================
   13. EVENT LISTENERS
   ========================================================== */
function autoGrowInput() {
  const ta = dom.messageInput;
  ta.style.height = "auto";
  ta.style.height = Math.min(ta.scrollHeight, 180) + "px";
  updateComposerState();
}

function initEventListeners() {
  // Composer input
  dom.messageInput.addEventListener("input", autoGrowInput);
  dom.messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!dom.sendBtn.disabled) sendMessage();
    }
  });
  dom.sendBtn.addEventListener("click", sendMessage);

  // Sidebar / drawer — the 3-line menu button toggles open/closed.
  dom.menuBtn.addEventListener("click", toggleSidebar);
  dom.sidebarClose.addEventListener("click", closeSidebar);
  dom.overlay.addEventListener("click", closeSidebar);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeSidebar();
    }
  });

  // New chat
  dom.newChatBtn.addEventListener("click", () => {
    if (state.isStreaming) {
      showToast("Please wait for the current reply to finish.");
      return;
    }
    createChat();
  });

  // Search (local only)
  dom.searchChats.addEventListener("input", () => {
    renderChatList(dom.searchChats.value);
  });

  // Voice
  dom.micBtn.addEventListener("click", toggleVoice);

  // Rewarded ad
  dom.watchAdBtn.addEventListener("click", onWatchAdClick);

  // Scroll awareness (auto-scroll pause when reading up)
  dom.chatArea.addEventListener("scroll", markUserScroll);

  // Warn before leaving mid-stream? Not required; skip confirm dialogs.

  // Window online/offline toasts
  window.addEventListener("offline", () => showToast("You are offline. Please check your internet connection."));
  window.addEventListener("online", () => showToast("Back online."));
}
/* ==========================================================
   14. INITIALIZATION
   ----------------------------------------------------------
   Order: DOM -> IndexedDB -> token state -> chats -> restore
   chat -> listeners -> voice -> GPT stub -> render.
   Any failure degrades gracefully with a friendly message.
   ========================================================== */
async function init() {
  initDom();

  try {
    await openDB();
  } catch (err) {
    console.warn("IndexedDB unavailable:", err);
    // App still renders; persistence features degrade gracefully.
  }

  if (state.dbReady) {
    await loadTokenState();   // restores lock state across refresh
    await loadChats();
    await restoreLastChat();
  }

  initEventListeners();
  initVoice();
  initBroadcastChannel();
  initGptRewarded();

  renderChatList();
  renderActiveChat();
  updateComposerState();
  autoGrowInput();

  if (state.isLocked || state.limitReached) {
    showLock();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    init().catch((err) => {
      console.error("Init failed", err);
      showToast("Umrani had trouble starting. Please refresh the page.");
    });
  });
} else {
  init().catch((err) => {
    console.error("Init failed", err);
    showToast("Umrani had trouble starting. Please refresh the page.");
  });
}













