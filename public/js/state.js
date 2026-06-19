// 全局状态管理
const state = {
  // 当前选中的 Provider
  activeProviderId: null,
  // 当前选中的模型
  activeModelId: null,
  // 各 Provider 连接信息 { providerId: { apiKey, models, connected } }
  providers: {},
  // 当前会话
  currentSession: null,
  // 生成中的标志
  generating: false,
  // 修改模式的参考图
  referenceImage: null,
  // 各 Provider 的模型列表
  models: {},
  // 最近一次 prompt（用于 Lightbox 显示）
  lastPrompt: '',
  // 工作区模式：draw | img2img | edit
  workMode: 'draw',
  // 当前会话是否已锁定顶部模式切换
  sessionModeLocked: false,
  // 编辑链（前端维护，用于迭代历史展示）
  editChain: [],
  // 当前模型允许的最大参考图数量（图生图模式）
  maxRefImages: 4,
};

export default state;

export function setState(updates) {
  Object.assign(state, updates);
  // 触发自定义事件
  window.dispatchEvent(new CustomEvent('stateChange', { detail: updates }));
}