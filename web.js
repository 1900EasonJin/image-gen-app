/**
 * Image Gen — 纯 Web 模式
 * 不启动 Electron，直接运行 Express 服务器，在浏览器中访问
 */
import { createServer } from './server/index.js';

// 全局异常捕获 — 防止未处理错误导致进程崩溃
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT]', err.message, err.stack?.split('\n')[1]);
});
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED_REJECTION]', reason);
});

const PORT = 3456;
const app = await createServer();

app.listen(PORT, () => {
  console.log(`\n  🎨 Image Gen 已启动 → http://localhost:${PORT}\n`);
});
