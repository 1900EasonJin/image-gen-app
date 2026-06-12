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
  if (!referenceImage) {
    console.log('[refImg] 无参考图 → text2img 模式');
    return null;
  }

  // 情况 1：data URI 格式 "data:image/png;base64,xxxx"
  if (referenceImage.startsWith('data:image/')) {
    const match = referenceImage.match(/^data:(image\/\w+);base64,(.+)$/);
    if (match) {
      const fingerprint = match[2].substring(0, 20);
      const sizeKB = (match[2].length * 0.75 / 1024).toFixed(0);
      console.log(`[refImg] dataURI(${match[1]}) fingerprint=${fingerprint}... size≈${sizeKB}KB`);
      return {
        base64: match[2],
        mimeType: match[1],
        dataUrl: referenceImage,
      };
    }
    console.log('[refImg] dataURI 格式但正则不匹配!');
  }

  // 情况 2：本地 API 路径 "/api/images/img_xxx"
  if (referenceImage.startsWith('/api/images/')) {
    const imgId = referenceImage.split('/').pop();
    console.log(`[refImg] 本地路径 /api/images/${imgId}`);
    const img = loadImage(imgId);
    if (img?.dataUrl) {
      const match = img.dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
      if (match) {
        console.log(`[refImg] 本地文件加载成功 fingerprint=${match[2].substring(0, 20)}...`);
        return {
          base64: match[2],
          mimeType: match[1],
          dataUrl: img.dataUrl,
        };
      }
    }
    console.log('[refImg] 本地文件不存在或无法解析!');
    return null;
  }

  // 情况 3：外部 URL
  if (referenceImage.startsWith('http://') || referenceImage.startsWith('https://')) {
    // 百炼 OSS URL — 直接透传，不需要下载转码，Qwen API 可直接读取
    if (referenceImage.includes('dashscope-result') || referenceImage.includes('oss-')) {
      console.log(`[refImg] 百炼OSS URL 直接透传: ${referenceImage.substring(0, 80)}...`);
      return {
        base64: '',
        mimeType: 'image/png',
        dataUrl: referenceImage,
      };
    }
    console.log(`[refImg] 外部URL: ${referenceImage.substring(0, 80)}...`);
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
    } catch (err) {
      console.log(`[refImg] 外部URL下载失败: ${err.message}`);
      return null;
    }
  }

  // 情况 4：裸 base64 字符串（前端可能直接传）
  // 尝试判断是否像 base64
  if (/^[A-Za-z0-9+/=]+$/.test(referenceImage.substring(0, 100))) {
    console.log(`[refImg] 裸base64 fingerprint=${referenceImage.substring(0, 20)}...`);
    return {
      base64: referenceImage,
      mimeType: 'image/png',
      dataUrl: `data:image/png;base64,${referenceImage}`,
    };
  }

  console.log(`[refImg] 无法识别的格式，前50字符: ${String(referenceImage).substring(0, 50)}`);
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
          // 如果是外部 URL，先下载再存本地
          if (!src.startsWith('data:') && src.startsWith('http')) {
            const imgResp = await fetch(src);
            if (!imgResp.ok) {
              console.error(`[图片下载失败] HTTP ${imgResp.status} for ${src.substring(0, 80)}`);
              savedImages.push(img);
              continue;
            }
            const arrBuf = await imgResp.arrayBuffer();
            const b64 = Buffer.from(arrBuf).toString('base64');
            const contentType = imgResp.headers.get('content-type') || 'image/png';
            const dataUrl = `data:${contentType};base64,${b64}`;
            const filePath = saveImage(dataUrl, img.id);
            savedImages.push({ ...img, dataUrl, localPath: filePath, sourceUrl: img.url });
          } else {
            const filePath = saveImage(src, img.id);
            savedImages.push({ ...img, localPath: filePath, sourceUrl: img.url });
          }
        } catch (e) {
          console.error(`[图片保存失败] ${img.id}:`, e.message);
          savedImages.push(img);
        }
      } else {
        savedImages.push(img);
      }
    }

    // 所有图片都没有有效数据时，向前端返回明确错误
    const validImages = savedImages.filter(img => img.dataUrl || img.url || img.localPath);
    if (validImages.length === 0) {
      console.error('[生成异常] API 返回了图片列表但所有图片均无有效 URL/dataUrl');
      console.error('[调试信息]', JSON.stringify(result.debug || {}));
      return res.json({
        success: false,
        error: 'API 返回了生成结果但无法获取图片数据，请检查 Provider 配置或查看服务端日志',
        debug: result.debug || null,
      });
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
          sourceUrl: img.sourceUrl || img.url,
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
          sourceUrl: img.sourceUrl || img.url,
        })),
      });
    }

    res.json({
      success: true,
      images: savedImages,
      sessionId: session.id,
      iterationIndex: session.iterations.length - 1,
      session,
      debug: result.debug || null,
    });
  } catch (err) {
    next(err);
  }
});

export default router;