import { connectProvider } from '../providers/index.js';

export async function connectCommand(options) {
  const { provider, key } = options;

  if (!provider) {
    console.error('错误：请使用 --provider 指定 Provider ID');
    console.log('可用: volcengine, aliyun');
    process.exit(1);
  }

  if (!key) {
    console.error('错误：请使用 --key 指定 API Key');
    process.exit(1);
  }

  console.log(`正在连接 ${provider}...`);

  const result = await connectProvider(provider, key);

  if (result.success) {
    const { saveApiKey } = await import('../lib/crypto-store.js');
    saveApiKey(provider, key);
    console.log(`\n✓ 连接成功！`);
    console.log(`\n可用模型:`);
    result.models.forEach((m) => {
      console.log(`  ${m.id} — ${m.name}${m.desc ? ` (${m.desc})` : ''}`);
    });
  } else {
    console.error(`\n✗ 连接失败: ${result.error}`);
    process.exit(1);
  }
}