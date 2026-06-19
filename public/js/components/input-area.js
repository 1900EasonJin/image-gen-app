import state from '../state.js';
import { generateImage } from '../api.js';
import { showToast } from '../utils/toast.js';
import { $ } from '../utils/dom.js';
import { t } from '../i18n.js';
import { renderEditChain, clearChain } from './iteration-chain.js';
import { appendToGallery } from './gallery-panel.js';
import { renderResult, setPrompt } from './result-grid.js';
import { openStation } from './transfer-station.js';

const promptInput = $('#promptInput');
const generateBtn = $('#generateBtn');
const sizeTrigger = $('#sizeTrigger');
const sizeTriggerText = $('#sizeTriggerText');
const sizeDropdown = $('#sizeDropdown');
const sizeDropdownList = $('#sizeDropdownList');
const modelBadge = $('#modelBadge');
let currentSize = '2k';
const refImagePreview = $('#refImagePreview');
const refImageThumb = $('#refImageThumb');
const removeRefBtn = $('#removeRefBtn');
const loadingOverlay = $('#loadingOverlay');
const editModal = $('#editModal');
const editModalPrompt = $('#editModalPrompt');

// 图生图模式元素
const img2imgDropZone = $('#img2imgDropZone');
const img2imgFileInput = $('#img2imgFileInput');
const img2imgDropContent = $('#img2imgDropContent');
const img2imgPreviewWrapper = $('#img2imgPreviewWrapper');
const img2imgStationRow = $('#img2imgStationRow');

let editModeOriginalPlaceholder = '';
let img2imgOriginalPlaceholder = '';
let img2imgImageData = null;
let editContext = {
  returnMode: 'draw',
  hadImg2ImgImages: false,
};
let modeTransitioning = false;

const MODE_TIMING = {
  img2imgLeave: 340,
  chain: 300,
  img2imgRestore: 320,
  inputEditEnter: 260,
};

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function playClassAnimation(el, className, duration) {
  if (!el) return;
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
  window.setTimeout(() => el.classList.remove(className), duration);
}

export function init() {
  editModeOriginalPlaceholder = promptInput.placeholder;
  img2imgOriginalPlaceholder = t('input.img2imgPlaceholder');

  window.addEventListener('languageChanged', () => {
    if (!state.referenceImage) {
      if (state.workMode === 'img2img') {
        promptInput.placeholder = t('input.img2imgPlaceholder');
        img2imgOriginalPlaceholder = t('input.img2imgPlaceholder');
      } else {
        promptInput.placeholder = t('input.placeholder');
      }
    }
    if (!state.activeModelId) {
      modelBadge.textContent = t('input.noModel');
    }
    updateModeTag();
    const dropLabel = document.querySelector('.img2img-drop-label');
    if (dropLabel) dropLabel.textContent = t('input.img2imgDropText');
  });

  // 监听工作区模式切换
  window.addEventListener('workModeChanged', (e) => {
    const { mode } = e.detail;
    if (mode === 'img2img') {
      enterImg2ImgMode();
    } else {
      exitImg2ImgMode();
    }
  });

  // 图生图拖放上传
  initImg2ImgDropZone();

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

  window.addEventListener('modelSelected', (e) => {
    const { sizes } = e.detail || {};
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
      if (sizes.length > 0) {
        updateSizeSelection(sizes[0]);
      }
    }
  });

  generateBtn.addEventListener('click', handleGenerate);

  let isComposing = false;
  promptInput.addEventListener('compositionstart', () => { isComposing = true; });
  promptInput.addEventListener('compositionend', () => { isComposing = false; });

  promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault();
      handleGenerate();
    }
  });

  removeRefBtn.addEventListener('click', () => {
    state.referenceImage = null;
    refImagePreview.classList.add('hidden');
  });

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

  $('#editModalCancel').addEventListener('click', () => {
    editModal.classList.add('hidden');
  });

  $('#btnTextStyle')?.addEventListener('click', () => {
    showToast(t('toast.textStyleTodo'), 'info');
  });

  $('#exitEditBtn')?.addEventListener('click', () => {
    exitEditMode();
  });
}

// ===== 图生图模式 =====

function initImg2ImgDropZone() {
  if (!img2imgDropZone || !img2imgFileInput) return;

  const stationLink = document.getElementById('img2imgStationLink');
  if (stationLink) {
    stationLink.addEventListener('click', (e) => {
      e.stopPropagation();
      openStation((dataUrls) => {
        const urls = Array.isArray(dataUrls) ? dataUrls : [dataUrls];
        if (urls.length === 0) return;

        img2imgImageData = urls[0];
        state.referenceImage = urls[0];
        window.img2imgMultiImages = urls;

        img2imgDropContent.classList.add('hidden');
        img2imgPreviewWrapper.classList.remove('hidden');
        img2imgDropZone.classList.add('has-image');
        img2imgDropZone.classList.remove('drag-over');
        renderMultiThumbnails(urls);

        showToast(`已选择 ${urls.length} 张图片`, 'success');
      });
    });
  }

  img2imgFileInput.addEventListener('change', () => {
    const file = img2imgFileInput.files[0];
    if (file) handleImg2ImgFile(file);
  });

  img2imgDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    img2imgDropZone.classList.add('drag-over');
  });

  img2imgDropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    img2imgDropZone.classList.remove('drag-over');
  });

  img2imgDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    img2imgDropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleImg2ImgFile(file);
    } else {
      showToast('请拖放图片文件', 'error');
    }
  });

  // 不再使用一键删除按钮，改为每个缩略图独立删除

  document.addEventListener('paste', (e) => {
    if (state.workMode !== 'img2img') return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        handleImg2ImgFile(file);
        break;
      }
    }
  });
}

function handleImg2ImgFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    img2imgImageData = reader.result;
    state.referenceImage = reader.result;
    window.img2imgMultiImages = [reader.result];

    img2imgDropContent.classList.add('hidden');
    img2imgPreviewWrapper.classList.remove('hidden');
    img2imgDropZone.classList.add('has-image');
    img2imgDropZone.classList.remove('drag-over');
    renderMultiThumbnails([reader.result]);
    showToast('图片已上传', 'success');
  };
  reader.readAsDataURL(file);
}

function removeImg2ImgImage() {
  img2imgImageData = null;
  state.referenceImage = null;
  window.img2imgMultiImages = null;
  img2imgFileInput.value = '';
  img2imgPreviewWrapper.classList.add('hidden');
  img2imgPreviewWrapper.innerHTML = '';
  img2imgDropContent.classList.remove('hidden');
  img2imgDropZone.classList.remove('has-image');
}

export function resetImg2ImgMode() {
  removeImg2ImgImage();
  img2imgDropZone.classList.add('collapsed');
  img2imgStationRow.classList.add('collapsed');
  const inputArea = document.getElementById('inputArea');
  inputArea?.classList.remove('img2img-mode');
}

/** 渲染多张缩略图到预览区，每张带独立删除按钮 */
function renderMultiThumbnails(urls) {
  img2imgPreviewWrapper.innerHTML = '';
  urls.forEach((url, index) => {
    const container = document.createElement('div');
    container.className = 'img2img-thumb-container';

    const thumb = document.createElement('img');
    thumb.className = 'img2img-preview-img';
    thumb.src = url;
    thumb.alt = '参考图';

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-icon img2img-thumb-remove';
    delBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    delBtn.title = '移除这张图片';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      removeSingleImage(index);
    });

    container.appendChild(thumb);
    container.appendChild(delBtn);
    img2imgPreviewWrapper.appendChild(container);
  });
}

/** 删除指定索引的单张图片 */
function removeSingleImage(index) {
  const urls = window.img2imgMultiImages;
  if (!urls || index < 0 || index >= urls.length) return;

  urls.splice(index, 1);

  if (urls.length === 0) {
    // 所有图片都删完了，重置状态
    img2imgImageData = null;
    state.referenceImage = null;
    window.img2imgMultiImages = null;
    img2imgFileInput.value = '';
    img2imgPreviewWrapper.classList.add('hidden');
    img2imgPreviewWrapper.innerHTML = '';
    img2imgDropContent.classList.remove('hidden');
    img2imgDropZone.classList.remove('has-image');
  } else {
    // 更新 referenceImage 为第一张
    img2imgImageData = urls[0];
    state.referenceImage = urls[0];
    renderMultiThumbnails(urls);
  }
}

/** 恢复图生图参考图区预览 */
function restoreImg2ImgPreview({ showStation = false } = {}) {
  const savedImages = window.img2imgMultiImages;
  if (!savedImages || savedImages.length === 0) return false;

  img2imgImageData = savedImages[0];
  state.referenceImage = savedImages[0];
  img2imgDropContent.classList.add('hidden');
  img2imgPreviewWrapper.classList.remove('hidden');
  img2imgDropZone.classList.add('has-image');
  img2imgDropZone.classList.remove('collapsed');
  img2imgStationRow.classList.toggle('collapsed', !showStation);
  renderMultiThumbnails(savedImages);
  return true;
}

function enterImg2ImgMode() {
  if (state.referenceImage && !img2imgImageData) {
    exitEditMode();
  }

  state.workMode = 'img2img';
  img2imgDropZone.classList.remove('collapsed');
  img2imgStationRow.classList.remove('collapsed');

  // 恢复之前保存的参考图
  restoreImg2ImgPreview({ showStation: true });

  const inputArea = document.getElementById('inputArea');
  if (inputArea) {
    inputArea.classList.add('img2img-mode');
    inputArea.classList.remove('edit-mode');
  }

  promptInput.placeholder = t('input.img2imgPlaceholder');
  updateModeTag();
  promptInput.focus();
}

export function exitImg2ImgMode() {
  state.workMode = state.referenceImage ? 'edit' : 'draw';

  const inputArea = document.getElementById('inputArea');
  if (inputArea) {
    inputArea.classList.remove('img2img-mode');
  }

  requestAnimationFrame(() => {
    if (state.workMode !== 'img2img') {
      // 有参考图时保留预览区可见，只隐藏拖放提示区
      if (window.img2imgMultiImages && window.img2imgMultiImages.length > 0) {
        img2imgDropZone.classList.remove('collapsed');
        img2imgStationRow.classList.add('collapsed');
      } else {
        img2imgDropZone.classList.add('collapsed');
        img2imgStationRow.classList.add('collapsed');
      }
    }
  });
  promptInput.placeholder = t('input.placeholder');
  updateModeTag();
}

function syncModeToggle(mode) {
  const modeToggle = document.getElementById('modeToggle');
  if (!modeToggle) return;

  modeToggle.classList.toggle('img2img', mode === 'img2img');
  modeToggle.querySelectorAll('.mode-option').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
}

function updateModeTag() {
  const modeTag = document.getElementById('modeTag');
  if (!modeTag) return;

  modeTag.classList.remove('edit', 'img2img');

  if (state.workMode === 'edit' || (state.referenceImage && !img2imgImageData)) {
    modeTag.textContent = '🖊 ' + t('input.editModeBadge');
    modeTag.classList.add('edit');
  } else if (state.workMode === 'img2img') {
    modeTag.textContent = '🖼 ' + t('input.img2imgModeBadge');
    modeTag.classList.add('img2img');
  } else {
    modeTag.textContent = '🎨 ' + t('input.drawModeBadge');
  }
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

  state.generating = true;
  generateBtn.disabled = true;
  promptInput.disabled = true;
  const canvasPlaceholder = document.getElementById('canvasPlaceholder');
  if (canvasPlaceholder) canvasPlaceholder.classList.add('hidden');
  loadingOverlay.classList.remove('hidden');

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

      if (result.debug && imgCount === 0) {
        const dbg = result.debug;
        console.log('[Qwen Debug]', dbg);
        showToast(`调试: output keys=[${dbg.outputKeys.join(',')}], results=${dbg.resultsCount}, raw=${dbg.rawOutput.substring(0, 200)}`, 'info');
      }

      promptInput.value = '';

      if (state.workMode === 'edit' && state.referenceImage && result.images?.length > 0) {
        const firstImg = result.images[0];
        const newSrc = firstImg.dataUrl || `/api/images/${firstImg.id}`;
        result.images.forEach((img, idx) => {
          state.editChain.push({
            src: img.dataUrl || `/api/images/${img.id}`,
            id: img.id,
            label: t('iteration.version', state.editChain.length),
          });
        });
        state.referenceImage = newSrc;
        renderEditChain(state.editChain);
      }

      window.dispatchEvent(new CustomEvent('imagesGenerated', { detail: result }));

      if (result.sessionId) {
        window.dispatchEvent(new CustomEvent('sessionUpdated', { detail: result }));
      }

      state.currentSession = result.session || { id: result.sessionId, mode: state.workMode || 'draw' };
      state.sessionModeLocked = true;

      if (!state.referenceImage && state.workMode === 'edit') {
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

export function enterEditMode(referenceImage, src, id) {
  transitionToEditMode(referenceImage, src, id);
}

export function exitEditMode(options = {}) {
  return transitionFromEditMode(options);
}

async function transitionToEditMode(referenceImage, src, id) {
  if (modeTransitioning) return;
  modeTransitioning = true;

  // 如果已经在修改模式里再次点击“修改”，不要覆盖首次进入修改模式时记录的来源模式
  const fromMode = state.workMode === 'edit'
    ? editContext.returnMode
    : (state.workMode === 'img2img' ? 'img2img' : 'draw');

  if (state.workMode !== 'edit') {
    editContext = {
      returnMode: fromMode,
      hadImg2ImgImages: !!window.img2imgMultiImages?.length,
    };
  }

  const inputArea = document.getElementById('inputArea');

  if (fromMode === 'img2img') {
    // 进入修改模式时：参考图区先柔和淡出，再与高度折叠衔接，避免“下坠后突然消失”
    playClassAnimation(img2imgDropZone, 'leaving', MODE_TIMING.img2imgLeave);
    await delay(110);
    img2imgDropZone.classList.add('collapsed');
    img2imgStationRow.classList.add('collapsed');
    inputArea?.classList.remove('img2img-mode');
    await delay(MODE_TIMING.img2imgLeave - 40);
  }

  state.referenceImage = referenceImage;
  state.workMode = 'edit';
  promptInput.value = '';
  promptInput.placeholder = t('input.editPlaceholder');

  if (inputArea) {
    inputArea.classList.add('edit-mode');
    inputArea.classList.remove('img2img-mode');
    playClassAnimation(inputArea, 'entering-edit', MODE_TIMING.inputEditEnter);
  }

  updateModeTag();
  document.getElementById('modeTag')?.classList.add('bounce');
  window.setTimeout(() => document.getElementById('modeTag')?.classList.remove('bounce'), 520);

  state.editChain = [{ src, id, label: t('iteration.original') }];
  await delay(fromMode === 'img2img' ? 120 : 0);
  renderEditChain(state.editChain);
  promptInput.focus();

  modeTransitioning = false;
}

async function transitionFromEditMode({ animate = true, restoreReturnMode = true, force = false, targetMode = null } = {}) {
  if (modeTransitioning && !force) return;
  modeTransitioning = true;

  state.referenceImage = null;
  state.editChain = [];
  refImagePreview.classList.add('hidden');

  const inputArea = document.getElementById('inputArea');
  if (inputArea) {
    inputArea.classList.remove('edit-mode');
  }

  clearChain();
  if (animate) {
    await delay(MODE_TIMING.chain);
  }

  if ((restoreReturnMode && editContext.returnMode === 'img2img') || targetMode === 'img2img') {
    state.workMode = 'img2img';
    if (inputArea) {
      inputArea.classList.add('img2img-mode');
    }
    promptInput.placeholder = t('input.img2imgPlaceholder');
    syncModeToggle('img2img');
    updateModeTag();

    img2imgDropZone.classList.remove('collapsed');
    img2imgStationRow.classList.remove('collapsed');

    const restored = restoreReturnMode ? restoreImg2ImgPreview({ showStation: true }) : false;
    if (!restored) {
      img2imgImageData = null;
      window.img2imgMultiImages = null;
      img2imgFileInput.value = '';
      img2imgDropZone.classList.remove('has-image');
      img2imgPreviewWrapper.classList.add('hidden');
      img2imgPreviewWrapper.innerHTML = '';
      img2imgDropContent.classList.remove('hidden');
    }

    if (animate) {
      playClassAnimation(img2imgDropZone, 'restoring', MODE_TIMING.img2imgRestore);
    }
    promptInput.focus();
    modeTransitioning = false;
    return;
  }

  state.workMode = 'draw';
  promptInput.placeholder = t('input.placeholder');
  img2imgDropZone.classList.add('collapsed');
  img2imgStationRow.classList.add('collapsed');
  syncModeToggle('draw');
  updateModeTag();
  promptInput.focus();
  modeTransitioning = false;
}
