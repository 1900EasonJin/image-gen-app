import state from '../state.js';
import { $ } from '../utils/dom.js';
import { t } from '../i18n.js';

const canvasGrid = document.getElementById('canvasGrid');
const canvasPlaceholder = document.getElementById('canvasPlaceholder');

let currentPrompt = '';

export function setPrompt(prompt) {
  currentPrompt = prompt;
}

/** 显示空状态（画布占位） */
export function showEmpty() {
  canvasGrid.classList.add('hidden');
  canvasGrid.innerHTML = '';
  canvasPlaceholder.classList.remove('hidden');

  // 同时隐藏迭代链条
  document.getElementById('iterationChain')?.classList.add('hidden');

  // 更新顶部状态标签
  const statusTag = document.getElementById('statusTag');
  if (statusTag) {
    statusTag.textContent = '暂无数据';
    statusTag.style.color = '';
  }
}

/** 渲染生成结果 */
export function renderResult(images) {
  if (!images || images.length === 0) {
    showEmpty();
    return;
  }

  canvasPlaceholder.classList.add('hidden');
  canvasGrid.classList.remove('hidden');
  canvasGrid.innerHTML = '';

  // 根据图片数量设置布局类
  const count = images.length;
  canvasGrid.className = 'canvas-grid';
  if (count === 1) canvasGrid.classList.add('count-1');
  else if (count === 2) canvasGrid.classList.add('count-2');
  else if (count === 3) canvasGrid.classList.add('count-3');
  else if (count === 4) canvasGrid.classList.add('count-4');
  else canvasGrid.classList.add('count-many');

  images.forEach((img) => {
    const imgSrc = resolveImageSrc(img);
    if (!imgSrc) return;

    const card = document.createElement('div');
    card.className = 'image-card';
    card.dataset.id = img.id;

    const imgEl = document.createElement('img');
    imgEl.src = imgSrc;
    imgEl.alt = img.id;
    imgEl.loading = 'lazy';

    const overlay = document.createElement('div');
    overlay.className = 'hover-overlay';
    overlay.innerHTML = `
      <button class="btn-icon" title="${t('action.preview')}" data-action="preview">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
      </button>
      <button class="btn-icon" title="${t('action.download')}" data-action="download">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
      </button>
      <button class="btn-icon" title="${t('action.edit')}" data-action="edit">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
    `;

    overlay.querySelectorAll('.btn-icon').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        handleAction(action, img, imgSrc);
      });
    });

    card.appendChild(imgEl);
    card.appendChild(overlay);
    canvasGrid.appendChild(card);
  });
}

function resolveImageSrc(img) {
  if (img.dataUrl) return img.dataUrl;
  if (img.localPath) return `/api/images/${img.id}`;
  if (img.url) return img.url;
  return '';
}

function handleAction(action, img, imgSrc) {
  switch (action) {
    case 'preview':
      window.dispatchEvent(new CustomEvent('lightbox', {
        detail: { src: imgSrc, prompt: currentPrompt },
      }));
      break;
    case 'download':
      downloadImage(img, imgSrc);
      break;
    case 'edit':
      window.dispatchEvent(new CustomEvent('editImage', {
        detail: { src: imgSrc, id: img.id },
      }));
      break;
  }
}

function downloadImage(img, imgSrc) {
  const link = document.createElement('a');

  if (imgSrc.startsWith('data:')) {
    link.href = imgSrc;
    link.download = `${img.id}.png`;
  } else if (imgSrc.startsWith('/api/')) {
    link.href = imgSrc;
    link.download = `${img.id}.png`;
  } else {
    fetch(imgSrc)
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.download = `${img.id}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      })
      .catch(() => window.open(imgSrc, '_blank'));
    return;
  }

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
