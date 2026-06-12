import { Router } from 'express';
import { generateImage } from '../../providers/index.js';
import { createSession, appendIteration } from '../../storage/sessions.js';
import { saveImage, loadImage } from '../../storage/images.js';

const router = Router();

/**
 * 预处理 referenceImage：
 * 将前端传来的各种格式（data URI、本地路径、URL）统一转为结构化对象
 * { base64, mimeType, dataUrl } 或 null
 */
async function processReferenceImage(referenceImage) {
  if (!referenceImage) return null;

  // 情况 1：data URI 格式 "data:image/png;base64,xxxx"
  if (referenceImage.startsWith('data:image/')) {
    const match = referenceImage.match(/^data:(image\/\w+);base64,(.+)$/);
    if (match) {
      return {
        base64: match[2],
        mimeType: match[1],
        dataUrl: referenceImage,
      };
    }
  }

  // 情况 2：本地 API 路径 "/api/images/img_xxx"
  if (referenceImage.startsWith('/api/images/')) {
    const imgId = referenceImage.split('/').pop();
    const img = loadImage(imgId);
    if (img?.dataUrl) {
      const match = img.dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
      if (match) {
        return {
          base64: match[2],
          mimeType: match[1],
          dataUrl: img.dataUrl,
        };
      }
    }
    return null;
  }

  // 情况 3：外部 URL
  if (referenceImage.startsWith('http://') || referenceImage.startsWith('https://')) {
    try {
      const resp = await fetch(referenceImage);
      const arrBuf = await resp.arrayBuffer();
      const b64 = Buffer.from(arrBuf).toString('base64');
      const contentType = resp.headers.get('content-type') || 'image/png';
      const dataUrl = `data:${contentType};base64,${b64}`;
      return {
        base64: b64,
        mimeType: contentType,
        dataUrl,
      };
    } catch {
      return null;
    }
  }

  // 情况 4：裸 base64 字符串（前端可能直接传）
  // 尝试判断是否像 base64
  if (/^[A-Za-z0-9+/=]+$/.test(referenceImage.substring(0, 100))) {
    return {
      base64: referenceImage,
      mimeType: 'image/png',
      dataUrl: `data:image/png;base64,${referenceImage}`,
    };
  }

  return null;
}

// 文生图 / 图生图
router.post('/', async (req, res, next) => {
  try {
    const { provider, model, prompt, n, size, referenceImage, sessionId, mode } = req.body;

    if (!provider || !model || !prompt) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数：provider, model, prompt',
      });
    }

    // 预处理 referenceImage：统一转为结构化对象
    const processedRefImage = await processReferenceImage(referenceImage);

    const result = await generateImage({
      provider,
      model,
      prompt,
      n: n || 1,
      size: size || '2K',
      referenceImage: processedRefImage,
      sessionId: sessionId || null,
    });

    if (!result.success) {
      return res.json(result);
    }

    // 保存图片到本地
    const savedImages = [];
    for (const img of result.images) {
      const src = img.dataUrl || img.url;
      if (src) {
        try {
          // 如果是外部 URL，先下载
          if (!src.startsWith('data:') && src.startsWith('http')) {
            const imgResp = await fetch(src);
            const arrBuf = await imgResp.arrayBuffer();
            const b64 = Buffer.from(arrBuf).toString('base64');
            const contentType = imgResp.headers.get('content-type') || 'image/png';
            const dataUrl = `data:${contentType};base64,${b64}`;
            const filePath = saveImage(dataUrl, img.id);
            savedImages.push({ ...img, dataUrl, localPath: filePath });
          } else {
            const filePath = saveImage(src, img.id);
            savedImages.push({ ...img, localPath: filePath });
          }
        } catch (e) {
          console.error('[图片保存失败]', e.message);
          savedImages.push(img); // 保存失败也不影响返回
        }
      } else {
        savedImages.push(img);
      }
    }

    // 创建或更新会话
    let session;
    if (sessionId) {
      session = appendIteration(sessionId, {
        prompt,
        model,
        provider,
        referenceImage: !!referenceImage,
        images: savedImages.map((img) => ({
          id: img.id,
          localPath: img.localPath,
        })),
      });
    } else {
      session = createSession({
        prompt,
        provider,
        model,
      });
      session = appendIteration(session.id, {
        prompt,
        model,
        provider,
        referenceImage: !!referenceImage,
        images: savedImages.map((img) => ({
          id: img.id,
          localPath: img.localPath,
        })),
      });
    }

    res.json({
      success: true,
      images: savedImages,
      sessionId: session.id,
      iterationIndex: session.iterations.length - 1,
      session,
    });
  } catch (err) {
    next(err);
  }
});

export default router;