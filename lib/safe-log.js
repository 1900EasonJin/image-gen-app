// 安全日志工具 — 防止 EPIPE 导致 Uncaught Exception
// 在 Electron 主进程中，stdout/stderr 管道可能意外断开

export function safeLog(...args) {
  try { console.log(...args); } catch { /* EPIPE，忽略 */ }
}

export function safeError(...args) {
  try { console.error(...args); } catch { /* EPIPE，忽略 */ }
}
