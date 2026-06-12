import state from '../state.js';
import { generateImage } from '../api.js';
import { showToast } from '../utils/toast.js';
import { $ } from '../utils/dom.js';
import { t } from '../i18n.js';

const promptInput = $('#promptInput');
const generateBtn = $('#generateBtn');
const countSlider = $('#countSlider');
const countValue = $('#countValue');
const sizeSelect = $('#sizeSelect');
const modelBadge = $('#modelBadge');
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
    modelBadge.textContent = t('input.noModel');
  });

  // 数量滑块
  countSlider.addEventListener('input', () => {
    countValue.textContent = countSlider.value;
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

  // 拖拽调节输入框高度（手柄在输入框上方）
  const resizeHandle = $('#resizeHandle');
  let isResizing = false;
  let resizeStartY = 0;
  let resizeStartHeight = 0;

  resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    resizeStartY = e.clientY;
    resizeStartHeight = promptInput.offsetHeight;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const delta = resizeStartY - e.clientY;
    const newHeight = Math.max(56, Math.min(400, resizeStartHeight + delta));
    promptInput.style.height = newHeight + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!isResizing) return;
    isResizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
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

  try {
    const result = await generateImage({
      provider: state.activeProviderId,
      model: state.activeModelId,
      prompt,
      n: parseInt(countSlider.value),
      size: sizeSelect.value,
      referenceImage: state.referenceImage || undefined,
      sessionId: state.currentSession?.id,
      mode: state.workMode || 'draw',
    });

    if (result.success) {
      const imgCount = result.images?.length || 0;
      showToast(imgCount > 0 ? t('toast.generateSuccess', imgCount) : t('toast.generateSuccessSingle'), 'success');

      window.dispatchEvent(new CustomEvent('imagesGenerated', { detail: result }));

      if (result.sessionId) {
        window.dispatchEvent(new CustomEvent('sessionUpdated', { detail: result }));
      }
      state.currentSession = result.session || { id: result.sessionId };

      exitEditMode();
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
export function enterEditMode(referenceImage) {
  state.referenceImage = referenceImage;
  if (referenceImage) {
    refImageThumb.src = referenceImage.startsWith('data:')
      ? referenceImage
      : referenceImage;
    refImagePreview.classList.remove('hidden');
  }
  promptInput.focus();
  promptInput.placeholder = t('input.editPlaceholder');
}

export function exitEditMode() {
  state.referenceImage = null;
  refImagePreview.classList.add('hidden');
  promptInput.placeholder = t('input.placeholder');
}
