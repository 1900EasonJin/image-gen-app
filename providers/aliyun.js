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
    return this._parseQwenResult(data);
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
        return this._parseQwenResult(data);
      }

      if (data.output?.task_status === 'FAILED') {
        throw new Error(`阿里云生图失败: ${data.output?.message || '未知错误'}`);
      }
    }

    throw new Error('阿里云生图超时');
  },

  _parseQwenResult(data) {
    const results = data.output?.results || data.output?.result_urls || [];

    const images = Array.isArray(results)
      ? results.map((r, i) => ({
          id: `img_${Date.now()}_${i}`,
          url: r.url || r,
          dataUrl: r.b64_image ? `data:image/png;base64,${r.b64_image}` : null,
          index: i,
        }))
      : [{
          id: `img_${Date.now()}_0`,
          url: data.output?.results?.[0]?.url || data.output?.result_url || null,
          dataUrl: null,
          index: 0,
        }];

    return { success: true, images, usage: data.usage || null };
  },

  // ——— Wan 系列生图 ———
  // Wan 2.7 使用 image-generation 端点，messages 格式，size 用 "2K"
  async _generateWan({ model, prompt, n, size, apiKey, referenceImage }) {
    const messages = [{ role: 'user', content: [{ text: prompt }] }];

    if (referenceImage) {
      const imageUrl = referenceImage.dataUrl
        || `data:${referenceImage.mimeType || 'image/png'};base64,${referenceImage.base64}`;
      messages[0].content.unshift({ image: imageUrl });
    }

    // Wan 用 2K/1K 格式，不用 2048*2048
    const wanSize = (!size || size === '2048*2048') ? '2K'
      : (size === '1024*1024' ? '1K' : size);

    const body = {
      model,
      input: { messages },
      parameters: {
        n: n || 1,
        size: wanSize,
      },
    };

    const resp = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/image-generation/generation', {
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

    // Wan 同步返回，格式与 Qwen 相同
    return this._parseQwenResult(data);
  },
};