import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { openai } from "@/lib/openai";
import {
  getMetaSystemPrompt,
  buildGenerateUserPrompt,
  getRegionsSystemPrompt,
  buildRegionsUserPrompt,
  STRUCTURING_JSON_SCHEMA,
  type ChannelType,
} from "@/lib/system-prompt";
import { generateRequestSchema, isRegionsRequest } from "@/lib/schemas/generate";
import { check as rateCheck, getClientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import {
  applyIndustryPreset,
  DEFAULT_STT_TTS_RULES,
} from "@/lib/regions-presets";
import type { StructuringPrompt } from "@/types/structuring";

const RATE_LIMIT = { capacity: 10, refillPerSecond: 10 / 60 }; // ~10/min burst

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = rateCheck(ip, RATE_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "요청이 너무 잦습니다. 잠시 후 다시 시도해주세요." },
      {
        status: 429,
        headers: {
          "retry-after": String(Math.ceil(rl.resetMs / 1000)),
        },
      }
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { error: "잘못된 요청 형식입니다" },
      { status: 400 }
    );
  }

  let parsed;
  try {
    parsed = generateRequestSchema.parse(raw);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "요청 스키마 검증 실패", details: err.flatten() },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "요청 검증 실패" }, { status: 400 });
  }

  if (isRegionsRequest(parsed)) {
    return handleRegions(parsed);
  }
  return handleLegacy(parsed, raw as Record<string, unknown>);
}

async function handleRegions(body: {
  parsedText: string;
  images?: string[];
  channel: ChannelType;
  industry: string;
}): Promise<NextResponse> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: getRegionsSystemPrompt(body.channel) },
        {
          role: "user",
          content: buildRegionsUserPrompt({
            parsedText: body.parsedText,
            imageDescriptions: body.images,
            channel: body.channel,
            industry: body.industry,
          }),
        },
      ],
      temperature: 0.1,
      max_tokens: 8192,
      response_format: {
        type: "json_schema",
        json_schema: STRUCTURING_JSON_SCHEMA,
      },
    });

    const content = response.choices[0]?.message?.content ?? "";
    if (!content) {
      return NextResponse.json(
        { error: "빈 응답을 받았습니다" },
        { status: 502 }
      );
    }

    let structuring: StructuringPrompt;
    try {
      structuring = JSON.parse(content) as StructuringPrompt;
    } catch (err) {
      logger.error("[generate:regions] JSON parse failed", err);
      return NextResponse.json(
        { error: "LLM 응답이 JSON 형식이 아닙니다" },
        { status: 502 }
      );
    }

    structuring = applyIndustryPreset(structuring, body.industry);

    // Server-enforced defaults / cleanups. These intentionally override
    // whatever the LLM returned because the system prompt already tells
    // the model to leave these fields empty — this is the fallback that
    // guarantees a consistent shape regardless of LLM drift.
    structuring.system.sttTts = DEFAULT_STT_TTS_RULES;
    structuring.answerScope.specifics.keyValueItems = [];
    structuring.answerScope.specifics.sentence = "";
    structuring.toolCalling = { mcp: "", api: "", agent: "", dataQuery: "" };
    structuring.conversation.customNotes = "";
    if (!structuring.custom) {
      structuring.custom = { items: [] };
    } else {
      structuring.custom.items = [];
    }

    return NextResponse.json({
      mode: "regions",
      structuring,
      warnings: [],
    });
  } catch (err) {
    logger.error("[generate:regions] OpenAI call failed", err);
    return NextResponse.json(
      { error: "프롬프트 생성에 실패했습니다" },
      { status: 500 }
    );
  }
}

async function handleLegacy(
  body: {
    parsedText: string;
    images?: string[];
    industry?: string;
    channelType?: string;
  },
  rawBody: Record<string, unknown>
): Promise<NextResponse> {
  // Legacy payload shape diverges from the new one; fall back to raw body
  // fields for backward compat with existing frontend calls.
  const type = (rawBody.type as string) || "general";
  const textContent = (rawBody.textContent as string) || body.parsedText || "";
  const imageDescriptions =
    (rawBody.imageDescriptions as string[]) || body.images || [];
  const channel: ChannelType =
    (rawBody.channel as ChannelType) ||
    (body.channelType as ChannelType) ||
    "callbot";

  try {
    const userPrompt = buildGenerateUserPrompt(
      type === "hospital" ? "hospital" : "general",
      textContent,
      imageDescriptions,
      channel
    );

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: getMetaSystemPrompt(channel) },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 8192,
    });

    const fullPrompt = response.choices[0]?.message?.content ?? "";
    const greetingMessage = extractGreeting(fullPrompt);
    const sections = parseSections(fullPrompt);
    const warnings = validatePrompt(fullPrompt, textContent);

    return NextResponse.json({
      prompt: fullPrompt,
      sections,
      greetingMessage,
      warnings,
    });
  } catch (err) {
    logger.error("[generate:legacy] failed", err);
    return NextResponse.json(
      { error: "Prompt generation failed" },
      { status: 500 }
    );
  }
}

function extractGreeting(text: string): string {
  let greeting = "";

  // 이스케이프된 따옴표(\" )를 건너뛰고 진짜 닫는 따옴표까지 매칭하는 패턴
  const QUOTED = '((?:[^"\\\\]|\\\\[\\s\\S])*)';

  const pattern1 = new RegExp(`(?:시스템 송출 멘트|시스템 초기 멘트|인사말)[^"]*"${QUOTED}"`);
  const match1 = pattern1.exec(text);
  if (match1) greeting = match1[1].trim();

  if (!greeting) {
    const pattern2 = new RegExp(`(?:시스템 송출 멘트|시스템 초기 멘트|인사말)[^\\n]*\\n"${QUOTED}"`);
    const match2 = pattern2.exec(text);
    if (match2) greeting = match2[1].trim();
  }

  if (!greeting) {
    const pattern3 = new RegExp(`"((?:반갑습니다|안녕하세요)(?:[^"\\\\]|\\\\[\\s\\S]){10,}?)"`);
    const match3 = pattern3.exec(text);
    if (match3) greeting = match3[1].trim();
  }

  if (!greeting) {
    const pattern4 = new RegExp(`<!--\\s*GREETING:\\s*"${QUOTED}"\\s*-->`);
    const match4 = pattern4.exec(text);
    if (match4) greeting = match4[1].trim();
  }

  greeting = greeting.replace(/\\"/g, '"');
  greeting = greeting.replace(/\\n/g, "\n");

  return greeting;
}

function validatePrompt(generated: string, source: string): string[] {
  const warnings: string[] = [];
  const sections = generated.split(/---+/);

  for (let i = 1; i < sections.length - 1; i++) {
    const section = sections[i] || "";
    if (/\[입력 정보\]/.test(section)) continue;
    if (/AA\d{4}/.test(section)) {
      warnings.push(
        `섹션 ${i + 1}에서 AA코드가 직접 사용되었습니다. deptStatus 등 변수명을 사용해야 합니다.`
      );
    }
  }

  if (sections.length >= 4) {
    const flowSection = sections[3] || "";
    if (/안녕하세요/.test(flowSection) && /대화\s*흐름/.test(flowSection)) {
      warnings.push("대화 흐름에 인사말이 포함되어 있습니다.");
    }
  }

  if (source) {
    const sourceQuotes = source.match(/"[^"]{10,}"/g) || [];
    for (const quote of sourceQuotes.slice(0, 5)) {
      const inner = quote.slice(1, -1).trim();
      if (inner.length > 15 && !generated.includes(inner.slice(0, 20))) {
        warnings.push(
          `소스 멘트가 변형되었을 수 있습니다: "${inner.slice(0, 40)}..."`
        );
      }
    }
  }

  return warnings;
}

function parseSections(text: string) {
  const defaults = {
    introduction: "",
    responseRules: "",
    businessStatus: "",
    conversationFlow: "",
    callEnd: "",
    exceptionHandling: "",
    referenceData: "",
  };

  const parts = text.split(/---+/);

  if (parts.length >= 7) {
    return {
      introduction: parts[0]?.trim() ?? "",
      responseRules: parts[1]?.trim() ?? "",
      businessStatus: parts[2]?.trim() ?? "",
      conversationFlow: parts[3]?.trim() ?? "",
      callEnd: parts[4]?.trim() ?? "",
      exceptionHandling: parts[5]?.trim() ?? "",
      referenceData: parts[6]?.trim() ?? "",
    };
  }

  const sectionPatterns = [
    { key: "introduction", pattern: /\[도입부\]/i },
    { key: "responseRules", pattern: /응답\s*기본\s*원칙/i },
    { key: "businessStatus", pattern: /영업\s*상태\s*판단/i },
    { key: "conversationFlow", pattern: /대화\s*흐름/i },
    { key: "callEnd", pattern: /통화\s*종료/i },
    { key: "exceptionHandling", pattern: /예외\s*처리/i },
    { key: "referenceData", pattern: /답변\s*참고\s*자료/i },
  ];

  const result = { ...defaults };
  const lines = text.split("\n");
  let currentKey = "introduction";

  for (const line of lines) {
    for (const { key, pattern } of sectionPatterns) {
      if (pattern.test(line)) {
        currentKey = key;
        break;
      }
    }
    result[currentKey as keyof typeof result] += line + "\n";
  }

  return result;
}
