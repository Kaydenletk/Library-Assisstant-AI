import { convertToModelMessages, streamText, type UIMessage } from 'ai';
import { agentConfig } from '@/lib/agent/config';

// Agent does up to 5 steps (retrieval + answer); give it headroom.
export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  const result = streamText({
    ...agentConfig,
    messages: await convertToModelMessages(messages),
  });
  return result.toUIMessageStreamResponse();
}
