import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import providerRoutes from './routes/providers.js';
import generateRoutes from './routes/generate.js';
import sessionRoutes from './routes/sessions.js';
import imageRoutes from './routes/images.js';
import { errorHandler } from './middleware/error-handler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 全局 btoa 钩子：捕获所有 btoa 调用，定位 ByteString 错误来源
if (typeof btoa === 'function') {
  const _originalBtoa = btoa;
  globalThis.btoa = function patchedBtoa(input) {
    try {
      return _originalBtoa(input);
    } catch (err) {
      console.error('[btoa-hook] btoa() 抛出异常!');
      console.error('[btoa-hook] 输入长度:', input?.length);
      console.error('[btoa-hook] 输入前100字符:', JSON.stringify(String(input).substring(0, 100)));
      console.error('[btoa-hook] 错误:', err.message);
      console.error('[btoa-hook] 调用栈:', new Error('btoa stack').stack);
      throw err;
    }
  };
}

// 全局 atob 钩子：atob 也可能触发类似错误
if (typeof atob === 'function') {
  const _originalAtob = atob;
  globalThis.atob = function patchedAtob(input) {
    try {
      return _originalAtob(input);
    } catch (err) {
      console.error('[atob-hook] atob() 抛出异常!');
      console.error('[atob-hook] 输入:', JSON.stringify(String(input).substring(0, 100)));
      console.error('[atob-hook] 错误:', err.message);
      console.error('[atob-hook] 调用栈:', new Error('atob stack').stack);
      throw err;
    }
  };
}

export async function createServer() {
  const app = express();

  // 中间件
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true }));

  // 静态文件
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // API 路由
  app.use('/api/providers', providerRoutes);
  app.use('/api/generate', generateRoutes);
  app.use('/api/sessions', sessionRoutes);
  app.use('/api/images', imageRoutes);

  // 错误处理
  app.use(errorHandler);

  return app;
}