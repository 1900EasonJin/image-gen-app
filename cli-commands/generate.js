import fs from 'fs';
import path from 'path';
import { generateImage } from '../providers/index.js';
import { getApiKey } from '../lib/crypto-store.js';

export async function generateCommand(options) {
  const { provider, model, prompt, count, size, image, output, json } = options;

  if (!prompt) {
    console.error('错误：请使用 --prompt 指定生成文本');
    process.exit(1);
  }

  // 获取 API Key
  const apiKey = await getApiKey(provider);
  if (!apiKey && !options.key) {
    console.error(`错误：未配置 ${provider} 的 API Key，请先运行 image-gen config set-key ${provider} <key>`);
    process.exit(1);
  }

  // 如果有参考图，读取并转 base64
  let referenceImage = null;
  if (image) {
    const imgPath = path.resolve(image);
    if (!fs.existsSync(imgPath)) {
      console.error(`错误：参考图不存在: ${imgPath}`);
      process.exit(1);
    }
    const imgData = fs.readFileSync(imgPath);
    const ext = path.extname(imgPath).slice(1);
    const mimeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
    referenceImage = `data:${mimeMap[ext] || 'image/png'};base64,${imgData.toString('base64')}`;
  }

  console.log(`正在生成图片...`);
  console.log(`  Provider: ${provider}`);
  console.log(`  Model: ${model}`);
  console.log(`  Prompt: ${prompt}`);
  console.log(`  数量: ${count}, 分辨率: ${size}`);

  try {
    const result = await generateImage({
      provider,
      model,
      prompt,
      n: parseInt(count),
      size,
      referenceImage,
      apiKey: apiKey || options.key,
    });

    if (result.success) {
      // 确保输出目录存在
      const outputDir = path.resolve(output);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const savedFiles = [];
      for (const img of result.images) {
        if (img.dataUrl) {
          const base64Data = img.dataUrl.replace(/^data:image\/\w+;base64,/, '');
          const filename = `${img.id}.png`;
          const filePath = path.join(outputDir, filename);
          fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
          savedFiles.push(filePath);
        } else if (img.url) {
          savedFiles.push(img.url);
        }
      }

      if (json) {
        console.log(JSON.stringify({ success: true, files: savedFiles, ...result }, null, 2));
      } else {
        console.log(`\n✓ 生成成功！`);
        savedFiles.forEach((f) => console.log(`  ${f}`));
      }
    } else {
      if (json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.error(`✗ 生成失败: ${result.error || '未知错误'}`);
      }
      process.exit(1);
    }
  } catch (err) {
    if (json) {
      console.log(JSON.stringify({ success: false, error: err.message }, null, 2));
    } else {
      console.error(`✗ 生成失败: ${err.message}`);
    }
    process.exit(1);
  }
}