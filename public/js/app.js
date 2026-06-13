/**
 * Image Gen v2 — 主入口
 * 初始化组件、绑定全局事件
 */

import { init as sidebarInit } from './components/sidebar.js';
import { init as settingsInit } from './components/settings.js';
import { init as inputInit, enterEditMode, exitEditMode } from './components/input-area.js';
import { renderResult, setPrompt, showEmpty } from './components/result-grid.js';
import { init as lightboxInit, open as openLightbox } from './components/lightbox.js';
import { init as workAreaInit } from './components/work-area.js';
import { init as galleryPanelInit, clearGallery, appendToGallery } from './components/gallery-panel.js';
import { clearChain } from './components/iteration-chain.js';
import { init as languageInit } from './components/language.js';
import { showToast } from './utils/toast.js';
import { renderSessionList, renderArchiveList, loadSessionDetail } from './utils/session-list.js';
import state from './state.js';
import { t, applyLanguage, setLang, getLang } from './i18n.js';

// ===== 初始化 =====

async function init() {
  applyLanguage();
  languageInit();
  lightboxInit();
  settingsInit();
  inputInit();
  workAreaInit();
  galleryPanelInit();
  initInputResize();
  initArchiveModal();

  // 并行初始化：sidebar + 会话列表
  await Promise.all([sidebarInit(), renderSessionList()]);

  // 新建对话
  document.getElementById('newSessionBtn')?.addEventListener('click', newSession);

  // 全局事件监听
  bindGlobalEvents();
}

function bindGlobalEvents() {
  // 模型选择变化 → 更新空状态
  window.addEventListener('modelSelected', () => showEmpty());

  // 生成完成 → 渲染结果 + 刷新会话列表
  window.addEventListener('imagesGenerated', (e) => {
    const result = e.detail;
    setPrompt(state.lastPrompt || '');
    renderResult(result.images);
    renderSessionList();
  });

  // Lightbox 预览
  window.addEventListener('lightbox', (e) => {
    const { src, prompt, id } = e.detail;
    openLightbox(src, prompt);
    if (id && state.editChain?.length > 0) {
      const nodes = document.querySelectorAll('.iteration-node');
      const idx = state.editChain.findIndex(item => item.id === id);
      if (idx >= 0) nodes.forEach((n, i) => n.classList.toggle('active', i === idx));
    }
  });

  // 修改图片 → 进入编辑模式
  window.addEventListener('editImage', (e) => {
    const { src, id, sourceUrl } = e.detail;
    const ref = sourceUrl || src;
    console.log(`[editImage] id=${id} type=${sourceUrl ? 'OSS_URL' : 'base64/local'}`);
    enterEditMode(ref, src, id);
  });

  // 迭代切换
  window.addEventListener('switchIteration', (e) => {
    const { iteration } = e.detail;
    if (iteration.images) {
      renderResult(iteration.images.map(img => ({
        id: img.id,
        localPath: img.localPath,
        dataUrl: img.localPath ? `/api/images/${img.id}` : null,
        sourceUrl: img.sourceUrl || null,
      })));
    }
  });

  // 会话加载（从侧边栏点击历史会话）
  window.addEventListener('sessionLoaded', (e) => {
    const session = e.detail;
    exitEditMode();
    document.getElementById('promptInput').value = '';

    const iterations = session.iterations || [];
    if (iterations.length > 0) {
      const latest = iterations[iterations.length - 1];
      const images = (latest.images || []).map(img => ({
        id: img.id,
        dataUrl: img.localPath ? `/api/images/${img.id}` : null,
        localPath: img.localPath,
        sourceUrl: img.sourceUrl || null,
      }));
      setPrompt(session.prompt || '');
      renderResult([images[0]]);
      clearChain();

      // 画廊：收集所有迭代的图片
      clearGallery();
      const allImages = [];
      for (const iter of iterations) {
        for (const img of (iter.images || [])) {
          if (img.localPath) {
            allImages.push({
              id: img.id,
              dataUrl: `/api/images/${img.id}`,
              localPath: img.localPath,
              sourceUrl: img.sourceUrl || null,
            });
          }
        }
      }
      appendToGallery(allImages);
    }
  });

  // 新建会话事件
  window.addEventListener('newSession', newSession);

  // 跟踪 prompt
  document.getElementById('promptInput')?.addEventListener('input', function () {
    state.lastPrompt = this.value;
  });
}

// ===== 新建会话 =====

function newSession() {
  state.currentSession = null;
  state.referenceImage = null;
  state.lastPrompt = '';
  document.getElementById('promptInput').value = '';
  document.getElementById('promptInput').placeholder = t('input.placeholder');
  exitEditMode();
  showEmpty();
  clearChain();
  clearGallery();
  showToast(t('toast.newSession'), 'info');
}

// ===== 输入框拖拽 =====

function initInputResize() {
  const handle = document.getElementById('inputGrabHandle');
  const textarea = document.getElementById('promptInput');
  if (!handle || !textarea) return;

  const MIN = 56, MAX = 360;
  let resizing = false, startY = 0, startH = 0;

  handle.addEventListener('mousedown', (e) => {
    resizing = true; startY = e.clientY; startH = textarea.offsetHeight;
    handle.classList.add('active');
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!resizing) return;
    const h = Math.max(MIN, Math.min(MAX, startH + startY - e.clientY));
    textarea.style.height = h + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!resizing) return;
    resizing = false;
    handle.classList.remove('active');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });

  handle.addEventListener('dblclick', () => { textarea.style.height = ''; });
}

// ===== 归档弹窗 =====

function initArchiveModal() {
  const modal = document.getElementById('archiveModal');
  document.getElementById('archiveToggleBtn')?.addEventListener('click', () => {
    modal.classList.remove('hidden');
    renderArchiveList();
  });
  document.getElementById('archiveModalClose')?.addEventListener('click', () => modal.classList.add('hidden'));
  modal.querySelector('.modal-overlay')?.addEventListener('click', () => modal.classList.add('hidden'));
}

// ===== 启动 =====

init().catch((err) => {
  console.error('初始化失败:', err);
  showToast(t('toast.appInitFailed'), 'error');
});
