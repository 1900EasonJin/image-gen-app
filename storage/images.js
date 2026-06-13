import fs from 'fs';
import path from 'path';
import os from 'os';

const IMAGES_DIR = path.join(os.homedir(), '.image-gen-v2', 'images');

function ensureDir() {
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }
}

/** 将 Base64 图片保存到本地，返回文件路径 */
export function saveImage(dataUrl, id) {
  ensureDir();

  const matches = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!matches) {
    // 如果是 URL 而非 base64，只返回 URL
    if (dataUrl.startsWith('http')) return dataUrl;
    throw new Error('无效的图片数据格式');
  }

  const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1] === 'png' ? 'png' : matches[1];
  const base64Data = matches[2];
  const filename = `${id || `img_${Date.now()}`}.${ext}`;
  const filePath = path.join(IMAGES_DIR, filename);

  fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

  return filePath;
}

/** 从本地缓存读取图片 */
export function loadImage(id) {
  ensureDir();

  const files = fs.readdirSync(IMAGES_DIR).filter((f) => f.startsWith(id + '.'));
  if (files.length === 0) return null;

  const filePath = path.join(IMAGES_DIR, files[0]);
  const data = fs.readFileSync(filePath);
  const ext = path.extname(filePath).slice(1);

  return {
    dataUrl: `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${data.toString('base64')}`,
    path: filePath,
  };
}

/** 删除单张图片 */
export function deleteImage(id) {
  ensureDir();
  const files = fs.readdirSync(IMAGES_DIR).filter((f) => f.startsWith(id + '.'));
  files.forEach((f) => fs.unlinkSync(path.join(IMAGES_DIR, f)));
  return files.length > 0;
}

/** 批量删除图片 */
export function deleteImages(ids) {
  let count = 0;
  for (const id of ids) {
    if (deleteImage(id)) count++;
  }
  return count;
}

/**
 * 清空孤儿图片缓存（未被任何会话引用的图片）
 * @param {Set<string>} activeIds - 所有活跃会话中引用的图片 ID
 * @returns {number} 删除数量
 */
export function clearOrphanImages(activeIds = new Set()) {
  ensureDir();
  const files = fs.readdirSync(IMAGES_DIR);
  let deleted = 0;
  for (const f of files) {
    const imgId = f.split('.')[0]; // img_xxx.png → img_xxx
    if (!activeIds.has(imgId)) {
      try {
        fs.unlinkSync(path.join(IMAGES_DIR, f));
        deleted++;
      } catch { /* 忽略 */ }
    }
  }
  return deleted;
}

/** 获取缓存大小信息 */
export function getCacheStats() {
  ensureDir();
  const files = fs.readdirSync(IMAGES_DIR);
  let totalSize = 0;
  for (const f of files) {
    try {
      totalSize += fs.statSync(path.join(IMAGES_DIR, f)).size;
    } catch { /* 忽略 */ }
  }
  return { count: files.length, sizeBytes: totalSize };
}