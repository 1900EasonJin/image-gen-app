import { safeError } from '../../lib/safe-log.js';

export function errorHandler(err, req, res, _next) {
  safeError('[Error]', err.message);
  if (err.stack) safeError(err.stack);

  if (res.headersSent) return;

  try {
    res.status(err.status || 500).json({
      success: false,
      error: err.message || '服务器内部错误',
    });
  } catch {
    // 连接已关闭，忽略
  }
}