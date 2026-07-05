/** LLM 客户端:配置读写 + 经 Rust 代理调用;不可用时返回 null(上层降级) */
import { invoke } from '@tauri-apps/api/core';
import { getSetting, setSetting } from '../systems/db';

export interface ChatMsg {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmConfig {
  url: string;
  key: string;
  model: string;
}

export async function loadLlmConfig(): Promise<LlmConfig> {
  return {
    url: (await getSetting('llm_api_url')) ?? '',
    key: (await getSetting('llm_api_key')) ?? '',
    model: (await getSetting('llm_model')) ?? 'gpt-4o-mini',
  };
}

export async function saveLlmConfig(cfg: LlmConfig): Promise<void> {
  await setSetting('llm_api_url', cfg.url.trim());
  await setSetting('llm_api_key', cfg.key.trim());
  await setSetting('llm_model', cfg.model.trim());
}

export async function llmConfigured(): Promise<boolean> {
  const cfg = await loadLlmConfig();
  return cfg.url.length > 0 && cfg.key.length > 0;
}

/**
 * 调用 LLM;任何失败(未配置/断网/超时/格式错误)返回 null,
 * 上层降级为预设台词 —— 应用其余功能与 LLM 零耦合。
 */
export async function llmChat(messages: ChatMsg[], temperature = 0.8): Promise<string | null> {
  try {
    const cfg = await loadLlmConfig();
    if (!cfg.url || !cfg.key) return null;
    const reply = await invoke<string>('llm_chat', {
      url: cfg.url,
      key: cfg.key,
      model: cfg.model,
      messages,
      temperature,
    });
    return reply || null;
  } catch (e) {
    console.warn('[llm] fallback:', e);
    return null;
  }
}

/** 设置页"测试连接" */
export async function llmTest(cfg: LlmConfig): Promise<{ ok: boolean; detail: string }> {
  try {
    const reply = await invoke<string>('llm_chat', {
      url: cfg.url,
      key: cfg.key,
      model: cfg.model,
      messages: [{ role: 'user', content: '回复"ok"两个字母即可' }],
      temperature: 0,
    });
    return { ok: true, detail: reply.slice(0, 60) };
  } catch (e) {
    return { ok: false, detail: String(e).slice(0, 200) };
  }
}
