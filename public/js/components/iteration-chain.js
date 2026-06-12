import state from '../state.js';
import { t } from '../i18n.js';
import { $ } from '../utils/dom.js';

const iterationChain = $('#iterationChain');
const iterationTimeline = $('#iterationTimeline');

const CHAIN_HIDDEN = 'chain-hidden';

/**
 * 两段式时序动画：
 *
 * 展开：画布/输入区先分开（0.8s）→ 迭代历史淡入（0.6s，delay 0.8s）
 * 收起：迭代历史先淡出（0.5s）→ 画布/输入区再合拢（0.8s，delay 0.5s）
 */

/** 收起：先淡出，再合拢 */
export function clearChain() {
  if (iterationChain.classList.contains(CHAIN_HIDDEN)) {
    iterationTimeline.innerHTML = '';
    return;
  }
  // opacity 立即过渡，layout 延迟 0.025s
  iterationChain.style.transitionDelay = '0.025s, 0.025s, 0.025s, 0.025s, 0s';
  iterationChain.offsetHeight;
  iterationChain.classList.add(CHAIN_HIDDEN);
  iterationChain.addEventListener('transitionend', function onHide(e) {
    if (e.propertyName !== 'max-height') return;
    iterationChain.removeEventListener('transitionend', onHide);
    iterationChain.style.transitionDelay = '';
    iterationTimeline.innerHTML = '';
  }, { once: true });
}

/** 展开：先分开，再淡入 */
function animateExpand() {
  // layout 立即过渡，opacity 延迟 0.025s
  iterationChain.style.transitionDelay = '0s, 0s, 0s, 0s, 0.025s';
  iterationChain.offsetHeight;
  iterationChain.classList.remove(CHAIN_HIDDEN);
  iterationChain.addEventListener('transitionend', function onShow(e) {
    if (e.propertyName !== 'opacity') return;
    iterationChain.removeEventListener('transitionend', onShow);
    iterationChain.style.transitionDelay = '';
  }, { once: true });
}

/** 从服务器迭代数据渲染 */
export function renderChain(iterations) {
  if (!iterations || iterations.length === 0) {
    iterationChain.classList.add(CHAIN_HIDDEN);
    return;
  }

  const wasHidden = iterationChain.classList.contains(CHAIN_HIDDEN);
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

    node.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('switchIteration', { detail: { index: i, iteration: iter } }));
      document.querySelectorAll('.iteration-node').forEach((n) => n.classList.remove('active'));
      node.classList.add('active');
    });

    iterationTimeline.appendChild(node);
  });

  if (wasHidden) {
    animateExpand();
  }
}

/** 从前端编辑链渲染 */
export function renderEditChain(chain) {
  if (!chain || chain.length === 0) {
    iterationChain.classList.add(CHAIN_HIDDEN);
    return;
  }

  const wasHidden = iterationChain.classList.contains(CHAIN_HIDDEN);
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

    node.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('lightbox', {
        detail: { src: item.src, prompt: '', id: item.id },
      }));
      document.querySelectorAll('.iteration-node').forEach((n) => n.classList.remove('active'));
      node.classList.add('active');
    });

    iterationTimeline.appendChild(node);
  });

  if (wasHidden) {
    animateExpand();
  }
}
