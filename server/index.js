import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import providerRoutes from './routes/providers.js';
import generateRoutes from './routes/generate.js';
import sessionRoutes from './routes/sessions.js';
import imageRoutes from './routes/images.js';
import { errorHandler } from './middleware/error-handler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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