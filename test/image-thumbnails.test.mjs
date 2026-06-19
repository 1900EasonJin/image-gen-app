import assert from 'node:assert/strict';
import fs from 'node:fs';
import sharp from 'sharp';
import { saveImage, loadThumbnailImage, deleteImage } from '../storage/images.js';

const id = `test_thumb_${Date.now()}`;
const pngBuffer = await sharp({
  create: {
    width: 10,
    height: 10,
    channels: 4,
    background: '#ff0000',
  },
}).png().toBuffer();
const pngDataUrl = `data:image/png;base64,${pngBuffer.toString('base64')}`;

try {
  saveImage(pngDataUrl, id);
  const thumb = await loadThumbnailImage(id);

  assert.ok(thumb, '应能生成缩略图');
  assert.equal(thumb.contentType, 'image/webp');
  assert.ok(thumb.path.endsWith('.thumb.webp'), '缩略图应使用独立 .thumb.webp 文件');
  assert.ok(fs.existsSync(thumb.path), '缩略图文件应存在');
} finally {
  deleteImage(id);
}

console.log('image thumbnail tests passed');
