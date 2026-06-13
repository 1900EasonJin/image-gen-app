import { Router } from 'express';
import { loadImage, clearOrphanImages, getCacheStats } from '../../storage/images.js';
import { getAllImageIds } from '../../storage/sessions.js';
import { exec } from 'child_process';
import os from 'os';
import path from 'path';

const router = Router();

// 获取缓存统计
router.get('/cache/stats', (_req, res) => {
  try {
    const stats = getCacheStats();
    res.json({ success: true, ...stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 打开图片缓存文件夹
router.post('/cache/open-dir', (_req, res) => {
  const dir = path.join(os.homedir(), '.image-gen-v2', 'images');
  exec(`open "${dir}"`, (err) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true });
  });
});

// 清除孤儿图片缓存（保留会话中引用的图片）
router.delete('/cache', (_req, res) => {
  try {
    const activeIds = getAllImageIds();
    const count = clearOrphanImages(activeIds);
    res.json({ success: true, deleted: count, kept: activeIds.size });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 获取本地缓存的图片
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const image = loadImage(id);

  if (!image) {
    return res.status(404).json({ success: false, error: '图片不存在' });
  }

  // 如果是 dataUrl，提取 base64 和 content-type
  if (image.dataUrl) {
    const matches = image.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (matches) {
      const contentType = matches[1];
      const buffer = Buffer.from(matches[2], 'base64');
      res.set('Content-Type', contentType);
      res.set('Cache-Control', 'public, max-age=86400');
      return res.send(buffer);
    }
  }

  // 直接发文件路径的文件
  if (image.path) {
    return res.sendFile(image.path);
  }

  res.status(500).json({ success: false, error: '无法读取图片' });
});

export default router;
