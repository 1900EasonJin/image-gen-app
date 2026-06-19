import fs from 'fs';
import path from 'path';
import os from 'os';
import sharp from 'sharp';

const IMAGES_DIR = path.join(os.homedir(), '.image-gen-v2', 'images');
const THUMB_WIDTH = 320;
const thumbnailJobs = new Map();

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
  createThumbnail(filePath, id || path.basename(filename, path.extname(filename))).catch((err) => {
    console.warn(`[thumbnail] 生成失败 ${filename}: ${err.message}`);
  });

  return filePath;
}

function findImageFile(id) {
  ensureDir();
  const files = fs.readdirSync(IMAGES_DIR).filter((f) => f.startsWith(id + '.') && !f.includes('.thumb.'));
  if (files.length === 0) return null;
  return path.join(IMAGES_DIR, files[0]);
}

function getThumbnailPath(id) {
  return path.join(IMAGES_DIR, `${id}.thumb.webp`);
}

async function createThumbnail(sourcePath, id) {
  ensureDir();

  if (thumbnailJobs.has(id)) {
    return thumbnailJobs.get(id);
  }

  const thumbPath = getThumbnailPath(id);
  const job = sharp(sourcePath)
    .rotate()
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .webp({ quality: 72 })
    .toFile(thumbPath)
    .then(() => thumbPath)
    .finally(() => thumbnailJobs.delete(id));

  thumbnailJobs.set(id, job);
  return job;
}

/** 从本地缓存读取图片 */
export function loadImage(id) {
  ensureDir();

  const filePath = findImageFile(id);
  if (!filePath) return null;
  const data = fs.readFileSync(filePath);
  const ext = path.extname(filePath).slice(1);

  return {
    dataUrl: `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${data.toString('base64')}`,
    path: filePath,
  };
}

/** 读取或按需生成缩略图 */
export async function loadThumbnailImage(id) {
  ensureDir();

  const thumbPath = getThumbnailPath(id);
  if (fs.existsSync(thumbPath)) {
    return { path: thumbPath, contentType: 'image/webp' };
  }

  const sourcePath = findImageFile(id);
  if (!sourcePath) return null;

  const generatedPath = await createThumbnail(sourcePath, id);
  return { path: generatedPath, contentType: 'image/webp' };
}

/** 删除图片 */
export function deleteImage(id) {
  ensureDir();

  const files = fs.readdirSync(IMAGES_DIR).filter((f) => f.startsWith(id + '.'));
  files.forEach((f) => fs.unlinkSync(path.join(IMAGES_DIR, f)));

  return files.length > 0;
}