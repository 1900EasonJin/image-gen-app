import { Router } from 'express';
import {
  loadSessions, loadSession, deleteSession, saveSession,
  loadArchivedSessions, loadArchivedSession, archiveSession, unarchiveSession, deleteArchivedSession,
  renameSession
} from '../../storage/sessions.js';

const router = Router();

// 获取历史会话列表
router.get('/', (_req, res) => {
  const sessions = loadSessions();
  res.json({ success: true, sessions });
});

// 获取归档会话列表 — 必须在 /:id 之前
router.get('/archived/list', (_req, res) => {
  const sessions = loadArchivedSessions();
  res.json({ success: true, sessions });
});

// 归档会话 — 必须在 /:id 之前
router.post('/:id/archive', (req, res) => {
  const archived = archiveSession(req.params.id);
  if (!archived) {
    return res.status(404).json({ success: false, error: '会话不存在' });
  }
  res.json({ success: true, archived: true });
});

// 取消归档
router.post('/:id/unarchive', (req, res) => {
  const unarchived = unarchiveSession(req.params.id);
  if (!unarchived) {
    return res.status(404).json({ success: false, error: '归档会话不存在' });
  }
  res.json({ success: true, unarchived: true });
});

// 删除归档会话
router.delete('/archived/:id', (req, res) => {
  const deleted = deleteArchivedSession(req.params.id);
  res.json({ success: true, deleted });
});

// 获取单个会话详情
router.get('/:id', (req, res) => {
  const session = loadSession(req.params.id);
  if (!session) {
    return res.status(404).json({ success: false, error: '会话不存在' });
  }
  res.json({ success: true, session });
});

// 删除会话
router.delete('/:id', (req, res) => {
  const deleted = deleteSession(req.params.id);
  res.json({ success: true, deleted });
});

// 重命名会话
router.patch('/:id/rename', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: '名称不能为空' });
  }
  const result = renameSession(req.params.id, name.trim(), { archived: false });
  if (!result) {
    return res.status(404).json({ success: false, error: '会话不存在' });
  }
  res.json({ success: true, session: result });
});

// 重命名归档会话
router.patch('/archived/:id/rename', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: '名称不能为空' });
  }
  const result = renameSession(req.params.id, name.trim(), { archived: true });
  if (!result) {
    return res.status(404).json({ success: false, error: '归档会话不存在' });
  }
  res.json({ success: true, session: result });
});

// 创建/更新会话
router.post('/', (req, res) => {
  const session = req.body;
  saveSession(session);
  res.json({ success: true, session });
});

export default router;