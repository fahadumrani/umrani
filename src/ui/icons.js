// Local 24px-grid icon system. All SVG markup is a trusted constant, never AI/user text.
export const ICON_PATHS = Object.freeze({
  plus: '<path d="M12 5v14M5 12h14"/>',
  volume: '<path d="m11 5-5 4H3.5v6H6l5 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  thumbUp: '<path d="M7.5 10v10H4V10h3.5Zm0 0 4-7a2 2 0 0 1 2 2v4h4.5a2 2 0 0 1 2 2.4l-1.3 6A3 3 0 0 1 16 20H7.5"/>',
  thumbDown: '<path d="M7.5 14V4H4v10h3.5Zm0 0 4 7a2 2 0 0 0 2-2v-4h4.5a2 2 0 0 0 2-2.4l-1.3-6A3 3 0 0 0 16 4H7.5"/>',
  regenerate: '<path d="M20 8V3m0 5h-5M20 8a8 8 0 1 0 .3 7"/>',
  brand: '<path d="M6.75 5.5v7a5.25 5.25 0 0 0 10.5 0v-7"/><path d="m19 2.75.65 1.85 1.85.65-1.85.65L19 7.75l-.65-1.85-1.85-.65 1.85-.65L19 2.75Z" fill="currentColor" stroke="none"/>',
  menu: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M9 4.5v15M5.75 8h1"/>',
  close: '<path d="m6.5 6.5 11 11m0-11-11 11"/>',
  newChat: '<path d="M20 10.5V7a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v13l4-3h3.5M17 13v8m-4-4h8"/>',
  search: '<circle cx="10.75" cy="10.75" r="6.25"/><path d="m15.25 15.25 4.25 4.25"/>',
  attach: '<path d="m8.75 12.75 6.5-6.5a3 3 0 0 1 4.25 4.25l-8 8a5 5 0 0 1-7.07-7.07l8-8M7.5 14l6.5-6.5a1.5 1.5 0 0 1 2.12 2.12l-6.5 6.5a1.5 1.5 0 0 1-2.12-2.12Z"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 10.5a6.5 6.5 0 0 0 13 0M12 17v4m-3 0h6"/>',
  send: '<path d="M12 19V5m-6 6 6-6 6 6"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor" stroke="none"/>',
  developer: '<circle cx="12" cy="7.5" r="3.25"/><path d="M5 20v-1a7 7 0 0 1 14 0v1"/>',
  brain: '<path d="M12 5a3 3 0 0 0-5.8-1 3.5 3.5 0 0 0-2 6 4 4 0 0 0 1 7.5A3.5 3.5 0 0 0 12 19V5Zm0 0a3 3 0 0 1 5.8-1 3.5 3.5 0 0 1 2 6 4 4 0 0 1-1 7.5A3.5 3.5 0 0 1 12 19M8 7a3 3 0 0 1-1 3m-1 4a3 3 0 0 1 3 3m7-10a3 3 0 0 0 1 3m1 4a3 3 0 0 0-3 3"/>',
  trash: '<path d="M4.5 7h15M9 7V4.5h6V7m-8.5 0 .75 12a1.5 1.5 0 0 0 1.5 1.5h6.5a1.5 1.5 0 0 0 1.5-1.5l.75-12M10 11v5.5m4-5.5v5.5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  check: '<path d="m5 12 4.5 4.5L19 7"/>',
  download: '<path d="M12 3.5v11m-4-4 4 4 4-4M4.5 15v4a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-4"/>',
  expand: '<path d="m7 9 5 5 5-5"/>',
  collapse: '<path d="m7 15 5-5 5 5"/>',
  file: '<path d="M14 3.5H6a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 6 20.5h12a1.5 1.5 0 0 0 1.5-1.5V9L14 3.5Zm0 0V9h5.5M8 13h8m-8 3.5h6"/>'
});
export function iconSvg(name, size = 20, className = '') {
  if (!Object.hasOwn(ICON_PATHS, name)) throw new RangeError('Unknown UI icon');
  if (!Number.isInteger(size) || size < 12 || size > 64) throw new RangeError('Invalid icon size');
  if (!/^[\w\s-]*$/.test(className)) throw new RangeError('Invalid icon class');
  return `<svg data-icon="${name}" class="ui-icon${className ? ' '+className : ''}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${name==='brand' ? '1.9' : '1.75'}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON_PATHS[name]}</svg>`;
}
export function setIconLabel(element, name, label, size = 16) {
  element.innerHTML = iconSvg(name, size);
  const text = document.createElement('span');
  text.className = 'icon-label';
  text.textContent = String(label);
  element.appendChild(text);
}
