/**
 * 阿里云百炼 Provider — Qwen-Image + Wan 系列
 * API 文档: https://help.aliyun.com/zh/model-studio/
 * 统一通过 DashScope API 调用
 */

import { safeLog, safeError } from '../lib/safe-log.js';

export default {
  id: 'aliyun',
  name: '阿里云百炼 (Qwen + Wan)',
  websiteUrl: 'https://bailian.console.aliyun.com/',
  defaults: { n: 1, size: '2048*2048' },

  /** 将前端通用的 2K/1K 转为阿里云格式的 2048*2048/1024*1024 */
  _normalizeSize(size) {
    if (!size) return '2048*2048';
    // 已符合格式的直接返回
    if (/^\d+\*\d+$/.test(size)) return size;
    // 前端传来的 2K / 1K
    const map = { '2K': '2048*2048', '1K': '1024*1024', '4K': '4096*4096' };
    return map[size] || '2048*2048';
  },

  async connect(apiKey) {
    // 阿里云百炼没有标准模型列表 API，返回预置模型
    const models = [
      { id: 'qwen-image-max', name: 'Qwen Max', maxN: 1, sizes: ['1664*928', '928*1664'] },
      { id: 'qwen-image-plus', name: 'Qwen Plus', maxN: 1, sizes: ['1664*928', '928*1664'] },
      { id: 'qwen-image-2.0-pro', name: 'Qwen 2.0 Pro', maxN: 6, sizes: ['2048*2048', '1280*720', '720*1280'] },
      { id: 'qwen-image-2.0', name: 'Qwen 2.0', maxN: 6, sizes: ['2048*2048', '1280*720', '720*1280'] },
      { id: 'qwen-image-turbo', name: 'Qwen Turbo', maxN: 6, sizes: ['2048*2048', '1280*720', '720*1280'] },
      { id: 'wan2.7-image-pro', name: 'Wan 2.7 Pro', maxN: 4, sizes: ['2048*2048'] },
      { id: 'wan2.7-image', name: 'Wan 2.7', maxN: 4, sizes: ['2048*2048'] },
    ];

    // 只做非空校验，不做网络验证（验证推迟到实际生图时）
    if (!apiKey || apiKey.trim() === '') {
      return { success: false, error: 'API Key 不能为空' };
    }

    return {
      success: true,
      provider: { id: 'aliyun', name: '阿里云百炼 (Qwen + Wan)' },
      models,
    };
  },

  async text2img({ model, prompt, n, size, apiKey }) {
    // 判断是 Wan 还是 Qwen 模型
    const isWan = model.startsWith('wan');

    if (isWan) {
      return this._generateWan({ model, prompt, n, size, apiKey });
    }
    return this._generateQwen({ model, prompt, n, size, apiKey });
  },

  async img2img({ model, prompt, referenceImage, n, size, apiKey }) {
    const isWan = model.startsWith('wan');

    if (isWan) {
      return this._generateWan({ model, prompt, n, size, apiKey, referenceImage });
    }
    return this._generateQwen({ model, prompt, n, size, apiKey, referenceImage });
  },

  // ——— Qwen 系列生图 ———
  async _generateQwen({ model, prompt, n, size, apiKey, referenceImage }) {
    const messages = [{ role: 'user', content: [{ text: prompt }] }];

    // 图生图：附加参考图
    // referenceImage 是结构化对象 { base64, mimeType, dataUrl }
    if (referenceImage) {
      // Qwen 多模态 API 在 content 中使用 image 字段传 data URL
      const imageUrl = referenceImage.dataUrl
        || `data:${referenceImage.mimeType || 'image/png'};base64,${referenceImage.base64}`;
      messages[0].content.unshift({ image: imageUrl });
      const fp = imageUrl.includes('base64,') ? imageUrl.substring(imageUrl.indexOf('base64,') + 7, imageUrl.indexOf('base64,') + 27) : imageUrl.substring(0, 20);
      safeLog(`[Qwen-img2img] model=${model} prompt="${prompt.substring(0, 50)}" refFingerprint=${fp}... refSize≈${(imageUrl.length / 1024).toFixed(0)}KB`);
    } else {
      safeLog(`[Qwen-text2img] model=${model} n=${n || 1} size=${size} prompt="${prompt.substring(0, 50)}" (无参考图)`);
    }

    const resp = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: { messages },
        parameters: {
          n: n || 1,
          size: this._normalizeSize(size),
        },
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`阿里云百炼生图失败 (${resp.status}): ${text}`);
    }

    const data = await resp.json();
    return this._parseImageResult(data);
  },

  async _pollQwenTask(taskId, apiKey, maxRetries = 60) {
    for (let i = 0; i < maxRetries; i++) {
      await new Promise((r) => setTimeout(r, 2000));

      const resp = await fetch(
        `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`,
        { headers: { 'Authorization': `Bearer ${apiKey}` } }
      );

      if (!resp.ok) continue;

      const data = await resp.json();

      if (data.output?.task_status === 'SUCCEEDED') {
        return this._parseImageResult(data);
      }

      if (data.output?.task_status === 'FAILED') {
        throw new Error(`阿里云生图失败: ${data.output?.message || '未知错误'}`);
      }
    }

    throw new Error('阿里云生图超时');
  },

  /**
   * 通用图像结果解析 — 正确遍历 choices[] → message.content[] → { image } 嵌套
   * 适配 Qwen-Image 和 Wan2.7 同步调用的返回格式
   */
  _parseImageResult(data) {
    const imageUrls = [];
    const seen = new Set();

    // 辅助：去重添加
    const addUrl = (url) => {
      if (url && typeof url === 'string' && url.startsWith('http') && !seen.has(url)) {
        seen.add(url);
        imageUrls.push(url);
      }
    };

    // 1. output.choices[] → message.content[] → { image, type: "image" }
    const choices = data.output?.choices;
    if (Array.isArray(choices)) {
      safeLog(`[parseImageResult] choices.length=${choices.length}`);
      for (let i = 0; i < choices.length; i++) {
        const contents = choices[i].message?.content || [];
        safeLog(`[parseImageResult] choice[${i}].content.length=${contents.length}`);
        for (const item of contents) {
          if (item.image) addUrl(item.image);
        }
      }
    }

    // 2. output.results[] (旧格式/异步轮询结果)
    const results = data.output?.results;
    if (Array.isArray(results)) {
      safeLog(`[parseImageResult] results.length=${results.length}`);
      for (const r of results) {
        addUrl(r.url || r.image || r.result_url);
      }
    }

    // 3. output.result_urls[]
    if (Array.isArray(data.output?.result_urls)) {
      for (const u of data.output.result_urls) addUrl(u);
    }

    // 4. output.result_url / output.image (单图兜底)
    addUrl(data.output?.result_url);
    addUrl(data.output?.image);

    safeLog(`[parseImageResult] 最终收集到 ${imageUrls.length} 个图片 URL`);

    const images = imageUrls.map((url, i) => ({
      id: `img_${Date.now()}_${i}`,
      url,
      dataUrl: null,
      index: i,
    }));

    const debug = {
      outputKeys: data.output ? Object.keys(data.output) : [],
      choicesCount: choices?.length || 0,
      resultsCount: results?.length || 0,
      imagesCount: images.length,
      rawOutput: JSON.stringify(data.output || {}).substring(0, 800),
    };

    return { success: true, images, usage: data.usage || null, debug };
  },

  // ——— Wan 系列生图 ———
  // Wan 2.7 同步调用使用 multimodal-generation 端点（与 Qwen 相同），size 用 "2K"/"1K"/"4K" 缩写
  async _generateWan({ model, prompt, n, size, apiKey, referenceImage }) {
    const messages = [{ role: 'user', content: [{ text: prompt }] }];

    if (referenceImage) {
      const imageUrl = referenceImage.dataUrl
        || `data:${referenceImage.mimeType || 'image/png'};base64,${referenceImage.base64}`;
      messages[0].content.unshift({ image: imageUrl });
      safeLog(`[Wan-img2img] model=${model} prompt="${prompt.substring(0, 50)}" refFingerprint=${imageUrl.substring(imageUrl.indexOf('base64,') + 7, imageUrl.indexOf('base64,') + 27)}...`);
    } else {
      safeLog(`[Wan-text2img] model=${model} n=${n || 1} size=${size} prompt="${prompt.substring(0, 50)}" (无参考图)`);
    }

    // Wan 用 "2K"/"1K"/"4K" 缩写格式，将宽*高格式自动转换
    const sizeMap = { '2048*2048': '2K', '1024*1024': '1K', '4096*4096': '4K' };
    const wanSize = sizeMap[size] || size || '2K';

    const body = {
      model,
      input: { messages },
      parameters: {
        n: n || 1,
        size: wanSize,
        thinking_mode: true,   // Wan2.7 默认开启思考模式，提升画质
        watermark: false,
      },
    };

    // ⚠️ 关键修复：Wan2.7 同步调用必须用 multimodal-generation 端点
    // image-generation 是异步端点，不带 X-DashScope-Async: enable 会返回 403
    const resp = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`阿里云 Wan 生图失败 (${resp.status}): ${text}`);
    }

    const data = await resp.json();
    return this._parseImageResult(data);
  },
};