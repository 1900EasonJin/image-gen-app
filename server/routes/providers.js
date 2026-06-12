import { Router } from 'express';
import { getProviders, connectProvider } from '../../providers/index.js';
import { saveApiKey, getApiKey, maskApiKey as maskKey, getCustomModels, addCustomModel, removeCustomModel, getProviderCache, updateProviderCacheEntry } from '../../lib/crypto-store.js';

const router = Router();

// 获取所有可用 Provider 列表
router.get('/', (_req, res) => {
  const providers = getProviders();
  res.json({ success: true, providers });
});

// 获取 Provider 缓存状态（轻量级，从本地缓存读取，<5ms）
router.get('/cached-status', (_req, res) => {
  try {
    const providers = getProviders();
    const cache = getProviderCache();

    const result = providers.map((p) => {
      const cached = cache[p.id];
      const apiKey = cached ? true : false; // 只判断有没有保存过 key
      return {
        id: p.id,
        name: p.name,
        websiteUrl: p.websiteUrl,
        connected: !!(cached?.connected),
        models: cached?.models || [],
        maskedKey: cached?.maskedKey || '',
        cachedAt: cached?.cachedAt || null,
        stale: cached ? (Date.now() - new Date(cached.cachedAt).getTime() > 5 * 60 * 1000) : true, // 超过5分钟标记为过期
      };
    });

    res.json({ success: true, providers: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 获取 Provider 状态：强制重新连接验证（重量级）
router.get('/status', async (_req, res) => {
  try {
    const providers = getProviders();
    // 并行请求所有 Provider，提升速度
    const statusPromises = providers.map(async (p) => {
      const apiKey = await getApiKey(p.id);
      if (apiKey) {
        try {
          const result = await connectProvider(p.id, apiKey);

          // 连接成功 → 更新缓存
          if (result.success) {
            updateProviderCacheEntry(p.id, {
              connected: true,
              models: result.models,
              maskedKey: maskKey(apiKey),
            });
          }

          return {
            id: p.id,
            name: p.name,
            connected: result.success,
            models: result.success ? result.models : [],
            maskedKey: maskKey(apiKey),
            error: result.success ? null : result.error,
          };
        } catch {
          return { id: p.id, name: p.name, connected: false, models: [], maskedKey: maskKey(apiKey), error: '连接失败' };
        }
      } else {
        return { id: p.id, name: p.name, connected: false, models: [], maskedKey: '' };
      }
    });

    const status = await Promise.all(statusPromises);
    res.json({ success: true, providers: status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 连接 Provider（传入 API Key），返回可用模型
router.post('/:id/connect', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { apiKey } = req.body;

    if (!apiKey) {
      return res.status(400).json({ success: false, error: '缺少 apiKey 参数' });
    }

    const result = await connectProvider(id, apiKey);

    // 连接成功后保存 API Key（加密）+ 更新缓存
    if (result.success) {
      saveApiKey(id, apiKey);
      updateProviderCacheEntry(id, {
        connected: true,
        models: result.models,
        maskedKey: maskKey(apiKey),
      });
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 获取用户自定义模型
router.get('/:id/custom-models', async (req, res) => {
  try {
    const { id } = req.params;
    const models = getCustomModels(id);
    res.json({ success: true, models });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 添加用户自定义模型
router.post('/:id/custom-models', async (req, res) => {
  try {
    const { id } = req.params;
    const { modelId, modelName } = req.body;

    if (!modelId) {
      return res.status(400).json({ success: false, error: '缺少 modelId 参数' });
    }

    const models = addCustomModel(id, {
      id: modelId,
      name: modelName || modelId,
    });

    // 同步更新缓存中的模型列表
    const cache = getProviderCache();
    if (cache[id]?.connected) {
      const apiKey = await getApiKey(id);
      if (apiKey) {
        const result = await connectProvider(id, apiKey);
        if (result.success) {
          updateProviderCacheEntry(id, {
            connected: true,
            models: result.models,
            maskedKey: maskKey(apiKey),
          });
        }
      }
    }

    res.json({ success: true, models });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 删除用户自定义模型
router.delete('/:id/custom-models/:modelId', async (req, res) => {
  try {
    const { id, modelId } = req.params;
    const models = removeCustomModel(id, modelId);

    // 同步更新缓存中的模型列表
    const cache = getProviderCache();
    if (cache[id]?.connected) {
      const apiKey = await getApiKey(id);
      if (apiKey) {
        const result = await connectProvider(id, apiKey);
        if (result.success) {
          updateProviderCacheEntry(id, {
            connected: true,
            models: result.models,
            maskedKey: maskKey(apiKey),
          });
        }
      }
    }

    res.json({ success: true, models });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;