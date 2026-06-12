import state from '../state.js';
import { generateImage } from '../api.js';
import { showToast } from '../utils/toast.js';
import { $ } from '../utils/dom.js';
import { t } from '../i18n.js';
import { renderEditChain, clearChain } from './iteration-chain.js';
import { appendToGallery } from './gallery-panel.js';
import { renderResult, setPrompt } from './result-grid.js';

const promptInput = $('#promptInput');
const generateBtn = $('#generateBtn');
const sizeTrigger = $('#sizeTrigger');
const sizeTriggerText = $('#sizeTriggerText');
const sizeDropdown = $('#sizeDropdown');
const sizeDropdownList = $('#sizeDropdownList');
const modelBadge = $('#modelBadge');
let currentSize = '2k'; // 当前选中的分辨率
const refImagePreview = $('#refImagePreview');
const refImageThumb = $('#refImageThumb');
const removeRefBtn = $('#removeRefBtn');
const loadingOverlay = $('#loadingOverlay');
const editModal = $('#editModal');
const editModalPrompt = $('#editModalPrompt');

let editModeOriginalPlaceholder = '';

export function init() {
  editModeOriginalPlaceholder = promptInput.placeholder;

  // Listen for language changes to update placeholders
  window.addEventListener('languageChanged', () => {
    if (!state.referenceImage) {
      promptInput.placeholder = t('input.placeholder');
    }
    // 只有未选择模型时才显示占位文字
    if (!state.activeModelId) {
      modelBadge.textContent = t('input.noModel');
    }
    // 更新模式标签
    const modeTagEl = document.getElementById('modeTag');
    if (modeTagEl) {
      modeTagEl.textContent = state.referenceImage
        ? ('🖊 ' + t('input.editModeBadge'))
        : ('🎨 ' + t('input.drawModeBadge'));
    }
  });

  // 分辨率上拉选择器
  let sizeDropdownOpen = false;
  sizeTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    sizeDropdownOpen ? closeSizeDropdown() : openSizeDropdown();
  });
  document.addEventListener('click', () => {
    if (sizeDropdownOpen) closeSizeDropdown();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sizeDropdownOpen) closeSizeDropdown();
  });

  function openSizeDropdown() {
    sizeDropdownOpen = true;
    sizeTrigger.classList.add('open');
    sizeDropdown.classList.remove('hidden');
  }
  function closeSizeDropdown() {
    sizeDropdownOpen = false;
    sizeTrigger.classList.remove('open');
    sizeDropdown.classList.add('hidden');
  }

  function updateSizeSelection(value) {
    currentSize = value;
    sizeTriggerText.textContent = value;
    sizeDropdownList.querySelectorAll('.size-option').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.size === value);
    });
    closeSizeDropdown();
  }

  // 模型切换时更新尺寸选项
  window.addEventListener('modelSelected', (e) => {
    const { sizes } = e.detail || {};

    // 更新分辨率选项
    if (sizes && sizes.length > 0) {
      sizeDropdownList.innerHTML = '';
      sizes.forEach((s) => {
        const labelMap = { '2048*2048': '2K', '1024*1024': '1K', '4096*4096': '4K', '2k': '2K', '1k': '1K', '4k': '4K', '2K': '2K', '1K': '1K', '4K': '4K' };
        const label = labelMap[s] || s;
        const opt = document.createElement('div');
        opt.className = 'size-option';
        opt.textContent = label;
        opt.dataset.size = s;
        opt.addEventListener('click', () => updateSizeSelection(s));
        sizeDropdownList.appendChild(opt);
      });
      // 默认选中第一个
      if (sizes.length > 0) {
        updateSizeSelection(sizes[0]);
      }
    }
  });

  // 生成按钮
  generateBtn.addEventListener('click', handleGenerate);

  // 标记 IME 组合输入状态，防止中文输入法确认时误触发送
  let isComposing = false;
  promptInput.addEventListener('compositionstart', () => { isComposing = true; });
  promptInput.addEventListener('compositionend', () => { isComposing = false; });

  // Enter 发送，Shift+Enter 换行（IME 组合中 Enter 不发送）
  promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault();
      handleGenerate();
    }
  });

  // 移除参考图
  removeRefBtn.addEventListener('click', () => {
    state.referenceImage = null;
    refImagePreview.classList.add('hidden');
  });

  // 修改弹窗 — 开始修改
  $('#editModalSubmit').addEventListener('click', () => {
    const editPrompt = editModalPrompt.value.trim();
    if (!editPrompt) {
      showToast(t('toast.editPromptRequired'), 'error');
      return;
    }
    editModal.classList.add('hidden');
    promptInput.value = editPrompt;
    handleGenerate();
  });

  // 修改弹窗 — 取消
  $('#editModalCancel').addEventListener('click', () => {
    editModal.classList.add('hidden');
  });

  // 文本样式按钮（预留）
  $('#btnTextStyle')?.addEventListener('click', () => {
    showToast(t('toast.textStyleTodo'), 'info');
  });

  // 迭代链条退出修改模式
  $('#exitEditBtn')?.addEventListener('click', () => {
    exitEditMode();
  });
}

export async function handleGenerate() {
  const prompt = promptInput.value.trim();
  if (!prompt) {
    showToast(t('toast.enterPrompt'), 'error');
    return;
  }

  if (!state.activeProviderId || !state.activeModelId) {
    showToast(t('toast.selectModel'), 'error');
    return;
  }

  // 设置生成中状态
  state.generating = true;
  generateBtn.disabled = true;
  promptInput.disabled = true;
  const canvasPlaceholder = document.getElementById('canvasPlaceholder');
  if (canvasPlaceholder) canvasPlaceholder.classList.add('hidden');
  loadingOverlay.classList.remove('hidden');

  // debug: 打印本次生图参数
  const hasRef = !!state.referenceImage;
  console.log(`[handleGenerate] prompt="${prompt}" hasRef=${hasRef} refLen=${hasRef ? state.referenceImage.length : 'N/A'} sessionId=${state.currentSession?.id || 'NEW'}`);

  try {
    const result = await generateImage({
      provider: state.activeProviderId,
      model: state.activeModelId,
      prompt,
      n: 1,
      size: currentSize,
      referenceImage: state.referenceImage || undefined,
      sessionId: state.currentSession?.id,
      mode: state.workMode || 'draw',
    });

    if (result.success) {
      const imgCount = result.images?.length || 0;
      showToast(imgCount > 0 ? t('toast.generateSuccess', imgCount) : t('toast.generateSuccessSingle'), 'success');

      // 显示调试信息（如果有）
      if (result.debug && imgCount === 0) {
        const dbg = result.debug;
        console.log('[Qwen Debug]', dbg);
        showToast(`调试: output keys=[${dbg.outputKeys.join(',')}], results=${dbg.resultsCount}, raw=${dbg.rawOutput.substring(0, 200)}`, 'info');
      }

      promptInput.value = '';

      // 编辑模式：追加到编辑链，并更新参考图为最新结果（连续迭代）
      if (state.referenceImage && result.images?.length > 0) {
        const firstImg = result.images[0];
        const newSrc = firstImg.dataUrl || `/api/images/${firstImg.id}`;
        result.images.forEach((img, idx) => {
          state.editChain.push({
            src: img.dataUrl || `/api/images/${img.id}`,
            id: img.id,
            label: t('iteration.version', state.editChain.length),
          });
        });
        // 更新参考图为最新生成结果，下次修改基于最新版本
        state.referenceImage = newSrc;
        renderEditChain(state.editChain);
      }

      window.dispatchEvent(new CustomEvent('imagesGenerated', { detail: result }));

      if (result.sessionId) {
        window.dispatchEvent(new CustomEvent('sessionUpdated', { detail: result }));
      }
      state.currentSession = result.session || { id: result.sessionId };

      // 生图模式生成后退出编辑态（确保 mode tag 正确）
      if (!state.referenceImage) {
        exitEditMode();
      }
    } else {
      showToast(t('toast.generateFailed', result.error), 'error');
    }
  } catch (err) {
    showToast(t('toast.requestFailed', err.message), 'error');
  } finally {
    state.generating = false;
    generateBtn.disabled = false;
    promptInput.disabled = false;
    loadingOverlay.classList.add('hidden');
  }
}

// 设置修改模式
export function enterEditMode(referenceImage, src, id) {
  const wasInDrawMode = !state.referenceImage;
  state.referenceImage = referenceImage;
  promptInput.value = '';
  promptInput.placeholder = t('input.editPlaceholder');
  const modeTag = document.getElementById('modeTag');
  const inputArea = document.getElementById('inputArea');
  if (modeTag) {
    modeTag.textContent = '🖊 ' + t('input.editModeBadge');
    modeTag.classList.remove('edit');
    void modeTag.offsetWidth;
    modeTag.classList.add('edit');
    // 弹跳动画已取消
  }
  if (inputArea) {
    inputArea.classList.add('edit-mode');
  }
  // 初始化编辑链：原图为被修改的图片
  state.editChain = [{ src, id, label: t('iteration.original') }];
  renderEditChain(state.editChain);
  promptInput.focus();
}

export function exitEditMode() {
  state.referenceImage = null;
  state.editChain = [];
  refImagePreview.classList.add('hidden');
  promptInput.placeholder = t('input.placeholder');
  const modeTag = document.getElementById('modeTag');
  const inputArea = document.getElementById('inputArea');
  if (modeTag) {
    modeTag.textContent = '🎨 ' + t('input.drawModeBadge');
    modeTag.classList.remove('edit');
    // 弹跳动画已取消
  }
  if (inputArea) {
    inputArea.classList.remove('edit-mode');
  }
  clearChain();
}
