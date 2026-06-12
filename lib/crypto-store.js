import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.image-gen-v2');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const CURRENT_KEY_VERSION = 2;

/** 从机器标识派生加密密钥（v2：只用 hostname + username，不依赖 MAC 地址） */
function deriveKeyV2() {
  const hostname = os.hostname();
  const username = os.userInfo().username;
  const salt = `image-gen-v2:${hostname}:${username}`;
  return crypto.pbkdf2Sync(salt, 'image-gen-v2-salt', 100000, 32, 'sha256');
}

/** 旧版密钥派生（v1：含 MAC 地址，已废弃但保留用于迁移） */
function deriveKeyV1() {
  const hostname = os.hostname();
  const username = os.userInfo().username;
  const networkInterfaces = os.networkInterfaces();
  let mac = '';
  for (const iface of Object.values(networkInterfaces)) {
    for (const info of iface) {
      if (!info.internal && info.mac && info.mac !== '00:00:00:00:00:00') {
        mac = info.mac;
        break;
      }
    }
    if (mac) break;
  }
  const salt = `image-gen-v2:${hostname}:${username}:${mac}`;
  return crypto.pbkdf2Sync(salt, 'image-gen-v2-salt', 100000, 32, 'sha256');
}

/** 尝试用指定密钥解密 */
function tryDecrypt(key, encryptedJson) {
  const { iv, tag, data } = JSON.parse(encryptedJson);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  let decrypted = decipher.update(data, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function encrypt(text) {
  const key = deriveKeyV2();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const tag = cipher.getAuthTag();

  return JSON.stringify({
    v: CURRENT_KEY_VERSION,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted,
  });
}

export function decrypt(encryptedJson) {
  // 先尝试当前 v2 密钥
  try {
    return tryDecrypt(deriveKeyV2(), encryptedJson);
  } catch {
    // v2 失败，尝试 v1 旧密钥（含 MAC）
  }

  try {
    return tryDecrypt(deriveKeyV1(), encryptedJson);
  } catch {
    console.error('[crypto] 解密失败：密钥不匹配，请重新输入 API Key');
  }

  return null;
}

// 读取配置
function readConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return {};
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return {};
  }
}

// 写入配置
function writeConfig(config) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

/** 保存 API Key（加密） */
export function saveApiKey(providerId, apiKey) {
  const config = readConfig();
  if (!config.providers) config.providers = {};

  config.providers[providerId] = {
    encrypted: true,
    key: encrypt(apiKey),
    connectedAt: new Date().toISOString(),
  };

  writeConfig(config);
}

/** 读取 API Key（解密） */
export async function getApiKey(providerId) {
  const config = readConfig();
  const providerConfig = config.providers?.[providerId];

  if (!providerConfig?.key) return null;

  return decrypt(providerConfig.key);
}

/** 获取所有偏好设置 */
export function getPreferences() {
  const config = readConfig();
  return config.preferences || {};
}

/** 保存偏好设置 */
export function savePreferences(prefs) {
  const config = readConfig();
  config.preferences = { ...config.preferences, ...prefs };
  writeConfig(config);
}

/** 获取用户自定义模型列表 */
export function getCustomModels(providerId) {
  const config = readConfig();
  return config.customModels?.[providerId] || [];
}

/** 保存用户自定义模型 */
export function addCustomModel(providerId, model) {
  const config = readConfig();
  if (!config.customModels) config.customModels = {};
  if (!config.customModels[providerId]) config.customModels[providerId] = [];
  
  // 避免重复
  const exists = config.customModels[providerId].some(m => m.id === model.id);
  if (!exists) {
    config.customModels[providerId].push({
      id: model.id,
      name: model.name || model.id,
      desc: model.desc || '用户自定义',
      custom: true,
      addedAt: new Date().toISOString(),
    });
  }
  writeConfig(config);
  return config.customModels[providerId];
}

/** 删除用户自定义模型 */
export function removeCustomModel(providerId, modelId) {
  const config = readConfig();
  if (config.customModels?.[providerId]) {
    config.customModels[providerId] = config.customModels[providerId].filter(m => m.id !== modelId);
    writeConfig(config);
  }
  return config.customModels?.[providerId] || [];
}

/** 生成 API Key 掩码 */
export function maskApiKey(key) {
  if (!key) return '';
  if (key.length <= 10) return '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022';
  return key.substring(0, 6) + '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' + key.substring(key.length - 4);
}

/** 读取 Provider 缓存状态 */
export function getProviderCache() {
  const config = readConfig();
  return config.providerCache || {};
}

/** 保存 Provider 缓存状态 */
export function saveProviderCache(cache) {
  const config = readConfig();
  config.providerCache = cache;
  writeConfig(config);
}

/** 更新单个 Provider 的缓存 */
export function updateProviderCacheEntry(providerId, entry) {
  const config = readConfig();
  if (!config.providerCache) config.providerCache = {};
  config.providerCache[providerId] = {
    ...entry,
    cachedAt: new Date().toISOString(),
  };
  writeConfig(config);
  return config.providerCache;
}