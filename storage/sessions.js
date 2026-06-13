import fs from 'fs';
import path from 'path';
import os from 'os';
import { deleteImages } from './images.js';

/** 从会话数据中提取所有图片 ID */
function extractImageIds(session) {
  const ids = [];
  if (session.iterations) {
    for (const iter of session.iterations) {
      if (iter.images) {
        for (const img of iter.images) {
          if (img.id) ids.push(img.id);
        }
      }
    }
  }
  return ids;
}

/** 获取所有会话（含归档）中引用的图片 ID 集合 */
export function getAllImageIds() {
  const ids = new Set();
  const dirs = [SESSIONS_DIR, ARCHIVE_DIR];
  for (const dir of dirs) {
    try {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
      for (const f of files) {
        try {
          const session = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
          for (const id of extractImageIds(session)) ids.add(id);
        } catch { /* 跳过损坏文件 */ }
      }
    } catch { /* 跳过无法读取的目录 */ }
  }
  return ids;
}

const SESSIONS_DIR = path.join(os.homedir(), '.image-gen-v2', 'sessions');
const ARCHIVE_DIR = path.join(os.homedir(), '.image-gen-v2', 'archive');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function ensureSessionsDir() { ensureDir(SESSIONS_DIR); }
function ensureArchiveDir() { ensureDir(ARCHIVE_DIR); }

/** 获取所有会话列表（简要信息） */
export function loadSessions() {
  ensureSessionsDir();
  const files = fs.readdirSync(SESSIONS_DIR).filter((f) => f.endsWith('.json'));

  return files
    .map((f) => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, f), 'utf8'));
        return {
          id: data.id,
          prompt: data.prompt?.substring(0, 50) || '',
          provider: data.provider,
          model: data.model,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          iterationCount: data.iterations?.length || 0,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

/** 获取所有归档会话列表 */
export function loadArchivedSessions() {
  ensureArchiveDir();
  const files = fs.readdirSync(ARCHIVE_DIR).filter((f) => f.endsWith('.json'));

  return files
    .map((f) => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(ARCHIVE_DIR, f), 'utf8'));
        return {
          id: data.id,
          prompt: data.prompt?.substring(0, 50) || '',
          provider: data.provider,
          model: data.model,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          iterationCount: data.iterations?.length || 0,
          archivedAt: data.archivedAt,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.archivedAt || b.updatedAt) - new Date(a.archivedAt || a.updatedAt));
}

/** 获取单个会话详情 */
export function loadSession(id) {
  const filePath = path.join(SESSIONS_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

/** 保存会话 */
export function saveSession(session) {
  ensureSessionsDir();
  const now = new Date().toISOString();
  const sessionData = {
    ...session,
    updatedAt: now,
    createdAt: session.createdAt || now,
  };

  fs.writeFileSync(
    path.join(SESSIONS_DIR, `${sessionData.id}.json`),
    JSON.stringify(sessionData, null, 2)
  );

  return sessionData;
}

/** 重命名会话（历史或归档） */
export function renameSession(id, newName, { archived = false } = {}) {
  const dir = archived ? ARCHIVE_DIR : SESSIONS_DIR;
  const filePath = path.join(dir, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  data.prompt = newName;
  data.updatedAt = new Date().toISOString();
  if (archived) data.archivedAt = data.archivedAt || data.updatedAt;

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  return data;
}

/** 删除会话（含关联图片） */
export function deleteSession(id) {
  const filePath = path.join(SESSIONS_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return false;
  const session = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const imageIds = extractImageIds(session);
  fs.unlinkSync(filePath);
  if (imageIds.length > 0) deleteImages(imageIds);
  return true;
}

/** 归档会话 */
export function archiveSession(id) {
  const srcPath = path.join(SESSIONS_DIR, `${id}.json`);
  if (!fs.existsSync(srcPath)) return false;

  ensureArchiveDir();
  const data = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
  data.archivedAt = new Date().toISOString();

  fs.writeFileSync(path.join(ARCHIVE_DIR, `${id}.json`), JSON.stringify(data, null, 2));
  fs.unlinkSync(srcPath);
  return true;
}

/** 取消归档（恢复到历史） */
export function unarchiveSession(id) {
  const srcPath = path.join(ARCHIVE_DIR, `${id}.json`);
  if (!fs.existsSync(srcPath)) return false;

  ensureSessionsDir();
  const data = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
  delete data.archivedAt;

  fs.writeFileSync(path.join(SESSIONS_DIR, `${id}.json`), JSON.stringify(data, null, 2));
  fs.unlinkSync(srcPath);
  return true;
}

/** 删除归档会话（含关联图片） */
export function deleteArchivedSession(id) {
  const filePath = path.join(ARCHIVE_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return false;
  const session = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const imageIds = extractImageIds(session);
  fs.unlinkSync(filePath);
  if (imageIds.length > 0) deleteImages(imageIds);
  return true;
}

/** 获取归档会话详情 */
export function loadArchivedSession(id) {
  const filePath = path.join(ARCHIVE_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

/** 创建新会话 */
export function createSession({ prompt, provider, model }) {
  const id = `ses_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const session = {
    id,
    prompt,
    provider,
    model,
    iterations: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return saveSession(session);
}

/** 向会话追加一次迭代 */
export function appendIteration(sessionId, iteration) {
  const session = loadSession(sessionId);
  if (!session) throw new Error('会话不存在');

  session.iterations.push({
    ...iteration,
    timestamp: new Date().toISOString(),
  });

  return saveSession(session);
}