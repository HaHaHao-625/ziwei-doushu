import Anthropic from '@anthropic-ai/sdk';
import type { NextRequest } from 'next/server';
import type { ZiweiChart } from '@/lib/ziwei/types';
import { HEMING_METHODOLOGY } from '@/lib/ziwei/heming-knowledge';
import { buildChartContext } from '@/lib/ai/chart-context';
import { getDeepSeekConfig } from '@/lib/ai/deepseek';
import { HEMING_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import { toSSEStream } from '@/lib/ai/sse-stream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_REQUEST = `请按【合盘五步法】给出完整合盘分析，并按以下结构输出：

**【整体缘分】**
一句话定性两人的缘分类型与匹配度。

**【双方命格匹配】**
双方命宫、身宫、福德宫的星性搭配，是互补还是相冲。

**【夫妻宫互参】**
双方夫妻宫主星、四化，以及是否对应对方命宫/三合方。

**【四化飞化互参】**
双方生年干四化落入对方盘面的影响，重点看化禄与化忌。

**【大限同步】**
双方当前大限的运势节奏是否合拍，近期感情机会与挑战。

**【相处建议】**
具体可执行的相处、沟通与边界建议。`;

function isValidChart(value: unknown): value is ZiweiChart {
  return Boolean(
    value &&
    typeof value === 'object' &&
    Array.isArray((value as ZiweiChart).palaces) &&
    (value as ZiweiChart).palaces.length > 0,
  );
}

export async function POST(req: NextRequest) {
  const config = getDeepSeekConfig();
  if (!config) {
    return Response.json(
      { error: 'AI 服务未配置：请在 .env.local 设置 DEEPSEEK_API_KEY' },
      { status: 500 },
    );
  }

  let body: { chartA?: ZiweiChart; chartB?: ZiweiChart; question?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  if (!isValidChart(body?.chartA) || !isValidChart(body?.chartB)) {
    return Response.json({ error: '缺少有效的双方命盘 chartA / chartB' }, { status: 400 });
  }

  const question = typeof body.question === 'string' ? body.question.trim() : '';
  const userPrompt = question
    ? `请基于双方命盘回答这个问题：\n\n${question}\n\n回答时请结合盘面依据，并给出可执行的合盘结论。`
    : DEFAULT_REQUEST;

  const client = new Anthropic({ apiKey: config.apiKey, baseURL: config.baseURL });
  const system = [
    HEMING_SYSTEM_PROMPT,
    HEMING_METHODOLOGY,
    buildChartContext(body.chartA, '甲方命盘'),
    buildChartContext(body.chartB, '乙方命盘'),
  ].join('\n\n');

  let stream: ReturnType<typeof client.messages.stream>;
  try {
    stream = client.messages.stream(
      {
        model: config.model,
        max_tokens: 4096,
        temperature: 0.7,
        system,
        messages: [{ role: 'user', content: userPrompt }],
      },
      { signal: req.signal },
    );
  } catch (err) {
    console.error('[heming] failed to open stream:', err);
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
