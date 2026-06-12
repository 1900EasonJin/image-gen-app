import state from '../state.js';
import { fetchProviders, fetchCachedStatus, fetchProviderStatus } from '../api.js';
import { $ } from '../utils/dom.js';
import { t, getLang } from '../i18n.js';

const modelTrigger = $('#modelTrigger');
const modelTriggerText = $('#modelTriggerText');
const modelDropdown = $('#modelDropdown');
const modelDropdownList = $('#modelDropdownList');

let dropdownOpen = false;

// 初始化：拉取 Provider 列表，填充模型下拉
export async function init() {
  // 语言切换监听
  window.addEventListener('languageChanged', () => {
    if (!state.activeProviderId || !state.activeModelId) {
      modelTriggerText.textContent = t('sidebar.selectModel');
      modelTriggerText.classList.add('placeholder');
    }
    if (!state.activeProviderId || !state.activeModelId) {
      $('#modelBadge').textContent = t('input.noModel');
    }
    // 重新渲染模型列表以应用新的语言翻译
    refreshModelList();
  });

  // 设置按钮 → 打开设置弹窗
  $('#openSettingsBtn').addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('openSettings'));
  });

  // 切换下拉
  modelTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDropdown();
  });

  // 点击外部关闭
  document.addEventListener('click', () => {
    if (dropdownOpen) closeDropdown();
  });

  // 键盘 ESC 关闭
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dropdownOpen) closeDropdown();
  });

  // 侧边栏宽度拖拽调整
  const sidebarEl = document.getElementById('sidebar');
  const sidebarHandle = document.getElementById('sidebarResizeHandle');
  let sidebarResizing = false;
  let sidebarStartX = 0;
  let sidebarStartWidth = 0;

  sidebarHandle.addEventListener('mousedown', (e) => {
    sidebarResizing = true;
    sidebarStartX = e.clientX;
    sidebarStartWidth = sidebarEl.offsetWidth;
    sidebarHandle.classList.add('active');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!sidebarResizing) return;
    const delta = e.clientX - sidebarStartX;
    const newWidth = Math.max(180, Math.min(400, sidebarStartWidth + delta));
    sidebarEl.style.width = newWidth + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!sidebarResizing) return;
    sidebarResizing = false;
    sidebarHandle.classList.remove('active');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });

  // 先用缓存秒开，后台再刷新
  await loadFromCache();
  autoSelectDefaultModel();
  backgroundRefresh();
}

function toggleDropdown() {
  if (dropdownOpen) {
    closeDropdown();
  } else {
    openDropdown();
  }
}

function openDropdown() {
  dropdownOpen = true;
  modelTrigger.classList.add('open');
  modelDropdown.classList.remove('hidden');
}

function closeDropdown() {
  dropdownOpen = false;
  modelTrigger.classList.remove('open');
  modelDropdown.classList.add('hidden');
}

/** 从缓存加载（<50ms，瞬间可用） */
async function loadFromCache() {
  try {
    const result = await fetchCachedStatus();
    if (result.success && result.providers) {
      for (const p of result.providers) {
        if (p.connected && p.models.length > 0) {
          state.models[p.id] = p.models;
          state.providers[p.id] = { connected: true, apiKey: p.maskedKey || '' };
        }
      }
      await refreshModelList();
    }
  } catch {
    // 缓存也不存在，静默
  }
}

/** 后台静默刷新最新数据（不阻塞界面） */
function backgroundRefresh() {
  fetchProviderStatus().then((result) => {
    if (result.success && result.providers) {
      let changed = false;
      for (const p of result.providers) {
        const prevModels = state.models[p.id] || [];
        const prevConnected = state.providers[p.id]?.connected || false;

        if (p.connected && p.models.length > 0) {
          if (!prevConnected || prevModels.length !== p.models.length || JSON.stringify(prevModels) !== JSON.stringify(p.models)) {
            changed = true;
          }
          state.models[p.id] = p.models;
          state.providers[p.id] = { connected: true, apiKey: p.maskedKey || '' };
        } else if (!p.connected && prevConnected) {
          changed = true;
          delete state.models[p.id];
          delete state.providers[p.id];
          if (state.activeProviderId === p.id) {
            state.activeProviderId = null;
            state.activeModelId = null;
            modelTriggerText.textContent = t('sidebar.selectModel');
            modelTriggerText.classList.add('placeholder');
            $('#modelBadge').textContent = t('input.noModel');
          }
        }
      }
      if (changed) refreshModelList();
    }
  }).catch(() => {});
}

// 刷新模型下拉列表（从已连接的 Provider 中聚合）
export async function refreshModelList() {
  const result = await fetchProviders();
  if (!result.success) {
    modelDropdownList.innerHTML = `<p class="text-hint">${t('settings.fetchFailed')}</p>`;
    return;
  }

  modelDropdownList.innerHTML = '';
  let hasModels = false;
  let anyActive = false;

  for (const provider of result.providers) {
    const models = state.models[provider.id];
    if (models && models.length > 0) {
      hasModels = true;

      // 分组标签（使用 i18n 翻译）
      const groupLabel = document.createElement('div');
      groupLabel.className = 'model-group-label';
      groupLabel.textContent = t('provider.' + provider.id);
      groupLabel.dataset.i18n = 'provider.' + provider.id;
      modelDropdownList.appendChild(groupLabel);

      models.forEach((m) => {
        const isActive = state.activeProviderId === provider.id && state.activeModelId === m.id;
        if (isActive) anyActive = true;

        const option = document.createElement('div');
        option.className = `model-option${isActive ? ' active' : ''}`;
        option.dataset.providerId = provider.id;
        option.dataset.modelId = m.id;

        const nameEl = document.createElement('span');
        nameEl.className = 'model-option-name';
        nameEl.textContent = m.name;
        option.appendChild(nameEl);

        option.addEventListener('click', () => {
          selectModel(provider.id, m.id, m.name);
        });

        modelDropdownList.appendChild(option);
      });
    }
  }

  if (!hasModels) {
    modelDropdownList.innerHTML = `<p class="text-hint" style="padding: 16px">${t('settings.noApiKey')}</p>`;
  }

  // 恢复选中状态显示
  if (anyActive) {
    const activeOption = modelDropdownList.querySelector('.model-option.active');
    if (activeOption) {
      modelTriggerText.textContent = activeOption.querySelector('span').textContent;
      modelTriggerText.classList.remove('placeholder');
    }
  }

  // 首次加载时自动选择默认模型
  autoSelectDefaultModel();
}

/** 自动选择默认模型：仅火山 → Seedream 5.0 Lite，仅阿里 → Wan2.7 Pro，两者都有 → Seedream 5.0 Lite */
function autoSelectDefaultModel() {
  if (state.activeModelId) return; // 已选中就不覆盖

  const hasVolcengine = state.models['volcengine']?.length > 0;
  const hasAliyun = state.models['aliyun']?.length > 0;

  let targetProvider = null;
  let targetModel = null;

  if (hasVolcengine) {
    targetProvider = 'volcengine';
    targetModel = state.models.volcengine.find(m => m.id === 'doubao-seedream-5-0-260128' || m.id === 'doubao-seedream-5-0-lite-260128')
      || state.models.volcengine[0];
  } else if (hasAliyun) {
    targetProvider = 'aliyun';
    targetModel = state.models.aliyun.find(m => m.id === 'wan2.7-image-pro')
      || state.models.aliyun.find(m => m.id === 'qwen-image-2.0-pro')
      || state.models.aliyun[0];
  }

  if (targetProvider && targetModel) {
    selectModel(targetProvider, targetModel.id, targetModel.name);
  }
}

function selectModel(providerId, modelId, modelName) {
  state.activeProviderId = providerId;
  state.activeModelId = modelId;
  modelTriggerText.textContent = modelName;
  modelTriggerText.classList.remove('placeholder');
  $('#modelBadge').textContent = modelName;

  // 更新选中状态
  modelDropdownList.querySelectorAll('.model-option').forEach(el => {
    el.classList.toggle('active', el.dataset.providerId === providerId && el.dataset.modelId === modelId);
  });

  // 查找完整模型信息（含 maxN / sizes）
  const models = state.models[providerId] || [];
  const model = models.find(m => m.id === modelId);

  closeDropdown();
  window.dispatchEvent(new CustomEvent('modelSelected', {
    detail: {
      maxN: model?.maxN ?? 4,
      sizes: model?.sizes || ['2048*2048'],
    },
  }));
}