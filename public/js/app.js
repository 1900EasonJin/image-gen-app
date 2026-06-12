import { init as sidebarInit } from './components/sidebar.js';
import { init as settingsInit } from './components/settings.js';
import { init as inputInit, enterEditMode, exitEditMode } from './components/input-area.js';
import { renderResult, setPrompt, showEmpty } from './components/result-grid.js';
import { init as lightboxInit, open as openLightbox } from './components/lightbox.js';
import { init as workAreaInit } from './components/work-area.js';
import { init as galleryPanelInit } from './components/gallery-panel.js';
import { clearChain } from './components/iteration-chain.js';
import { clearGallery, appendToGallery } from './components/gallery-panel.js';
import { init as languageInit } from './components/language.js';
import { showToast } from './utils/toast.js';
import { fetchSessions, fetchArchivedSessions, deleteSession as deleteSessionApi, archiveSession as archiveSessionApi, unarchiveSession as unarchiveSessionApi, deleteArchivedSession as deleteArchivedSessionApi, renameSession as renameSessionApi, renameArchivedSession as renameArchivedSessionApi } from './api.js';
import state from './state.js';
import { t, applyLanguage, setLang, getLang } from './i18n.js';

// 画布高度拖拽调整 — 分屏分割：画布区和输入区同时联动
function initCanvasResize() {
  const handle = document.getElementById('canvasResizeHandle');
  const canvasArea = document.getElementById('canvasArea');
  const canvasColumn = document.querySelector('.canvas-column');
  const inputArea = document.getElementById('inputArea');
  const chain = document.getElementById('iterationChain');
  if (!handle || !canvasArea || !canvasColumn || !inputArea) return;

  let isResizing = false;
  let startY = 0;
  let startCanvasBasis = 0;
  let startInputBasis = 0;

  // 从 inline flex 或实际高度读取当前的 flex-basis
  function getBasis(el) {
    const style = el.style.flex;
    if (style) {
      const m = style.match(/0\s+0\s+(\d+)px/);
      if (m) return parseInt(m[1]);
    }
    return el.offsetHeight;
  }

  // 固定元素占用（手柄 + 迭代链，含 margin）
  function getFixedHeight() {
    const hs = getComputedStyle(handle);
    const hTotal = handle.offsetHeight + (parseFloat(hs.marginTop) || 0) + (parseFloat(hs.marginBottom) || 0);
    let cTotal = 0;
    if (chain) {
      const cs = getComputedStyle(chain);
      cTotal = chain.offsetHeight + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
    }
    return hTotal + cTotal;
  }

  // 窗口缩放 / 迭代链展开时等比 clamp
  new ResizeObserver(() => {
    if (!canvasArea.style.flex && !inputArea.style.flex) return; // 默认布局不动
    const colH = canvasColumn.clientHeight;
    const fixed = getFixedHeight();
    const avail = colH - fixed;
    const cB = getBasis(canvasArea);
    const iB = getBasis(inputArea);
    if (avail <= 100 + 80) return;
    const ratio = cB / (cB + iB);
    const newC = Math.max(100, Math.round(avail * ratio));
    const newI = Math.max(80, avail - newC);
    canvasArea.style.flex = '0 0 ' + Math.round(newC) + 'px';
    inputArea.style.flex = '0 0 ' + Math.round(newI) + 'px';
  }).observe(canvasColumn);

  handle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startY = e.clientY;
    startCanvasBasis = getBasis(canvasArea);
    startInputBasis = getBasis(inputArea);
    handle.classList.add('active');
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const delta = e.clientY - startY;
    const colH = canvasColumn.clientHeight;
    const fixed = getFixedHeight();
    const minCanvas = 100;
    const minInput = 80;

    let newCanvas = startCanvasBasis + delta;
    // 画布往大拉：压缩输入区
    if (newCanvas > colH - fixed - minInput) {
      newCanvas = colH - fixed - minInput;
    }
    // 画布往小拉：压缩画布本身
    if (newCanvas < minCanvas) {
      newCanvas = minCanvas;
    }
    const newInput = colH - fixed - newCanvas;

    canvasArea.style.flex = '0 0 ' + newCanvas + 'px';
    inputArea.style.flex = '0 0 ' + newInput + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!isResizing) return;
    isResizing = false;
    handle.classList.remove('active');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });

  // 双击手柄：恢复默认（画布 flex:1 填充，输入区自然高度）
  handle.addEventListener('dblclick', () => {
    canvasArea.style.flex = '';
    inputArea.style.flex = '';
  });
}

async function init() {
  // 应用初始语言
  applyLanguage();

  // 语言选择器
  const langSelect = document.getElementById('languageSelect');
  if (langSelect) {
    langSelect.value = getLang();
    langSelect.addEventListener('change', () => {
      setLang(langSelect.value);
    });
  }

  lightboxInit();
  languageInit();
  settingsInit();
  inputInit();
  workAreaInit();
  galleryPanelInit();
  // initCanvasResize(); // 旧版画布拖拽（卡片间），已替换为 inputGrabHandle
  initInputResize();

  // textarea 上沿抓手拖拽调整输入框高度
  function initInputResize() {
    const handle = document.getElementById('inputGrabHandle');
    const textarea = document.getElementById('promptInput');
    if (!handle || !textarea) return;

    const MIN_HEIGHT = 56;
    const MAX_HEIGHT = 360;
    let isResizing = false;
    let startY = 0;
    let startHeight = 0;

    handle.addEventListener('mousedown', (e) => {
      isResizing = true;
      startY = e.clientY;
      startHeight = textarea.offsetHeight;
      handle.classList.add('active');
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      const delta = startY - e.clientY;
      let newHeight = startHeight + delta;
      if (newHeight < MIN_HEIGHT) newHeight = MIN_HEIGHT;
      if (newHeight > MAX_HEIGHT) newHeight = MAX_HEIGHT;
      textarea.style.height = newHeight + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (!isResizing) return;
      isResizing = false;
      handle.classList.remove('active');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    });

    handle.addEventListener('dblclick', () => {
      textarea.style.height = '';
    });
  }
  initArchiveModal();

  // 并行初始化：sidebar（缓存秒开）和 sessions 同时加载
  const [,] = await Promise.all([
    sidebarInit(),
    loadSessions(),
  ]);

  // 新建对话按钮
  document.getElementById('newSessionBtn')?.addEventListener('click', newSession);

  // 加载历史
  loadSessions();

  // 监听模型选择变化 → 更新空状态提示
  window.addEventListener('modelSelected', () => {
    showEmpty();
  });

  // 监听生成完成
  window.addEventListener('imagesGenerated', (e) => {
    const result = e.detail;
    setPrompt(state.lastPrompt || '');
    renderResult(result.images);

    // 刷新历史列表
    loadSessions();
  });

  // Lightbox
  window.addEventListener('lightbox', (e) => {
    const { src, prompt, id } = e.detail;
    openLightbox(src, prompt);
    // 如果在编辑模式，高亮迭代链中对应节点
    if (id && state.editChain?.length > 0) {
      const nodes = document.querySelectorAll('.iteration-node');
      const idx = state.editChain.findIndex(item => item.id === id);
      if (idx >= 0) {
        nodes.forEach((n, i) => n.classList.toggle('active', i === idx));
      }
    }
  });

  // 修改图片
  window.addEventListener('editImage', (e) => {
    const { src, id, sourceUrl } = e.detail;
    // 优先使用 OSS URL（百炼可直接读取），避免 base64 转码损耗
    const referenceSrc = sourceUrl || src;
    const fingerprint = referenceSrc.substring(0, 50) + (referenceSrc.length > 50 ? '...' : '');
    console.log(`[editImage] id=${id} type=${sourceUrl ? 'OSS_URL' : 'base64/local'} ref=${fingerprint} len=${referenceSrc.length}`);

    enterEditMode(referenceSrc, src, id);
  });

  // 迭代切换
  window.addEventListener('switchIteration', (e) => {
    const { iteration } = e.detail;
    if (iteration.images) {
      const images = (iteration.images || []).map((img) => ({
        id: img.id,
        localPath: img.localPath,
        dataUrl: img.localPath ? `/api/images/${img.id}` : null,
        sourceUrl: img.sourceUrl || null,
      }));
      renderResult(images);
    }
  });

  // 跟踪 prompt
  const promptInput = document.getElementById('promptInput');
  promptInput?.addEventListener('input', () => {
    state.lastPrompt = promptInput.value;
  });
}

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

async function loadSessions() {
  const sessionList = document.getElementById('sessionList');

  try {
    const result = await fetchSessions();

    if (!result.success || !result.sessions || result.sessions.length === 0) {
      sessionList.innerHTML = `<p class="text-hint">${t('sidebar.noSession')}</p>`;
      updateSessionCount(0);
      return;
    }

    updateSessionCount(result.sessions.length);
    sessionList.innerHTML = '';
    result.sessions.forEach((s) => {
      const el = document.createElement('div');
      el.className = 'session-item';
      el.dataset.sessionId = s.id;

      const textSpan = document.createElement('span');
      textSpan.className = 'session-item-text';
      textSpan.textContent = s.prompt?.substring(0, 40) || s.id;
      textSpan.title = s.prompt || s.id;

      const actionsSpan = document.createElement('span');
      actionsSpan.className = 'session-item-actions';

      // 重命名按钮
      const renameBtn = document.createElement('button');
      renameBtn.className = 'btn-icon session-action-btn session-rename-btn';
      renameBtn.title = t('action.rename');
      renameBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
      renameBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        startRename(el, s.id, s.prompt || s.id, false);
      });

      // 归档按钮
      const archiveBtn = document.createElement('button');
      archiveBtn.className = 'btn-icon session-action-btn session-archive-btn';
      archiveBtn.title = t('action.archive');
      archiveBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/></svg>';
      archiveBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const res = await archiveSessionApi(s.id);
        if (res.success) {
          showToast(t('toast.archived'), 'success');
          loadSessions();
        } else {
          showToast(t('toast.archiveFailed'), 'error');
        }
      });

      // 删除按钮
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-icon session-action-btn session-delete-btn';
      deleteBtn.title = t('action.confirmDelete');
      deleteBtn.dataset.confirming = 'false';
      deleteBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (deleteBtn.dataset.confirming === 'false') {
          deleteBtn.dataset.confirming = 'true';
          deleteBtn.classList.add('confirm');
          deleteBtn.title = t('action.confirmDeleteTitle');
          setTimeout(() => {
            if (!deleteBtn.isConnected) return;
            deleteBtn.dataset.confirming = 'false';
            deleteBtn.classList.remove('confirm');
            deleteBtn.title = t('action.confirmDelete');
          }, 3000);
        } else {
          const res = await deleteSessionApi(s.id);
          if (res.success) {
            showToast(t('toast.deleted'), 'info');
            if (state.currentSession?.id === s.id) newSession();
            loadSessions();
          } else {
            showToast(t('toast.deleteFailed'), 'error');
          }
        }
      });

      actionsSpan.appendChild(renameBtn);
      actionsSpan.appendChild(archiveBtn);
      actionsSpan.appendChild(deleteBtn);
      el.appendChild(textSpan);
      el.appendChild(actionsSpan);
      el.addEventListener('click', () => loadSessionDetail(s.id));
      sessionList.appendChild(el);
    });
  } catch {
    sessionList.innerHTML = '<p class="text-hint">加载失败</p>';
  }
}

function updateSessionCount(count) {
  const countEl = document.getElementById('sessionCount');
  if (countEl) {
    countEl.textContent = count > 0 ? `${count}` : '';
  }
}

// ===== 重命名功能 =====
function startRename(itemEl, sessionId, currentName, isArchived) {
  const textSpan = itemEl.querySelector('.session-item-text, .archive-item-text');
  if (!textSpan) return;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'session-rename-input';
  input.value = currentName;

  textSpan.replaceWith(input);
  input.focus();
  input.select();

  const doRename = async () => {
    const newName = input.value.trim();
    if (newName && newName !== currentName) {
      const api = isArchived ? renameArchivedSessionApi : renameSessionApi;
      const res = await api(sessionId, newName);
      if (res.success) {
        showToast(t('toast.renamed'), 'success');
      } else {
        showToast(t('toast.renameFailed'), 'error');
      }
    }
    // 刷新列表
    if (isArchived) {
      loadArchivedSessions();
    } else {
      loadSessions();
    }
  };

  input.addEventListener('blur', doRename);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      input.blur();
    } else if (e.key === 'Escape') {
      // 取消重命名，恢复原文本
      const restore = () => {
        if (isArchived) loadArchivedSessions();
        else loadSessions();
      };
      input.removeEventListener('blur', doRename);
      restore();
    }
  });
}

// ===== 归档弹窗 =====
function initArchiveModal() {
  const archiveModal = document.getElementById('archiveModal');
  const archiveModalClose = document.getElementById('archiveModalClose');

  document.getElementById('archiveToggleBtn')?.addEventListener('click', () => {
    archiveModal.classList.remove('hidden');
    loadArchivedSessions();
  });

  archiveModalClose?.addEventListener('click', () => {
    archiveModal.classList.add('hidden');
  });

  archiveModal.querySelector('.modal-overlay')?.addEventListener('click', () => {
    archiveModal.classList.add('hidden');
  });
}

async function loadArchivedSessions() {
  const archiveList = document.getElementById('archiveList');

  try {
    const result = await fetchArchivedSessions();

    if (!result.success || !result.sessions || result.sessions.length === 0) {
      archiveList.innerHTML = `<p class="text-hint">${t('archive.empty')}</p>`;
      return;
    }

    archiveList.innerHTML = '';
    result.sessions.forEach((s) => {
      const el = document.createElement('div');
      el.className = 'archive-item';
      el.dataset.sessionId = s.id;

      const info = document.createElement('div');
      info.className = 'archive-item-info';

      const textSpan = document.createElement('span');
      textSpan.className = 'archive-item-text';
      textSpan.textContent = (s.prompt || s.id).substring(0, 60);
      textSpan.title = s.prompt || s.id;
      info.appendChild(textSpan);

      const actions = document.createElement('div');
      actions.className = 'archive-item-actions';

      // 重命名按钮
      const renameBtn = document.createElement('button');
      renameBtn.className = 'btn-icon session-action-btn session-rename-btn';
      renameBtn.title = t('action.rename');
      renameBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
      renameBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        startRename(el, s.id, s.prompt || s.id, true);
      });

      // 恢复按钮
      const restoreBtn = document.createElement('button');
      restoreBtn.className = 'btn btn-sm btn-secondary';
      restoreBtn.textContent = t('action.restore');
      restoreBtn.addEventListener('click', async () => {
        const res = await unarchiveSessionApi(s.id);
        if (res.success) {
          showToast(t('toast.restored'), 'success');
          loadArchivedSessions();
          loadSessions();
        } else {
          showToast(t('toast.restoreFailed'), 'error');
        }
      });

      // 删除按钮
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-icon session-action-btn session-delete-btn';
      deleteBtn.title = t('action.confirmDelete');
      deleteBtn.dataset.confirming = 'false';
      deleteBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
      deleteBtn.addEventListener('click', async () => {
        if (deleteBtn.dataset.confirming === 'false') {
          deleteBtn.dataset.confirming = 'true';
          deleteBtn.classList.add('confirm');
          deleteBtn.title = t('action.confirmDeleteTitle');
          setTimeout(() => {
            if (!deleteBtn.isConnected) return;
            deleteBtn.dataset.confirming = 'false';
            deleteBtn.classList.remove('confirm');
            deleteBtn.title = t('action.confirmDelete');
          }, 3000);
        } else {
          const res = await deleteArchivedSessionApi(s.id);
          if (res.success) {
            showToast(t('toast.permanentlyDeleted'), 'info');
            loadArchivedSessions();
          } else {
            showToast(t('toast.deleteFailed'), 'error');
          }
        }
      });

      actions.appendChild(renameBtn);
      actions.appendChild(restoreBtn);
      actions.appendChild(deleteBtn);
      el.appendChild(info);
      el.appendChild(actions);
      archiveList.appendChild(el);
    });
  } catch {
    archiveList.innerHTML = '<p class="text-hint">加载失败</p>';
  }
}

async function loadSessionDetail(sessionId) {
  try {
    const resp = await fetch(`/api/sessions/${sessionId}`);
    const data = await resp.json();

    if (!data.success || !data.session) {
      showToast(t('toast.sessionLoadFailed'), 'error');
      return;
    }

    const session = data.session;
    state.currentSession = session;

    // 浏览历史时确保退出编辑模式（生图模式）
    exitEditMode();

    // 浏览历史时清空输入框
    const promptInput = document.getElementById('promptInput');
    promptInput.value = '';

    const iterations = session.iterations || [];
    if (iterations.length > 0) {
      const latest = iterations[iterations.length - 1];

      // 最新迭代的图片用于画布展示（默认只显示第一张）
      const latestImages = (latest.images || []).map((img) => {
        if (img.localPath) {
          return {
            id: img.id,
            dataUrl: `/api/images/${img.id}`,
            localPath: img.localPath,
            sourceUrl: img.sourceUrl || null,
          };
        }
        return { id: img.id, dataUrl: null };
      });

      setPrompt(session.prompt || '');
      // 默认只展示第一张图片
      renderResult(latestImages.length > 0 ? [latestImages[0]] : []);
      // 浏览历史时默认生图模式，不显示迭代链
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

    showToast(t('toast.sessionRestored'), 'info');
  } catch (err) {
    showToast(t('toast.sessionRestoreFailed'), 'error');
  }
}

init().catch((err) => {
  console.error('初始化失败:', err);
  showToast(t('toast.appInitFailed'), 'error');
});
