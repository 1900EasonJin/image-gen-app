import state from '../state.js';
import { t } from '../i18n.js';

const statusTag = document.getElementById('statusTag');
const modeToggle = document.getElementById('modeToggle');
const canvasArea = document.getElementById('canvasArea');
const canvasGrid = document.getElementById('canvasGrid');

export function init() {
  // 动态调整图片渲染大小，适配窗口/画布实际尺寸
  const resizeObserver = new ResizeObserver(() => {
    updateImageMaxHeight();
  });
  if (canvasArea) resizeObserver.observe(canvasArea);

  // 图片网格变化时重新计算
  const gridObserver = new MutationObserver(() => {
    updateImageMaxHeight();
  });
  if (canvasGrid) {
    gridObserver.observe(canvasGrid, { childList: true, attributes: true, attributeFilter: ['class'] });
  }

  // 模式切换
  if (modeToggle) {
    modeToggle.querySelectorAll('.mode-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        modeToggle.querySelectorAll('.mode-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.workMode = mode;
        // 滑动动画
        modeToggle.classList.toggle('img2img', mode === 'img2img');
      });
    });
  }

  // 监听生成完成 → 更新状态标签
  window.addEventListener('imagesGenerated', () => {
    if (statusTag) {
      statusTag.textContent = t('work.generated');
      statusTag.style.color = 'var(--success)';
    }
  });

  // 监听生成中状态
  window.addEventListener('stateChange', (e) => {
    if (!statusTag) return;
    if (e.detail.generating === true) {
      statusTag.textContent = t('work.generating');
      statusTag.style.color = 'var(--accent)';
    } else if (e.detail.generating === false && !state.currentSession) {
      statusTag.textContent = t('work.noData');
      statusTag.style.color = '';
    }
  });
}

/** 根据画布实际高度和图片数量，动态计算每张图片的最大高度 */
function updateImageMaxHeight() {
  if (!canvasGrid || !canvasArea) return;

  const areaHeight = canvasArea.clientHeight;
  if (areaHeight === 0) return;

  // 画布区 padding 上下共 32px
  const availableHeight = areaHeight - 32;

  // 根据图片数量计算合适的最大高度
  const cards = canvasGrid.querySelectorAll('.image-card');
  const count = cards.length;
  if (count === 0) return;

  let rows = 1;
  if (count === 1) rows = 1;
  else if (count === 2) rows = 1;
  else if (count === 3) rows = 2;
  else if (count === 4) rows = 2;
  else {
    const gridStyle = window.getComputedStyle(canvasGrid);
    const cols = gridStyle.gridTemplateColumns.split(' ').length || 3;
    rows = Math.ceil(count / Math.max(cols, 2));
  }

  const gap = 16;
  const totalGap = (rows - 1) * gap;
  const maxH = Math.floor((availableHeight - totalGap) / rows);

  canvasGrid.style.setProperty('--img-max-height', Math.max(maxH, 120) + 'px');
}