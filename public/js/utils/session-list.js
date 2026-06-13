/**
 * 会话列表 & 归档弹窗渲染
 * 从 app.js 提取，减少主入口文件体积
 */

import { t } from '../i18n.js';
import { showToast } from './toast.js';
import {
  fetchSessions, fetchArchivedSessions,
  deleteSession as deleteSessionApi,
  archiveSession as archiveSessionApi,
  unarchiveSession as unarchiveSessionApi,
  deleteArchivedSession as deleteArchivedSessionApi,
  renameSession as renameSessionApi,
  renameArchivedSession as renameArchivedSessionApi,
} from '../api.js';
import { showDeleteBubble, dismissDeleteBubble, isDeleteConfirming } from './delete-bubble.js';
import state from '../state.js';

// ===== 侧边栏历史会话列表 =====

export async function renderSessionList() {
  const sessionList = document.getElementById('sessionList');
  try {
    const result = await fetchSessions();
    if (!result.success || !result.sessions?.length) {
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

      // 重命名
      const renameBtn = createIconBtn('rename', t('action.rename'),
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>');
      renameBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        startRename(el, s.id, s.prompt || s.id, false);
      });

      // 归档
      const archiveBtn = createIconBtn('archive', t('action.archive'),
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/></svg>');
      archiveBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const res = await archiveSessionApi(s.id);
        if (res.success) { showToast(t('toast.archived'), 'success'); renderSessionList(); }
        else showToast(t('toast.archiveFailed'), 'error');
      });

      // 删除（二次确认）
      const deleteBtn = createIconBtn('delete', t('action.delete'),
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>');
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!isDeleteConfirming(deleteBtn)) { showDeleteBubble(deleteBtn); return; }
        dismissDeleteBubble();
        const res = await deleteSessionApi(s.id);
        if (res.success) {
          showToast(t('toast.deleted'), 'info');
          if (state.currentSession?.id === s.id) window.dispatchEvent(new CustomEvent('newSession'));
          renderSessionList();
        } else showToast(t('toast.deleteFailed'), 'error');
      });

      actionsSpan.append(renameBtn, archiveBtn, deleteBtn);
      el.append(textSpan, actionsSpan);
      el.addEventListener('click', () => loadSessionDetail(s.id));
      sessionList.appendChild(el);
    });
  } catch {
    sessionList.innerHTML = '<p class="text-hint">加载失败</p>';
  }
}

function updateSessionCount(count) {
  const el = document.getElementById('sessionCount');
  if (el) el.textContent = count > 0 ? `${count}` : '';
}

// ===== 归档弹窗 =====

export async function renderArchiveList() {
  const archiveList = document.getElementById('archiveList');
  try {
    const result = await fetchArchivedSessions();
    if (!result.success || !result.sessions?.length) {
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

      // 重命名
      const renameBtn = createIconBtn('rename', t('action.rename'),
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>');
      renameBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        startRename(el, s.id, s.prompt || s.id, true);
      });

      // 恢复
      const restoreBtn = document.createElement('button');
      restoreBtn.className = 'btn btn-sm btn-secondary';
      restoreBtn.textContent = t('action.restore');
      restoreBtn.addEventListener('click', async () => {
        const res = await unarchiveSessionApi(s.id);
        if (res.success) {
          showToast(t('toast.restored'), 'success');
          renderArchiveList();
          renderSessionList();
        } else showToast(t('toast.restoreFailed'), 'error');
      });

      // 删除
      const deleteBtn = createIconBtn('delete', t('action.delete'),
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>');
      deleteBtn.addEventListener('click', async () => {
        if (!isDeleteConfirming(deleteBtn)) { showDeleteBubble(deleteBtn); return; }
        dismissDeleteBubble();
        const res = await deleteArchivedSessionApi(s.id);
        if (res.success) { showToast(t('toast.permanentlyDeleted'), 'info'); renderArchiveList(); }
        else showToast(t('toast.deleteFailed'), 'error');
      });

      actions.append(renameBtn, restoreBtn, deleteBtn);
      el.append(info, actions);
      archiveList.appendChild(el);
    });
  } catch {
    archiveList.innerHTML = '<p class="text-hint">加载失败</p>';
  }
}

// ===== 重命名 =====

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
      showToast(res.success ? t('toast.renamed') : t('toast.renameFailed'), res.success ? 'success' : 'error');
    }
    isArchived ? renderArchiveList() : renderSessionList();
  };

  input.addEventListener('blur', doRename);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    else if (e.key === 'Escape') {
      input.removeEventListener('blur', doRename);
      isArchived ? renderArchiveList() : renderSessionList();
    }
  });
}

// ===== 会话详情加载（放在这里因为和会话列表紧密相关） =====

export async function loadSessionDetail(sessionId) {
  try {
    const resp = await fetch(`/api/sessions/${sessionId}`);
    const data = await resp.json();
    if (!data.success || !data.session) {
      showToast(t('toast.sessionLoadFailed'), 'error');
      return;
    }

    const session = data.session;
    state.currentSession = session;
    window.dispatchEvent(new CustomEvent('sessionLoaded', { detail: session }));
    showToast(t('toast.sessionRestored'), 'info');
  } catch {
    showToast(t('toast.sessionRestoreFailed'), 'error');
  }
}

// ===== 工具 =====

function createIconBtn(type, title, svg) {
  const btn = document.createElement('button');
  btn.className = `btn-icon session-action-btn session-${type}-btn`;
  btn.title = title;
  btn.innerHTML = svg;
  return btn;
}
