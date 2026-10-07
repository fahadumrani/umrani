import { iconSvg } from './icons.js';

// Reply tools are real actions, not decorative controls. Feedback stays local.
export function createReplyActions({ text, onCopy, onFeedback, onRegenerate, feedback = null, canRegenerate = false, onError = () => {} }) {
  const row = document.createElement('div');
  row.className = 'reply-actions';
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', 'Reply actions');
  const make = (icon, label, handler) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'reply-action icon-btn';
    button.dataset.action = icon; button.title = label;
    button.setAttribute('aria-label', label); button.innerHTML = iconSvg(icon, 18);
    button.addEventListener('click', async () => { try { await handler(button); } catch { onError('This action could not be completed.'); } });
    row.appendChild(button); return button;
  };
  make('copy', 'Copy reply', async button => {
    await onCopy(); button.innerHTML = iconSvg('check', 18);
    button.setAttribute('aria-label', 'Reply copied');
    setTimeout(() => { if (button.isConnected) { button.innerHTML = iconSvg('copy', 18); button.setAttribute('aria-label', 'Copy reply'); } }, 1800);
  });
  const speechAvailable = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  let utterance = null;
  const read = make('volume', 'Read reply aloud', button => {
    if (!speechAvailable) return;
    if (button.classList.contains('speaking')) { window.speechSynthesis.cancel(); finish(); return; }
    window.speechSynthesis.cancel();
    const spoken = String(text).replace(/```[\s\S]*?```/g, ' Code example omitted. ').replace(/[#*_`]/g, '').slice(0, 12000);
    utterance = new SpeechSynthesisUtterance(spoken);
    utterance.lang = /[\u0600-\u06FF]/.test(spoken) ? 'ur-PK' : (navigator.language || 'en-US');
    utterance.onend = finish; utterance.onerror = () => { finish(); onError('Read aloud is unavailable. Try another browser or installed voice.'); };
    button.classList.add('speaking'); button.setAttribute('aria-label', 'Stop reading aloud');
    window.speechSynthesis.speak(utterance);
  });
  function finish() { read.classList.remove('speaking'); read.setAttribute('aria-label', 'Read reply aloud'); utterance = null; }
  read.disabled = !speechAvailable;
  if (!speechAvailable) read.title = 'Read aloud is not supported in this browser';
  let current = feedback;
  const helpful = make('thumbUp', 'Helpful — saved on this device', () => rate(1));
  const unhelpful = make('thumbDown', 'Not helpful — saved on this device', () => rate(-1));
  function update() { helpful.setAttribute('aria-pressed', String(current === 1)); unhelpful.setAttribute('aria-pressed', String(current === -1)); }
  async function rate(value) { current = current === value ? null : value; update(); await onFeedback(current); }
  update();
  const retry = make('regenerate', 'Regenerate latest reply', () => onRegenerate());
  retry.disabled = !canRegenerate;
  if (!canRegenerate) retry.title = 'Only the latest reply can be regenerated when no request is running';
  return row;
}
