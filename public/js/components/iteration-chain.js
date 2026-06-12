import state from '../state.js';
import { t } from '../i18n.js';
import { $ } from '../utils/dom.js';

const iterationChain = $('#iterationChain');
const iterationTimeline = $('#iterationTimeline');

/** 清空迭代链条 */
export function clearChain() {
  iterationChain.classList.add('hidden');
  iterationTimeline.innerHTML = '';
}

export function renderChain(iterations) {
  if (!iterations || iterations.length === 0) {
    iterationChain.classList.add('hidden');
    return;
  }

  iterationChain.classList.remove('hidden');
  iterationTimeline.innerHTML = '';

  iterations.forEach((iter, i) => {
    const node = document.createElement('div');
    node.className = `iteration-node${i === iterations.length - 1 ? ' active' : ''}`;

    const thumb = document.createElement('img');
    const imgId = iter.images?.[0]?.id;
    thumb.src = imgId ? `/api/images/${imgId}` : '';
    thumb.alt = `迭代 ${i + 1}`;

    const label = document.createElement('span');
    label.className = 'iteration-label';
    label.textContent = i === 0 ? t('iteration.original') : t('iteration.version', i);

    node.appendChild(thumb);
    node.appendChild(label);

    // 点击切换到对应迭代
    node.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('switchIteration', { detail: { index: i, iteration: iter } }));
      // 激活样式
      document.querySelectorAll('.iteration-node').forEach((n) => n.classList.remove('active'));
      node.classList.add('active');
    });

    iterationTimeline.appendChild(node);
  });
}