/**
 * Config 子命令
 */

export async function setKeyCommand(provider, apiKey) {
  const { saveApiKey } = await import('../lib/crypto-store.js');
  saveApiKey(provider, apiKey);
  console.log(`✓ ${provider} API Key 已保存（加密）`);
}

export async function showCommand() {
  const { getApiKey } = await import('../lib/crypto-store.js');
  const { getProviders } = await import('../providers/index.js');
  const providers = getProviders();
  console.log('\n当前配置:');
  for (const p of providers) {
    const key = await getApiKey(p.id);
    console.log(`  ${p.name}: ${key ? '✓ 已配置' : '✗ 未配置'}`);
  }
  console.log();
}
