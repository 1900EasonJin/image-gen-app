export function errorHandler(err, req, res, _next) {
  // 安全日志：防止 stderr 管道断开导致 EPIPE 崩溃
  try {
    console.error('[Error]', err.message);
    console.error('[Error.name]', err.name);
    console.error('[Error.code]', err.code);
    if (err.stack) console.error('[Stack]', err.stack);
    // 额外：检查是否 btoa 相关错误
    if (err.message && err.message.includes('ByteString')) {
      console.error('[ByteString诊断] 检测到 btoa/Buffer 编码错误');
      console.error('[ByteString诊断] 请求body前100字符:', JSON.stringify(req.body).substring(0, 100));
    }
  } catch {
    // stderr 已关闭，静默
  }

  // 防止 EPIPE：响应头已发送或连接已断开时不再写响应
  if (res.headersSent) {
    return;
  }

  // 捕获写入时的 EPIPE 错误
  try {
    res.status(err.status || 500).json({
      success: false,
      error: err.message || '服务器内部错误',
    });
  } catch {
    // 连接已关闭，忽略
  }
}