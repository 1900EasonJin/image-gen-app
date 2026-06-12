import { Router } from 'express';
import { loadImage } from '../../storage/images.js';

const router = Router();

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