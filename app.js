const artboard = document.querySelector('#artboard');
const scene = document.querySelector('#scene');
const properties = document.querySelector('#properties');
const layers = document.querySelector('#layers');
const selectionCount = document.querySelector('#selection-count');
const layerCount = document.querySelector('#layer-count');
const toast = document.querySelector('#toast');
const STORAGE_KEY = 'createshop-design-v1';
const PAGE_PRESETS = {
  a4: { width: 794, height: 1123, label: 'A4' },
  a3: { width: 1123, height: 1587, label: 'A3' },
  letter: { width: 816, height: 1056, label: 'US Letter' },
  square: { width: 1080, height: 1080, label: 'Square' },
  social: { width: 1080, height: 1080, label: 'Social post' },
  story: { width: 1080, height: 1920, label: 'Story / Reel' },
  custom: { width: 800, height: 520, label: 'Custom canvas' }
};
const GRADIENTS = {
  sunrise: ['#ffbd91', '#ffd6da', '#ded6ff'],
  ocean: ['#a4e7df', '#b9d8fa', '#c4c4fa'],
  candy: ['#ffc9df', '#e7c9fa', '#c9e5ff']
};
let nextId = 1;
let selectedId = null;
let drag = null;
let toastTimer;
let undoStack = [];
let redoStack = [];
let state = loadDesign();
let objects = state.objects;

function loadDesign() {
  const fallback = { page: { ...PAGE_PRESETS.custom, preset: 'custom', orientation: 'landscape', background: '#ffffff', gradient: null }, objects: [] };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved)) {
      nextId = saved.reduce((max, item) => Math.max(max, Number(item.id) + 1), 1);
      return { ...fallback, objects: saved };
    }
    if (saved && Array.isArray(saved.objects) && saved.page) {
      nextId = saved.objects.reduce((max, item) => Math.max(max, Number(item.id) + 1), 1);
      return { ...fallback, ...saved, page: { ...fallback.page, ...saved.page } };
    }
  } catch (error) { console.warn('Could not load the saved design.', error); }
  return fallback;
}

function cloneState() { return JSON.parse(JSON.stringify(state)); }
function saveDesign() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (error) { console.warn('Could not save the design.', error); }
}
function recordHistory() {
  undoStack.push(cloneState());
  if (undoStack.length > 60) undoStack.shift();
  redoStack = [];
  updateHistoryButtons();
}
function restoreState(snapshot) {
  state = snapshot;
  objects = state.objects;
  selectedId = null;
  syncPageControls();
  render();
}
function undo() {
  if (!undoStack.length) return;
  redoStack.push(cloneState());
  restoreState(undoStack.pop());
  updateHistoryButtons();
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(cloneState());
  restoreState(redoStack.pop());
  updateHistoryButtons();
}
function updateHistoryButtons() {
  document.querySelector('#undo-button').disabled = !undoStack.length;
  document.querySelector('#redo-button').disabled = !redoStack.length;
}
function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);
}
function selectedObject() { return objects.find(item => item.id === selectedId) || null; }
function pageWidth() { return state.page.width; }
function pageHeight() { return state.page.height; }
function shapeMarkup(item) {
  if (item.type === 'text') return `<text class="design-text" x="${item.x}" y="${item.y + item.fontSize}" fill="${item.color}" font-family="DM Sans, Arial, sans-serif" font-size="${item.fontSize}" font-weight="${item.fontWeight || 700}" data-object-id="${item.id}">${escapeXml(item.text)}</text>`;
  if (item.type === 'circle') return `<circle cx="${item.x + item.width / 2}" cy="${item.y + item.height / 2}" r="${Math.min(item.width, item.height) / 2}" fill="${item.fill}" stroke="${item.stroke}" stroke-width="${item.strokeWidth}" data-object-id="${item.id}"/>`;
  if (item.type === 'line') return `<line x1="${item.x}" y1="${item.y}" x2="${item.x + item.width}" y2="${item.y + item.height}" stroke="${item.stroke}" stroke-width="${item.strokeWidth}" stroke-linecap="round" data-object-id="${item.id}"/>`;
  return `<rect x="${item.x}" y="${item.y}" width="${item.width}" height="${item.height}" rx="${item.radius || 12}" fill="${item.fill}" stroke="${item.stroke}" stroke-width="${item.strokeWidth}" data-object-id="${item.id}"/>`;
}
function selectionMarkup(item) {
  if (item.type === 'text') return `<rect class="selection-box" x="${item.x - 6}" y="${item.y - 5}" width="${Math.max(90, item.text.length * item.fontSize * 0.57) + 12}" height="${item.fontSize + 14}" rx="5"/>`;
  if (item.type === 'circle') return `<ellipse class="selection-box" cx="${item.x + item.width / 2}" cy="${item.y + item.height / 2}" rx="${item.width / 2 + 5}" ry="${item.height / 2 + 5}"/>`;
  if (item.type === 'line') return `<line class="selection-box" x1="${item.x}" y1="${item.y}" x2="${item.x + item.width}" y2="${item.y + item.height}"/>`;
  return `<rect class="selection-box" x="${item.x - 5}" y="${item.y - 5}" width="${item.width + 10}" height="${item.height + 10}" rx="${(item.radius || 12) + 3}"/>`;
}
function renderScene() {
  scene.innerHTML = objects.map(item => `<g class="design-object${item.id === selectedId ? ' is-selected' : ''}" data-object-id="${item.id}">${item.id === selectedId ? selectionMarkup(item) : ''}${shapeMarkup(item)}</g>`).join('');
}
function renderProperties() {
  const item = selectedObject();
  selectionCount.textContent = item ? '1 selected' : '—';
  if (!item) {
    properties.innerHTML = '<div class="empty-state"><span class="empty-cursor">↖</span><p>Select an object on your canvas to edit its style.</p></div>';
    return;
  }
  const controls = item.type === 'text'
    ? `<label class="field"><span>Text</span><input class="text-input" data-property="text" type="text" maxlength="120" value="${escapeXml(item.text)}" /></label><label class="field"><span>Font size <b data-value="fontSize">${item.fontSize}px</b></span><input data-property="fontSize" type="range" min="12" max="160" value="${item.fontSize}" /></label><label class="field"><span>Text color</span><span class="color-control"><input data-property="color" type="color" value="${item.color}" /><code>${item.color.toUpperCase()}</code></span></label><label class="field"><span>Weight</span><select data-property="fontWeight"><option value="400" ${item.fontWeight === 400 ? 'selected' : ''}>Regular</option><option value="700" ${item.fontWeight !== 400 ? 'selected' : ''}>Bold</option></select></label>`
    : item.type === 'line'
      ? `<label class="field"><span>Line color</span><span class="color-control"><input data-property="stroke" type="color" value="${item.stroke}" /><code>${item.stroke.toUpperCase()}</code></span></label><label class="field"><span>Line width <b data-value="strokeWidth">${item.strokeWidth}px</b></span><input data-property="strokeWidth" type="range" min="1" max="30" value="${item.strokeWidth}" /></label>`
      : `<label class="field"><span>Fill color</span><span class="color-control"><input data-property="fill" type="color" value="${item.fill}" /><code>${item.fill.toUpperCase()}</code></span></label><label class="field"><span>Outline color</span><span class="color-control"><input data-property="stroke" type="color" value="${item.stroke}" /><code>${item.stroke.toUpperCase()}</code></span></label><label class="field"><span>Outline width <b data-value="strokeWidth">${item.strokeWidth}px</b></span><input data-property="strokeWidth" type="range" min="0" max="30" value="${item.strokeWidth}" /></label>`;
  const sizeControl = item.type !== 'text' ? `<label class="field"><span>Size</span><div class="size-fields"><label><span class="sr-only">Width</span><input data-property="width" type="number" min="12" max="${pageWidth()}" value="${item.width}" aria-label="Width" /><span>W</span></label><label><span class="sr-only">Height</span><input data-property="height" type="number" min="12" max="${pageHeight()}" value="${item.height}" aria-label="Height" /><span>H</span></label></div></label>` : '';
  properties.innerHTML = `<div class="property-form">${controls}${sizeControl}<div class="layer-actions"><button type="button" data-layer-move="back" title="Send backward">↓ Back</button><button type="button" data-layer-move="front" title="Bring forward">↑ Front</button><button type="button" data-duplicate title="Duplicate">＋ Duplicate</button></div><button class="delete-button" type="button" data-delete-selected><span aria-hidden="true">⌫</span> Delete selection <kbd>⌫</kbd></button></div>`;
}
function renderLayers() {
  layerCount.textContent = String(objects.length);
  if (!objects.length) { layers.innerHTML = '<p class="layers-empty">Your design is waiting for its first layer.</p>'; return; }
  layers.innerHTML = [...objects].reverse().map(item => {
    const label = item.type === 'text' ? (item.text || 'Text') : item.type === 'rect' ? 'Rectangle' : item.type === 'line' ? 'Line' : 'Circle';
    const icon = item.type === 'text' ? 'T' : item.type === 'circle' ? '○' : item.type === 'line' ? '╱' : '▱';
    return `<button class="layer-row${item.id === selectedId ? ' active' : ''}" type="button" data-layer-id="${item.id}"><span class="layer-type">${icon}</span><span class="layer-name">${escapeXml(label)}</span><span class="layer-eye" aria-hidden="true">◉</span></button>`;
  }).join('');
}
function renderPage() {
  artboard.setAttribute('viewBox', `0 0 ${pageWidth()} ${pageHeight()}`);
  document.querySelector('#canvas-background').setAttribute('width', pageWidth());
  document.querySelector('#canvas-background').setAttribute('height', pageHeight());
  document.querySelector('#canvas-size').textContent = `${pageWidth()} × ${pageHeight()}`;
  document.querySelector('.canvas-size').title = `${state.page.label || 'Custom canvas'} · ${pageWidth()} × ${pageHeight()} px`;
  const defs = document.querySelector('#canvas-defs');
  const background = document.querySelector('#canvas-background');
  if (state.page.gradient && GRADIENTS[state.page.gradient]) {
    const colors = GRADIENTS[state.page.gradient];
    defs.innerHTML = `<linearGradient id="page-gradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${colors[0]}"/><stop offset="52%" stop-color="${colors[1]}"/><stop offset="100%" stop-color="${colors[2]}"/></linearGradient>`;
    background.setAttribute('fill', 'url(#page-gradient)');
  } else {
    defs.innerHTML = '';
    background.setAttribute('fill', state.page.background || '#ffffff');
  }
  document.querySelectorAll('.swatch').forEach(button => button.classList.toggle('active', !state.page.gradient && button.dataset.background === state.page.background));
  document.querySelector('#background-color').value = /^#[0-9a-f]{6}$/i.test(state.page.background) ? state.page.background : '#ffffff';
  document.querySelectorAll('[data-orientation]').forEach(button => button.classList.toggle('active', button.dataset.orientation === state.page.orientation));
  document.querySelector('#page-size').value = state.page.preset || 'custom';
  document.querySelector('#custom-width').value = pageWidth();
  document.querySelector('#custom-height').value = pageHeight();
}
function syncPageControls() { renderPage(); }
function render() { renderPage(); renderScene(); renderProperties(); renderLayers(); saveDesign(); updateHistoryButtons(); }
function addObject(type) {
  recordHistory();
  const offset = (objects.length % 5) * 18;
  const item = { id: nextId++, type, x: Math.min(pageWidth() - 230, 110 + offset), y: Math.min(pageHeight() - 130, 120 + offset), width: type === 'circle' ? 120 : type === 'line' ? 180 : 220, height: type === 'circle' ? 120 : type === 'line' ? 0 : 120, fill: type === 'circle' ? '#ffd4a8' : '#dcd7ff', stroke: type === 'circle' ? '#ff8b5e' : '#a99bff', strokeWidth: 3, radius: 16, color: '#28233d', text: 'Your text', fontSize: Math.min(36, Math.floor(pageWidth() / 15)), fontWeight: 700 };
  objects.push(item); selectedId = item.id; render();
  if (type === 'text') { const input = properties.querySelector('[data-property="text"]'); input?.focus(); input?.select(); }
}
function showToast(message) { toast.textContent = message; toast.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('visible'), 2600); }
function pointerPosition(event) { const bounds = artboard.getBoundingClientRect(); return { x: (event.clientX - bounds.left) * pageWidth() / bounds.width, y: (event.clientY - bounds.top) * pageHeight() / bounds.height }; }
function exportMarkup() {
  const bg = state.page.gradient && GRADIENTS[state.page.gradient] ? `<defs><linearGradient id="export-gradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${GRADIENTS[state.page.gradient][0]}"/><stop offset="52%" stop-color="${GRADIENTS[state.page.gradient][1]}"/><stop offset="100%" stop-color="${GRADIENTS[state.page.gradient][2]}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#export-gradient)"/>` : `<rect width="100%" height="100%" fill="${state.page.background || '#ffffff'}"/>`;
  const artwork = objects.map(item => {
    if (item.type === 'text') return `<text x="${item.x}" y="${item.y + item.fontSize}" fill="${item.color}" font-family="Arial,sans-serif" font-size="${item.fontSize}" font-weight="${item.fontWeight || 700}">${escapeXml(item.text)}</text>`;
    if (item.type === 'circle') return `<circle cx="${item.x + item.width / 2}" cy="${item.y + item.height / 2}" r="${Math.min(item.width, item.height) / 2}" fill="${item.fill}" stroke="${item.stroke}" stroke-width="${item.strokeWidth}"/>`;
    if (item.type === 'line') return `<line x1="${item.x}" y1="${item.y}" x2="${item.x + item.width}" y2="${item.y + item.height}" stroke="${item.stroke}" stroke-width="${item.strokeWidth}" stroke-linecap="round"/>`;
    return `<rect x="${item.x}" y="${item.y}" width="${item.width}" height="${item.height}" rx="${item.radius || 12}" fill="${item.fill}" stroke="${item.stroke}" stroke-width="${item.strokeWidth}"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${pageWidth() * 2}" height="${pageHeight() * 2}" viewBox="0 0 ${pageWidth()} ${pageHeight()}">${bg}${artwork}</svg>`;
}
function downloadPng() {
  const url = URL.createObjectURL(new Blob([exportMarkup()], { type: 'image/svg+xml;charset=utf-8' }));
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement('canvas'); canvas.width = pageWidth() * 2; canvas.height = pageHeight() * 2;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0); URL.revokeObjectURL(url);
    canvas.toBlob(png => {
      if (!png) return showToast('Could not export this design. Please try again.');
      const link = document.createElement('a'); link.href = URL.createObjectURL(png); link.download = `createshop-${state.page.preset || 'design'}.png`; link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000); showToast('Your design is ready to go!');
    }, 'image/png');
  };
  image.onerror = () => { URL.revokeObjectURL(url); showToast('Could not export this design. Please try again.'); };
  image.src = url;
}
function setBackground(color, gradient = null) { recordHistory(); state.page.background = color || '#ffffff'; state.page.gradient = gradient; render(); }
function setPageSize(preset, orientation = state.page.orientation) {
  if (!PAGE_PRESETS[preset]) return;
  recordHistory();
  const base = PAGE_PRESETS[preset];
  let width = base.width; let height = base.height;
  if (preset === 'custom') { width = pageWidth(); height = pageHeight(); }
  else if (['a4', 'a3', 'letter'].includes(preset) && orientation === 'landscape') [width, height] = [height, width];
  state.page = { ...state.page, preset, label: base.label, width, height, orientation };
  state.objects.forEach(item => { item.x = Math.min(item.x, width - 12); item.y = Math.min(item.y, height - 12); });
  render();
}

document.querySelectorAll('[data-add]').forEach(button => button.addEventListener('click', () => addObject(button.dataset.add)));
document.querySelector('#undo-button').addEventListener('click', undo);
document.querySelector('#redo-button').addEventListener('click', redo);
document.querySelector('#reset-button').addEventListener('click', () => {
  if (!objects.length || window.confirm('Clear your canvas and start over?')) { recordHistory(); objects = []; state.objects = objects; selectedId = null; render(); showToast('A fresh canvas, just for you.'); }
});
document.querySelector('#download-button').addEventListener('click', downloadPng);
document.querySelector('#page-size').addEventListener('change', event => setPageSize(event.target.value));
document.querySelectorAll('[data-orientation]').forEach(button => button.addEventListener('click', () => setPageSize(state.page.preset || 'custom', button.dataset.orientation)));
document.querySelectorAll('[data-background]').forEach(button => button.addEventListener('click', () => setBackground(button.dataset.background)));
document.querySelector('#background-color').addEventListener('input', event => setBackground(event.target.value));
document.querySelectorAll('[data-gradient]').forEach(button => button.addEventListener('click', () => button.dataset.gradient === 'none' ? setBackground(state.page.background, null) : setBackground(state.page.background, button.dataset.gradient)));
function customSizeChanged() {
  const width = Math.max(200, Math.min(2400, Number(document.querySelector('#custom-width').value) || 800));
  const height = Math.max(200, Math.min(2400, Number(document.querySelector('#custom-height').value) || 520));
  recordHistory(); state.page = { ...state.page, preset: 'custom', label: 'Custom canvas', width, height, orientation: width > height ? 'landscape' : 'portrait' }; render();
}
document.querySelector('#custom-width').addEventListener('change', customSizeChanged);
document.querySelector('#custom-height').addEventListener('change', customSizeChanged);
artboard.addEventListener('pointerdown', event => {
  const target = event.target.closest('[data-object-id]');
  if (!target) { selectedId = null; render(); return; }
  selectedId = Number(target.dataset.objectId); const item = selectedObject(); const point = pointerPosition(event);
  recordHistory(); drag = { id: item.id, startX: point.x, startY: point.y, x: item.x, y: item.y };
  artboard.setPointerCapture(event.pointerId); render();
});
artboard.addEventListener('pointermove', event => {
  if (!drag) return; const item = objects.find(value => value.id === drag.id); if (!item) return;
  const point = pointerPosition(event); item.x = Math.max(0, Math.min(pageWidth() - 12, drag.x + point.x - drag.startX)); item.y = Math.max(0, Math.min(pageHeight() - 12, drag.y + point.y - drag.startY));
  renderScene(); saveDesign();
});
artboard.addEventListener('pointerup', () => { if (drag) { drag = null; render(); } });
artboard.addEventListener('pointercancel', () => { drag = null; render(); });
properties.addEventListener('input', event => {
  const input = event.target.closest('[data-property]'); if (!input) return; const item = selectedObject(); if (!item) return;
  if (!input.dataset.historyRecorded) { recordHistory(); input.dataset.historyRecorded = 'true'; }
  const key = input.dataset.property;
  if (key === 'text') item.text = input.value;
  else if (['fontSize', 'strokeWidth', 'width', 'height', 'fontWeight'].includes(key)) item[key] = Number(input.value);
  else item[key] = input.value;
  const value = properties.querySelector(`[data-value="${key}"]`); if (value) value.textContent = `${item[key]}px`;
  const colorCode = input.closest('.color-control')?.querySelector('code'); if (colorCode) colorCode.textContent = input.value.toUpperCase();
  renderScene(); renderLayers(); saveDesign();
});
properties.addEventListener('change', event => { if (event.target.matches('[data-property]')) delete event.target.dataset.historyRecorded; });
properties.addEventListener('click', event => {
  if (event.target.closest('[data-delete-selected]')) { recordHistory(); objects = objects.filter(item => item.id !== selectedId); state.objects = objects; selectedId = null; render(); showToast('Layer removed.'); return; }
  const duplicate = event.target.closest('[data-duplicate]');
  if (duplicate) { const item = selectedObject(); if (!item) return; recordHistory(); const copy = { ...item, id: nextId++, x: item.x + 24, y: item.y + 24 }; objects.push(copy); selectedId = copy.id; render(); showToast('Layer duplicated.'); return; }
  const move = event.target.closest('[data-layer-move]');
  if (move) { const index = objects.findIndex(item => item.id === selectedId); const step = move.dataset.layerMove === 'front' ? 1 : -1; const target = index + step; if (index >= 0 && target >= 0 && target < objects.length) { recordHistory(); [objects[index], objects[target]] = [objects[target], objects[index]]; render(); } }
});
layers.addEventListener('click', event => { const row = event.target.closest('[data-layer-id]'); if (!row) return; selectedId = Number(row.dataset.layerId); render(); });
document.addEventListener('keydown', event => {
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); return; }
  if (!typing && (event.key === 'Delete' || event.key === 'Backspace') && selectedId !== null) { recordHistory(); objects = objects.filter(item => item.id !== selectedId); state.objects = objects; selectedId = null; render(); showToast('Layer removed.'); }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); saveDesign(); showToast('Your design is saved on this device.'); }
});

syncPageControls(); render();
