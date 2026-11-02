import Anthropic from '@anthropic-ai/sdk';
import type { NextRequest } from 'next/server';
import type { ZiweiChart } from '@/lib/ziwei/types';
import { buildChartContext } from '@/lib/ai/chart-context';
import { getDeepSeekConfig } from '@/lib/ai/deepseek';
import { INTERPRET_SYSTEM_PROMPT, sanitizeChatMessages } from '@/lib/ai/prompts';
import { toSSEStream } from '@/lib/ai/sse-stream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const config = getDeepSeekConfig();
  if (!config) {
    return Response.json(
      { error: 'AI 服务未配置：请在 .env.local 设置 DEEPSEEK_API_KEY' },
      { status: 500 },
    );
  }

  let body: { chart?: ZiweiChart; messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  const chart = body?.chart;
  if (!chart || !Array.isArray(chart.palaces) || chart.palaces.length === 0) {
    return Response.json({ error: '缺少有效命盘数据 chart' }, { status: 400 });
  }

  const messages = sanitizeChatMessages(body?.messages);
  if (!messages) {
    return Response.json({ error: '缺少有效对话 messages' }, { status: 400 });
  }

  const client = new Anthropic({ apiKey: config.apiKey, baseURL: config.baseURL });

  let stream: ReturnType<typeof client.messages.stream>;
  try {
    stream = client.messages.stream(
      {
        model: config.model,
        max_tokens: 4096,
        temperature: 0.7,
        system: `${INTERPRET_SYSTEM_PROMPT}\n\n${buildChartContext(chart, '命主命盘')}`,
        messages,
      },
      { signal: req.signal },
    );
  } catch (err) {
    console.error('[interpret] failed to open stream:', err);
    return Response.json({ error: 'AI 服务调用失败' }, { status: 502 });
  }

  return new Response(toSSEStream(stream, () => stream.abort()), {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
