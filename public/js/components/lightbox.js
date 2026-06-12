import { $ } from '../utils/dom.js';

const lightbox = $('#lightbox');
const lightboxImage = $('#lightboxImage');
const lightboxPrompt = $('#lightboxPrompt');
const lightboxOverlay = $('#lightboxOverlay');
const lightboxClose = $('#lightboxClose');

let scale = 1;

export function init() {
  lightboxOverlay.addEventListener('click', close);
  lightboxClose.addEventListener('click', close);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  // 滚轮缩放
  lightboxImage.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    scale = Math.max(0.3, Math.min(3, scale + delta));
    lightboxImage.style.transform = `scale(${scale})`;
  });

  // 双击还原
  lightboxImage.addEventListener('dblclick', () => {
    scale = 1;
    lightboxImage.style.transform = `scale(${scale})`;
  });
}

export function open(src, prompt = '') {
  lightboxImage.src = src;
  lightboxPrompt.textContent = prompt;
  scale = 1;
  lightboxImage.style.transform = 'scale(1)';
  lightbox.classList.remove('hidden');
  lightbox.classList.add('active');
  window.electronAPI?.hideWindowButtons();
}

function close() {
  lightbox.classList.remove('active');
  window.electronAPI?.showWindowButtons();
  // 等退场动画播完再清内容
  setTimeout(() => {
    lightboxImage.src = '';
    lightboxPrompt.textContent = '';
  }, 300);
}