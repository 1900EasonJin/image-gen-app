/**
 * 画布动画工具 — 淡出当前卡片 + 渲染新内容
 * 用于 result-grid 和 gallery-panel 中的交叉淡入淡出
 */

/**
 * 带淡出动画的画布替换
 * @param {Function} renderFn - 渲染函数，接收 newImages 参数
 * @param {Array} newImages - 新图片数组，格式 [{ id, dataUrl, url, sourceUrl }]
 * @param {number} [duration=420] - 动画时间(ms)
 */
export function crossfadeCanvas(renderFn, newImages, duration = 420) {
  const canvasGrid = document.getElementById('canvasGrid');
  const currentCards = canvasGrid.querySelectorAll('.image-card');

  if (currentCards.length === 0) {
    // 画布为空，直接渲染
    renderFn(newImages);
    return;
  }

  // 淡出所有当前卡片
  currentCards.forEach((c) => {
    c.style.transition = `opacity ${duration * 0.8}ms ease, transform ${duration * 0.8}ms ease`;
    c.style.opacity = '0';
    c.style.transform = 'scale(0.92)';
  });

  // 淡出完成后渲染新图
  setTimeout(() => {
    renderFn(newImages);
  }, duration);
}
