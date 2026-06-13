/**
 * 删除确认气泡 — 二次确认删除操作
 */

import { t } from '../i18n.js';

let activeBubble = null;
let bubbleDismissTimer = null;

export function showDeleteBubble(btn) {
  dismissDeleteBubble();

  const bubble = document.createElement('div');
  bubble.className = 'delete-bubble arrow-left';
  bubble.textContent = t('action.confirmDelete');
  document.body.appendChild(bubble);

  const btnRect = btn.getBoundingClientRect();
  bubble.style.position = 'fixed';
  bubble.style.left = (btnRect.right + 8) + 'px';
  bubble.style.top = (btnRect.top + btnRect.height / 2) + 'px';
  bubble.style.transform = 'translateY(-50%)';

  activeBubble = { bubble, btn };

  const scheduleDismiss = () => {
    clearTimeout(bubbleDismissTimer);
    bubbleDismissTimer = setTimeout(() => {
      bubble.style.transition = 'opacity 0.2s ease';
      bubble.style.opacity = '0';
      setTimeout(() => dismissDeleteBubble(), 200);
    }, 200);
  };

  const cancelDismiss = () => {
    clearTimeout(bubbleDismissTimer);
    bubble.style.transition = '';
    bubble.style.opacity = '';
  };

  btn.addEventListener('mouseleave', scheduleDismiss);
  btn.addEventListener('mouseenter', cancelDismiss);
  bubble.addEventListener('mouseenter', cancelDismiss);
  bubble.addEventListener('mouseleave', scheduleDismiss);
}

export function dismissDeleteBubble() {
  if (activeBubble?.bubble) {
    activeBubble.bubble.remove();
    activeBubble = null;
  }
}

export function isDeleteConfirming(btn) {
  return activeBubble?.btn === btn;
}
