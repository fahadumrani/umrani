(() => {
  // src/api/models.js
  var PRIMARY_MODEL = "deepseek-ai/DeepSeek-V4-Flash-0731";
  var FALLBACK_MODEL = "zai-org/GLM-5.3-Flash";
  var SECOND_FALLBACK_MODEL = "MiniMaxAI/MiniMax-M2.7";

  // src/api/endpoints.js
  var INFERENCE_BASE_URL = "https://inference.dahl.global";
  var CHAT_COMPLETIONS_PATH = "/v1/chat/completions";
  var CHAT_COMPLETIONS_URL = INFERENCE_BASE_URL + CHAT_COMPLETIONS_PATH;

  // src/config/config.js
  var API_PROVIDERS = [
    {
      name: "Dahl Primary",
      url: CHAT_COMPLETIONS_URL,
      key: "dahl_KgKuNT3JPs1oibtvFmbbmRQWgVyCX6Hcf",
      models: [PRIMARY_MODEL, FALLBACK_MODEL, SECOND_FALLBACK_MODEL]
    },
    {
      name: "Dahl Fallback 1",
      url: CHAT_COMPLETIONS_URL,
      key: "dahl_6k8Zd85LSZsZxQaow9VNL3kXnsED4NpJF",
      models: [PRIMARY_MODEL, FALLBACK_MODEL, SECOND_FALLBACK_MODEL]
    },
    {
      name: "Dahl Fallback 2",
      url: CHAT_COMPLETIONS_URL,
      key: "dahl_DbZarD77Pc7jFAVL7u497tcUu1pred7Fr",
      models: [PRIMARY_MODEL, FALLBACK_MODEL, SECOND_FALLBACK_MODEL]
    },
    {
      name: "Dahl Fallback 3",
      url: CHAT_COMPLETIONS_URL,
      key: "dahl_Hb4rueqVPipwe84fyMYW175FHmdctDo3Y",
      models: [PRIMARY_MODEL, FALLBACK_MODEL, SECOND_FALLBACK_MODEL]
    },
    {
      name: "Dahl Fallback 4",
      url: CHAT_COMPLETIONS_URL,
      key: "dahl_79M37eUF1MvFJYc3FUMyKi18CTmppsXcy",
      models: [PRIMARY_MODEL, FALLBACK_MODEL, SECOND_FALLBACK_MODEL]
    },
    {
      name: "Dahl Fallback 5",
      url: CHAT_COMPLETIONS_URL,
      key: "dahl_MLZeTs3EAL8gXriVJ5cKDBbgA382CQLn4",
      models: [PRIMARY_MODEL, FALLBACK_MODEL, SECOND_FALLBACK_MODEL]
    },
    {
      name: "Dahl Fallback 6",
      url: CHAT_COMPLETIONS_URL,
      key: "dahl_AFvMRrBnpWcLZLyNk1rhQXMkKFMR33rYF",
      models: [PRIMARY_MODEL, FALLBACK_MODEL, SECOND_FALLBACK_MODEL]
    },
    {
      name: "Dahl Fallback 7",
      url: CHAT_COMPLETIONS_URL,
      key: "dahl_FtTKYKTAEWuSDc4bKrN1vMfxVwu8f9zHH",
      models: [PRIMARY_MODEL, FALLBACK_MODEL, SECOND_FALLBACK_MODEL]
    },
    {
      name: "Dahl Fallback 8",
      url: CHAT_COMPLETIONS_URL,
      key: "dahl_MZHvPJbU67VwgzZr3iiT4g2mtoRqXW1bw",
      models: [PRIMARY_MODEL, FALLBACK_MODEL, SECOND_FALLBACK_MODEL]
    },
    {
      name: "Dahl Fallback 9",
      url: CHAT_COMPLETIONS_URL,
      key: "dahl_EZdwBLKNJqLoX3RvyrJe7eANrL3vvEQrp",
      models: [PRIMARY_MODEL, FALLBACK_MODEL, SECOND_FALLBACK_MODEL]
    }
  ];
  var SYSTEM_PROMPT = "You are Umrani, a smart, friendly, accurate, and professional AI assistant. Understand the user's intent, give clear and useful answers, never make up information, and admit uncertainty when necessary. Start in professional English, then respond in the same language and style the user uses. Keep answers concise by default and explain complex topics clearly.";
  var REQUEST_TIMEOUT_MS = 12e4;

  // src/utils/helpers.js
  function makeId() {
    return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  }
  function isRtlText(str) {
    return /[\u0600-\u06FF\u0590-\u05FF\u0750-\u077F]/.test(str || "");
  }

  // src/utils/formatter.js
  function singleLine(value) {
    return String(value != null ? value : "").replace(/\s+/g, " ").trim();
  }

  // src/core/chat.js
  var CHAT_TITLE_MAX_LENGTH = 34;
  function makeTitle(text) {
    const cleaned = singleLine(text);
    if (!cleaned) return "New Chat";
    return cleaned.length > CHAT_TITLE_MAX_LENGTH ? cleaned.slice(0, CHAT_TITLE_MAX_LENGTH) + "\u2026" : cleaned;
  }

  // src/core/memory.js
  var MAX_CONTEXT_MESSAGES = 24;

  // src/core/storage.js
  var STORAGE_DATABASE = "BolanAI";

  // src/core/history.js
  var HISTORY_STORE = "chats";
  var APP_STATE_STORE = "appState";

  // src/core/ai.js
  var SYSTEM_ROLE = "system";
  var USER_ROLE = "user";
  var AI_ROLE = "assistant";

  // src/api/client.js
  function isProviderErrorContent(text) {
    const value = String(text || "").trim().toLowerCase();
    if (!value) return false;
    return /model is at concurrency capacity/.test(value) || /paid accounts? (?:are|is) admitted first/.test(value) || /top up at https?:\/\/inference\.dahl\.global\/account/.test(value) || /retry after retry-after/.test(value);
  }
  function filterThinkingContent(text) {
    const source = String(text || "");
    let visible = "";
    let cursor = 0;
    let hiddenTag = null;
    let hadThinking = false;
    const partialTagStart = (value) => {
      const lower = value.toLowerCase();
      const index = lower.lastIndexOf("<");
      if (index < 0) return -1;
      const fragment = lower.slice(index);
      const tags = ["<think>", "<analysis>"];
      if (tags.some((tag) => tag.startsWith(fragment))) return index;
      if (/^<(?:think|analysis)(?:\s[^>]*)?$/.test(fragment)) return index;
      return -1;
    };
    while (cursor < source.length) {
      if (hiddenTag) {
        const closePattern = new RegExp(`<\\/${hiddenTag}\\s*>`, "ig");
        closePattern.lastIndex = cursor;
        const close = closePattern.exec(source);
        if (!close) {
          return {
            content: visible.replace(/^\s+/, ""),
            thinking: true,
            hadThinking: true
          };
        }
        cursor = closePattern.lastIndex;
        hiddenTag = null;
        continue;
      }
      const openPattern = /<(think|analysis)(?:\s[^>]*)?>/ig;
      openPattern.lastIndex = cursor;
      const open = openPattern.exec(source);
      if (open) {
        visible += source.slice(cursor, open.index);
        hiddenTag = open[1].toLowerCase();
        hadThinking = true;
        cursor = openPattern.lastIndex;
        continue;
      }
      const remainder = source.slice(cursor);
      const partial = partialTagStart(remainder);
      if (partial >= 0) {
        visible += remainder.slice(0, partial);
        return {
          content: visible.replace(/^\s+/, ""),
          thinking: true,
          hadThinking: true
        };
      }
      visible += remainder;
      break;
    }
    return {
      content: visible.replace(/<\/?(?:think|analysis)(?:\s[^>]*)?>/gi, "").replace(/^\s+/, ""),
      thinking: Boolean(hiddenTag),
      hadThinking
    };
  }
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

  // src/ui/sidebar.js
  var SIDEBAR_ELEMENT_ID = "sidebar";
  var SIDEBAR_CLOSE_ELEMENT_ID = "sidebarClose";
  var MENU_BUTTON_ELEMENT_ID = "menuBtn";
  var NEW_CHAT_BUTTON_ELEMENT_ID = "newChatBtn";
  var SEARCH_CHATS_ELEMENT_ID = "searchChats";
  var CHAT_LIST_ELEMENT_ID = "chatList";

  // src/ui/chat.js
  var CHAT_AREA_ELEMENT_ID = "chatArea";
  var MESSAGES_ELEMENT_ID = "messages";
  var EMPTY_STATE_ELEMENT_ID = "emptyState";
  var STREAM_STATUS_ELEMENT_ID = "streamStatus";
  var COMPOSER_ELEMENT_ID = "composer";
  var MESSAGE_INPUT_ELEMENT_ID = "messageInput";
  var SEND_BUTTON_ELEMENT_ID = "sendBtn";
  var MIC_BUTTON_ELEMENT_ID = "micBtn";
  var ATTACH_BUTTON_ELEMENT_ID = "attachBtn";
  var FILE_INPUT_ELEMENT_ID = "fileInput";
  var ATTACHMENT_BAR_ELEMENT_ID = "attachmentBar";
  var ATTACHMENT_NAME_ELEMENT_ID = "attachmentName";
  var ATTACHMENT_REMOVE_BUTTON_ELEMENT_ID = "attachmentRemoveBtn";

  // src/ui/messages.js
  var STREAM_MESSAGE_ELEMENT_ID = "streamMsg";

  // src/ui/modal.js
  var AD_BLOCK_WARNING_ELEMENT_ID = "adBlockWarning";

  // src/ui/notifications.js
  var TOAST_ELEMENT_ID = "toast";

  // src/ui/ads.js
  function initAdsterraCloseButton() {
    const shell = document.getElementById("adsterraAdShell");
    const closeButton = document.getElementById("adsterraCloseButton");
    if (!shell || !closeButton) return;
    const homeParent = shell.parentNode;
    const homeNextSibling = shell.nextSibling;
    closeButton.addEventListener("click", () => {
      shell.hidden = true;
      shell.classList.remove("inline-ad-mode", "adsterra-ad-highlight");
      if (homeParent && shell.parentNode !== homeParent) {
        homeParent.insertBefore(shell, homeNextSibling);
      }
      document.dispatchEvent(new CustomEvent("umrani:display-ad-closed"));
    });
  }

  // src/main.js?v=47
  var HIGH_LOAD_MESSAGE = "Umrani AI is under high load. Please wait.";
  var MODEL_SELECTION_KEY = "umrani-selected-model";
  var GLM_AD_VIEWS_KEY = "umrani-glm-ad-views";
  var REQUIRED_GLM_AD_VIEWS = 4;
  var MODEL_HEALTH_INTERVAL_MS = 2 * 60 * 1e3;
  var MODEL_OPTIONS = [
    {
      model: SECOND_FALLBACK_MODEL,
      alias: "Umrani 2.0",
      display: "Umrani 2.0"
    },
    {
      model: PRIMARY_MODEL,
      alias: "Umrani 2.1",
      display: "Umrani 2.1"
    },
    {
      model: FALLBACK_MODEL,
      alias: "Umrani 2.2",
      display: "Umrani 2.2"
    }
  ];
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
    dom.modelSelect = document.getElementById("modelSelect");
    dom.modelHealth = document.getElementById("modelHealth");
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
  var state = {
    db: null,
    dbReady: false,
    currentChatId: null,
    chats: [],
    // cached chat summaries + full messages when active
    isStreaming: false,
    adBreakActive: false,
    pendingAdBreak: false,
    adCloseScheduled: false,
    adCloseAllowedAt: 0,
    repliesSinceAd: 0,
    adBlockDetected: null,
    pendingAttachment: null,
    activeRequestChatId: null,
    controller: null,
    // AbortController for current request
    selectedModel: SECOND_FALLBACK_MODEL,
    modelAvailability: /* @__PURE__ */ Object.create(null),
    modelHealthChecking: false,
    lastModelHealthCheck: 0,
    glmAdViews: 0,
    glmUnlockFlow: false
  };
  var SOCIAL_BAR_SRC = "https://bauval.org/14/a67c4a1da3645718e3483de61514fbe8";
  var POPUNDER_SRC = "https://abscloud.org/1/1082f6d1e3a685e366e87a1a8c047da9";
  var NATIVE_BANNER_SRC = "https://bauval.org/21/63ea484e1a293480518c8d527b5e81e3";
  var DESKTOP_AD_MIN_WIDTH = 901;
  function isAdBlockBaitHidden() {
    const bait = document.getElementById("adBlockBait");
    if (!bait) return false;
    const style = window.getComputedStyle(bait);
    return style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0 || bait.offsetWidth === 0 || bait.offsetHeight === 0;
  }
  function loadSocialBar() {
    if (document.getElementById("adsterraSocialBarScript")) return;
    window.__umraniSocialBarStatus = "loading";
    const script = document.createElement("script");
    script.id = "adsterraSocialBarScript";
    script.async = true;
    script.dataset.cfasync = "false";
    script.src = SOCIAL_BAR_SRC;
    script.onload = () => {
      window.__umraniSocialBarStatus = "loaded";
    };
    script.onerror = () => {
      window.__umraniSocialBarStatus = "error";
    };
    document.head.appendChild(script);
  }
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
      window.__umraniAdsterraStatus = "unavailable";
      state.adBlockDetected = window.__umraniSocialBarStatus === "error" && isAdBlockBaitHidden();
      updateAdBreakWarning();
      if (state.adBlockDetected) {
        state.adCloseAllowedAt = 0;
        const closeButton = document.getElementById("adsterraCloseButton");
        if (closeButton) closeButton.hidden = true;
      } else {
        scheduleAdClose();
      }
    };
    shell.insertBefore(script, container);
  }
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
  var AD_REPLY_COUNTER_KEY = "umrani-replies-since-ad";
  var AD_PENDING_KEY = "umrani-ad-pending";
  function loadAdReplyCounter() {
    try {
      const saved = Number(localStorage.getItem(AD_REPLY_COUNTER_KEY));
      state.repliesSinceAd = Number.isFinite(saved) ? Math.max(0, Math.min(1, Math.floor(saved))) : 0;
      state.pendingAdBreak = localStorage.getItem(AD_PENDING_KEY) === "1";
    } catch (e) {
      state.repliesSinceAd = 0;
      state.pendingAdBreak = false;
    }
  }
  function saveAdReplyCounter() {
    try {
      localStorage.setItem(AD_REPLY_COUNTER_KEY, String(state.repliesSinceAd));
    } catch (e) {
    }
  }
  function savePendingAd(pending) {
    state.pendingAdBreak = pending;
    try {
      if (pending) localStorage.setItem(AD_PENDING_KEY, "1");
      else localStorage.removeItem(AD_PENDING_KEY);
    } catch (e) {
    }
  }
  function recordSuccessfulReply() {
    state.repliesSinceAd += 1;
    if (state.repliesSinceAd >= 2) {
      state.repliesSinceAd = 0;
      saveAdReplyCounter();
      savePendingAd(true);
      return;
    }
    saveAdReplyCounter();
  }
  function modelOption(model) {
    return MODEL_OPTIONS.find((item) => item.model === model) || MODEL_OPTIONS[0];
  }
  function isGlmUnlocked() {
    return state.glmAdViews >= REQUIRED_GLM_AD_VIEWS;
  }
  function loadModelPreferences() {
    try {
      const views = Number(localStorage.getItem(GLM_AD_VIEWS_KEY));
      state.glmAdViews = Number.isFinite(views) ? Math.max(0, Math.min(REQUIRED_GLM_AD_VIEWS, Math.floor(views))) : 0;
      const saved = localStorage.getItem(MODEL_SELECTION_KEY);
      const valid = MODEL_OPTIONS.some((item) => item.model === saved);
      state.selectedModel = valid ? saved : SECOND_FALLBACK_MODEL;
      if (state.selectedModel === FALLBACK_MODEL && !isGlmUnlocked()) {
        state.selectedModel = SECOND_FALLBACK_MODEL;
      }
    } catch (e) {
      state.glmAdViews = 0;
      state.selectedModel = SECOND_FALLBACK_MODEL;
    }
  }
  function saveSelectedModel() {
    try {
      localStorage.setItem(MODEL_SELECTION_KEY, state.selectedModel);
    } catch (e) {
    }
  }
  function modelHealthLabel(model) {
    if (model === FALLBACK_MODEL && !isGlmUnlocked()) {
      const remaining = REQUIRED_GLM_AD_VIEWS - state.glmAdViews;
      return `${remaining} ad${remaining === 1 ? "" : "s"} to unlock`;
    }
    const availability = state.modelAvailability[model];
    if (availability === true) return "Active";
    if (availability === false) return "Model is under overload";
    return "";
  }
  function updateModelUi() {
    if (!dom.modelSelect || !dom.modelHealth) return;
    const selected = state.selectedModel;
    for (const optionEl of dom.modelSelect.options) {
      const item = modelOption(optionEl.value);
      optionEl.textContent = item.display;
    }
    dom.modelSelect.value = selected;
    const label = modelHealthLabel(selected);
    dom.modelHealth.textContent = label;
    dom.modelHealth.className = "model-health";
    if (label === "Active") dom.modelHealth.classList.add("active");
    else if (label === "Model is under overload") dom.modelHealth.classList.add("overloaded");
    else if (selected === FALLBACK_MODEL && !isGlmUnlocked()) {
      dom.modelHealth.classList.add("locked");
    }
  }
  function selectModel(model) {
    if (!MODEL_OPTIONS.some((item) => item.model === model)) return;
    state.selectedModel = model;
    saveSelectedModel();
    updateModelUi();
  }
  function prepareNextUnlockAd() {
    const oldScript = document.getElementById("adsterraNativeBannerScript");
    if (oldScript) oldScript.remove();
    const container = document.getElementById("container-63ea484e1a293480518c8d527b5e81e3");
    if (container) container.textContent = "";
    window.__umraniAdsterraStatus = "idle";
    state.adBlockDetected = null;
  }
  function startGlmUnlockFlow() {
    if (isGlmUnlocked()) {
      selectModel(FALLBACK_MODEL);
      return;
    }
    if (state.isStreaming) {
      showToast("Please wait for the current reply to finish.");
      updateModelUi();
      return;
    }
    if (state.adBreakActive && !state.glmUnlockFlow) {
      showToast("Close the current advertisement, then select Umrani 2.2 again.");
      updateModelUi();
      return;
    }
    state.glmUnlockFlow = true;
    const remaining = REQUIRED_GLM_AD_VIEWS - state.glmAdViews;
    showToast(`Watch ${remaining} more ad${remaining === 1 ? "" : "s"} to unlock Umrani 2.2.`);
    showAdBreak();
  }
  function completeGlmUnlockAd() {
    finishAdBreak();
    state.glmAdViews = Math.min(REQUIRED_GLM_AD_VIEWS, state.glmAdViews + 1);
    try {
      localStorage.setItem(GLM_AD_VIEWS_KEY, String(state.glmAdViews));
    } catch (e) {
    }
    updateModelUi();
    const remaining = REQUIRED_GLM_AD_VIEWS - state.glmAdViews;
    if (remaining <= 0) {
      state.glmUnlockFlow = false;
      selectModel(FALLBACK_MODEL);
      showToast("Umrani 2.2 unlocked.");
      return;
    }
    prepareNextUnlockAd();
    showToast(`Ad completed. ${remaining} more to unlock Umrani 2.2.`);
    window.setTimeout(() => {
      if (state.glmUnlockFlow) showAdBreak();
    }, 650);
  }
  function initModelSelector() {
    if (!dom.modelSelect) return;
    dom.modelSelect.textContent = "";
    for (const item of MODEL_OPTIONS) {
      const option = document.createElement("option");
      option.value = item.model;
      option.textContent = item.display;
      dom.modelSelect.appendChild(option);
    }
    dom.modelSelect.addEventListener("change", () => {
      const requested = dom.modelSelect.value;
      if (state.isStreaming) {
        showToast("Please wait for the current reply to finish.");
        updateModelUi();
        return;
      }
      if (requested === FALLBACK_MODEL && !isGlmUnlocked()) {
        updateModelUi();
        startGlmUnlockFlow();
        return;
      }
      selectModel(requested);
    });
    updateModelUi();
  }
  async function probeModel(model) {
    const provider = API_PROVIDERS.find(isProviderConfigured);
    if (!provider || !getProviderModels(provider).includes(model)) return false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 1e3);
    try {
      const res = await fetch(provider.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + provider.key
        },
        body: JSON.stringify({
          model,
          messages: [{ role: USER_ROLE, content: "Reply OK" }],
          stream: false,
          max_tokens: 1
        }),
        signal: controller.signal
      });
      if (!res.ok) return false;
      const json = await res.json().catch(() => null);
      if (!json || json.error) return false;
      const content = json.choices && json.choices[0] && json.choices[0].message ? json.choices[0].message.content : "";
      return !isProviderErrorContent(content);
    } catch (e) {
      return false;
    } finally {
      window.clearTimeout(timeout);
    }
  }
  async function checkModelHealth() {
    if (state.modelHealthChecking || state.isStreaming || state.adBreakActive || document.hidden || !navigator.onLine) return;
    state.modelHealthChecking = true;
    updateModelUi();
    try {
      const results = await Promise.all(
        MODEL_OPTIONS.map(async (item) => [item.model, await probeModel(item.model)])
      );
      for (const [model, available] of results) {
        state.modelAvailability[model] = available;
      }
      state.lastModelHealthCheck = Date.now();
      updateModelUi();
    } finally {
      state.modelHealthChecking = false;
    }
  }
  async function loadChats() {
    try {
      const all = await dbGetAll(HISTORY_STORE);
      const cleanedChats = [];
      state.chats = (all || []).map((chat) => {
        let changed = false;
        const messages = (chat.messages || []).map((message) => {
          if (message.role !== AI_ROLE) return message;
          const cleanContent = filterThinkingContent(message.content).content;
          if (cleanContent === String(message.content || "")) return message;
          changed = true;
          return { ...message, content: cleanContent };
        });
        if (!changed) return chat;
        const cleaned = { ...chat, messages };
        cleanedChats.push(cleaned);
        return cleaned;
      }).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      await Promise.allSettled(cleanedChats.map((chat) => dbPut(HISTORY_STORE, chat)));
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
      del.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4.5h6V7M18.5 7l-.7 13H6.2L5.5 7M10 11v5M14 11v5"/></svg>';
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
    const activeAdShell = state.adBreakActive ? document.getElementById("adsterraAdShell") : null;
    msgsEl.textContent = "";
    if (!chat) {
      dom.emptyState.hidden = false;
      if (activeAdShell) msgsEl.appendChild(activeAdShell);
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
    if (activeAdShell) msgsEl.appendChild(activeAdShell);
    scrollToBottom(false);
  }
  function buildMessageEl(msg) {
    const wrap = document.createElement("div");
    wrap.className = "msg " + (msg.role === USER_ROLE ? "user" : "ai");
    if (msg.role !== USER_ROLE) {
      const avatar = document.createElement("div");
      avatar.className = "avatar";
      avatar.setAttribute("aria-hidden", "true");
      avatar.innerHTML = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M6.5 5.5v6.4a5.5 5.5 0 0 0 11 0V5.5"/><path d="m19 3 .35 1.05 1.05.35-1.05.35L19 5.8l-.35-1.05-1.05-.35 1.05-.35L19 3Z" fill="currentColor" stroke="none"/></svg>';
      wrap.appendChild(avatar);
    }
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    const rawContent = String(msg.content || "");
    const content = msg.role === AI_ROLE ? filterThinkingContent(rawContent).content : rawContent;
    bubble.setAttribute("dir", isRtlText(content) ? "rtl" : "ltr");
    if (msg.role === USER_ROLE) {
      bubble.textContent = content;
      if (msg.attachment && msg.attachment.name) {
        const fileChip = document.createElement("div");
        fileChip.className = "message-attachment";
        fileChip.textContent = `\u{1F4CE} ${msg.attachment.name} (${formatBytes(msg.attachment.size || 0)})`;
        fileChip.title = msg.attachment.name;
        bubble.appendChild(fileChip);
      }
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
    let codeIndex = 0;
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
        codeIndex += 1;
        targetEl.appendChild(
          createCodeBlock(b.lang, b.lines.join("\n"), codeIndex)
        );
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
  function codeFileInfo(lang, index) {
    const key = String(lang || "").trim().toLowerCase().replace(/^\./, "");
    const extensions = {
      javascript: "js",
      js: "js",
      node: "js",
      typescript: "ts",
      ts: "ts",
      python: "py",
      py: "py",
      html: "html",
      css: "css",
      json: "json",
      jsx: "jsx",
      tsx: "tsx",
      java: "java",
      c: "c",
      "c++": "cpp",
      cpp: "cpp",
      csharp: "cs",
      "c#": "cs",
      cs: "cs",
      php: "php",
      ruby: "rb",
      rb: "rb",
      go: "go",
      golang: "go",
      rust: "rs",
      rs: "rs",
      swift: "swift",
      kotlin: "kt",
      kt: "kt",
      sql: "sql",
      shell: "sh",
      bash: "sh",
      sh: "sh",
      powershell: "ps1",
      ps1: "ps1",
      yaml: "yml",
      yml: "yml",
      xml: "xml",
      markdown: "md",
      md: "md",
      svg: "svg",
      vue: "vue",
      svelte: "svelte",
      dart: "dart",
      lua: "lua",
      perl: "pl",
      r: "r",
      text: "txt",
      txt: "txt",
      plaintext: "txt"
    };
    const safeUnknown = /^[a-z0-9]{1,10}$/.test(key) ? key : "txt";
    const extension = extensions[key] || safeUnknown;
    const mimeTypes = {
      js: "text/javascript",
      ts: "text/typescript",
      py: "text/x-python",
      html: "text/html",
      css: "text/css",
      json: "application/json",
      xml: "application/xml",
      svg: "image/svg+xml",
      md: "text/markdown",
      txt: "text/plain"
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
    window.setTimeout(() => URL.revokeObjectURL(url), 1e3);
  }
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
        setTimeout(() => {
          copyBtn.textContent = "Copy";
        }, 1800);
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
  var MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
  var MAX_UPLOAD_CHARS = 3 * 1024 * 1024;
  var TEXT_FILE_EXTENSIONS = /* @__PURE__ */ new Set([
    "txt",
    "md",
    "markdown",
    "csv",
    "json",
    "xml",
    "html",
    "htm",
    "css",
    "js",
    "mjs",
    "cjs",
    "ts",
    "tsx",
    "jsx",
    "py",
    "java",
    "c",
    "h",
    "cpp",
    "cc",
    "cxx",
    "hpp",
    "cs",
    "php",
    "rb",
    "go",
    "rs",
    "swift",
    "kt",
    "kts",
    "sql",
    "sh",
    "bash",
    "ps1",
    "yml",
    "yaml",
    "svg",
    "vue",
    "svelte",
    "dart",
    "lua",
    "pl",
    "r",
    "ini",
    "toml",
    "log"
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
      file && (String(file.type || "").startsWith("text/") || ["application/json", "application/xml"].includes(file.type) || TEXT_FILE_EXTENSIONS.has(ext))
    );
  }
  function updateAttachmentBar() {
    const attachment = state.pendingAttachment;
    dom.attachmentBar.hidden = !attachment;
    dom.attachmentName.textContent = attachment ? `\u{1F4CE} ${attachment.name} \xB7 ${formatBytes(attachment.size)}` : "";
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
      showToast("File is too large. Maximum supported size is 3 MB.");
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
      if (truncated) showToast("File was truncated to the 3 MB content limit.");
    } catch (err) {
      dom.fileInput.value = "";
      showToast("Could not read this file.");
    }
  }
  function attachmentForApi(attachment) {
    if (!attachment) return "";
    const safeName = String(attachment.name || "attachment.txt").replace(/[<>]/g, "");
    const note = attachment.truncated ? "\n[The file was truncated by the client.]" : "";
    return `

<attached_file name="${safeName}" type="${attachment.type}">
${attachment.content}${note}
</attached_file>`;
  }
  function updateComposerState() {
    const locked = state.adBreakActive;
    dom.messageInput.disabled = locked;
    const lockedMessage = "Advertisement \u2014 please wait";
    dom.messageInput.placeholder = locked ? lockedMessage : "Ask anything\u2026";
    dom.messageInput.setAttribute(
      "aria-label",
      locked ? lockedMessage : "Message"
    );
    const canSend = !locked && !state.isStreaming && (dom.messageInput.value.trim().length > 0 || Boolean(state.pendingAttachment));
    dom.sendBtn.disabled = !canSend;
    dom.sendBtn.title = locked ? lockedMessage : "Send message";
    dom.attachBtn.disabled = locked || state.isStreaming;
    if (locked) dom.composer.classList.add("locked");
    else dom.composer.classList.remove("locked");
  }
  async function sendMessage() {
    const raw = dom.messageInput.value;
    const text = raw.trim();
    const attachment = state.pendingAttachment ? { ...state.pendingAttachment } : null;
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
    state.isStreaming = true;
    state.activeRequestChatId = state.currentChatId || null;
    dom.messageInput.value = "";
    state.pendingAttachment = null;
    dom.fileInput.value = "";
    updateAttachmentBar();
    dom.sendBtn.disabled = true;
    autoGrowInput();
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
        chat.title = makeTitle(text || attachment && attachment.name || "New Chat");
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
    setStreamStatus("Generating\u2026");
    dom.streamStatus.hidden = false;
    beginStreamRender(chat.id);
    const apiMessages = [{ role: SYSTEM_ROLE, content: SYSTEM_PROMPT }];
    const recent = chat.messages.slice(-MAX_CONTEXT_MESSAGES);
    for (const m of recent) {
      const role = m.role === USER_ROLE ? USER_ROLE : AI_ROLE;
      const content = role === USER_ROLE ? String(m.content || "") + attachmentForApi(m.attachment) : filterThinkingContent(m.content).content;
      apiMessages.push({ role, content });
    }
    const assistantMsg = { role: AI_ROLE, content: "", timestamp: Date.now() };
    chat.messages.push(assistantMsg);
    try {
      const res = await streamCompletion(apiMessages);
      const rawContent = filterThinkingContent(res.content || "").content;
      const content = collapseRepeatedResponse(rawContent) || cleanFinalResponse(rawContent) || rawContent;
      assistantMsg.content = content || "No response.";
      chat.updatedAt = Date.now();
      await persistChat(chat);
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
    if (!getChat(chat.id)) return;
    try {
      await dbPut(HISTORY_STORE, chat);
    } catch (err) {
      console.warn("Failed to persist chat", err);
    }
  }
  function mapApiError(status, providerName) {
    return HIGH_LOAD_MESSAGE;
  }
  function showFriendlyError(err) {
    showToast(HIGH_LOAD_MESSAGE, 5e3);
    console.debug("Request error:", err && err.message ? err.message : err, err);
  }
  function streamCompletion(apiMessages) {
    const providers = API_PROVIDERS.filter(isProviderConfigured);
    const model = state.selectedModel;
    return (async () => {
      let lastErr = null;
      const tried = [];
      for (const provider of providers) {
        if (!getProviderModels(provider).includes(model)) continue;
        tried.push(provider.name + " / " + model);
        streamContent = "";
        resetStreamBubble();
        try {
          const result = await streamWithProvider(apiMessages, provider, model);
          state.modelAvailability[model] = true;
          updateModelUi();
          console.log("Umrani responded via provider '" + provider.name + "' (model '" + model + "').");
          return result;
        } catch (err) {
          lastErr = err;
          console.warn(
            "Attempt '" + provider.name + "' / '" + model + "' failed; switching provider:",
            err && (err.message || err.userMessage) ? err.message || err.userMessage : err
          );
        }
      }
      if (tried.length === 0) {
        throw { userMessage: HIGH_LOAD_MESSAGE };
      }
      state.modelAvailability[model] = false;
      updateModelUi();
      const detail = tried.join(" \u2192 ");
      console.error("Selected model failed on all providers:", detail, lastErr);
      const fail = new Error("Selected model failed on all providers (" + detail + ").");
      fail.userMessage = HIGH_LOAD_MESSAGE;
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
          clearTimeout(timeout);
          let status = res.status;
          try {
            const j = await res.json().catch(() => null);
            if (j && j.error && j.error.message) {
              reject({
                userMessage: HIGH_LOAD_MESSAGE,
                providerMessage: j.error.message,
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
            if (j.error && (j.error.message || j.error) || isProviderErrorContent(content2)) {
              reject({
                userMessage: HIGH_LOAD_MESSAGE,
                providerMessage: j.error && (j.error.message || j.error) ? String(j.error.message || j.error) : content2
              });
              return;
            }
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
        let doneSignal = false;
        let lastRepCheckLen = 0;
        const onParsed = function(delta, usage, apiError, reasoningActive) {
          if (settled) return;
          if (apiError) {
            settled = true;
            clearTimeout(timeout);
            try {
              controller.abort();
            } catch (e) {
            }
            reject({
              userMessage: HIGH_LOAD_MESSAGE,
              providerMessage: apiError
            });
            return;
          }
          if (reasoningActive) {
            setStreamStatus("Thinking\u2026");
          }
          if (delta) {
            const kind = classifyChunk(delta, content);
            if (kind === "cumulative") {
              content = delta;
            } else if (kind !== "duplicate") {
              content += delta;
            }
            const filtered = filterThinkingContent(content);
            streamingTick(filtered.content, filtered.thinking);
            guardAgainstRepetition();
          }
          if (typeof usage === "number") usageTotal = usage;
        };
        function guardAgainstRepetition() {
          if (settled) return;
          if (content.length - lastRepCheckLen < 64) return;
          lastRepCheckLen = content.length;
          const visibleContent = filterThinkingContent(content).content;
          const trimmed = collapseRepeatedResponse(visibleContent) || trimRunawayRepetition(visibleContent) || cleanFinalResponse(visibleContent);
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
                  doneSignal = true;
                  buf = "";
                  break;
                }
                parseChunk(payload, onParsed);
              }
              if (settled || doneSignal) break;
            }
            if (doneSignal) {
              try {
                await reader.cancel();
              } catch (e) {
              }
            }
            if (!settled && buf.trim()) {
              const payload = buf.trim().startsWith("data:") ? buf.trim().slice(5).trim() : buf.trim();
              if (payload && payload !== "[DONE]") {
                parseChunk(payload, onParsed);
              }
            }
            clearTimeout(timeout);
            if (!settled) {
              if (isProviderErrorContent(content)) {
                reject({
                  userMessage: HIGH_LOAD_MESSAGE,
                  providerMessage: content
                });
              } else {
                resolve({ content, usageTotal });
              }
            }
          } catch (err) {
            clearTimeout(timeout);
            if (settled) return;
            if (err && err.name === "AbortError") {
              reject({ name: "AbortError", userMessage: HIGH_LOAD_MESSAGE });
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
            reject({ name: err && err.name || "FetchError", userMessage: HIGH_LOAD_MESSAGE });
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
      const apiError = obj && obj.error ? String(obj.error.message || obj.error) : null;
      if (apiError) {
        cb(null, null, apiError);
        return;
      }
      let delta = null;
      let reasoningActive = false;
      if (obj.choices && obj.choices[0] && obj.choices[0].delta) {
        delta = obj.choices[0].delta.content || "";
        reasoningActive = Boolean(
          obj.choices[0].delta.reasoning_content || obj.choices[0].delta.reasoning
        ) && !delta;
      }
      if (obj.choices && obj.choices[0] && obj.choices[0].message && !delta) {
        delta = obj.choices[0].message.content || "";
      }
      if (typeof delta !== "string" || !delta) delta = null;
      const usage = obj.usage && typeof obj.usage.total_tokens === "number" ? obj.usage.total_tokens : null;
      cb(delta, usage, null, reasoningActive);
    } catch (e) {
      console.debug("Malformed SSE chunk skipped:", payload);
      cb(null, null, null, false);
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
  function setStreamStatus(label) {
    if (!dom.streamStatus) return;
    const dot = dom.streamStatus.querySelector(".dot");
    dom.streamStatus.textContent = "";
    if (dot) dom.streamStatus.appendChild(dot);
    dom.streamStatus.appendChild(document.createTextNode(` ${label}`));
  }
  function streamingTick(visibleContent, thinking = false) {
    streamContent = visibleContent;
    setStreamStatus(thinking ? "Thinking\u2026" : "Generating\u2026");
    if (streamContent) removeTyping();
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
      avatar.innerHTML = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M6.5 5.5v6.4a5.5 5.5 0 0 0 11 0V5.5"/><path d="m19 3 .35 1.05 1.05.35-1.05.35L19 5.8l-.35-1.05-1.05-.35 1.05-.35L19 3Z" fill="currentColor" stroke="none"/></svg>';
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
  function updateAdBreakWarning() {
    if (!dom.adBlockWarning) return;
    dom.adBlockWarning.hidden = !state.adBlockDetected;
  }
  function scheduleAdClose() {
    if (!state.adBreakActive || state.adBlockDetected !== false || state.adCloseScheduled) return;
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
    if (wasActive) return;
    const shell = document.getElementById("adsterraAdShell");
    const closeButton = document.getElementById("adsterraCloseButton");
    if (!shell || !closeButton) {
      showToast("Advertisement is unavailable. You can continue chatting.");
      finishAdBreak();
      return;
    }
    dom.messages.appendChild(shell);
    shell.hidden = false;
    shell.classList.add("inline-ad-mode", "adsterra-ad-highlight");
    closeButton.hidden = true;
    shell.scrollIntoView({ behavior: "smooth", block: "center" });
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
    dom.attachBtn.addEventListener("click", () => {
      if (!dom.attachBtn.disabled) dom.fileInput.click();
    });
    dom.fileInput.addEventListener("change", () => {
      handleFileSelection(dom.fileInput.files && dom.fileInput.files[0]);
    });
    dom.attachmentRemoveBtn.addEventListener("click", clearPendingAttachment);
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
    document.addEventListener("umrani:display-ad-closed", () => {
      if (!state.adBreakActive) return;
      const allowed = state.adBlockDetected === false && state.adCloseAllowedAt > 0 && Date.now() >= state.adCloseAllowedAt;
      if (!allowed) {
        state.adBreakActive = false;
        state.adCloseScheduled = false;
        showAdBreak();
        showToast("Please wait for the advertisement.");
        return;
      }
      if (state.glmUnlockFlow) completeGlmUnlockAd();
      else finishAdBreak();
    });
    window.addEventListener("storage", (event) => {
      if (event.key === AD_PENDING_KEY && event.newValue === "1") {
        savePendingAd(true);
        if (!state.adBreakActive) showAdBreak();
      }
      if (event.key === GLM_AD_VIEWS_KEY) {
        const value = Number(event.newValue);
        state.glmAdViews = Number.isFinite(value) ? Math.max(0, Math.min(REQUIRED_GLM_AD_VIEWS, Math.floor(value))) : 0;
        updateModelUi();
      }
      if (event.key === MODEL_SELECTION_KEY && event.newValue) {
        const valid = MODEL_OPTIONS.some((item) => item.model === event.newValue);
        if (valid && (event.newValue !== FALLBACK_MODEL || isGlmUnlocked())) {
          state.selectedModel = event.newValue;
          updateModelUi();
        }
      }
    });
    dom.chatArea.addEventListener("scroll", markUserScroll);
    window.addEventListener("offline", () => showToast("You are offline. Please check your internet connection."));
    window.addEventListener("online", () => {
      showToast("Back online.");
      checkModelHealth();
    });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && Date.now() - state.lastModelHealthCheck >= MODEL_HEALTH_INTERVAL_MS) {
        checkModelHealth();
      }
    });
  }
  async function init() {
    initDom();
    loadAdReplyCounter();
    loadModelPreferences();
    initModelSelector();
    loadSocialBar();
    loadDesktopPopunder();
    try {
      await openDB();
    } catch (err) {
      console.warn("IndexedDB unavailable:", err);
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
    window.setTimeout(checkModelHealth, 0);
    window.setInterval(checkModelHealth, MODEL_HEALTH_INTERVAL_MS);
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
