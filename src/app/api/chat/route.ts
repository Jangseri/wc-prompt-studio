import { NextRequest } from "next/server";
import { openai } from "@/lib/openai";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
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

    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: openaiMessages,
      temperature: settings?.temperature ?? 0.25,
      max_tokens: settings?.maxTokens ?? 1024,
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }
          controller.close();
        } catch {
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
    logger.error("[chat] streaming failed", err);
    return new Response("Chat failed", { status: 500 });
  }
}
