#!/usr/bin/env node

/**
 * Image Gen v2 — CLI 命令行工具
 * 用法: image-gen <command> [options]
 */

import { program } from 'commander';
import { generateCommand } from './cli-commands/generate.js';
import { connectCommand } from './cli-commands/connect.js';


program
  .name('image-gen')
  .description('AI 图片生成命令行工具')
  .version('2.0.0');

// providers 命令
program
  .command('providers')
  .description('列出所有可用的 Provider')
  .action(async () => {
    const { getProviders } = await import('./providers/index.js');
    const providers = getProviders();
    console.log('\n可用 Provider:');
    providers.forEach((p) => {
      console.log(`  ${p.id} — ${p.name}`);
    });
    console.log();
  });

// connect 命令
program
  .command('connect')
  .description('连接 Provider 并列出可用模型')
  .option('-p, --provider <id>', 'Provider ID')
  .option('-k, --key <apiKey>', 'API Key')
  .action(connectCommand);

// generate 命令
program
  .command('generate')
  .description('生成图片')
  .option('-p, --provider <id>', 'Provider ID', 'volcengine')
  .option('-m, --model <id>', '模型 ID', 'doubao-seedream-5-0-260128')
  .option('--prompt <text>', 'Prompt 文本')
  .option('-n, --count <number>', '生成数量', '1')
  .option('-s, --size <size>', '分辨率', '2K')
  .option('-i, --image <path>', '参考图路径（图生图）')
  .option('-o, --output <dir>', '输出目录', process.cwd())
  .option('--json', 'JSON 格式输出')
  .action(generateCommand);

// config 命令
program
  .command('config')
  .description('配置管理')
  .addCommand(
    program.createCommand('set-key')
      .description('设置 Provider API Key')
      .argument('<provider>', 'Provider ID')
      .argument('<apiKey>', 'API Key')
      .action(async (provider, apiKey) => {
        const { saveApiKey } = await import('./lib/crypto-store.js');
        saveApiKey(provider, apiKey);
        console.log(`✓ ${provider} API Key 已保存（加密）`);
      })
  )
  .addCommand(
    program.createCommand('show')
      .description('查看当前配置')
      .action(async () => {
        const { getApiKey } = await import('./lib/crypto-store.js');
        const { getProviders } = await import('./providers/index.js');
        const providers = getProviders();
        console.log('\n当前配置:');
        for (const p of providers) {
          const key = await getApiKey(p.id);
          console.log(`  ${p.name}: ${key ? '✓ 已配置' : '✗ 未配置'}`);
        }
        console.log();
      })
  );

program.parse();