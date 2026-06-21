/**
 * 火山方舟 Provider — Seedream 系列模型
 * API 文档: https://www.volcengine.com/docs/6791/214528
 */

import { safeLog } from '../lib/safe-log.js';

export default {
  id: 'volcengine',
  name: '火山方舟 (Seedream)',
  websiteUrl: 'https://console.volcengine.com/ark',
  defaults: { n: 1, size: '2K' },

  async connect(apiKey) {
    try {
      const resp = await fetch('https://ark.cn-beijing.volces.com/api/v3/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`API 返回错误 (${resp.status}): ${text}`);
      }

      const data = await resp.json();

      // Seedream 各版本支持的尺寸（基于火山官方 API 文档）
      // 3.0: 仅 1K | 4.0: 1K/2K/4K | 4.5: 2K/4K | 5.0: 2K/3K
      // 尺寸字母必须大写 K（小写 k 会导致 400 错误）
      const sizeConfig = {
        'doubao-seedream-5-0-260128': { sizes: ['2K', '3K'], maxN: 1, sizeFormat: 'short' },
        'doubao-seedream-5-0-lite-260128': { sizes: ['2K', '3K'], maxN: 1, sizeFormat: 'short' },
        'doubao-seedream-4-5-250428': { sizes: ['2K', '4K'], maxN: 1, sizeFormat: 'short' },
        'doubao-seedream-4-5-251128': { sizes: ['2K', '4K'], maxN: 1, sizeFormat: 'short' },
        'doubao-seedream-4-0-250528': { sizes: ['2K', '1K', '4K'], maxN: 1, sizeFormat: 'short' },
        'doubao-seedream-4-0-250828': { sizes: ['2K', '1K', '4K'], maxN: 1, sizeFormat: 'short' },
        'doubao-seedream-3-0-250328': { sizes: ['1K'], maxN: 1, sizeFormat: 'short' },
        'doubao-seedream-3-0-t2i-250415': { sizes: ['1K'], maxN: 1, sizeFormat: 'short' },
      };

      // 过滤出图片生成模型
      const imageModels = (data.data || [])
        .filter((m) => m.id && m.id.includes('seedream'))
        .map((m) => {
          // 精简显示名称：Seedream X.Y
          const nameMap = {
            'doubao-seedream-5-0-260128': 'Seedream 5.0 Lite',
            'doubao-seedream-5-0-lite-260128': 'Seedream 5.0 Lite',
            'doubao-seedream-4-5-250428': 'Seedream 4.5',
            'doubao-seedream-4-0-250528': 'Seedream 4.0',
            'doubao-seedream-3-0-250328': 'Seedream 3.0',
            'doubao-seedream-3-0-t2i-250415': 'Seedream 3.0',
            'doubao-seedream-4-0-250828': 'Seedream 4.0',
            'doubao-seedream-4-5-251128': 'Seedream 4.5',
          };
          // 如果没有映射，自动解析版本号
          if (!nameMap[m.id]) {
            const match = m.id.match(/seedream[- ](\d+\.?\d*)/i);
            nameMap[m.id] = match ? `Seedream ${match[1]}` : m.id;
          }
          const cfg = sizeConfig[m.id] || { sizes: ['2k', '1k'], maxN: 1, sizeFormat: 'short' };
          return {
            id: m.id,
            name: nameMap[m.id],
            maxN: cfg.maxN,
            sizes: cfg.sizes,
            sizeFormat: cfg.sizeFormat,
          };
        });

      return {
        success: true,
        provider: { id: 'volcengine', name: '火山方舟 (Seedream)' },
        models: imageModels,
      };
    } catch (err) {
      return {
        success: false,
        error: `连接失败: ${err.message}`,
      };
    }
  },

  async text2img({ model, prompt, n, size, apiKey }) {
    // 规范化 size：确保大写 K（API 要求 "2K" 而非 "2k"）
    const normalizedSize = (size || '2K').replace(/k$/i, 'K');
    const normalizedN = n || 1;

    const reqBody = {
      model,
      prompt,
      n: normalizedN,
      size: normalizedSize,
      response_format: 'b64_json',
      watermark: false,
    };

    console.log(`[Seedream-REQ] model=${model} n=${normalizedN} size=${normalizedSize}`);
    console.log(`[Seedream-REQ] prompt前80字: ${prompt.substring(0, 80)}`);

    const resp = await fetch('https://ark.cn-beijing.volces.com/api/v3/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reqBody),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error(`[Seedream-ERR] HTTP ${resp.status}: ${text.substring(0, 500)}`);
      throw new Error(`火山方舟生图失败 (${resp.status}): ${text}`);
    }

    const data = await resp.json();
    safeLog(`[Seedream-text2img] 响应: data.data.length=${data.data?.length || 0}, 请求n=${n || 1}`);

    return {
      success: true,
      images: (data.data || []).map((img, i) => ({
        id: `img_${Date.now()}_${i}`,
        dataUrl: img.b64_json
          ? `data:image/png;base64,${img.b64_json}`
          : null,
        url: img.url || null,
        index: i,
      })),
      usage: data.usage || null,
    };
  },

  async img2img({ model, prompt, referenceImage, n, size, apiKey }) {
    // 构建请求体
    const body = {
      model,
      prompt,
      n: n || 1,
      size: size || '2K',
      response_format: 'b64_json',
      watermark: false,
    };

    // referenceImage 是结构化对象 { base64, mimeType, dataUrl }
    // 火山方舟 API 要求 image 字段使用完整 data URI 格式
    // data:image/<format>;base64,<base64> （注意：不是纯 base64）
    if (referenceImage) {
      body.image = (referenceImage.dataUrl) || referenceImage;
    }

    const resp = await fetch('https://ark.cn-beijing.volces.com/api/v3/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`火山方舟图生图失败 (${resp.status}): ${text}`);
    }

    const data = await resp.json();

    return {
      success: true,
      images: (data.data || []).map((img, i) => ({
        id: `img_${Date.now()}_${i}`,
        dataUrl: img.b64_json
          ? `data:image/png;base64,${img.b64_json}`
          : null,
        url: img.url || null,
        index: i,
      })),
      usage: data.usage || null,
    };
  },
};