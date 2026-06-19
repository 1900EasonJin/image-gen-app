# 已生成图片面板懒加载 Implementation Plan
> **For agents:** Use subagent-driven-development to execute. Steps use `- [ ]` syntax.

**Goal:** 降低历史会话首次载入大量已生成图片时的卡顿。
**Architecture:** 在右侧 Gallery 面板保留完整图片数据，但首屏只渲染最近一批缩略图 DOM；用户滚动到顶部时再逐批补渲染更早图片。保持现有点击预览、编辑、收藏逻辑不变。
**Tech Stack:** 原生 ES Modules、DOM、Node assert 测试。

### Task 1: 抽出分页计算逻辑

**Files:** Modify: `public/js/components/gallery-panel.js` / Create: `test/gallery-panel-pagination.test.mjs`

- [ ] **Step 1: Write failing test**
```js
import assert from 'node:assert/strict';
import { getInitialGalleryItems, getOlderGalleryItems } from '../public/js/components/gallery-panel.js';

const items = Array.from({ length: 45 }, (_, index) => ({ id: `img_${index + 1}` }));
assert.deepEqual(getInitialGalleryItems(items, 20).map((item) => item.id), items.slice(25).map((item) => item.id));
assert.deepEqual(getOlderGalleryItems(items, 25, 20).map((item) => item.id), items.slice(5, 25).map((item) => item.id));
assert.deepEqual(getOlderGalleryItems(items, 5, 20).map((item) => item.id), items.slice(0, 5).map((item) => item.id));
```

- [ ] **Step 2: Verify it fails**
Run: `node test/gallery-panel-pagination.test.mjs`
Expected: FAIL because functions are not exported.

- [ ] **Step 3: Write minimal implementation**
Add exported pure helpers and use a batch size of 20.

- [ ] **Step 4: Verify it passes**
Run: `node test/gallery-panel-pagination.test.mjs`
Expected: PASS.

### Task 2: Gallery 首次只渲染最近一批

**Files:** Modify: `public/js/components/gallery-panel.js`

- [ ] **Step 1: Implement render state**
Store all gallery items separately from rendered count, render only `getInitialGalleryItems` during `replaceGalleryWithAnimation` and full append during new generation.

- [ ] **Step 2: Add scroll loading**
When `galleryList.scrollTop <= 24`, prepend one older batch and preserve scroll position.

- [ ] **Step 3: Verify manually**
Run: `npm start`; open a history session with many images. Expected: first display is faster, scrolling up loads older images.

### Self-review
- 无 TBD/TODO。
- 不改变图片存储接口。
- 不改变画布默认显示逻辑。
