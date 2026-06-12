import volcengine from './volcengine.js';
import aliyun from './aliyun.js';
import { getApiKey, getCustomModels } from '../lib/crypto-store.js';

const providerRegistry = {
  [volcengine.id]: volcengine,
  [aliyun.id]: aliyun,
};

/** 获取所有可用 Provider 信息（不含 apiKey） */
export function getProviders() {
  return Object.values(providerRegistry).map((p) => ({
    id: p.id,
    name: p.name,
    websiteUrl: p.websiteUrl,
    defaults: p.defaults,
  }));
}

/** 连接 Provider，验证 apiKey 并获取模型列表 */
export async function connectProvider(id, apiKey) {
  const provider = providerRegistry[id];
  if (!provider) {
    throw new Error(`未知的 Provider: ${id}`);
  }

  const result = await provider.connect(apiKey);
  
  // 合并用户自定义模型
  if (result.success) {
    const customModels = getCustomModels(id);
    if (customModels.length > 0) {
      result.models = [...result.models, ...customModels];
    }
  }
  
  return result;
}

/** 生成图片（文生图 / 图生图） */
export async function generateImage({ provider: providerId, model, prompt, n, size, referenceImage, sessionId, apiKey }) {
  const provider = providerRegistry[providerId];
  if (!provider) {
    throw new Error(`未知的 Provider: ${providerId}`);
  }

  // 如果没传 apiKey，从加密存储中读取
  const resolvedApiKey = apiKey || (await getApiKey(providerId));

  if (!resolvedApiKey) {
    throw new Error(`未配置 ${provider.name} 的 API Key，请先在侧边栏设置`);
  }

  const params = {
    model,
    prompt,
    n,
    size,
    apiKey: resolvedApiKey,
  };

  if (referenceImage) {
    params.referenceImage = referenceImage;
    return provider.img2img(params);
  }

  return provider.text2img(params);
}