import { Router } from 'express';
import { generateImage } from '../../providers/index.js';
import { createSession, appendIteration } from '../../storage/sessions.js';
import { saveImage } from '../../storage/images.js';
import { processReferenceImage } from '../../lib/ref-image.js';
import { safeLog, safeError } from '../../lib/safe-log.js';

const router = Router();

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
    safeLog(`[generate] API 返回 ${result.images.length} 张图片，开始保存...`);
    const savedImages = [];
    for (const img of result.images) {
      const src = img.dataUrl || img.url;
      if (src) {
        try {
          // 如果是外部 URL，先下载再存本地
          if (!src.startsWith('data:') && src.startsWith('http')) {
            const imgResp = await fetch(src);
            if (!imgResp.ok) {
              safeError(`[图片下载失败] HTTP ${imgResp.status} for ${src.substring(0, 80)}`);
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
          safeError(`[图片保存失败] ${img.id}:`, e.message);
          savedImages.push(img);
        }
      } else {
        savedImages.push(img);
      }
    }

    // 所有图片都没有有效数据时，向前端返回明确错误
    const validImages = savedImages.filter(img => img.dataUrl || img.url || img.localPath);
    safeLog(`[generate] 保存完成: ${savedImages.length} 张, 有效: ${validImages.length} 张`);
    if (validImages.length === 0) {
      safeError('[生成异常] API 返回了图片列表但所有图片均无有效 URL/dataUrl');
      safeError('[调试信息]', JSON.stringify(result.debug || {}));
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