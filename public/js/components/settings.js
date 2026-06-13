import state from '../state.js';
import { fetchProviders, connectProvider, addCustomModel, removeCustomModel, getCacheStats, clearImageCache, openCacheDir } from '../api.js';
import { showToast } from '../utils/toast.js';
import { $ } from '../utils/dom.js';
import { refreshModelList } from './sidebar.js';
import { t } from '../i18n.js';

const settingsModal = $('#settingsModal');
const settingsProviders = $('#settingsProviders');

export function init() {
  window.addEventListener('openSettings', () => {
    settingsModal.classList.remove('hidden');
    render();
  });

  $('#settingsModalClose').addEventListener('click', () => {
    settingsModal.classList.add('hidden');
  });

  settingsModal.querySelector('.modal-overlay').addEventListener('click', () => {
    settingsModal.classList.add('hidden');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !settingsModal.classList.contains('hidden')) {
      settingsModal.classList.add('hidden');
    }
  });
}

async function render() {
  const result = await fetchProviders();
  if (!result.success) {
    settingsProviders.innerHTML = '<p class="text-hint">' + t('settings.fetchFailed') + '</p>';
    return;
  }

  settingsProviders.innerHTML = '';

  // ===== 缓存管理卡片 =====
  const cacheCard = document.createElement('div');
  cacheCard.className = 'settings-provider-card';
  cacheCard.innerHTML = `
    <div class="provider-header">
      <div class="provider-name">
        <span>🗂 ${t('settings.cacheTitle')}</span>
        <span class="provider-status-text" id="cacheStatsText">${t('settings.cacheLoading')}</span>
      </div>
    </div>
    <div class="settings-key-row">
      <button class="btn btn-secondary btn-sm" id="openCacheDirBtn">${t('settings.openCacheDir')}</button>
      <button class="btn btn-secondary btn-sm" id="clearCacheBtn">${t('settings.clearCache')}</button>
    </div>
  `;
  settingsProviders.appendChild(cacheCard);

  // 绑定打开文件夹按钮
  cacheCard.querySelector('#openCacheDirBtn').addEventListener('click', async () => {
    await openCacheDir();
  });

  // 绑定清缓存按钮
  cacheCard.querySelector('#clearCacheBtn').addEventListener('click', async () => {
    const btn = cacheCard.querySelector('#clearCacheBtn');
    btn.disabled = true;
    btn.textContent = t('settings.clearing');
    const res = await clearImageCache();
    if (res.success) {
      const msg = res.kept > 0
        ? t('settings.cacheClearedWithKept', res.deleted, res.kept)
        : t('settings.cacheCleared', res.deleted);
      showToast(msg, 'success');
      loadCacheStats();
    } else {
      showToast(t('settings.cacheClearFailed'), 'error');
    }
    btn.disabled = false;
    btn.textContent = t('settings.clearCache');
  });

  // 异步加载缓存统计
  loadCacheStats();

  // ===== Provider 卡片 =====

  result.providers.forEach((provider) => {
    const connected = state.providers[provider.id]?.connected || false;
    const models = state.models[provider.id] || [];
    const savedKey = state.providers[provider.id]?.apiKey || '';
    const hasSavedKey = connected || savedKey;

    const card = document.createElement('div');
    card.className = 'settings-provider-card';

    let modelsHtml = '';
    if (connected && models.length > 0) {
      modelsHtml = `
        <div class="settings-model-list">
          ${models.map((m) => `
            <div class="settings-model-item ${m.custom ? 'custom-model' : ''}">
              <div class="model-info">
                <span class="settings-model-name">${m.name}</span>
                <span class="settings-model-id">${m.id}</span>
                ${m.custom ? '<span class="model-badge-custom">' + t('settings.custom') + '</span>' : ''}
              </div>
              ${m.custom ? `
                <button class="btn-icon btn-remove-model" data-provider-id="${provider.id}" data-model-id="${m.id}" title="${t('settings.disconnect')}">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              ` : ''}
            </div>
          `).join('')}
        </div>
      `;
    } else if (connected) {
      modelsHtml = '<p class="text-hint settings-model-empty">' + t('settings.refresh') + '...</p>';
    }

    card.innerHTML = `
      <div class="provider-header">
        <div class="provider-name">
          <span class="status-dot ${connected ? 'connected' : 'disconnected'}"></span>
          <span>${t('provider.' + provider.id) || provider.name}</span>
          <span class="provider-status-text">${connected ? t('settings.connected') : t('settings.disconnectedStatus')}</span>
        </div>
        ${provider.websiteUrl ? `
          <a href="${provider.websiteUrl}" target="_blank" rel="noopener noreferrer" class="provider-link" title="${t('provider.' + provider.id) || provider.name}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            ${t('settings.getModels')}
          </a>
        ` : ''}
      </div>
      <div class="settings-key-row">
        <input
          type="password"
          class="input"
          placeholder="${t('settings.apiKeyPlaceholder')}"
          value="${savedKey}"
          data-provider-id="${provider.id}"
        />
        <button class="btn btn-primary btn-sm" data-provider-id="${provider.id}" data-action="connect">
          ${connected ? t('settings.update') : t('settings.connect')}
        </button>
        ${connected ? `<button class="btn btn-secondary btn-sm" data-provider-id="${provider.id}" data-action="disconnect">${t('settings.disconnect')}</button>` : ''}
      </div>
      ${connected ? `
        <div class="settings-model-header">
          <span class="settings-model-count">${t('settings.modelsLoaded', models.length)}</span>
          <button class="btn btn-sm" data-provider-id="${provider.id}" data-action="refresh-models">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            ${t('settings.refresh')}
          </button>
        </div>
        ${modelsHtml}
        <div class="settings-add-model">
          <div class="add-model-row">
            <input
              type="text"
              class="input input-sm"
              placeholder="${t('settings.modelIdPlaceholder')}"
              data-provider-id="${provider.id}"
              data-input-type="model-id"
            />
            <input
              type="text"
              class="input input-sm"
              placeholder="${t('settings.modelNamePlaceholder')}"
              data-provider-id="${provider.id}"
              data-input-type="model-name"
            />
            <button class="btn btn-primary btn-sm" data-provider-id="${provider.id}" data-action="add-model">
              ${t('settings.addModel')}
            </button>
          </div>
          <p class="text-hint">${t('settings.addModelHint')}</p>
        </div>
      ` : `<p class="text-hint" style="padding:8px 0 0;font-size:11px">${t('settings.noApiKey')}</p>`}
    `;

    settingsProviders.appendChild(card);
  });

  // ===== 绑定所有按钮事件 =====
  bindAllButtons();
}

async function loadCacheStats() {
  const el = document.getElementById('cacheStatsText');
  if (!el) return;
  try {
    const stats = await getCacheStats();
    if (stats.success) {
      const mb = (stats.sizeBytes / 1024 / 1024).toFixed(1);
      el.textContent = t('settings.cacheStats', stats.count, mb);
    }
  } catch {
    el.textContent = '';
  }
}

function bindAllButtons() {
  // 连接按钮
  settingsProviders.querySelectorAll('[data-action="connect"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await handleConnect(btn, btn.dataset.providerId);
    });
  });

  // 断开按钮
  settingsProviders.querySelectorAll('[data-action="disconnect"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const providerId = btn.dataset.providerId;
      delete state.providers[providerId];
      delete state.models[providerId];
      state.activeProviderId = null;
      state.activeModelId = null;
      $('#modelBadge').textContent = t('input.noModel');
      showToast(t('toast.disconnected'), 'info');
      refreshModelList();
      render();
    });
  });

  // 刷新模型按钮
  settingsProviders.querySelectorAll('[data-action="refresh-models"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await handleRefresh(btn, btn.dataset.providerId);
    });
  });

  // 添加模型按钮
  settingsProviders.querySelectorAll('[data-action="add-model"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const providerId = btn.dataset.providerId;
      const idInput = settingsProviders.querySelector(`input[data-provider-id="${providerId}"][data-input-type="model-id"]`);
      const nameInput = settingsProviders.querySelector(`input[data-provider-id="${providerId}"][data-input-type="model-name"]`);
      
      const modelId = idInput.value.trim();
      const modelName = nameInput.value.trim();

      if (!modelId) {
        showToast(t('toast.modelIdRequired'), 'error');
        return;
      }

      await handleAddModel(providerId, modelId, modelName);
    });
  });

  // 删除自定义模型按钮
  settingsProviders.querySelectorAll('.btn-remove-model').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const providerId = btn.dataset.providerId;
      const modelId = btn.dataset.modelId;
      await handleRemoveModel(providerId, modelId);
    });
  });

  // 输入框回车添加模型
  settingsProviders.querySelectorAll('input[data-input-type="model-id"]').forEach((input) => {
    input.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        const providerId = input.dataset.providerId;
        const nameInput = settingsProviders.querySelector(`input[data-provider-id="${providerId}"][data-input-type="model-name"]`);
        const modelId = input.value.trim();
        const modelName = nameInput.value.trim();

        if (modelId) {
          await handleAddModel(providerId, modelId, modelName);
        }
      }
    });
  });
}

async function handleConnect(btn, providerId) {
  const input = settingsProviders.querySelector(`input[data-provider-id="${providerId}"]`);
  const apiKey = input.value.trim();

  if (!apiKey) {
    showToast(t('toast.apiKeyRequired'), 'error');
    return;
  }

  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = t('settings.connecting');

  const result = await connectProvider(providerId, apiKey);

  btn.disabled = false;
  btn.textContent = originalText;

  if (result.success) {
    state.providers[providerId] = {
      apiKey,
      connected: true,
      models: result.models,
    };
    state.models[providerId] = result.models;
    showToast(t('toast.connectSuccess', result.provider?.name || providerId, result.models.length), 'success');
    await refreshModelList();
    render();
  } else {
    showToast(t('toast.connectFailed', result.error), 'error');
  }
}

async function handleRefresh(btn, providerId) {
  btn.disabled = true;
  btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg> ${t('settings.refreshing')}`;

  const result = await connectProvider(providerId, state.providers[providerId]?.apiKey || '');

  btn.disabled = false;

  if (result.success) {
    state.providers[providerId] = {
      ...state.providers[providerId],
      connected: true,
      models: result.models,
    };
    state.models[providerId] = result.models;
    showToast(t('toast.refreshSuccess', result.models.length), 'success');
    await refreshModelList();
    render();
  } else {
    showToast(t('toast.refreshFailed', result.error), 'error');
    render();
  }
}

async function handleAddModel(providerId, modelId, modelName) {
  try {
    const result = await addCustomModel(providerId, modelId, modelName);
    
    if (result.success) {
      // 更新 state 中的模型列表（需要重新连接获取完整列表）
      const connectResult = await connectProvider(providerId, state.providers[providerId]?.apiKey || '');
      if (connectResult.success) {
        state.models[providerId] = connectResult.models;
      }
      
      showToast(t('toast.addModelSuccess', modelName || modelId), 'success');
      await refreshModelList();
      render();
    } else {
      showToast(t('toast.addModelFailed', result.error), 'error');
    }
  } catch (err) {
    showToast(t('toast.addModelFailed', err.message), 'error');
  }
}

async function handleRemoveModel(providerId, modelId) {
  try {
    const result = await removeCustomModel(providerId, modelId);
    
    if (result.success) {
      // 更新 state 中的模型列表
      const connectResult = await connectProvider(providerId, state.providers[providerId]?.apiKey || '');
      if (connectResult.success) {
        state.models[providerId] = connectResult.models;
      }
      
      // 如果删除的是当前选中的模型，清空选择
      if (state.activeModelId === modelId) {
        state.activeProviderId = null;
        state.activeModelId = null;
        $('#modelBadge').textContent = t('input.noModel');
      }
      
      showToast(t('toast.removeModelSuccess'), 'success');
      await refreshModelList();
      render();
    } else {
      showToast(t('toast.removeModelFailed', result.error), 'error');
    }
  } catch (err) {
    showToast(t('toast.removeModelFailed', err.message), 'error');
  }
}
