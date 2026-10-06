/* Pure streaming-response helpers used by the API layer. */

export {
  classifyChunk,
  cleanFinalResponse,
  collapseRepeatedResponse,
  trimRunawayRepetition,
  isProviderErrorContent,
  filterThinkingContent
};

/* Some OpenAI-compatible gateways return capacity errors as a successful
   HTTP/SSE text response instead of using an error status. Treat only
   provider-specific notices as failures so the fallback chain can continue. */
function isProviderErrorContent(text) {
  const value = String(text || "").trim().toLowerCase();
  if (!value) return false;
  return /model is at concurrency capacity/.test(value) ||
    /paid accounts? (?:are|is) admitted first/.test(value) ||
    /top up at https?:\/\/inference\.dahl\.global\/account/.test(value) ||
    /retry after retry-after/.test(value);
}

/* Remove private model-reasoning blocks from user-visible output. This also
   handles an opening tag split across streaming chunks, so fragments such as
   "<thi" never flash inside the chat bubble. */
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
    content: visible
      .replace(/<\/?(?:think|analysis)(?:\s[^>]*)?>/gi, "")
      .replace(/^\s+/, ""),
    thinking: Boolean(hiddenTag),
    hadThinking
  };
}

/* ---------- Chunk classifier (guards against duplicated replies) ----------
   Some proxies intermittently send CUMULATIVE text in each SSE event —
   "everything streamed so far plus the new part" — instead of a small
   delta. Appending those makes the reply grow and repeat itself
   ("previous text plus new text"). Classify each chunk as:
     "fresh"      -> a normal small delta, append it
     "cumulative" -> contains the whole accumulated text + more: REPLACE
     "duplicate"  -> identical re-send of the accumulated text: ignore
   The flattened (whitespace-insensitive) check can never misfire on
   normal deltas because they are far shorter than the accumulated text. */
function classifyChunk(text, accumulated) {
  const flat = (s) => String(s).replace(/\s+/g, "").toLowerCase();
  const fa = flat(accumulated);
  const fd = flat(text);
  if (!fa) return "fresh";                       // nothing accumulated yet
  if (fd === fa) return "duplicate";
  if (fd.length > fa.length && fd.slice(0, fa.length) === fa) return "cumulative";
  return "fresh";
}

/* ---------- Final-response cleanup (defense in depth) ----------
   Some sessions still produce a "growing repeat" pattern in the final
   text: the reply's opening sentence/header is restated again and again,
   each restatement adding one more item. The LAST restatement is the
   complete, clean answer. If the reply's opening sentence appears 3+
   times, keep everything from its LAST occurrence. Returns null when
   the text is already clean, else the cleaned single response. */
function cleanFinalResponse(text) {
  const s = String(text);
  const flat = (x) => x.replace(/\s+/g, "").toLowerCase();
  const f = flat(s);
  if (f.length < 60) return null; // too short to bother
  // Opening = the first sentence/header line of the reply.
  const seg = s.match(/^[^\n.!?\u06D4]+[:!?\u06D4.]?\n?/);
  const openingRaw = (seg && seg[0] ? seg[0] : s.slice(0, 24)).trim();
  const opening = flat(openingRaw);
  if (opening.length < 12) return null; // too short/simple to be a header
  // Count occurrences of the opening phrase.
  let occ = 0;
  let idx = f.indexOf(opening);
  while (idx !== -1 && occ < 30) { occ++; idx = f.indexOf(opening, idx + opening.length); }
  if (occ < 3) return null; // clean (or mild) — keep as-is
  // Find the LAST occurrence's flat index.
  let lastFlat = -1;
  let cur = f.indexOf(opening, 0);
  while (cur !== -1) { lastFlat = cur; const next = f.indexOf(opening, cur + opening.length); if (next === -1) break; cur = next; }
  // Map lastFlat back to a raw character offset (skipping whitespace).
  let rawIdx = 0, count = 0;
  for (let i = 0; i < s.length; i++) {
    if (/\s/.test(s[i])) continue;
    if (count === lastFlat) { rawIdx = i; break; }
    count++;
  }
  const cut = s.slice(rawIdx);
  // Only use the cut when there really was duplication (a shorter result).
  if (flat(cut).length >= f.length) return null;
  return cut;
}

/* ---------- Exact whole-response de-duplication -------------------------
   Some gateways return one complete response three times as separate
   chunks.  The normal cumulative-chunk classifier cannot catch that when
   each chunk contains a complete answer rather than the answer-so-far.
   Compare a whitespace-normalised string in thirds (and, conservatively,
   halves for longer responses), then return the first original copy. */
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

  // Triple output is the reported failure.  A doubled result is also
  // collapsed only when it is sufficiently substantial to avoid changing
  // short, intentional repetitions such as "yes yes".
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

/* ---------- Runaway repetition guard ----------
   Some models/proxies occasionally fall into a loop where the same
   sentence is streamed over and over again (observed live: the same
   line repeated 7+ times in one SSE stream). Detect a run of identical
   consecutive sentences at the END of the accumulated text and return
   the text trimmed back to the FIRST occurrence of that run, so the
   response is displayed exactly once. Returns null when the text is
   clean. Analysis is conservative: only >= REPEAT_LIMIT identical
   consecutive sentences, each at least MIN_SENTENCE chars long. */
function trimRunawayRepetition(text) {
  const MIN_SENTENCE = 10;  // normalized chars a repeated unit must have
  const REPEAT_LIMIT = 4;   // identical consecutive sentences before trimming

  const src = String(text);
  // Split keeping separators: result alternates [text, sep, text, sep...].
  // Concatenating all parts reproduces the original text exactly.
  const parts = src.split(/([.!?\u06D4]+[\s]*|\n+)/);

  // Walk sentence units (body + its separator), tracking the CURRENT
  // consecutive run of identical (normalized) sentences. Only a run that
  // reaches the end of the accumulated text matters, because a runaway
  // loop always repeats at the tail of the stream.
  let pos = 0;
  let prevNorm = null;
  let runNorm = null;
  let runCount = 0;
  let runFirstEnd = -1; // char offset just after the run's first sentence
  for (let i = 0; i < parts.length; i += 2) {
    const unit = (parts[i] || "") + (parts[i + 1] || "");
    const start = pos;
    pos += unit.length;
    const norm = unit.replace(/\s+/g, "").toLowerCase();
    if (!norm) continue; // blank/whitespace unit — never part of a run
    if (norm === prevNorm) {
      runCount += 1;
    } else {
      runNorm = norm;
      runCount = 1;
      runFirstEnd = start + unit.length;
      prevNorm = norm;
    }
    // Repetition found: trim to the end of the run's first occurrence.
    if (runCount >= REPEAT_LIMIT && runNorm.length >= MIN_SENTENCE) {
      return src.slice(0, runFirstEnd);
    }
  }
  return null; // text is clean
}

