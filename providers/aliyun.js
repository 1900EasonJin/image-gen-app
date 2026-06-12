/**
 * 阿里云百炼 Provider — Qwen-Image + Wan 系列
 * API 文档: https://help.aliyun.com/zh/model-studio/
 * 统一通过 DashScope API 调用
 */

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
      { id: 'qwen-image-max', name: 'Qwen Max', desc: '经典旗舰', maxN: 1, sizes: ['1664*928', '928*1664'] },
      { id: 'qwen-image-plus', name: 'Qwen Plus', desc: '增强版', maxN: 1, sizes: ['1664*928', '928*1664'] },
      { id: 'qwen-image-2.0-pro', name: 'Qwen 2.0 Pro', desc: '最新旗舰', maxN: 6, sizes: ['2048*2048', '1280*720', '720*1280'] },
      { id: 'qwen-image-2.0', name: 'Qwen 2.0', desc: '标准版', maxN: 6, sizes: ['2048*2048', '1280*720', '720*1280'] },
      { id: 'qwen-image-turbo', name: 'Qwen Turbo', desc: '极速版', maxN: 6, sizes: ['2048*2048', '1280*720', '720*1280'] },
      { id: 'wan2.7-image-pro', name: 'Wan 2.7 Pro', desc: 'Wan 增强版', maxN: 4, sizes: ['2048*2048'] },
      { id: 'wan2.7-image', name: 'Wan 2.7', desc: 'Wan 标准版', maxN: 4, sizes: ['2048*2048'] },
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
      console.log(`[Qwen-img2img] model=${model} prompt="${prompt.substring(0, 50)}" refFingerprint=${fp}... refSize≈${(imageUrl.length / 1024).toFixed(0)}KB`);
    } else {
      console.log(`[Qwen-text2img] model=${model} prompt="${prompt.substring(0, 50)}" (无参考图)`);
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
    let imageUrls = [];

    // 主格式：output.choices[] → message.content[] → { image, type: "image" }
    // Qwen/Wan2.7 同步调用都走这个格式
    if (data.output?.choices && Array.isArray(data.output.choices)) {
      for (const choice of data.output.choices) {
        const contents = choice.message?.content || [];
        for (const item of contents) {
          if (item.image && typeof item.image === 'string' && item.image.startsWith('http')) {
            imageUrls.push(item.image);
          }
        }
      }
    }

    // 兜底兼容：旧格式 output.results[]（异步任务轮询结果等）
    if (imageUrls.length === 0 && data.output?.results && Array.isArray(data.output.results)) {
      imageUrls = data.output.results
        .map(r => r.url || r.image || r.result_url)
        .filter(u => typeof u === 'string' && u.startsWith('http'));
    }
    if (imageUrls.length === 0 && data.output?.result_urls && Array.isArray(data.output.result_urls)) {
      imageUrls = data.output.result_urls.filter(u => typeof u === 'string' && u.startsWith('http'));
    }
    if (imageUrls.length === 0 && data.output?.result_url && typeof data.output.result_url === 'string') {
      imageUrls = [data.output.result_url];
    }
    if (imageUrls.length === 0 && data.output?.image && typeof data.output.image === 'string') {
      imageUrls = [data.output.image];
    }

    const images = imageUrls.map((url, i) => ({
      id: `img_${Date.now()}_${i}`,
      url,
      dataUrl: null,   // 百炼同步调用只返回 OSS 临时 URL，不含 base64
      index: i,
    }));

    // 调试信息
    const debug = {
      outputKeys: data.output ? Object.keys(data.output) : [],
      choicesCount: data.output?.choices?.length || 0,
      imagesCount: images.length,
      rawOutput: JSON.stringify(data.output || {}).substring(0, 500),
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
      console.log(`[Wan-img2img] model=${model} prompt="${prompt.substring(0, 50)}" refFingerprint=${imageUrl.substring(imageUrl.indexOf('base64,') + 7, imageUrl.indexOf('base64,') + 27)}...`);
    } else {
      console.log(`[Wan-text2img] model=${model} prompt="${prompt.substring(0, 50)}" (无参考图)`);
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