/**
 * 参考图预处理 — 将前端传来的各种格式统一转为结构化对象
 * 返回 { base64, mimeType, dataUrl } 或 null
 */

import { loadImage } from '../storage/images.js';
import { safeLog } from './safe-log.js';

export async function processReferenceImage(referenceImage) {
  if (!referenceImage) {
    safeLog('[refImg] 无参考图 → text2img 模式');
    return null;
  }

  // 情况 1：data URI 格式 "data:image/png;base64,xxxx"
  if (referenceImage.startsWith('data:image/')) {
    const match = referenceImage.match(/^data:(image\/\w+);base64,(.+)$/);
    if (match) {
      safeLog(`[refImg] dataURI(${match[1]}) fingerprint=${match[2].substring(0, 20)}... size≈${(match[2].length * 0.75 / 1024).toFixed(0)}KB`);
      return { base64: match[2], mimeType: match[1], dataUrl: referenceImage };
    }
    safeLog('[refImg] dataURI 格式但正则不匹配!');
  }

  // 情况 2：本地 API 路径 "/api/images/img_xxx"
  if (referenceImage.startsWith('/api/images/')) {
    const imgId = referenceImage.split('/').pop();
    safeLog(`[refImg] 本地路径 /api/images/${imgId}`);
    const img = loadImage(imgId);
    if (img?.dataUrl) {
      const match = img.dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
      if (match) {
        safeLog(`[refImg] 本地文件加载成功 fingerprint=${match[2].substring(0, 20)}...`);
        return { base64: match[2], mimeType: match[1], dataUrl: img.dataUrl };
      }
    }
    safeLog('[refImg] 本地文件不存在或无法解析!');
    return null;
  }

  // 情况 3：外部 URL（百炼 OSS 直传 / 其他 HTTP URL）
  if (referenceImage.startsWith('http://') || referenceImage.startsWith('https://')) {
    if (referenceImage.includes('dashscope-result') || referenceImage.includes('oss-')) {
      safeLog(`[refImg] 百炼OSS URL 直接透传: ${referenceImage.substring(0, 80)}...`);
      return { base64: '', mimeType: 'image/png', dataUrl: referenceImage };
    }
    safeLog(`[refImg] 外部URL: ${referenceImage.substring(0, 80)}...`);
    try {
      const resp = await fetch(referenceImage);
      const arrBuf = await resp.arrayBuffer();
      const b64 = Buffer.from(arrBuf).toString('base64');
      const contentType = resp.headers.get('content-type') || 'image/png';
      return { base64: b64, mimeType: contentType, dataUrl: `data:${contentType};base64,${b64}` };
    } catch (err) {
      safeLog(`[refImg] 外部URL下载失败: ${err.message}`);
      return null;
    }
  }

  // 情况 4：裸 base64 字符串
  if (/^[A-Za-z0-9+/=]+$/.test(referenceImage.substring(0, 100))) {
    safeLog(`[refImg] 裸base64 fingerprint=${referenceImage.substring(0, 20)}...`);
    return { base64: referenceImage, mimeType: 'image/png', dataUrl: `data:image/png;base64,${referenceImage}` };
  }

  safeLog(`[refImg] 无法识别的格式，前50字符: ${String(referenceImage).substring(0, 50)}`);
  return null;
}
