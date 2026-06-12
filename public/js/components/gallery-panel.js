import state from '../state.js';
import { t } from '../i18n.js';

const galleryList = document.getElementById('galleryList');
const galleryEmpty = document.getElementById('galleryEmpty');

// 所有缩略图数据
let galleryItems = [];

export function init() {
  // 监听生成完成 → 追加缩略图
  window.addEventListener('imagesGenerated', (e) => {
    const result = e.detail;
    if (result.images && result.images.length > 0) {
      appendImages(result.images);
    }
  });

  // 监听切换迭代 → 更新缩略图
  window.addEventListener('switchIteration', (e) => {
    const { iteration } = e.detail;
    if (iteration.images) {
      const images = iteration.images.map((img) => ({
        id: img.id,
        localPath: img.localPath,
        dataUrl: img.localPath ? `/api/images/${img.id}` : null,
      }));
      appendImages(images);
    }
  });
}

/** 追加图片到面板（内部方法） */
function appendImages(images) {
  hideEmpty();

  images.forEach((img) => {
    const src = resolveImageSrc(img);
    if (!src) return;

    // 避免重复
    if (galleryItems.find((item) => item.id === img.id)) return;

    galleryItems.push({ id: img.id, src });

    const thumb = createThumbElement(img.id, src);
    galleryList.appendChild(thumb);

    // 滚动到底部
    galleryList.scrollTop = galleryList.scrollHeight;
  });
}

/** 导出：追加图片到面板（供 app.js 加载历史会话时使用） */
export function appendToGallery(images) {
  appendImages(images);
}

/** 导出：清空面板（供 app.js 新建会话时使用） */
export function clearGallery() {
  galleryItems = [];
  galleryList.innerHTML = '';
  showEmpty();
}

/** 创建单个缩略图元素 */
function createThumbElement(id, src) {
  const thumb = document.createElement('div');
  thumb.className = 'gallery-thumb';
  thumb.dataset.id = id;

  const imgEl = document.createElement('img');
  imgEl.src = src;
  imgEl.alt = id;
  imgEl.loading = 'lazy';

  // 悬停操作层
  const overlay = document.createElement('div');
  overlay.className = 'gallery-thumb-overlay';
  overlay.innerHTML = `
    <button class="btn-icon" title="${t('action.preview')}" data-action="preview">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
    </button>
    <button class="btn-icon" title="${t('action.edit')}" data-action="edit">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
    </button>
  `;

  // 事件：点击缩略图 → 预览
  imgEl.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('lightbox', {
      detail: { src, prompt: state.lastPrompt || '' },
    }));
  });

  // 事件：操作按钮
  overlay.querySelectorAll('.btn-icon').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      if (action === 'preview') {
        window.dispatchEvent(new CustomEvent('lightbox', {
          detail: { src, prompt: state.lastPrompt || '' },
        }));
      } else if (action === 'edit') {
        window.dispatchEvent(new CustomEvent('editImage', {
          detail: { src, id },
        }));
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