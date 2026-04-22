import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openai";
import {
  getMetaSystemPrompt,
  buildGenerateUserPrompt,
} from "@/lib/system-prompt";
import type { ChannelType } from "@/lib/system-prompt";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, textContent, imageDescriptions, channel } = body;
    const ch: ChannelType = channel || "callbot";

    const userPrompt = buildGenerateUserPrompt(
      type || "general",
      textContent || "",
      imageDescriptions || [],
      ch
    );

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: getMetaSystemPrompt(ch) },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 8192,
    });

    const fullPrompt = response.choices[0]?.message?.content ?? "";

    // Extract greeting message if present
    const greetingMessage = extractGreeting(fullPrompt);

    // Parse sections
    const sections = parseSections(fullPrompt);

    // Validate generated prompt against source
    const warnings = validatePrompt(fullPrompt, textContent || "");

    return NextResponse.json({
      prompt: fullPrompt,
      sections,
      greetingMessage,
      warnings,
    });
  } catch (err) {
    console.error("Generate error:", err);
    return NextResponse.json(
      { error: "Prompt generation failed" },
      { status: 500 }
    );
  }
}

function extractGreeting(text: string): string {
  let greeting = "";

  // 이스케이프된 따옴표(\" )를 건너뛰고 진짜 닫는 따옴표까지 매칭하는 패턴
  // (?:[^"\\]|\\.)* → 비따옴표/비백슬래시 문자 또는 백슬래시+아무문자 반복
  const QUOTED = '((?:[^"\\\\]|\\\\[\\s\\S])*)';

  // Pattern 1: 시스템 송출 멘트 / 시스템 초기 멘트 / 인사말 (참고용...) "텍스트"
  const pattern1 = new RegExp(`(?:시스템 송출 멘트|시스템 초기 멘트|인사말)[^"]*"${QUOTED}"`);
  const match1 = pattern1.exec(text);
  if (match1) greeting = match1[1].trim();

  // Pattern 2: Multi-line — greeting block with quoted text on next line
  if (!greeting) {
    const pattern2 = new RegExp(`(?:시스템 송출 멘트|시스템 초기 멘트|인사말)[^\\n]*\\n"${QUOTED}"`);
    const match2 = pattern2.exec(text);
    if (match2) greeting = match2[1].trim();
  }

  // Pattern 3: 챗봇 스타일 — "반갑습니다" 또는 "안녕하세요"로 시작하는 첫 번째 따옴표 멘트
  if (!greeting) {
    const pattern3 = new RegExp(`"((?:반갑습니다|안녕하세요)(?:[^"\\\\]|\\\\[\\s\\S]){10,}?)"`);
    const match3 = pattern3.exec(text);
    if (match3) greeting = match3[1].trim();
  }

  // Pattern 4: <!-- GREETING: "텍스트" -->
  if (!greeting) {
    const pattern4 = new RegExp(`<!--\\s*GREETING:\\s*"${QUOTED}"\\s*-->`);
    const match4 = pattern4.exec(text);
    if (match4) greeting = match4[1].trim();
  }

  // Convert escaped quotes \" to actual quotes
  greeting = greeting.replace(/\\"/g, '"');
  // Convert literal \n to actual newlines
  greeting = greeting.replace(/\\n/g, "\n");

  return greeting;
}

function validatePrompt(
  generated: string,
  source: string
): string[] {
  const warnings: string[] = [];
  const sections = generated.split(/---+/);

  // Check 1: AA codes in wrong sections (skip first section = intro, last = reference)
  for (let i = 1; i < sections.length - 1; i++) {
    const section = sections[i] || "";
    if (/\[입력 정보\]/.test(section)) continue;
    if (/AA\d{4}/.test(section)) {
      warnings.push(
        `섹션 ${i + 1}에서 AA코드가 직접 사용되었습니다. deptStatus 등 변수명을 사용해야 합니다.`
      );
    }
  }

  // Check 2: Greeting in conversation flow
  if (sections.length >= 4) {
    const flowSection = sections[3] || "";
    if (/안녕하세요/.test(flowSection) && /대화\s*흐름/.test(flowSection)) {
      warnings.push("대화 흐름에 인사말이 포함되어 있습니다.");
    }
  }

  // Check 3: Source text preservation - check quoted strings from source exist in output
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

  // Fallback: split by section markers
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
