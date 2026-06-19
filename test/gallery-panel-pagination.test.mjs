import assert from 'node:assert/strict';

globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

globalThis.document = {
  getElementById: () => null,
};

globalThis.window = {
  addEventListener: () => {},
};

const { getInitialGalleryItems, getOlderGalleryItems } = await import('../public/js/components/gallery-panel.js');

const items = Array.from({ length: 45 }, (_, index) => ({ id: `img_${index + 1}` }));

assert.deepEqual(
  getInitialGalleryItems(items, 20).map((item) => item.id),
  items.slice(25).map((item) => item.id),
  '首次应只返回最近 20 张'
);

assert.deepEqual(
  getOlderGalleryItems(items, 25, 20).map((item) => item.id),
  items.slice(5, 25).map((item) => item.id),
  '向上滚动应返回上一批 20 张'
);

assert.deepEqual(
  getOlderGalleryItems(items, 5, 20).map((item) => item.id),
  items.slice(0, 5).map((item) => item.id),
  '不足一批时应返回剩余全部旧图'
);

console.log('gallery pagination tests passed');
