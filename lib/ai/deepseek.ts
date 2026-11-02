/**
 * DeepSeek 的 Anthropic 兼容接口。
 * baseURL 形如 https://api.deepseek.com/anthropic，SDK 会请求 /v1/messages。
 */
export interface AiConfig {
  apiKey: string;
  baseURL: string;
  model: string;
}

export function getDeepSeekConfig(): AiConfig | null {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey || apiKey === 'your-deepseek-api-key') return null;

  return {
    apiKey,
    baseURL: process.env.DEEPSEEK_BASE_URL?.trim() || 'https://api.deepseek.com/anthropic',
    model: process.env.DEEPSEEK_MODEL?.trim() || 'deepseek-chat',
  };
}
