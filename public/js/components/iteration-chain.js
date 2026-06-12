import state from '../state.js';
import { t } from '../i18n.js';
import { $ } from '../utils/dom.js';

const iterationChain = $('#iterationChain');
const iterationTimeline = $('#iterationTimeline');

const CHAIN_HIDDEN = 'chain-hidden';

/** 清空迭代链条（播放收起动画后清空内容） */
export function clearChain() {
  if (iterationChain.classList.contains(CHAIN_HIDDEN)) {
    iterationTimeline.innerHTML = '';
    return;
  }
  iterationChain.classList.add(CHAIN_HIDDEN);
  iterationChain.addEventListener('transitionend', function onHide() {
    iterationChain.removeEventListener('transitionend', onHide);
    iterationTimeline.innerHTML = '';
  }, { once: true });
}

/** 从服务器迭代数据渲染 */
export function renderChain(iterations) {
  if (!iterations || iterations.length === 0) {
    iterationChain.classList.add(CHAIN_HIDDEN);
    return;
  }

  iterationChain.classList.remove(CHAIN_HIDDEN);
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

/** 从前端编辑链渲染 */
export function renderEditChain(chain) {
  if (!chain || chain.length === 0) {
    iterationChain.classList.add(CHAIN_HIDDEN);
    return;
  }

  iterationChain.classList.remove(CHAIN_HIDDEN);
  iterationTimeline.innerHTML = '';

  chain.forEach((item, i) => {
    const node = document.createElement('div');
    node.className = `iteration-node${i === chain.length - 1 ? ' active' : ''}`;

    const thumb = document.createElement('img');
    thumb.src = item.src || '';
    thumb.alt = item.label || '';

    const label = document.createElement('span');
    label.className = 'iteration-label';
    label.textContent = item.label || (i === 0 ? t('iteration.original') : t('iteration.version', i));

    node.appendChild(thumb);
    node.appendChild(label);

    // 点击节点 → 预览该版本图片 + 高亮
    node.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('lightbox', {
        detail: { src: item.src, prompt: '', id: item.id },
      }));
      document.querySelectorAll('.iteration-node').forEach((n) => n.classList.remove('active'));
      node.classList.add('active');
    });

    iterationTimeline.appendChild(node);
  });
}
