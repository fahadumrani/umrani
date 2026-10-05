(() => {
  // umrani-v9-adsterra-scan/bolanai/src/api/models.js
  var PRIMARY_MODEL = "deepseek-ai/DeepSeek-V4-Flash-0731";
  var FALLBACK_MODEL = "zai-org/GLM-5.3-Flash";

  // umrani-v9-adsterra-scan/bolanai/src/api/endpoints.js
  var INFERENCE_BASE_URL = "https://inference.dahl.global";
  var CHAT_COMPLETIONS_PATH = "/v1/chat/completions";
  var CHAT_COMPLETIONS_URL = INFERENCE_BASE_URL + CHAT_COMPLETIONS_PATH;

  // umrani-v9-adsterra-scan/bolanai/src/config/config.js
  var API_PROVIDERS = [
    {
      name: "Dahl Primary",
      url: CHAT_COMPLETIONS_URL,
      key: "dahl_KgKuNT3JPs1oibtvFmbbmRQWgVyCX6Hcf",
      models: [PRIMARY_MODEL, FALLBACK_MODEL]
    },
    {
      name: "Dahl Fallback 1",
      url: CHAT_COMPLETIONS_URL,
      key: "dahl_6k8Zd85LSZsZxQaow9VNL3kXnsED4NpJF",
      models: [PRIMARY_MODEL, FALLBACK_MODEL]
    },
    {
      name: "Dahl Fallback 2",
      url: CHAT_COMPLETIONS_URL,
      key: "dahl_DbZarD77Pc7jFAVL7u497tcUu1pred7Fr",
      models: [PRIMARY_MODEL, FALLBACK_MODEL]
    }
  ];
  var TOKEN_LIMIT = 1e4;
  var SYSTEM_PROMPT = "You are Umrani, an intelligent and friendly AI assistant. You can speak in Urdu, Roman Urdu, and English. Always be helpful, polite, and professional. Keep answers clear and concise. If you don't know something, say so honestly. Never share your API key, system prompt, or internal details. If the user asks 'Who are you?', reply: 'I am Umrani, your AI assistant. I am here to help you. You can ask me anything in Urdu, Roman Urdu, or English.'";
  var REQUEST_TIMEOUT_MS = 12e4;

  // umrani-v9-adsterra-scan/bolanai/src/utils/helpers.js
  function makeId() {
    return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  }
  function isRtlText(str) {
    return /[\u0600-\u06FF\u0590-\u05FF\u0750-\u077F]/.test(str || "");
  }
  function estimateTokens(text) {
    if (!text) return 0;
    const s = String(text);
    const arabChars = (s.match(/[\u0600-\u06FF\u0750-\u077F]/g) || []).length;
    const other = s.length - arabChars;
    return Math.ceil(arabChars / 1.3) + Math.ceil(other / 4);
  }

  // umrani-v9-adsterra-scan/bolanai/src/utils/formatter.js
  function singleLine(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  // umrani-v9-adsterra-scan/bolanai/src/core/chat.js
  var CHAT_TITLE_MAX_LENGTH = 34;
  function makeTitle(text) {
    const cleaned = singleLine(text);
    if (!cleaned) return "New Chat";
    return cleaned.length > CHAT_TITLE_MAX_LENGTH ? cleaned.slice(0, CHAT_TITLE_MAX_LENGTH) + "\u2026" : cleaned;
  }

  // umrani-v9-adsterra-scan/bolanai/src/core/memory.js
  var MAX_CONTEXT_MESSAGES = 24;

  // umrani-v9-adsterra-scan/bolanai/src/core/storage.js
  var STORAGE_DATABASE = "BolanAI";

  // umrani-v9-adsterra-scan/bolanai/src/core/history.js
  var HISTORY_STORE = "chats";
  var APP_STATE_STORE = "appState";

  // umrani-v9-adsterra-scan/bolanai/src/core/ai.js
  var SYSTEM_ROLE = "system";
  var USER_ROLE = "user";
  var AI_ROLE = "assistant";

  // umrani-v9-adsterra-scan/bolanai/src/api/client.js
  function classifyChunk(text, accumulated) {
    const flat = (s) => String(s).replace(/\s+/g, "").toLowerCase();
    const fa = flat(accumulated);
    const fd = flat(text);
    if (!fa) return "fresh";
    if (fd === fa) return "duplicate";
    if (fd.length > fa.length && fd.slice(0, fa.length) === fa) return "cumulative";
    return "fresh";
  }
  function cleanFinalResponse(text) {
    const s = String(text);
    const flat = (x) => x.replace(/\s+/g, "").toLowerCase();
    const f = flat(s);
    if (f.length < 60) return null;
    const seg = s.match(/^[^\n.!?\u06D4]+[:!?\u06D4.]?\n?/);
    const openingRaw = (seg && seg[0] ? seg[0] : s.slice(0, 24)).trim();
    const opening = flat(openingRaw);
    if (opening.length < 12) return null;
    let occ = 0;
    let idx = f.indexOf(opening);
    while (idx !== -1 && occ < 30) {
      occ++;
      idx = f.indexOf(opening, idx + opening.length);
    }
    if (occ < 3) return null;
    let lastFlat = -1;
    let cur = f.indexOf(opening, 0);
    while (cur !== -1) {
      lastFlat = cur;
      const next = f.indexOf(opening, cur + opening.length);
      if (next === -1) break;
      cur = next;
    }
    let rawIdx = 0, count = 0;
    for (let i = 0; i < s.length; i++) {
      if (/\s/.test(s[i])) continue;
      if (count === lastFlat) {
        rawIdx = i;
        break;
      }
      count++;
    }
    const cut = s.slice(rawIdx);
    if (flat(cut).length >= f.length) return null;
    return cut;
  }
  function collapseRepeatedResponse(text) {
    const src = String(text || "");
    const normalised = src.replace(/\s+/g, "").toLowerCase();
    if (normalised.length < 12) return null;
    const rawOffsetForNormalisedIndex = (target) => {
      let seen = 0;
      for (let i = 0; i < src.length; i++) {
        if (/\s/.test(src[i])) continue;
        if (seen === target) return i;
        seen++;
      }
      return src.length;
    };
    const candidates = normalised.length % 3 === 0 ? [3] : [];
    if (normalised.length >= 80 && normalised.length % 2 === 0) {
      candidates.push(2);
    }
    for (const copies of candidates) {
      const unitLength = normalised.length / copies;
      if (unitLength < 12) continue;
      const unit = normalised.slice(0, unitLength);
      let repeated = true;
      for (let i = 1; i < copies; i++) {
        if (normalised.slice(i * unitLength, (i + 1) * unitLength) !== unit) {
          repeated = false;
          break;
        }
      }
      if (repeated) {
        return src.slice(0, rawOffsetForNormalisedIndex(unitLength)).trim();
      }
    }
    return null;
  }
  function trimRunawayRepetition(text) {
    const MIN_SENTENCE = 10;
    const REPEAT_LIMIT = 4;
    const src = String(text);
    const parts = src.split(/([.!?\u06D4]+[\s]*|\n+)/);
    let pos = 0;
    let prevNorm = null;
    let runNorm = null;
    let runCount = 0;
    let runFirstEnd = -1;
    for (let i = 0; i < parts.length; i += 2) {
      const unit = (parts[i] || "") + (parts[i + 1] || "");
      const start = pos;
      pos += unit.length;
      const norm = unit.replace(/\s+/g, "").toLowerCase();
      if (!norm) continue;
      if (norm === prevNorm) {
        runCount += 1;
      } else {
        runNorm = norm;
        runCount = 1;
        runFirstEnd = start + unit.length;
        prevNorm = norm;
      }
      if (runCount >= REPEAT_LIMIT && runNorm.length >= MIN_SENTENCE) {
        return src.slice(0, runFirstEnd);
      }
    }
    return null;
  }

  // umrani-v9-adsterra-scan/bolanai/src/ui/sidebar.js
  var SIDEBAR_ELEMENT_ID = "sidebar";
  var SIDEBAR_CLOSE_ELEMENT_ID = "sidebarClose";
  var MENU_BUTTON_ELEMENT_ID = "menuBtn";
  var NEW_CHAT_BUTTON_ELEMENT_ID = "newChatBtn";
  var SEARCH_CHATS_ELEMENT_ID = "searchChats";
  var CHAT_LIST_ELEMENT_ID = "chatList";

  // umrani-v9-adsterra-scan/bolanai/src/ui/chat.js
  var CHAT_AREA_ELEMENT_ID = "chatArea";
  var MESSAGES_ELEMENT_ID = "messages";
  var EMPTY_STATE_ELEMENT_ID = "emptyState";
  var STREAM_STATUS_ELEMENT_ID = "streamStatus";
  var COMPOSER_ELEMENT_ID = "composer";
  var MESSAGE_INPUT_ELEMENT_ID = "messageInput";
  var SEND_BUTTON_ELEMENT_ID = "sendBtn";
  var MIC_BUTTON_ELEMENT_ID = "micBtn";

  // umrani-v9-adsterra-scan/bolanai/src/ui/messages.js
  var STREAM_MESSAGE_ELEMENT_ID = "streamMsg";

  // umrani-v9-adsterra-scan/bolanai/src/ui/modal.js
  var LOCK_OVERLAY_ELEMENT_ID = "lockOverlay";
  var OPEN_DISPLAY_AD_BUTTON_ELEMENT_ID = "openDisplayAdBtn";
  var LOCK_MESSAGE_ELEMENT_ID = "lockMsg";
  var TOKEN_LIMIT_INFO_ELEMENT_ID = "tokenLimitInfo";

  // umrani-v9-adsterra-scan/bolanai/src/ui/notifications.js
  var TOAST_ELEMENT_ID = "toast";

  // umrani-v9-adsterra-scan/bolanai/src/ui/ads.js
  var CLOSED_KEY = "umrani-adsterra-closed";
  function initAdsterraCloseButton() {
    const shell = document.getElementById("adsterraAdShell");
    const closeButton = document.getElementById("adsterraCloseButton");
    if (!shell || !closeButton) return;
    closeButton.addEventListener("click", () => {
      shell.hidden = true;
      document.dispatchEvent(new CustomEvent("umrani:display-ad-closed"));
      try {
        sessionStorage.setItem(CLOSED_KEY, "1");
      } catch {
      }
    });
    try {
      if (sessionStorage.getItem(CLOSED_KEY) === "1") {
        shell.hidden = true;
      }
    } catch {
    }
  }

  // umrani-v9-adsterra-scan/bolanai/src/main.js
  function getProviderModels(provider) {
    if (!provider || !Array.isArray(provider.models)) return [];
    return provider.models.filter((model) => typeof model === "string" && !model.startsWith("YOUR_"));
  }
  function isProviderConfigured(provider) {
    return Boolean(
      provider && typeof provider.url === "string" && !provider.url.includes("YOUR_") && typeof provider.key === "string" && provider.key.length > 0 && getProviderModels(provider).length > 0
    );
  }
  var dom = {};
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
    dom.openDisplayAdBtn = document.getElementById(OPEN_DISPLAY_AD_BUTTON_ELEMENT_ID);
    dom.lockMsg = document.getElementById(LOCK_MESSAGE_ELEMENT_ID);
    dom.tokenLimitInfo = document.getElementById(TOKEN_LIMIT_INFO_ELEMENT_ID);
    dom.toast = document.getElementById(TOAST_ELEMENT_ID);
    dom.composer = document.getElementById(COMPOSER_ELEMENT_ID);
  }
  var state = {
    db: null,
    dbReady: false,
    currentChatId: null,
    chats: [],
    // cached chat summaries + full messages when active
    isStreaming: false,
    isLocked: false,
    tokensUsed: 0,
    limitReached: false,
    activeRequestChatId: null,
    controller: null
    // AbortController for current request
  };
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
      req.onsuccess = (e) => {
        state.db = e.target.result;
        state.dbReady = true;
        resolve(state.db);
      };
      req.onerror = (e) => {
        console.error("IndexedDB open error", e);
        reject(e);
      };
      req.onblocked = () => {
      };
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
      req.onsuccess = () => resolve(req.result == null ? void 0 : req.result);
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
  var toastTimer = null;
  function showToast(message, ms = 2800) {
    if (!dom.toast) return;
    dom.toast.textContent = message;
    dom.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      dom.toast.hidden = true;
    }, ms);
  }
  async function loadTokenState() {
    try {
      const rec = await dbGet(APP_STATE_STORE, "tokenState");
      if (rec) {
        state.tokensUsed = Math.max(0, Number(rec.tokensUsed) || 0);
        state.limitReached = !!rec.limitReached;
      }
    } catch (err) {
      console.warn("Failed to load token state", err);
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
    const chat = getChat(id);
    if (!chat) return;
    state.currentChatId = id;
    renderChatList();
    renderActiveChat();
    persistLastChat();
    updateComposerState();
    closeSidebar();
  }
  async function deleteChat(id) {
    const chat = getChat(id);
    if (!chat) return;
    const ok = await confirmDialog("Delete this chat? This cannot be undone.");
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
      del.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M10 11v6M14 11v6"/></svg>';
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
    }
  }
  async function restoreLastChat() {
    try {
      const rec = await dbGet(APP_STATE_STORE, "lastChatId");
      if (rec && rec.value && getChat(rec.value)) {
        state.currentChatId = rec.value;
      }
    } catch (err) {
    }
  }
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
      if (m.role === AI_ROLE && !m.content) continue;
      frag.appendChild(buildMessageEl(m));
    }
    msgsEl.appendChild(frag);
    scrollToBottom(false);
  }
  function buildMessageEl(msg) {
    const wrap = document.createElement("div");
    wrap.className = "msg " + (msg.role === USER_ROLE ? "user" : "ai");
    if (msg.role !== USER_ROLE) {
      const avatar = document.createElement("div");
      avatar.className = "avatar";
      avatar.setAttribute("aria-hidden", "true");
      avatar.innerHTML = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4z"/></svg>';
      wrap.appendChild(avatar);
    }
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    const content = String(msg.content || "");
    bubble.setAttribute("dir", isRtlText(content) ? "rtl" : "ltr");
    if (msg.role === USER_ROLE) {
      bubble.textContent = content;
    } else {
      renderMarkdown(bubble, content);
    }
    wrap.appendChild(bubble);
    return wrap;
  }
  function renderMarkdown(targetEl, text) {
    targetEl.classList.add("md");
    targetEl.textContent = "";
    const lines = String(text).split("\n");
    const blocks = [];
    let i = 0;
    let codeBuf = null;
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
      if (codeBuf) {
        codeBuf.lines.push(lines[i]);
        continue;
      }
      const prev = blocks[blocks.length - 1];
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
  function renderInlineBlocks(text) {
    const container = document.createElement("div");
    const lines = String(text).split("\n");
    let i = 0;
    let listEl = null;
    while (i < lines.length) {
      const t = lines[i].trim();
      if (!t) {
        listEl = null;
        i++;
        continue;
      }
      const h = t.match(/^#{1,6}\s+(.*)$/);
      if (h) {
        listEl = null;
        const hd = document.createElement("h3");
        appendInline(hd, h[1]);
        container.appendChild(hd);
        i++;
        continue;
      }
      if (/^>\s?/.test(t) && !/^>>/.test(t)) {
        listEl = null;
        const q = document.createElement("blockquote");
        appendInline(q, t.replace(/^>\s?/, ""));
        container.appendChild(q);
        i++;
        continue;
      }
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
      listEl = null;
      const paraLines = [t];
      i++;
      while (i < lines.length) {
        const nt = lines[i].trim();
        if (!nt || /^#{1,6}\s+/.test(nt) || /^>\s?/.test(nt) || /^[-*+]\s+/.test(nt) || /^\d+[.)]\s+/.test(nt)) {
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
        setTimeout(() => {
          copyBtn.textContent = "Copy";
        }, 1800);
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
  var userScrolledUp = false;
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
  function confirmDialog(message) {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
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
  function updateComposerState() {
    const locked = state.isLocked || state.limitReached;
    dom.messageInput.disabled = locked;
    dom.messageInput.placeholder = locked ? "Watch ad to continue" : "Ask anything\u2026";
    dom.messageInput.setAttribute(
      "aria-label",
      locked ? "Watch ad to continue" : "Message"
    );
    const canSend = !locked && !state.isStreaming && dom.messageInput.value.trim().length > 0;
    dom.sendBtn.disabled = !canSend;
    dom.sendBtn.title = locked ? "Watch ad to continue" : "Send message";
    if (locked) dom.composer.classList.add("locked");
    else dom.composer.classList.remove("locked");
  }
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
    state.isStreaming = true;
    state.activeRequestChatId = state.currentChatId || null;
    dom.messageInput.value = "";
    dom.sendBtn.disabled = true;
    autoGrowInput();
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
    const apiMessages = [{ role: SYSTEM_ROLE, content: SYSTEM_PROMPT }];
    const recent = chat.messages.slice(-MAX_CONTEXT_MESSAGES);
    for (const m of recent) {
      apiMessages.push({ role: m.role === USER_ROLE ? USER_ROLE : AI_ROLE, content: m.content });
    }
    const assistantMsg = { role: AI_ROLE, content: "", timestamp: Date.now() };
    chat.messages.push(assistantMsg);
    try {
      const res = await streamCompletion(apiMessages);
      const rawContent = res.content || "";
      const content = collapseRepeatedResponse(rawContent) || cleanFinalResponse(rawContent) || rawContent;
      const usageTotal = res.usageTotal;
      assistantMsg.content = content || "No response.";
      chat.updatedAt = Date.now();
      await persistChat(chat);
      const added = typeof usageTotal === "number" ? usageTotal : estimateTokens(content);
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
      if (err && err.code === "TOKEN_LIMIT_REACHED") {
        state.tokensUsed = TOKEN_LIMIT;
        state.limitReached = true;
        state.isLocked = true;
        await saveTokenState();
        broadcastTokenSync();
        showLock();
      }
      renderActiveChat();
      showFriendlyError(err);
    } finally {
      state.isStreaming = false;
      state.activeRequestChatId = null;
      removeTyping();
      dom.streamStatus.hidden = true;
      endStreamRender();
      updateComposerState();
      renderChatList();
    }
    renderActiveChat();
  }
  async function persistChat(chat) {
    if (!getChat(chat.id)) return;
    try {
      await dbPut(HISTORY_STORE, chat);
    } catch (err) {
      console.warn("Failed to persist chat", err);
    }
  }
  function mapApiError(status, providerName) {
    if (status === 429) return "This AI provider is temporarily rate-limited.";
    return "Server error. Please try again.";
  }
  function showFriendlyError(err) {
    const msg = err && err.userMessage || "Server error. Please try again.";
    showToast(msg, 5e3);
    console.debug("Request error:", err && err.message ? err.message : err, err);
  }
  function streamCompletion(apiMessages) {
    const providers = API_PROVIDERS.filter(isProviderConfigured);
    return (async () => {
      let lastErr = null;
      const tried = [];
      for (const provider of providers) {
        const models = getProviderModels(provider);
        for (const model of models) {
          tried.push(provider.name + " / " + model);
          streamContent = "";
          resetStreamBubble();
          try {
            const result = await streamWithProvider(apiMessages, provider, model);
            console.log("Umrani responded via provider '" + provider.name + "' (model '" + model + "').");
            return result;
          } catch (err) {
            lastErr = err;
            console.warn(
              "Attempt '" + provider.name + "' / '" + model + "' failed, trying next:",
              err && (err.message || err.userMessage) ? err.message || err.userMessage : err
            );
          }
        }
      }
      if (tried.length === 0) {
        throw { userMessage: "No AI provider is configured. Please set your API details in the configuration module." };
      }
      const detail = tried.join(" \u2192 ");
      console.error("All AI attempts failed:", detail, lastErr);
      const fail = new Error("All AI attempts failed (" + detail + ").");
      if (lastErr && lastErr.userMessage) {
        fail.userMessage = lastErr.userMessage;
      } else {
        fail.userMessage = "All AI services are currently unavailable. Please try again in a moment.";
      }
      throw fail;
    })();
  }
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
        body: JSON.stringify({ model, messages: apiMessages, stream: true }),
        signal: controller.signal
      }).then(async (res) => {
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
          } catch (e) {
          }
          reject({ userMessage: mapApiError(status, provider.name), status });
          return;
        }
        if (!res.body || !res.body.getReader) {
          try {
            const j = await res.json();
            const content2 = (j.choices && j.choices[0] && j.choices[0].message ? j.choices[0].message.content : "") || "";
            const usage = j.usage && j.usage.total_tokens || null;
            clearTimeout(timeout);
            resolve({ content: content2, usageTotal: usage });
          } catch (e) {
            clearTimeout(timeout);
            reject(new Error("Invalid JSON from AI service"));
          }
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buf = "";
        let content = "";
        let usageTotal = null;
        let settled = false;
        let lastRepCheckLen = 0;
        const onParsed = function(delta, usage) {
          if (settled) return;
          if (delta) {
            removeTyping();
            const kind = classifyChunk(delta, content);
            if (kind === "cumulative") {
              content = delta;
              streamContent = content;
              updateStreamBubble();
            } else if (kind !== "duplicate") {
              content += delta;
              streamingTick(delta);
            }
            guardAgainstRepetition();
          }
          if (typeof usage === "number") usageTotal = usage;
        };
        function guardAgainstRepetition() {
          if (settled) return;
          if (content.length - lastRepCheckLen < 64) return;
          lastRepCheckLen = content.length;
          const trimmed = collapseRepeatedResponse(content) || trimRunawayRepetition(content) || cleanFinalResponse(content);
          if (!trimmed) return;
          settled = true;
          try {
            controller.abort();
          } catch (e) {
          }
          clearTimeout(timeout);
          content = trimmed;
          streamContent = trimmed;
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
                if (payload === "[DONE]") {
                  continue;
                }
                parseChunk(payload, onParsed);
              }
              if (settled || buf.indexOf("[DONE]") !== -1) {
                buf = "";
                break;
              }
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
            if (settled) return;
            if (err && err.name === "AbortError") {
              reject({ name: "AbortError", userMessage: "The AI service took too long to respond." });
            } else {
              reject(err);
            }
          }
        })();
      }).catch((err) => {
        clearTimeout(timeout);
        if (!err || typeof err !== "object") {
          reject(new Error(String(err)));
          return;
        }
        if (!err.userMessage) {
          const raw = err.message || "";
          if (/failed to fetch|networkerror|load failed/i.test(raw)) {
            reject({ name: err && err.name || "FetchError", userMessage: "Could not reach this AI service. Trying the next option." });
          } else {
            reject(err);
          }
        } else {
          reject(err);
        }
      });
    });
  }
  function resetStreamBubble() {
    const el = document.getElementById(STREAM_MESSAGE_ELEMENT_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }
  function parseChunk(payload, cb) {
    try {
      const obj = JSON.parse(payload);
      let delta = null;
      if (obj.choices && obj.choices[0] && obj.choices[0].delta) {
        delta = obj.choices[0].delta.content || "";
      }
      if (obj.choices && obj.choices[0] && obj.choices[0].message && !delta) {
        delta = obj.choices[0].message.content || "";
      }
      if (typeof delta !== "string" || !delta) delta = null;
      const usage = obj.usage && typeof obj.usage.total_tokens === "number" ? obj.usage.total_tokens : null;
      cb(delta, usage);
    } catch (e) {
      console.debug("Malformed SSE chunk skipped:", payload);
      cb(null, null);
    }
  }
  var streamContent = "";
  var streamChatId = null;
  var streamRafPending = false;
  var lastStreamRender = 0;
  var streamActive = false;
  var STREAM_RENDER_INTERVAL_MS = 60;
  function beginStreamRender(chatId) {
    streamChatId = chatId;
    streamContent = "";
    streamRafPending = false;
    lastStreamRender = 0;
    streamActive = true;
  }
  function endStreamRender() {
    streamActive = false;
    streamRafPending = false;
  }
  function streamingTick(delta) {
    streamContent += delta;
    removeTyping();
    if (!streamActive) return;
    if (state.currentChatId !== streamChatId) {
      return;
    }
    if (streamRafPending) return;
    streamRafPending = true;
    requestAnimationFrame(() => {
      streamRafPending = false;
      if (!streamActive) return;
      const now = performance.now();
      if (now - lastStreamRender < STREAM_RENDER_INTERVAL_MS) return;
      lastStreamRender = now;
      updateStreamBubble();
    });
  }
  function updateStreamBubble() {
    if (!streamActive) return;
    let el = document.getElementById(STREAM_MESSAGE_ELEMENT_ID);
    if (!el) {
      el = document.createElement("div");
      el.className = "msg ai";
      el.id = "streamMsg";
      const avatar = document.createElement("div");
      avatar.className = "avatar";
      avatar.setAttribute("aria-hidden", "true");
      avatar.innerHTML = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4z"/></svg>';
      const bubble2 = document.createElement("div");
      bubble2.className = "bubble md";
      el.appendChild(avatar);
      el.appendChild(bubble2);
      dom.messages.appendChild(el);
    }
    const bubble = el.querySelector(".bubble");
    if (!bubble) return;
    bubble.setAttribute("dir", isRtlText(streamContent) ? "rtl" : "ltr");
    while (bubble.firstChild) bubble.removeChild(bubble.firstChild);
    renderMarkdown(bubble, streamContent);
    scrollToBottom(false);
  }
  function lockUI(locked) {
    state.isLocked = locked;
    updateComposerState();
  }
  function showLock() {
    dom.lockOverlay.hidden = false;
    if (dom.tokenLimitInfo) {
      dom.tokenLimitInfo.textContent = "This browser has reached its 10,000-token limit.";
    }
  }
  function hideLock() {
    dom.lockOverlay.hidden = true;
    state.isLocked = false;
    updateComposerState();
    dom.messageInput.focus();
  }
  var bc = null;
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
      bc.postMessage({ type: state.limitReached ? "locked" : "unlocked" });
    } catch (err) {
    }
  }
  function onOpenDisplayAdClick() {
    const shell = document.getElementById("adsterraAdShell");
    const closeButton = document.getElementById("adsterraCloseButton");
    if (!shell) {
      showToast("The display ad is not available.");
      return;
    }
    shell.hidden = false;
    dom.lockOverlay.hidden = true;
    if (closeButton) {
      closeButton.hidden = true;
      window.setTimeout(() => {
        closeButton.hidden = false;
        closeButton.focus({ preventScroll: true });
      }, 1500);
    }
    shell.scrollIntoView({ behavior: "smooth", block: "center" });
    shell.classList.add("adsterra-ad-highlight");
    window.setTimeout(() => shell.classList.remove("adsterra-ad-highlight"), 1500);
  }
  var recognition = null;
  var isListening = false;
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
    recognition.lang = "en-US";
    recognition.onstart = () => {
      isListening = true;
      dom.micBtn.classList.add("listening");
      dom.micBtn.setAttribute("aria-label", "Stop voice input");
      showToast("Listening\u2026 speak now", 1200);
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
      try {
        recognition.stop();
      } catch (e) {
      }
      return;
    }
    try {
      recognition.start();
    } catch (err) {
      showToast("Voice input is already active.");
    }
  }
  function autoGrowInput() {
    const ta = dom.messageInput;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 180) + "px";
    updateComposerState();
  }
  function initEventListeners() {
    dom.messageInput.addEventListener("input", autoGrowInput);
    dom.messageInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!dom.sendBtn.disabled) sendMessage();
      }
    });
    dom.sendBtn.addEventListener("click", sendMessage);
    dom.menuBtn.addEventListener("click", toggleSidebar);
    dom.sidebarClose.addEventListener("click", closeSidebar);
    dom.overlay.addEventListener("click", closeSidebar);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeSidebar();
      }
    });
    dom.newChatBtn.addEventListener("click", () => {
      if (state.isStreaming) {
        showToast("Please wait for the current reply to finish.");
        return;
      }
      createChat();
    });
    dom.searchChats.addEventListener("input", () => {
      renderChatList(dom.searchChats.value);
    });
    dom.micBtn.addEventListener("click", toggleVoice);
    dom.openDisplayAdBtn.addEventListener("click", onOpenDisplayAdClick);
    document.addEventListener("umrani:display-ad-closed", () => {
      if (state.isLocked) showLock();
    });
    dom.chatArea.addEventListener("scroll", markUserScroll);
    window.addEventListener("offline", () => showToast("You are offline. Please check your internet connection."));
    window.addEventListener("online", () => showToast("Back online."));
  }
  async function init() {
    initDom();
    try {
      await openDB();
    } catch (err) {
      console.warn("IndexedDB unavailable:", err);
    }
    if (state.dbReady) {
      await loadTokenState();
      await loadChats();
      await restoreLastChat();
    }
    initEventListeners();
    initAdsterraCloseButton();
    initVoice();
    initBroadcastChannel();
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
})();
