import { init as sidebarInit } from './components/sidebar.js';
import { init as settingsInit } from './components/settings.js';
import { init as inputInit, enterEditMode, exitEditMode } from './components/input-area.js';
import { renderResult, setPrompt, showEmpty } from './components/result-grid.js';
import { init as lightboxInit, open as openLightbox } from './components/lightbox.js';
import { init as workAreaInit } from './components/work-area.js';
import { init as galleryPanelInit } from './components/gallery-panel.js';
import { renderChain, clearChain } from './components/iteration-chain.js';
import { clearGallery, appendToGallery } from './components/gallery-panel.js';
import { init as languageInit } from './components/language.js';
import { showToast } from './utils/toast.js';
import { fetchSessions, fetchArchivedSessions, deleteSession as deleteSessionApi, archiveSession as archiveSessionApi, unarchiveSession as unarchiveSessionApi, deleteArchivedSession as deleteArchivedSessionApi, renameSession as renameSessionApi, renameArchivedSession as renameArchivedSessionApi } from './api.js';
import state from './state.js';
import { t, applyLanguage, setLang, getLang } from './i18n.js';

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

    if (result.session?.iterations) {
      renderChain(result.session.iterations);
    }

    // 刷新历史列表
    loadSessions();
  });

  // Lightbox
  window.addEventListener('lightbox', (e) => {
    const { src, prompt } = e.detail;
    openLightbox(src, prompt);
  });

  // 修改图片
  window.addEventListener('editImage', (e) => {
    const { src, id } = e.detail;
    const editModal = document.getElementById('editModal');
    const editModalImage = document.getElementById('editModalImage');
    const editModalPrompt = document.getElementById('editModalPrompt');

    editModalImage.src = src;
    editModalPrompt.value = '';
    editModal.classList.remove('hidden');
    enterEditMode(src);
  });

  // 迭代切换
  window.addEventListener('switchIteration', (e) => {
    const { iteration } = e.detail;
    if (iteration.images) {
      const images = (iteration.images || []).map((img) => ({
        id: img.id,
        localPath: img.localPath,
        dataUrl: img.localPath ? `/api/images/${img.id}` : null,
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

    // 恢复输入框 prompt
    const promptInput = document.getElementById('promptInput');
    promptInput.value = session.prompt || '';

    const iterations = session.iterations || [];
    if (iterations.length > 0) {
      const latest = iterations[iterations.length - 1];

      // 最新迭代的图片用于画布展示
      const latestImages = (latest.images || []).map((img) => {
        if (img.localPath) {
          return {
            id: img.id,
            dataUrl: `/api/images/${img.id}`,
            localPath: img.localPath,
          };
        }
        return { id: img.id, dataUrl: null };
      });

      setPrompt(session.prompt || '');
      renderResult(latestImages);
      renderChain(iterations);

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
