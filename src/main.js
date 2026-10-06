/* ==========================================================
   Umrani — app.js
   Frontend-only AI chatbot. Vanilla JS. IndexedDB persistence.
   Adsterra display ad break after every two complete chat cycles.
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
    10. Two-chat ad breaks
    12. Voice input
    13. Event listeners
    14. Initialization
   ========================================================== */

import {
  API_PROVIDERS, APP_NAME,
  SYSTEM_PROMPT, REQUEST_TIMEOUT_MS
} from "./config/config.js";
import { makeId, isRtlText } from "./utils/helpers.js";
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
  SEND_BUTTON_ELEMENT_ID, MIC_BUTTON_ELEMENT_ID, ATTACH_BUTTON_ELEMENT_ID,
  FILE_INPUT_ELEMENT_ID, ATTACHMENT_BAR_ELEMENT_ID,
  ATTACHMENT_NAME_ELEMENT_ID, ATTACHMENT_REMOVE_BUTTON_ELEMENT_ID
} from "./ui/chat.js";
import { STREAM_MESSAGE_ELEMENT_ID } from "./ui/messages.js";
import { AD_BLOCK_WARNING_ELEMENT_ID } from "./ui/modal.js";
import { TOAST_ELEMENT_ID } from "./ui/notifications.js";
import { initAdsterraCloseButton } from "./ui/ads.js";

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
    !provider.url.includes("YOUR_") &&
    typeof provider.key === "string" &&
    provider.key.length > 0 &&
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
  dom.attachBtn = document.getElementById(ATTACH_BUTTON_ELEMENT_ID);
  dom.fileInput = document.getElementById(FILE_INPUT_ELEMENT_ID);
  dom.attachmentBar = document.getElementById(ATTACHMENT_BAR_ELEMENT_ID);
  dom.attachmentName = document.getElementById(ATTACHMENT_NAME_ELEMENT_ID);
  dom.attachmentRemoveBtn = document.getElementById(ATTACHMENT_REMOVE_BUTTON_ELEMENT_ID);
  dom.adBlockWarning = document.getElementById(AD_BLOCK_WARNING_ELEMENT_ID);
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
  adBreakActive: false,
  pendingAdBreak: false,
  adCloseScheduled: false,
  adCloseAllowedAt: 0,
  repliesSinceAd: 0,
  adBlockDetected: null,
  pendingAttachment: null,
  activeRequestChatId: null,
  controller: null,        // AbortController for current request
};

const SOCIAL_BAR_SRC = "https://bauval.org/14/a67c4a1da3645718e3483de61514fbe8";
const POPUNDER_SRC = "https://abscloud.org/1/1082f6d1e3a685e366e87a1a8c047da9";
const NATIVE_BANNER_SRC = "https://bauval.org/21/63ea484e1a293480518c8d527b5e81e3";
const DESKTOP_AD_MIN_WIDTH = 901;

// Load exactly one Social Bar script on desktop and mobile.
function loadSocialBar() {
  if (document.getElementById("adsterraSocialBarScript")) return;

  const script = document.createElement("script");
  script.id = "adsterraSocialBarScript";
  script.async = true;
  script.dataset.cfasync = "false";
  script.src = SOCIAL_BAR_SRC;
  document.head.appendChild(script);
}

// Popunder is a desktop-only format. The provider controls when it opens;
// this code only installs its official script once and never simulates clicks.
function loadDesktopPopunder() {
  if (window.innerWidth < DESKTOP_AD_MIN_WIDTH) return;
  if (document.getElementById("adsterraPopunderScript")) return;

  const script = document.createElement("script");
  script.id = "adsterraPopunderScript";
  script.async = true;
  script.dataset.cfasync = "false";
  script.src = POPUNDER_SRC;
  document.head.appendChild(script);
}

// Chrome can calculate a zero-width native widget when its script runs while
// the parent has [hidden]. Load the official script only after the inline ad
// shell is visible and has a real layout width.
function ensureNativeBannerLoaded() {
  const shell = document.getElementById("adsterraAdShell");
  const container = document.getElementById("container-63ea484e1a293480518c8d527b5e81e3");
  if (!shell || !container || shell.hidden) return;

  const status = window.__umraniAdsterraStatus || "idle";
  const oldScript = document.getElementById("adsterraNativeBannerScript");
  if (status === "loaded") {
    state.adBlockDetected = false;
    updateAdBreakWarning();
    scheduleAdClose();
    return;
  }
  if (status === "loading") return;
  if (oldScript) oldScript.remove();

  state.adBlockDetected = null;
  updateAdBreakWarning();
  window.__umraniAdsterraStatus = "loading";

  const script = document.createElement("script");
  script.id = "adsterraNativeBannerScript";
  script.async = true;
  script.dataset.cfasync = "false";
  script.src = NATIVE_BANNER_SRC;
  script.onload = () => {
    window.__umraniAdsterraStatus = "loaded";
    state.adBlockDetected = false;
    updateAdBreakWarning();
    scheduleAdClose();
  };
  script.onerror = () => {
    window.__umraniAdsterraStatus = "error";
    state.adBlockDetected = true;
    state.adCloseAllowedAt = 0;
    updateAdBreakWarning();
    const closeButton = document.getElementById("adsterraCloseButton");
    if (closeButton) closeButton.hidden = true;
  };
  shell.insertBefore(script, container);
}

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
   10. TWO-CHAT AD COUNTER
   ----------------------------------------------------------
   One chat cycle means one user message plus one successful AI reply.
   After two cycles, reset the counter and display one Adsterra break.
   The counter persists across refreshes in localStorage.
   ========================================================== */
const AD_REPLY_COUNTER_KEY = "umrani-replies-since-ad";
const AD_PENDING_KEY = "umrani-ad-pending";

function loadAdReplyCounter() {
  try {
    const saved = Number(localStorage.getItem(AD_REPLY_COUNTER_KEY));
    state.repliesSinceAd = Number.isFinite(saved)
      ? Math.max(0, Math.min(1, Math.floor(saved)))
      : 0;
    state.pendingAdBreak = localStorage.getItem(AD_PENDING_KEY) === "1";
  } catch {
    state.repliesSinceAd = 0;
    state.pendingAdBreak = false;
  }
}

function saveAdReplyCounter() {
  try {
    localStorage.setItem(AD_REPLY_COUNTER_KEY, String(state.repliesSinceAd));
  } catch {
    // The in-memory counter still works when storage is unavailable.
  }
}

function savePendingAd(pending) {
  state.pendingAdBreak = pending;
  try {
    if (pending) localStorage.setItem(AD_PENDING_KEY, "1");
    else localStorage.removeItem(AD_PENDING_KEY);
  } catch {
    // In-memory enforcement remains active if storage is unavailable.
  }
}

function recordSuccessfulReply() {
  state.repliesSinceAd += 1;
  if (state.repliesSinceAd >= 2) {
    state.repliesSinceAd = 0;
    saveAdReplyCounter();
    savePendingAd(true);
    // Insert the inline card only after the final chat re-render completes.
    return;
  }
  saveAdReplyCounter();
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
      '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4.5h6V7M18.5 7l-.7 13H6.2L5.5 7M10 11v5M14 11v5"/></svg>';
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
      '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.3 4.1a5.2 5.2 0 0 1-3.6 3.6L3 12l4.1 1.3a5.2 5.2 0 0 1 3.6 3.6L12 21l1.3-4.1a5.2 5.2 0 0 1 3.6-3.6L21 12l-4.1-1.3a5.2 5.2 0 0 1-3.6-3.6L12 3Z"/></svg>';
    wrap.appendChild(avatar);
  }

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  const content = String(msg.content || "");
  bubble.setAttribute("dir", isRtlText(content) ? "rtl" : "ltr");

  if (msg.role === USER_ROLE) {
    bubble.textContent = content;
    if (msg.attachment && msg.attachment.name) {
      const fileChip = document.createElement("div");
      fileChip.className = "message-attachment";
      fileChip.textContent = `📎 ${msg.attachment.name} (${formatBytes(msg.attachment.size || 0)})`;
      fileChip.title = msg.attachment.name;
      bubble.appendChild(fileChip);
    }
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
  let codeIndex = 0;

  // Split into fenced code blocks vs. text runs.
  for (; i < lines.length; i++) {
    const lm = lines[i].match(/^\s*```([\w+.#-]*)\s*$/);
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
      codeIndex += 1;
      targetEl.appendChild(
        createCodeBlock(b.lang, b.lines.join("\n"), codeIndex)
      );
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
function codeFileInfo(lang, index) {
  const key = String(lang || "").trim().toLowerCase().replace(/^\./, "");
  const extensions = {
    javascript: "js", js: "js", node: "js",
    typescript: "ts", ts: "ts",
    python: "py", py: "py",
    html: "html", css: "css", json: "json",
    jsx: "jsx", tsx: "tsx",
    java: "java", c: "c", "c++": "cpp", cpp: "cpp",
    csharp: "cs", "c#": "cs", cs: "cs",
    php: "php", ruby: "rb", rb: "rb",
    go: "go", golang: "go", rust: "rs", rs: "rs",
    swift: "swift", kotlin: "kt", kt: "kt",
    sql: "sql", shell: "sh", bash: "sh", sh: "sh",
    powershell: "ps1", ps1: "ps1",
    yaml: "yml", yml: "yml", xml: "xml",
    markdown: "md", md: "md",
    svg: "svg", vue: "vue", svelte: "svelte",
    dart: "dart", lua: "lua", perl: "pl", r: "r",
    text: "txt", txt: "txt", plaintext: "txt"
  };
  const safeUnknown = /^[a-z0-9]{1,10}$/.test(key) ? key : "txt";
  const extension = extensions[key] || safeUnknown;
  const mimeTypes = {
    js: "text/javascript", ts: "text/typescript", py: "text/x-python",
    html: "text/html", css: "text/css", json: "application/json",
    xml: "application/xml", svg: "image/svg+xml",
    md: "text/markdown", txt: "text/plain"
  };
  return {
    extension,
    filename: `code-${index}.${extension}`,
    mime: mimeTypes[extension] || "text/plain"
  };
}

function downloadCode(code, fileInfo) {
  const blob = new Blob([code], { type: `${fileInfo.mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileInfo.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Build a styled code block with language label, copy, download + collapse.
function createCodeBlock(lang, code, index = 1) {
  const wrap = document.createElement("div");
  wrap.className = "code-block";

  const head = document.createElement("div");
  head.className = "code-head";
  const label = document.createElement("span");
  label.textContent = lang ? lang : "code";
  const actions = document.createElement("div");
  actions.className = "code-actions";
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
  const fileInfo = codeFileInfo(lang, index);
  const downloadBtn = document.createElement("button");
  downloadBtn.className = "code-copy code-download";
  downloadBtn.type = "button";
  downloadBtn.textContent = "Download";
  downloadBtn.title = `Download ${fileInfo.filename}`;
  downloadBtn.addEventListener("click", () => {
    downloadCode(code, fileInfo);
    downloadBtn.textContent = "Downloaded";
    window.setTimeout(() => {
      downloadBtn.textContent = "Download";
    }, 1800);
  });

  const body = document.createElement("div");
  body.className = "code-body";
  body.textContent = code;

  head.appendChild(label);
  actions.appendChild(copyBtn);
  actions.appendChild(downloadBtn);
  head.appendChild(actions);
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

const MAX_UPLOAD_BYTES = 200 * 1024;
const MAX_UPLOAD_CHARS = 60000;
const TEXT_FILE_EXTENSIONS = new Set([
  "txt", "md", "markdown", "csv", "json", "xml", "html", "htm", "css",
  "js", "mjs", "cjs", "ts", "tsx", "jsx", "py", "java", "c", "h",
  "cpp", "cc", "cxx", "hpp", "cs", "php", "rb", "go", "rs", "swift",
  "kt", "kts", "sql", "sh", "bash", "ps1", "yml", "yaml", "svg",
  "vue", "svelte", "dart", "lua", "pl", "r", "ini", "toml", "log"
]);

function fileExtension(name) {
  const match = String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : "";
}

function formatBytes(bytes) {
  const value = Math.max(0, Number(bytes) || 0);
  if (value < 1024) return `${value} B`;
  return `${(value / 1024).toFixed(value < 10240 ? 1 : 0)} KB`;
}

function isSupportedTextFile(file) {
  const ext = fileExtension(file && file.name);
  return Boolean(
    file &&
    (
      String(file.type || "").startsWith("text/") ||
      ["application/json", "application/xml"].includes(file.type) ||
      TEXT_FILE_EXTENSIONS.has(ext)
    )
  );
}

function updateAttachmentBar() {
  const attachment = state.pendingAttachment;
  dom.attachmentBar.hidden = !attachment;
  dom.attachmentName.textContent = attachment
    ? `📎 ${attachment.name} · ${formatBytes(attachment.size)}`
    : "";
  updateComposerState();
}

function clearPendingAttachment() {
  state.pendingAttachment = null;
  dom.fileInput.value = "";
  updateAttachmentBar();
}

async function handleFileSelection(file) {
  if (!file) return;
  if (!isSupportedTextFile(file)) {
    dom.fileInput.value = "";
    showToast("These AI models accept text/code files only. Images, PDF and DOCX are not supported.");
    return;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    dom.fileInput.value = "";
    showToast("File is too large. Maximum supported size is 200 KB.");
    return;
  }
  try {
    const raw = await file.text();
    const truncated = raw.length > MAX_UPLOAD_CHARS;
    state.pendingAttachment = {
      name: file.name,
      type: file.type || "text/plain",
      extension: fileExtension(file.name) || "txt",
      size: file.size,
      content: raw.slice(0, MAX_UPLOAD_CHARS),
      truncated
    };
    updateAttachmentBar();
    if (truncated) showToast("File was truncated to 60,000 characters.");
  } catch (err) {
    dom.fileInput.value = "";
    showToast("Could not read this file.");
  }
}

function attachmentForApi(attachment) {
  if (!attachment) return "";
  const safeName = String(attachment.name || "attachment.txt").replace(/[<>]/g, "");
  const note = attachment.truncated
    ? "\n[The file was truncated by the client.]"
    : "";
  return `\n\n<attached_file name="${safeName}" type="${attachment.type}">\n${attachment.content}${note}\n</attached_file>`;
}

/* ---------- Composer enable/disable ---------- */
function updateComposerState() {
  const locked = state.adBreakActive;
  // Typing stays possible while streaming; only SENDING is blocked
  // (prevents duplicate sends without freezing the composer).
  dom.messageInput.disabled = locked;
  const lockedMessage = "Advertisement — please wait";
  dom.messageInput.placeholder = locked ? lockedMessage : "Ask anything…";
  dom.messageInput.setAttribute(
    "aria-label",
    locked ? lockedMessage : "Message"
  );
  const canSend = !locked && !state.isStreaming &&
    (dom.messageInput.value.trim().length > 0 || Boolean(state.pendingAttachment));
  dom.sendBtn.disabled = !canSend;
  dom.sendBtn.title = locked ? lockedMessage : "Send message";
  dom.attachBtn.disabled = locked || state.isStreaming;
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
  const attachment = state.pendingAttachment
    ? { ...state.pendingAttachment }
    : null;

  if (!text && !attachment) {
    showToast("Please type a message or attach a text/code file.");
    return;
  }
  if (state.isStreaming) {
    showToast("Please wait for the current reply to finish.");
    return;
  }
  if (state.adBreakActive) {
    showAdBreak();
    return;
  }
  if (state.pendingAdBreak) {
    showAdBreak();
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
  state.pendingAttachment = null;
  dom.fileInput.value = "";
  updateAttachmentBar();
  dom.sendBtn.disabled = true;
  autoGrowInput(); // reset the composer height + composer state immediately

  let chat;
  try {
    chat = getChat(state.currentChatId);
    if (!chat) {
      chat = await createChat();
    }
    if (!state.currentChatId) state.currentChatId = chat.id;

    const displayText = text || `Please analyze ${attachment.name}`;
    const userMsg = {
      role: USER_ROLE,
      content: displayText,
      timestamp: Date.now(),
      attachment
    };

    chat.messages.push(userMsg);
    chat.updatedAt = Date.now();
    if (!chat.title || chat.title === "New Chat") {
      chat.title = makeTitle(text || (attachment && attachment.name) || "New Chat");
    }
    await persistChat(chat);
  } catch (err) {
    state.isStreaming = false;
    state.pendingAttachment = attachment;
    updateAttachmentBar();
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
    const role = m.role === USER_ROLE ? USER_ROLE : AI_ROLE;
    const content = role === USER_ROLE
      ? String(m.content || "") + attachmentForApi(m.attachment)
      : m.content;
    apiMessages.push({ role, content });
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
    assistantMsg.content = content || "No response.";
    chat.updatedAt = Date.now();
    await persistChat(chat);

    // Every second successful AI reply completes two chat cycles.
    recordSuccessfulReply();
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
  if (state.pendingAdBreak) {
    state.pendingAdBreak = false;
    showAdBreak();
  }
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
  if (status === 429) return "This AI provider is temporarily rate-limited.";
  return "Server error. Please try again.";
}

function showFriendlyError(err) {
  const msg = (err && err.userMessage) || "Server error. Please try again.";
  showToast(msg, 5000);
  // Full details stay in the console for troubleshooting.
  console.debug("Request error:", err && err.message ? err.message : err, err);
}

function streamCompletion(apiMessages) {
  // Immediate model fallback:
  // DeepSeek gets ONE attempt. If it fails, switch directly to GLM;
  // if GLM fails, switch directly to MiniMax. Only after all three
  // models fail do we move to the next provider/account and repeat.
  const providers = API_PROVIDERS.filter(isProviderConfigured);

  return (async () => {
    let lastErr = null;
    const tried = [];

    for (const provider of providers) {
      for (const model of getProviderModels(provider)) {
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
          console.warn("Attempt '" + provider.name + "' / '" + model + "' failed; switching model:",
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
    const headers = { "Content-Type": "application/json" };
    if (provider.key) headers.Authorization = "Bearer " + provider.key;

    fetch(provider.url, {
      method: "POST",
      headers,
      body: JSON.stringify({ model: model, messages: apiMessages, stream: true }),
      signal: controller.signal
    })
    .then(async (res) => {
      if (!res.ok) {
        let status = res.status;
        try {
          const j = await res.json().catch(() => null);
          if (j && j.error && j.error.message) {
            reject({
              userMessage: status === 429 ? j.error.message : mapApiError(status, provider.name),
              status,
              code: j.error.code || null
            });
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
      '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.3 4.1a5.2 5.2 0 0 1-3.6 3.6L3 12l4.1 1.3a5.2 5.2 0 0 1 3.6 3.6L12 21l1.3-4.1a5.2 5.2 0 0 1 3.6-3.6L21 12l-4.1-1.3a5.2 5.2 0 0 1-3.6-3.6L12 3Z"/></svg>';
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
   10. TWO-CHAT AD BREAK UI
   ----------------------------------------------------------
   An inline ad card appears between messages after every two
   complete chat cycles. No full-screen overlay is used.
   ========================================================== */
function updateAdBreakWarning() {
  if (!dom.adBlockWarning) return;
  dom.adBlockWarning.hidden = !state.adBlockDetected;
}

function scheduleAdClose() {
  if (!state.adBreakActive ||
      state.adBlockDetected !== false ||
      state.adCloseScheduled) return;
  const closeButton = document.getElementById("adsterraCloseButton");
  const shell = document.getElementById("adsterraAdShell");
  if (!closeButton || !shell) return;

  state.adCloseScheduled = true;
  state.adCloseAllowedAt = Date.now() + 500;
  window.setTimeout(() => {
    if (!state.adBreakActive || state.adBlockDetected) return;
    closeButton.hidden = false;
    closeButton.focus({ preventScroll: true });
    shell.classList.remove("adsterra-ad-highlight");
  }, 500);
}

function showAdBreak() {
  const wasActive = state.adBreakActive;
  savePendingAd(true);
  state.adBreakActive = true;
  updateComposerState();
  updateAdBreakWarning();

  // Do not restart the 0.5-second close delay while this inline ad is active.
  if (wasActive) return;

  const shell = document.getElementById("adsterraAdShell");
  const closeButton = document.getElementById("adsterraCloseButton");
  if (!shell || !closeButton) {
    showToast("Advertisement is unavailable. You can continue chatting.");
    finishAdBreak();
    return;
  }

  // Insert the reusable ad shell directly after the latest chat messages.
  dom.messages.appendChild(shell);
  shell.hidden = false;
  shell.classList.add("inline-ad-mode", "adsterra-ad-highlight");
  closeButton.hidden = true;
  shell.scrollIntoView({ behavior: "smooth", block: "center" });
  // Wait two paint frames so Chrome has measured the visible container
  // before Adsterra builds its image/card layout.
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(ensureNativeBannerLoaded);
  });
}

function finishAdBreak(clearPending = true) {
  state.adBreakActive = false;
  state.adCloseScheduled = false;
  state.adCloseAllowedAt = 0;
  if (clearPending) savePendingAd(false);
  updateComposerState();
  dom.messageInput.focus();
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
  dom.attachBtn.addEventListener("click", () => {
    if (!dom.attachBtn.disabled) dom.fileInput.click();
  });
  dom.fileInput.addEventListener("change", () => {
    handleFileSelection(dom.fileInput.files && dom.fileInput.files[0]);
  });
  dom.attachmentRemoveBtn.addEventListener("click", clearPendingAttachment);

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

  // Closing the automatically shown ad ends only this short ad break.
  document.addEventListener("umrani:display-ad-closed", () => {
    if (!state.adBreakActive) return;
    const allowed = state.adBlockDetected === false &&
      state.adCloseAllowedAt > 0 &&
      Date.now() >= state.adCloseAllowedAt;
    if (!allowed) {
      // Ignore scripted/early closes and restore the required inline ad.
      state.adBreakActive = false;
      state.adCloseScheduled = false;
      showAdBreak();
      showToast("Please wait for the advertisement.");
      return;
    }
    finishAdBreak();
  });
  // A pending ad created in another tab must also block this tab.
  window.addEventListener("storage", (event) => {
    if (event.key === AD_PENDING_KEY && event.newValue === "1") {
      savePendingAd(true);
      if (!state.adBreakActive) showAdBreak();
    }
  });

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
   chat -> listeners -> voice -> render.
   Any failure degrades gracefully with a friendly message.
   ========================================================== */
async function init() {
  initDom();
  loadAdReplyCounter();
  loadSocialBar();
  loadDesktopPopunder();

  try {
    await openDB();
  } catch (err) {
    console.warn("IndexedDB unavailable:", err);
    // App still renders; persistence features degrade gracefully.
  }

  if (state.dbReady) {
    await loadChats();
    await restoreLastChat();
  }

  initEventListeners();
  initAdsterraCloseButton();
  initVoice();

  renderChatList();
  renderActiveChat();
  updateComposerState();
  autoGrowInput();
  if (state.pendingAdBreak) showAdBreak();

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













