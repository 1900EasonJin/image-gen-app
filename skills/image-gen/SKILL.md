# Image Gen v2 Skill

通过 CLI 命令行调用 Image Gen v2 生图工具。

## 使用场景

当用户说"帮我生成一张xxx"、"画一个xxx"时触发。

## 工作流

1. 解析用户的生图需求，提取 prompt、数量、分辨率等参数
2. 确认已配置的 Provider 和 API Key（如未配置，提示用户先设置）
3. 执行生成命令：

```bash
node /path/to/image-gen-app/cli.js generate \
  --provider volcengine \
  --model doubao-seedream-5-0-260128 \
  --prompt "用户描述" \
  --count 1 \
  --size 2K \
  --output ~/Downloads/ \
  --json
```

4. 解析 JSON 输出，返回图片路径给用户

## Provider 选项

- `volcengine` — 火山方舟 (Seedream)
- `aliyun` — 阿里云百炼 (Qwen + Wan)

## 模型速查

### 火山方舟
- `doubao-seedream-5-0-260128` — Seedream 5.0

### 阿里云百炼
- `qwen-image-2.0-pro` — Qwen Image 2.0 Pro
- `qwen-image-plus` — Qwen Image Plus
- `qwan-image-turbo` — Qwen Image Turbo（最快）
- `wan2.7-image-pro` — Wan 2.7 Image Pro

## 配置 API Key

首次使用前需要配置 Provider 的 API Key：

```bash
node /path/to/image-gen-app/cli.js config set-key volcengine "your-api-key"
node /path/to/image-gen-app/cli.js config set-key aliyun "your-api-key"
```

## 图生图

支持基于已有图片进行修改：

```bash
node /path/to/image-gen-app/cli.js generate \
  --provider volcengine \
  --model doubao-seedream-5-0-260128 \
  --prompt "描述修改内容" \
  --image /path/to/original.png \
  --output ~/Downloads/ \
  --json
```