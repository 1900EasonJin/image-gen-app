const BASE_URL = '';

export async function fetchProviders() {
  const resp = await fetch(`${BASE_URL}/api/providers`);
  return resp.json();
}

/** 获取 Provider 状态：自动重连已保存 Key 的 Provider */
export async function fetchProviderStatus() {
  const resp = await fetch(`${BASE_URL}/api/providers/status`);
  return resp.json();
}

/** 获取 Provider 缓存状态（轻量级，从本地缓存读取，<5ms） */
export async function fetchCachedStatus() {
  const resp = await fetch(`${BASE_URL}/api/providers/cached-status`);
  return resp.json();
}

export async function connectProvider(providerId, apiKey) {
  const resp = await fetch(`${BASE_URL}/api/providers/${providerId}/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey }),
  });
  return resp.json();
}

export async function generateImage({ provider, model, prompt, n, size, referenceImage, sessionId, mode }) {
  const resp = await fetch(`${BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider,
      model,
      prompt,
      n,
      size,
      referenceImage: referenceImage || undefined,
      sessionId: sessionId || undefined,
      mode: mode || 'draw',
    }),
  });
  return resp.json();
}

export async function fetchSessions() {
  const resp = await fetch(`${BASE_URL}/api/sessions`);
  return resp.json();
}

export async function fetchSession(id) {
  const resp = await fetch(`${BASE_URL}/api/sessions/${id}`);
  return resp.json();
}

export async function deleteSession(id) {
  const resp = await fetch(`${BASE_URL}/api/sessions/${id}`, { method: 'DELETE' });
  return resp.json();
}

export async function archiveSession(id) {
  const resp = await fetch(`${BASE_URL}/api/sessions/${id}/archive`, { method: 'POST' });
  return resp.json();
}

export async function unarchiveSession(id) {
  const resp = await fetch(`${BASE_URL}/api/sessions/${id}/unarchive`, { method: 'POST' });
  return resp.json();
}

export async function fetchArchivedSessions() {
  const resp = await fetch(`${BASE_URL}/api/sessions/archived/list`);
  return resp.json();
}

export async function deleteArchivedSession(id) {
  const resp = await fetch(`${BASE_URL}/api/sessions/archived/${id}`, { method: 'DELETE' });
  return resp.json();
}

export async function renameSession(id, name) {
  const resp = await fetch(`${BASE_URL}/api/sessions/${id}/rename`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return resp.json();
}

export async function renameArchivedSession(id, name) {
  const resp = await fetch(`${BASE_URL}/api/sessions/archived/${id}/rename`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return resp.json();
}

// 自定义模型 API
export async function fetchCustomModels(providerId) {
  const resp = await fetch(`${BASE_URL}/api/providers/${providerId}/custom-models`);
  return resp.json();
}

export async function addCustomModel(providerId, modelId, modelName) {
  const resp = await fetch(`${BASE_URL}/api/providers/${providerId}/custom-models`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelId, modelName }),
  });
  return resp.json();
}

export async function removeCustomModel(providerId, modelId) {
  const resp = await fetch(`${BASE_URL}/api/providers/${providerId}/custom-models/${encodeURIComponent(modelId)}`, {
    method: 'DELETE',
  });
  return resp.json();
}