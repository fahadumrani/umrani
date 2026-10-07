export const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
export async function readJsonLimited(response, maxBytes = MAX_RESPONSE_BYTES) {
  if (!response.body?.getReader) {
    const data = await response.json();
    if (new TextEncoder().encode(JSON.stringify(data)).length > maxBytes) throw new Error('Provider response exceeded safe size limit');
    return data;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0; let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new Error('Provider response exceeded safe size limit');
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } finally { reader.releaseLock(); }
}

// SSE events may contain several data: lines, split UTF-8 chunks or CRLF.
export class SseEvents {
  constructor(onEvent, maxChars = 1024 * 1024) {
    this.onEvent = onEvent; this.maxChars = maxChars;
    this.buffer = ''; this.data = []; this.eventChars = 0;
  }
  line(line) {
    if (!line) {
      if (this.data.length) this.onEvent(this.data.join('\n'));
      this.data = []; this.eventChars = 0; return;
    }
    if (line.startsWith('data:')) {
      const value = line.slice(5).replace(/^ /, '');
      this.eventChars += value.length;
      if (this.eventChars > this.maxChars) throw new Error('SSE event exceeded safe size limit');
      this.data.push(value);
    }
  }
  push(text, final = false) {
    this.buffer += text;
    if (this.buffer.length > this.maxChars) throw new Error('SSE buffer exceeded safe size limit');
    let match;
    while ((match = /\r\n|\r|\n/.exec(this.buffer))) {
      // A trailing CR may be half of a CRLF across network chunks.
      if (!final && match[0] === '\r' && match.index === this.buffer.length - 1) break;
      this.line(this.buffer.slice(0, match.index));
      this.buffer = this.buffer.slice(match.index + match[0].length);
    }
    if (final) {
      if (this.buffer) this.line(this.buffer);
      this.buffer = ''; this.line('');
    }
  }
}
