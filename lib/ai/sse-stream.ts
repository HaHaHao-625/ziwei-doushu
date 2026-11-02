import type { MessageStreamEvent } from '@anthropic-ai/sdk/resources/messages';

/**
 * 把 Anthropic 事件流翻译成前端约定的 SSE：
 *   data: {"delta":{"text":"..."}}
 *   data: [DONE]
 * 前端 ChatPanel / InsightPanel / 合盘页都只解析 delta.text。
 */
export function toSSEStream(
  events: AsyncIterable<MessageStreamEvent>,
  abort: () => void,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let closed = false;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (line: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(line));
        } catch {
          closed = true;
        }
      };

      try {
        for await (const event of events) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            send(`data: ${JSON.stringify({ delta: { text: event.delta.text } })}\n\n`);
          }
        }
      } catch (err) {
        console.error('[ai] stream failed:', err);
        send(`data: ${JSON.stringify({ delta: { text: '\n\n（AI 服务连接中断，请稍后重试。）' } })}\n\n`);
      } finally {
        send('data: [DONE]\n\n');
        if (!closed) controller.close();
      }
    },
    cancel() {
      closed = true;
      abort();
    },
  });
}
