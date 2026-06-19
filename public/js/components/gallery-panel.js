import state from '../state.js';
import { t } from '../i18n.js';
import { renderResult } from './result-grid.js';
import { collectImage } from './transfer-station.js';

const galleryList = document.getElementById('galleryList');
const galleryEmpty = document.getElementById('galleryEmpty');
const galleryPanel = document.getElementById('galleryPanel');
const galleryResizeHandle = document.getElementById('galleryResizeHandle');

let galleryItems = [];

export function init() {
  let isResizing = false;
  let resizeStartX = 0;
  let resizeStartWidth = 0;

  galleryResizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    resizeStartX = e.clientX;
    resizeStartWidth = galleryPanel.offsetWidth;
    galleryResizeHandle.classList.add('active');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const delta = resizeStartX - e.clientX;
    const newWidth = Math.max(100, Math.min(500, resizeStartWidth + delta));
    galleryPanel.style.width = newWidth + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!isResizing) return;
    isResizing = false;
    galleryResizeHandle.classList.remove('active');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });

  window.addEventListener('imagesGenerated', (e) => {
    const result = e.detail;
    if (result.images && result.images.length > 0) {
      appendImages(result.images);
    }
  });

  window.addEventListener('switchIteration', (e) => {
    const { iteration } = e.detail;
    if (iteration.images) {
      const images = iteration.images.map((img) => ({
        id: img.id,
        localPath: img.localPath,
        dataUrl: img.localPath ? `/api/images/${img.id}` : null,
        sourceUrl: img.sourceUrl || null,
      }));
      appendImages(images);
    }
  });
}

function appendImages(images) {
  hideEmpty();

  images.forEach((img) => {
    const src = resolveImageSrc(img);
    if (!src) return;

    if (galleryItems.find((item) => item.id === img.id)) return;

    galleryItems.push({ id: img.id, src, sourceUrl: img.sourceUrl || img.url || null });

    const thumb = createThumbElement(img.id, src, img.sourceUrl || img.url || null);
    galleryList.appendChild(thumb);
    galleryList.scrollTop = galleryList.scrollHeight;
  });
}

export function appendToGallery(images) {
  appendImages(images);
}

export function clearGallery() {
  galleryItems = [];
  galleryList.innerHTML = '';
  showEmpty();
}

function createThumbElement(id, src, sourceUrl) {
  const thumb = document.createElement('div');
  thumb.className = 'gallery-thumb';
  thumb.dataset.id = id;
  if (sourceUrl) thumb.dataset.sourceUrl = sourceUrl;

  const imgEl = document.createElement('img');
  imgEl.src = src;
  imgEl.alt = id;
  imgEl.loading = 'lazy';

  const overlay = document.createElement('div');
  overlay.className = 'gallery-thumb-overlay';
  overlay.innerHTML = `
    <button class="btn-icon" title="${t('action.edit')}" data-action="edit">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
    </button>
    <button class="btn-icon btn-collect" title="${t('action.collect')}" data-action="collect">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
    </button>
  `;

  imgEl.addEventListener('click', () => {
    const canvasGrid = document.getElementById('canvasGrid');
    const currentCards = canvasGrid.querySelectorAll('.image-card');

    // 如果点击的图片已经在画布上，不做任何操作（避免闪烁）
    if (currentCards.length === 1 && currentCards[0].dataset.id === id) return;

    if (currentCards.length > 0) {
      currentCards.forEach((c) => {
        c.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        c.style.opacity = '0';
        c.style.transform = 'scale(0.92)';
      });

      setTimeout(() => {
        renderResult([{
          id,
          dataUrl: src,
          url: sourceUrl || null,
          sourceUrl: sourceUrl || null,
        }]);
      }, 420);
    } else {
      renderResult([{
        id,
        dataUrl: src,
        url: sourceUrl || null,
        sourceUrl: sourceUrl || null,
      }]);
    }
  });

  overlay.querySelectorAll('.btn-icon').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      if (action === 'collect') {
        collectImage(src, '', state.currentSession?.id);
        return;
      }
      if (action === 'edit') {
        const canvasGrid = document.getElementById('canvasGrid');
        const currentCards = canvasGrid.querySelectorAll('.image-card');

        if (currentCards.length > 0) {
          currentCards.forEach((c) => {
            c.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
            c.style.opacity = '0';
            c.style.transform = 'scale(0.92)';
          });

          setTimeout(() => {
            renderResult([{
              id,
              dataUrl: src,
              url: sourceUrl || null,
              sourceUrl: sourceUrl || null,
            }]);

            requestAnimationFrame(() => {
              window.dispatchEvent(new CustomEvent('editImage', {
                detail: { src, id, sourceUrl: thumb.dataset.sourceUrl || null },
              }));
            });
          }, 420);
        } else {
          renderResult([{
            id,
            dataUrl: src,
            url: sourceUrl || null,
            sourceUrl: sourceUrl || null,
          }]);

          requestAnimationFrame(() => {
            window.dispatchEvent(new CustomEvent('editImage', {
              detail: { src, id, sourceUrl: thumb.dataset.sourceUrl || null },
            }));
          });
        }
      }
    });
  });

  thumb.appendChild(imgEl);
  thumb.appendChild(overlay);
  return thumb;
}

function showEmpty() {
  if (galleryEmpty) galleryEmpty.classList.remove('hidden');
}

function hideEmpty() {
  if (galleryEmpty) galleryEmpty.classList.add('hidden');
}

function resolveImageSrc(img) {
  if (img.dataUrl) return img.dataUrl;
  if (img.localPath) return `/api/images/${img.id}`;
  if (img.url) return img.url;
  return '';
}
