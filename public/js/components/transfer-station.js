import { t } from '../i18n.js';
import { showToast } from '../utils/toast.js';

const STORAGE_KEY = 'image_gen_transfer_station';

function loadItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveItems(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function collectImage(dataUrl, prompt, sessionId) {
  const items = loadItems();

  if (items.some(item => item.dataUrl === dataUrl)) {
    showToast(t('station.added'), 'info');
    return;
  }

  items.unshift({
    id: 'station_' + Date.now(),
    dataUrl,
    prompt: prompt || '',
    sessionId: sessionId || '',
    timestamp: Date.now(),
  });

  saveItems(items);
  showToast(t('station.added'), 'success');
  window.dispatchEvent(new CustomEvent('stationUpdated'));
}

export function removeStationItem(id) {
  let items = loadItems();
  items = items.filter(item => item.id !== id);
  saveItems(items);
  showToast(t('station.removed'), 'info');
  window.dispatchEvent(new CustomEvent('stationUpdated'));
}

export function getStationItems() {
  return loadItems();
}

export function openStation(onSelect) {
  const modal = document.getElementById('stationModal');
  if (!modal) return;

  modal._onSelect = onSelect;
  modal.classList.remove('hidden');
  renderStationGrid(onSelect);
}

function closeStation() {
  const modal = document.getElementById('stationModal');
  if (modal) modal.classList.add('hidden');
}

let selectedItems = [];

function renderStationGrid(onSelect) {
  const grid = document.getElementById('stationGrid');
  const footer = document.getElementById('stationFooter');
  const countEl = document.getElementById('stationCount');
  const confirmBtn = document.getElementById('stationConfirmBtn');
  if (!grid) return;

  const items = loadItems();
  selectedItems = [];

  if (items.length === 0) {
    grid.innerHTML = `<p class="text-hint">${t('station.empty')}</p>`;
    if (footer) footer.classList.add('hidden');
    return;
  }

  grid.innerHTML = '';
  const isMultiMode = typeof onSelect === 'function';

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'station-item';
    card.dataset.id = item.id;

    const img = document.createElement('img');
    img.src = item.dataUrl;
    img.alt = item.prompt || '收藏图片';
    img.loading = 'lazy';

    const label = document.createElement('div');
    label.className = 'station-item-label';
    label.textContent = item.prompt?.substring(0, 30) || '';

    const checkbox = document.createElement('div');
    checkbox.className = 'station-checkbox';
    if (isMultiMode) {
      card.appendChild(checkbox);
    }

    const actions = document.createElement('div');
    actions.className = 'station-item-actions';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-icon';
    deleteBtn.title = t('action.delete');
    deleteBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeStationItem(item.id);
      renderStationGrid(onSelect);
    });

    actions.appendChild(deleteBtn);
    card.appendChild(img);
    card.appendChild(label);
    card.appendChild(actions);

    if (isMultiMode) {
      card.addEventListener('click', () => {
        const idx = selectedItems.indexOf(item.dataUrl);
        if (idx >= 0) {
          selectedItems.splice(idx, 1);
          card.classList.remove('selected');
          checkbox.classList.remove('checked');
        } else {
          selectedItems.push(item.dataUrl);
          card.classList.add('selected');
          checkbox.classList.add('checked');
        }
        updateConfirmButton();
      });
    } else {
      card.addEventListener('click', () => {
        if (onSelect) {
          onSelect(item.dataUrl);
          closeStation();
        }
      });
    }

    grid.appendChild(card);
  });

  if (footer && confirmBtn && countEl) {
    if (isMultiMode) {
      footer.classList.remove('hidden');
      updateConfirmButton();

      const newBtn = confirmBtn.cloneNode(true);
      confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);

      newBtn.addEventListener('click', () => {
        if (selectedItems.length === 0) {
          showToast('请至少选择一张图片', 'info');
          return;
        }
        onSelect(selectedItems);
        closeStation();
      });
    } else {
      footer.classList.add('hidden');
    }
  }
}

function updateConfirmButton() {
  const countEl = document.getElementById('stationCount');
  const confirmBtn = document.getElementById('stationConfirmBtn');
  if (countEl) {
    countEl.textContent = selectedItems.length > 0
      ? `已选择 ${selectedItems.length} 张`
      : '';
  }
  if (confirmBtn) {
    confirmBtn.disabled = selectedItems.length === 0;
  }
}

export function init() {
  const modal = document.getElementById('stationModal');
  if (!modal) return;

  document.getElementById('stationModalClose')?.addEventListener('click', closeStation);
  modal.querySelector('.modal-overlay')?.addEventListener('click', closeStation);

  window.addEventListener('stationUpdated', () => {
    if (!modal.classList.contains('hidden')) {
      renderStationGrid(modal._onSelect || null);
    }
  });
}
