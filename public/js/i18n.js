// ==================== i18n 国际化系统 ====================

const translations = {
  zh: {
    // App
    'app.brand': 'Image Gen',
    'app.mode.draw': '文生图',
    'app.mode.img2img': '图生图',

    // Sidebar
    'sidebar.model': '模型',
    'sidebar.history': '历史',
    'sidebar.selectModel': '选择模型...',
    'sidebar.noSession': '暂无历史会话',
    'sidebar.archive': '归档记录',

    // Work area
    'work.noData': '暂无数据',
    'work.generated': '已生成',
    'work.generating': '生成中...',
    'work.noImage': '暂无图片',
    'work.newCanvas': '新建画布',

    // Input
    'input.placeholder': '输入你的图片描述，文本绘制用"双引号"包裹',
    'input.editPlaceholder': '描述你想要修改的部分...',
    'input.noModel': '未选择模型',
    'input.drawModeBadge': '生图模式',
    'input.editModeBadge': '修改模式',
    'input.count': '数量',
    'input.resolution': '分辨率',

    // Gallery
    'gallery.title': '已生成图片',
    'gallery.empty': '暂无生成记录',

    // Iteration
    'iteration.title': '迭代历史',
    'iteration.original': '原图',
    'iteration.version': '迭代{0}.0',

    // Image card actions
    'action.preview': '预览',
    'action.download': '下载',
    'action.edit': '修改',

    // Settings
    'settings.title': '⚙ 设置',
    'settings.language': '语言',
    'settings.language.zh': '中文',
    'settings.language.en': 'English',
    'settings.connect': '连接',
    'settings.update': '更新',
    'settings.disconnect': '断开',
    'settings.apiKeyPlaceholder': '输入 API Key...',
    'settings.getModels': '查看模型',
    'settings.connected': '✓ 已连接',
    'settings.disconnectedStatus': '未连接',
    'settings.modelsLoaded': '已加载 {0} 个模型',
    'settings.refresh': '刷新',
    'settings.addModel': '添加',
    'settings.modelIdPlaceholder': '输入模型 ID（如 qwen-image-new）',
    'settings.modelNamePlaceholder': '显示名称（可选）',
    'settings.addModelHint': '手动添加供应商提供的其他模型 ID',
    'settings.custom': '自定义',

    // Providers
    'provider.volcengine': '火山方舟 (Seedream)',
    'provider.aliyun': '阿里云百炼 (Qwen + Wan)',
    'settings.noApiKey': '输入 API Key 后连接，将自动拉取可用模型',
    'settings.fetchFailed': '获取 Provider 列表失败',
    'settings.connecting': '连接中...',
    'settings.refreshing': '刷新中...',

    // Archive
    'archive.title': '📦 归档记录',
    'archive.empty': '暂无归档记录',

    // Toast
    'toast.enterPrompt': '请输入 Prompt',
    'toast.selectModel': '请先在设置中连接 Provider 并选择模型',
    'toast.generateSuccess': '生成成功！共 {0} 张图片',
    'toast.generateSuccessSingle': '生成成功！',
    'toast.generateFailed': '生成失败: {0}',
    'toast.requestFailed': '请求失败: {0}',
    'toast.connectSuccess': '{0} 连接成功！找到 {1} 个模型',
    'toast.connectFailed': '连接失败: {0}',
    'toast.disconnected': '已断开连接',
    'toast.refreshSuccess': '刷新成功！{0} 个模型',
    'toast.refreshFailed': '刷新失败: {0}',
    'toast.addModelSuccess': '已添加模型: {0}',
    'toast.addModelFailed': '添加失败: {0}',
    'toast.removeModelSuccess': '已删除自定义模型',
    'toast.removeModelFailed': '删除失败: {0}',
    'toast.editPromptRequired': '请输入修改描述',
    'toast.textStyleTodo': '文本样式功能待实现',

    // App actions
    'toast.archived': '已归档',
    'toast.archiveFailed': '归档失败',
    'toast.deleted': '已删除',
    'toast.deleteFailed': '删除失败',
    'toast.restored': '已恢复到历史',
    'toast.restoreFailed': '恢复失败',
    'toast.permanentlyDeleted': '已永久删除',
    'toast.sessionLoadFailed': '会话加载失败',
    'toast.sessionRestored': '已恢复历史会话',
    'toast.sessionRestoreFailed': '恢复会话失败',
    'toast.appInitFailed': '应用初始化失败',
    'toast.newSession': '新建对话',
    'toast.renamed': '已重命名',
    'toast.renameFailed': '重命名失败',
    'app.loadFailed': '加载失败',
    'action.rename': '重命名',
    'action.archive': '归档',
    'action.delete': '删除',
    'action.restore': '恢复',
    'action.confirmDelete': '删除（再点一次确认）',
    'action.confirmDeleteTitle': '确认删除？',
  },

  en: {
    'app.brand': 'Image Gen',
    'app.mode.draw': 'Text to Image',
    'app.mode.img2img': 'Image to Image',

    'sidebar.model': 'Model',
    'sidebar.history': 'History',
    'sidebar.selectModel': 'Select Model...',
    'sidebar.noSession': 'No history yet',
    'sidebar.archive': 'Archived',

    'work.noData': 'No data',
    'work.generated': 'Generated',
    'work.generating': 'Generating...',
    'work.noImage': 'No images',
    'work.newCanvas': 'New Canvas',

    'input.placeholder': 'Describe the image you want to generate...',
    'input.editPlaceholder': 'Describe what you want to modify...',
    'input.noModel': 'No model selected',
    'input.drawModeBadge': 'Draw Mode',
    'input.editModeBadge': 'Edit Mode',
    'input.count': 'Count',
    'input.resolution': 'Resolution',

    'gallery.title': 'Generated Images',
    'gallery.empty': 'No images yet',

    'iteration.title': 'Iteration History',
    'iteration.original': 'Original',
    'iteration.version': 'Iteration {0}.0',

    'action.preview': 'Preview',
    'action.download': 'Download',
    'action.edit': 'Edit',

    'settings.title': '⚙ Settings',
    'settings.language': 'Language',
    'settings.language.zh': '中文',
    'settings.language.en': 'English',
    'settings.connect': 'Connect',
    'settings.update': 'Update',
    'settings.disconnect': 'Disconnect',
    'settings.apiKeyPlaceholder': 'Enter API Key...',
    'settings.getModels': 'View Models',
    'settings.connected': '✓ Connected',
    'settings.disconnectedStatus': 'Disconnected',
    'settings.modelsLoaded': '{0} models loaded',
    'settings.refresh': 'Refresh',
    'settings.addModel': 'Add',
    'settings.modelIdPlaceholder': 'Enter model ID (e.g. qwen-image-new)',
    'settings.modelNamePlaceholder': 'Display name (optional)',
    'settings.addModelHint': 'Manually add additional model IDs provided by the vendor',
    'settings.custom': 'Custom',

    // Providers
    'provider.volcengine': 'Volcengine Ark (Seedream)',
    'provider.aliyun': 'Alibaba Cloud Bailian (Qwen + Wan)',
    'settings.noApiKey': 'Enter an API Key to connect and automatically fetch available models',
    'settings.fetchFailed': 'Failed to fetch provider list',
    'settings.connecting': 'Connecting...',
    'settings.refreshing': 'Refreshing...',

    'archive.title': '📦 Archived',
    'archive.empty': 'No archived records',

    'toast.enterPrompt': 'Please enter a prompt',
    'toast.selectModel': 'Please connect a provider and select a model in Settings',
    'toast.generateSuccess': 'Generated successfully! {0} images',
    'toast.generateSuccessSingle': 'Generated successfully!',
    'toast.generateFailed': 'Generation failed: {0}',
    'toast.requestFailed': 'Request failed: {0}',
    'toast.connectSuccess': '{0} connected! Found {1} models',
    'toast.connectFailed': 'Connection failed: {0}',
    'toast.disconnected': 'Disconnected',
    'toast.refreshSuccess': 'Refreshed! {0} models',
    'toast.refreshFailed': 'Refresh failed: {0}',
    'toast.addModelSuccess': 'Model added: {0}',
    'toast.addModelFailed': 'Failed to add model: {0}',
    'toast.removeModelSuccess': 'Custom model removed',
    'toast.removeModelFailed': 'Failed to remove model: {0}',
    'toast.editPromptRequired': 'Please enter a modification description',
    'toast.textStyleTodo': 'Text style feature coming soon',

    'toast.archived': 'Archived',
    'toast.archiveFailed': 'Archive failed',
    'toast.deleted': 'Deleted',
    'toast.deleteFailed': 'Delete failed',
    'toast.restored': 'Restored to history',
    'toast.restoreFailed': 'Restore failed',
    'toast.permanentlyDeleted': 'Permanently deleted',
    'toast.sessionLoadFailed': 'Session load failed',
    'toast.sessionRestored': 'Session restored',
    'toast.sessionRestoreFailed': 'Session restore failed',
    'toast.appInitFailed': 'App initialization failed',
    'toast.newSession': 'New session',
    'toast.renamed': 'Renamed',
    'toast.renameFailed': 'Rename failed',
    'app.loadFailed': 'Load failed',
    'action.rename': 'Rename',
    'action.archive': 'Archive',
    'action.delete': 'Delete',
    'action.restore': 'Restore',
    'action.confirmDelete': 'Delete (click again to confirm)',
    'action.confirmDeleteTitle': 'Confirm delete?',
  },
};

let currentLang = localStorage.getItem('lang') || 'zh';

/**
 * Get translated string by key
 * @param {string} key - Translation key
 * @param {...any} args - Format arguments
 * @returns {string}
 */
export function t(key, ...args) {
  let text = translations[currentLang]?.[key] || translations.zh[key] || key;
  args.forEach((arg, i) => {
    text = text.replace(`{${i}}`, arg ?? '');
  });
  return text;
}

/**
 * Get current language
 * @returns {'zh' | 'en'}
 */
export function getLang() {
  return currentLang;
}

/**
 * Set language and re-render UI
 * @param {'zh' | 'en'} lang
 */
export async function setLang(lang) {
  if (currentLang === lang) return;
  currentLang = lang;
  localStorage.setItem('lang', lang);

  // 丝滑过渡：先淡出 → 更新文字 → 淡入
  document.body.classList.add('lang-switching');
  await new Promise(r => setTimeout(r, 250));
  applyLanguage();
  document.body.classList.remove('lang-switching');
}

/**
 * 获取模型描述的翻译
 */
export function translateModelDesc(desc) {
  if (!desc) return desc;
  const descTranslations = {
    zh: {
      '经典旗舰': '经典旗舰',
      '增强版': '增强版',
      '最新旗舰': '最新旗舰',
      '标准版': '标准版',
      '基础版': '基础版',
      '极速版': '极速版',
      'Wan 增强版': 'Wan 增强版',
      'Wan 标准版': 'Wan 标准版',
    },
    en: {
      '经典旗舰': 'Flagship',
      '增强版': 'Enhanced',
      '最新旗舰': 'Latest',
      '标准版': 'Standard',
      '基础版': 'Basic',
      '极速版': 'Turbo',
      'Wan 增强版': 'Wan En.',
      'Wan 标准版': 'Wan Std.',
    },
  };
  
  const lang = getLang();
  return descTranslations[lang]?.[desc] || desc;
}

/**
 * Apply translations to all DOM elements with [data-i18n] attributes
 */
export function applyLanguage() {
  // Text content
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });

  // Placeholder
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });

  // Title
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
  });

  // Dispatch event for components to react
  window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang: currentLang } }));
}
