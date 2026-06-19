import state from '../state.js';
import { t } from '../i18n.js';
import { renderResult } from './result-grid.js';
import { collectImage } from './transfer-station.js';

const GALLERY_BATCH_SIZE = 20;

const galleryList = typeof document !== 'undefined' ? document.getElementById('galleryList') : null;
const galleryEmpty = typeof document !== 'undefined' ? document.getElementById('galleryEmpty') : null;
const galleryPanel = typeof document !== 'undefined' ? document.getElementById('galleryPanel') : null;
const galleryResizeHandle = typeof document !== 'undefined' ? document.getElementById('galleryResizeHandle') : null;

let galleryItems = [];
let renderedStartIndex = 0;

export function getInitialGalleryItems(items, batchSize = GALLERY_BATCH_SIZE) {
  const start = Math.max(0, items.length - batchSize);
  return items.slice(start);
}

export function getOlderGalleryItems(items, currentStartIndex, batchSize = GALLERY_BATCH_SIZE) {
  const start = Math.max(0, currentStartIndex - batchSize);
  return items.slice(start, currentStartIndex);
}

export function init() {
  let isResizing = false;
  let resizeStartX = 0;
  let resizeStartWidth = 0;

  if (galleryResizeHandle && galleryPanel) {
    galleryResizeHandle.addEventListener('mousedown', (e) => {
      isResizing = true;
      resizeStartX = e.clientX;
      resizeStartWidth = galleryPanel.offsetWidth;
      galleryResizeHandle.classList.add('active');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });
  }

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

  if (galleryList) {
    galleryList.addEventListener('scroll', () => {
      if (galleryList.scrollTop <= 24) {
        prependOlderImages();
      }
    });
  }

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
  if (!galleryList) return;
  hideEmpty();

  images.forEach((img) => {
    const item = normalizeGalleryItem(img);
    if (!item) return;

    if (galleryItems.find((existing) => existing.id === item.id)) return;

    galleryItems.push(item);

    const thumb = createThumbElement(item.id, item.src, item.sourceUrl, item.thumbSrc);
    galleryList.appendChild(thumb);
    renderedStartIndex = Math.max(0, galleryItems.length - galleryList.querySelectorAll('.gallery-thumb').length);
    galleryList.scrollTop = galleryList.scrollHeight;
  });
}

export function appendToGallery(images) {
  appendImages(images);
}

export function clearGallery() {
  galleryItems = [];
  renderedStartIndex = 0;
  if (galleryList) galleryList.innerHTML = '';
  showEmpty();
}

export function replaceGalleryWithAnimation(images) {
  const thumbs = galleryList.querySelectorAll('.gallery-thumb');
  const hasOldThumbs = thumbs.length > 0;

  if (!hasOldThumbs) {
    replaceGalleryItems(images);
    appendImagesWithEnterAnimation(getInitialGalleryItems(galleryItems));
    return;
  }

  thumbs.forEach((thumb) => {
    thumb.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    thumb.style.opacity = '0';
    thumb.style.transform = 'scale(0.92)';
  });

  window.setTimeout(() => {
    replaceGalleryItems(images);
    appendImagesWithEnterAnimation(getInitialGalleryItems(galleryItems));
  }, 620);
}

function appendImagesWithEnterAnimation(images) {
  const thumbs = renderGalleryItems(images, { animateEnter: true });
  renderedStartIndex = Math.max(0, galleryItems.length - images.length);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      thumbs.forEach((thumb, index) => {
        const delay = Math.min(index * 35, 280);
        thumb.style.transitionDelay = `${delay}ms`;
        thumb.style.opacity = '1';
        thumb.style.transform = 'translateY(0) scale(1)';
      });
    });
  });
}

function replaceGalleryItems(images) {
  galleryItems = images.map(normalizeGalleryItem).filter(Boolean);
  renderedStartIndex = Math.max(0, galleryItems.length - GALLERY_BATCH_SIZE);
  if (galleryList) galleryList.innerHTML = '';
  if (galleryItems.length > 0) hideEmpty();
  else showEmpty();
}

function renderGalleryItems(items, options = {}) {
  if (!galleryList) return [];
  if (items.length > 0) hideEmpty();

  const thumbs = items.map((item) => {
    const thumb = createThumbElement(item.id, item.src, item.sourceUrl, item.thumbSrc);

    if (options.animateEnter) {
      thumb.style.opacity = '0';
      thumb.style.transform = 'translateY(10px) scale(0.97)';
      thumb.style.transition = 'opacity 0.28s ease, transform 0.28s ease';
      thumb.style.willChange = 'opacity, transform';
      thumb.addEventListener('transitionend', () => {
        thumb.style.willChange = '';
        thumb.style.transitionDelay = '0s';
      }, { once: true });
    }

    galleryList.appendChild(thumb);
    return thumb;
  });

  galleryList.scrollTop = galleryList.scrollHeight;
  return thumbs;
}

function prependOlderImages() {
  if (!galleryList || renderedStartIndex <= 0) return;

  const previousHeight = galleryList.scrollHeight;
  const olderItems = getOlderGalleryItems(galleryItems, renderedStartIndex);
  const fragment = document.createDocumentFragment();

  olderItems.forEach((item) => {
    fragment.appendChild(createThumbElement(item.id, item.src, item.sourceUrl, item.thumbSrc));
  });

  galleryList.prepend(fragment);
  renderedStartIndex = Math.max(0, renderedStartIndex - olderItems.length);
  galleryList.scrollTop = galleryList.scrollHeight - previousHeight + galleryList.scrollTop;
}

function createThumbElement(id, src, sourceUrl, thumbSrc = src) {
  const thumb = document.createElement('div');
  thumb.className = 'gallery-thumb';
  thumb.dataset.id = id;
  thumb.dataset.fullSrc = src;
  if (sourceUrl) thumb.dataset.sourceUrl = sourceUrl;

  const imgEl = document.createElement('img');
  imgEl.alt = id;
  imgEl.loading = 'lazy';
  imgEl.decoding = 'async';
  imgEl.addEventListener('load', () => {
    imgEl.classList.add('loaded');
  });
  imgEl.src = thumbSrc;
  if (imgEl.complete) {
    imgEl.classList.add('loaded');
  }

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

function normalizeGalleryItem(img) {
  const src = resolveImageSrc(img);
  if (!src) return null;
  return {
    id: img.id,
    src,
    thumbSrc: img.localPath ? `/api/images/${img.id}/thumb` : src,
    sourceUrl: img.sourceUrl || img.url || null,
  };
}

function resolveImageSrc(img) {
  if (img.dataUrl) return img.dataUrl;
  if (img.localPath) return `/api/images/${img.id}`;
  if (img.url) return img.url;
  return '';
}
