import { NextRequest } from "next/server";
import { openai } from "@/lib/openai";
import { logger, logRoute } from "@/lib/logger";

export async function POST(req: NextRequest) {
  return logRoute("[chat] POST", {}, async (rid) => {
    try {
      const body = await req.json();
      const { systemPrompt, messages, settings } = body;

      const openaiMessages = [
        { role: "system" as const, content: systemPrompt },
        ...messages.map((m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      logger.info("[chat] stream start", {
        rid,
        model: "gpt-4o",
        systemPromptLength: systemPrompt?.length ?? 0,
        messageCount: messages.length,
        temperature: settings?.temperature ?? 0.25,
        maxTokens: settings?.maxTokens ?? 1024,
      });

      const stream = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: openaiMessages,
        temperature: settings?.temperature ?? 0.25,
        max_tokens: settings?.maxTokens ?? 1024,
        stream: true,
      });

      const encoder = new TextEncoder();
      const t0 = Date.now();
      let chunkCount = 0;
      let totalChars = 0;
      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              const content = chunk.choices[0]?.delta?.content;
              if (content) {
                chunkCount++;
                totalChars += content.length;
                controller.enqueue(encoder.encode(content));
              }
            }
            logger.info("[chat] stream end", {
              rid,
              ms: Date.now() - t0,
              chunks: chunkCount,
              chars: totalChars,
            });
            controller.close();
          } catch (streamErr) {
            logger.error("[chat] stream interrupted", {
              rid,
              ms: Date.now() - t0,
              chunks: chunkCount,
              chars: totalChars,
              err: streamErr,
            });
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Transfer-Encoding": "chunked",
        },
      });
    } catch (err) {
      logger.error("[chat] streaming failed", { rid, err });
      return new Response("Chat failed", { status: 500 });
    }
  });
}
