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
  document.getElementById('iterationChain')?.classList.add('chain-hidden');

  // 更新顶部状态标签
  const statusTag = document.getElementById('statusTag');
  if (statusTag) {
    statusTag.textContent = t('work.noData');
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

  // 更新状态标签
  const statusTag = document.getElementById('statusTag');
  if (statusTag) {
    statusTag.textContent = t('work.generated');
    statusTag.style.color = '';
  }

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
    card.dataset.sourceUrl = img.sourceUrl || img.url || '';

    const imgEl = document.createElement('img');
    imgEl.src = imgSrc;
    imgEl.alt = img.id;
    imgEl.loading = 'lazy';

    // 图片加载后，根据实际尺寸动态设置 card 宽高比
    imgEl.onload = () => {
      const nw = imgEl.naturalWidth;
      const nh = imgEl.naturalHeight;
      if (nw && nh) {
        // 使用 CSS aspect-ratio 确保容器比例跟随图片
        card.style.aspectRatio = `${nw} / ${nh}`;
      }
    };
    // 如果图片已缓存立即触发
    if (imgEl.complete && imgEl.naturalWidth) {
      card.style.aspectRatio = `${imgEl.naturalWidth} / ${imgEl.naturalHeight}`;
    }

    const overlay = document.createElement('div');
    overlay.className = 'hover-overlay';
    overlay.innerHTML = `
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
        handleAction(action, img, imgSrc, card);
      });
    });

    // 点击图片 → 预览
    imgEl.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('lightbox', {
        detail: { src: imgSrc, prompt: currentPrompt, id: img.id },
      }));
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

function handleAction(action, img, imgSrc, card) {
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
      editWithAnimation(img, imgSrc, card);
      break;
  }
}

/** 多图模式下：所有图一起淡出，选中图以单图样式重新淡入 */
function editWithAnimation(img, imgSrc, card) {
  const allCards = canvasGrid.querySelectorAll('.image-card');
  const sourceUrl = img.sourceUrl || img.url || '';

  if (allCards.length <= 1) {
    window.dispatchEvent(new CustomEvent('editImage', {
      detail: { src: imgSrc, id: img.id, sourceUrl },
    }));
    return;
  }

  // 记录选中图的完整数据
  const selectedImg = { ...img };

  // 第一步：所有图一起淡出
  allCards.forEach((c) => {
    c.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    c.style.opacity = '0';
    c.style.transform = 'scale(0.92)';
  });

  // 第二步：淡出完成后，用单图重新渲染 + 触发编辑
  setTimeout(() => {
    renderResult([selectedImg]);
    // 稍等一帧确保 DOM 已更新，再进入编辑模式
    requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent('editImage', {
        detail: { src: imgSrc, id: img.id, sourceUrl },
      }));
    });
  }, 420);
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
