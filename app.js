const artboard = document.querySelector('#artboard');
const scene = document.querySelector('#scene');
const properties = document.querySelector('#properties');
const layers = document.querySelector('#layers');
const selectionCount = document.querySelector('#selection-count');
const layerCount = document.querySelector('#layer-count');
const toast = document.querySelector('#toast');
const STORAGE_KEY = 'createshop-design-v1';

let nextId = 1;
let selectedId = null;
let drag = null;
let toastTimer;
let objects = loadDesign();

function loadDesign() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved)) {
      nextId = saved.reduce((max, item) => Math.max(max, Number(item.id) + 1), 1);
      return saved;
    }
  } catch (error) {
    console.warn('Could not load the saved design.', error);
  }
  return [];
}

function saveDesign() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(objects));
  } catch (error) {
    console.warn('Could not save the design.', error);
  }
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
  })[char]);
}

function selectedObject() {
  return objects.find(item => item.id === selectedId) || null;
}

function renderScene() {
  scene.innerHTML = objects.map(item => {
    const active = item.id === selectedId;
    const shape = item.type === 'text'
      ? `<text class="design-text" x="${item.x}" y="${item.y + item.fontSize}" fill="${item.color}" font-family="DM Sans, Arial, sans-serif" font-size="${item.fontSize}" font-weight="${item.fontWeight || 700}" data-object-id="${item.id}">${escapeXml(item.text)}</text>`
      : item.type === 'circle'
        ? `<circle cx="${item.x + item.width / 2}" cy="${item.y + item.height / 2}" r="${Math.min(item.width, item.height) / 2}" fill="${item.fill}" stroke="${item.stroke}" stroke-width="${item.strokeWidth}" data-object-id="${item.id}"/>`
        : `<rect x="${item.x}" y="${item.y}" width="${item.width}" height="${item.height}" rx="${item.radius || 12}" fill="${item.fill}" stroke="${item.stroke}" stroke-width="${item.strokeWidth}" data-object-id="${item.id}"/>`;
    const bounds = item.type === 'text'
      ? `<rect class="selection-box" x="${item.x - 6}" y="${item.y - 5}" width="${Math.max(90, item.text.length * item.fontSize * 0.57) + 12}" height="${item.fontSize + 14}" rx="5"/>`
      : item.type === 'circle'
        ? `<ellipse class="selection-box" cx="${item.x + item.width / 2}" cy="${item.y + item.height / 2}" rx="${item.width / 2 + 5}" ry="${item.height / 2 + 5}"/>`
        : `<rect class="selection-box" x="${item.x - 5}" y="${item.y - 5}" width="${item.width + 10}" height="${item.height + 10}" rx="${(item.radius || 12) + 3}"/>`;
    return `<g class="design-object${active ? ' is-selected' : ''}" data-object-id="${item.id}">${active ? bounds : ''}${shape}</g>`;
  }).join('');
}

function renderProperties() {
  const item = selectedObject();
  selectionCount.textContent = item ? '1 selected' : '—';
  if (!item) {
    properties.innerHTML = '<div class="empty-state"><span class="empty-cursor">↖</span><p>Select an object on your canvas to edit its style.</p></div>';
    return;
  }

  const textControls = item.type === 'text'
    ? `<label class="field"><span>Text</span><input class="text-input" data-property="text" type="text" maxlength="80" value="${escapeXml(item.text)}" /></label>
       <label class="field"><span>Font size <b data-value="fontSize">${item.fontSize}px</b></span><input data-property="fontSize" type="range" min="12" max="100" value="${item.fontSize}" /></label>
       <label class="field"><span>Text color</span><span class="color-control"><input data-property="color" type="color" value="${item.color}" /><code>${item.color.toUpperCase()}</code></span></label>`
    : `<label class="field"><span>Fill color</span><span class="color-control"><input data-property="fill" type="color" value="${item.fill}" /><code>${item.fill.toUpperCase()}</code></span></label>
       <label class="field"><span>Outline color</span><span class="color-control"><input data-property="stroke" type="color" value="${item.stroke}" /><code>${item.stroke.toUpperCase()}</code></span></label>
       <label class="field"><span>Outline width <b data-value="strokeWidth">${item.strokeWidth}px</b></span><input data-property="strokeWidth" type="range" min="0" max="16" value="${item.strokeWidth}" /></label>`;

  properties.innerHTML = `<div class="property-form">${textControls}
    ${item.type !== 'text' ? `<label class="field"><span>Size</span><div class="size-fields"><label><span class="sr-only">Width</span><input data-property="width" type="number" min="24" max="760" value="${item.width}" aria-label="Width" /><span>W</span></label><label><span class="sr-only">Height</span><input data-property="height" type="number" min="24" max="480" value="${item.height}" aria-label="Height" /><span>H</span></label></div></label>` : ''}
    <button class="delete-button" type="button" data-delete-selected><span aria-hidden="true">⌫</span> Delete selection <kbd>⌫</kbd></button>
  </div>`;
}

function renderLayers() {
  layerCount.textContent = String(objects.length);
  if (!objects.length) {
    layers.innerHTML = '<p class="layers-empty">Your design is waiting for its first layer.</p>';
    return;
  }
  layers.innerHTML = [...objects].reverse().map(item => {
    const label = item.type === 'text' ? (item.text || 'Text') : item.type === 'rect' ? 'Rectangle' : 'Circle';
    const icon = item.type === 'text' ? 'T' : item.type === 'circle' ? '○' : '▱';
    return `<button class="layer-row${item.id === selectedId ? ' active' : ''}" type="button" data-layer-id="${item.id}"><span class="layer-type">${icon}</span><span class="layer-name">${escapeXml(label)}</span><span class="layer-eye" aria-hidden="true">◉</span></button>`;
  }).join('');
}

function render() {
  renderScene();
  renderProperties();
  renderLayers();
  saveDesign();
}

function addObject(type) {
  const offset = (objects.length % 5) * 18;
  const item = {
    id: nextId++, type, x: 110 + offset, y: 120 + offset,
    width: type === 'circle' ? 120 : 220,
    height: type === 'circle' ? 120 : 120,
    fill: type === 'circle' ? '#ffd4a8' : '#dcd7ff',
    stroke: type === 'circle' ? '#ff8b5e' : '#a99bff',
    strokeWidth: 2, radius: 16,
    color: '#28233d', text: 'Your text', fontSize: 36, fontWeight: 700
  };
  objects.push(item);
  selectedId = item.id;
  render();
  if (type === 'text') {
    const input = properties.querySelector('[data-property="text"]');
    input?.focus();
    input?.select();
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2600);
}

function pointerPosition(event) {
  const bounds = artboard.getBoundingClientRect();
  return { x: (event.clientX - bounds.left) * 800 / bounds.width, y: (event.clientY - bounds.top) * 520 / bounds.height };
}

function downloadPng() {
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1040" viewBox="0 0 800 520"><rect width="800" height="520" fill="#ffffff"/>${objects.map(item => {
    if (item.type === 'text') return `<text x="${item.x}" y="${item.y + item.fontSize}" fill="${item.color}" font-family="Arial,sans-serif" font-size="${item.fontSize}" font-weight="${item.fontWeight || 700}">${escapeXml(item.text)}</text>`;
    if (item.type === 'circle') return `<circle cx="${item.x + item.width / 2}" cy="${item.y + item.height / 2}" r="${Math.min(item.width, item.height) / 2}" fill="${item.fill}" stroke="${item.stroke}" stroke-width="${item.strokeWidth}"/>`;
    return `<rect x="${item.x}" y="${item.y}" width="${item.width}" height="${item.height}" rx="${item.radius || 12}" fill="${item.fill}" stroke="${item.stroke}" stroke-width="${item.strokeWidth}"/>`;
  }).join('')}</svg>`;
  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1600;
    canvas.height = 1040;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
    URL.revokeObjectURL(url);
    canvas.toBlob(png => {
      if (!png) return showToast('Could not export this design. Please try again.');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(png);
      link.download = 'createshop-design.png';
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      showToast('Your design is ready to go!');
    }, 'image/png');
  };
  image.onerror = () => { URL.revokeObjectURL(url); showToast('Could not export this design. Please try again.'); };
  image.src = url;
}

document.querySelectorAll('[data-add]').forEach(button => button.addEventListener('click', () => addObject(button.dataset.add)));

document.querySelector('#reset-button').addEventListener('click', () => {
  if (!objects.length || window.confirm('Clear your canvas and start over?')) {
    objects = [];
    selectedId = null;
    render();
    showToast('A fresh canvas, just for you.');
  }
});

document.querySelector('#download-button').addEventListener('click', downloadPng);

artboard.addEventListener('pointerdown', event => {
  const target = event.target.closest('[data-object-id]');
  if (!target) {
    selectedId = null;
    render();
    return;
  }
  selectedId = Number(target.dataset.objectId);
  const item = selectedObject();
  const point = pointerPosition(event);
  drag = { id: item.id, startX: point.x, startY: point.y, x: item.x, y: item.y };
  artboard.setPointerCapture(event.pointerId);
  render();
});

artboard.addEventListener('pointermove', event => {
  if (!drag) return;
  const item = objects.find(value => value.id === drag.id);
  if (!item) return;
  const point = pointerPosition(event);
  item.x = Math.max(0, Math.min(780, drag.x + point.x - drag.startX));
  item.y = Math.max(0, Math.min(480, drag.y + point.y - drag.startY));
  renderScene();
  saveDesign();
});

artboard.addEventListener('pointerup', () => { drag = null; });
artboard.addEventListener('pointercancel', () => { drag = null; });

properties.addEventListener('input', event => {
  const input = event.target.closest('[data-property]');
  if (!input) return;
  const item = selectedObject();
  if (!item) return;
  const key = input.dataset.property;
  if (key === 'text') item.text = input.value;
  else if (['fontSize', 'strokeWidth', 'width', 'height'].includes(key)) item[key] = Number(input.value);
  else item[key] = input.value;
  const value = properties.querySelector(`[data-value="${key}"]`);
  if (value) value.textContent = `${item[key]}px`;
  const colorCode = input.closest('.color-control')?.querySelector('code');
  if (colorCode) colorCode.textContent = input.value.toUpperCase();
  renderScene();
  renderLayers();
  saveDesign();
});

properties.addEventListener('click', event => {
  if (!event.target.closest('[data-delete-selected]')) return;
  objects = objects.filter(item => item.id !== selectedId);
  selectedId = null;
  render();
  showToast('Layer removed.');
});

layers.addEventListener('click', event => {
  const row = event.target.closest('[data-layer-id]');
  if (!row) return;
  selectedId = Number(row.dataset.layerId);
  render();
});

document.addEventListener('keydown', event => {
  const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
  if (!typing && (event.key === 'Delete' || event.key === 'Backspace') && selectedId !== null) {
    objects = objects.filter(item => item.id !== selectedId);
    selectedId = null;
    render();
    showToast('Layer removed.');
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    saveDesign();
    showToast('Your design is saved on this device.');
  }
});

render();
