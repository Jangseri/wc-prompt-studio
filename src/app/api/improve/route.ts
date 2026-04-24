import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openai";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { currentPrompt, chatHistory, feedback } = body;

    const systemMessage = `당신은 AI 콜봇 프롬프트를 개선하는 전문가입니다.

## 작업
사용자가 대화 테스트 중 발견한 문제를 바탕으로, 현재 프롬프트를 수정하여 개선된 버전을 출력합니다.

## 출력 형식
반드시 아래 형식으로 출력합니다:

1. 먼저 수정 사항을 요약합니다:
\`\`\`changes
- [수정 위치와 내용을 한 줄씩 설명]
\`\`\`

2. 그 다음 수정된 전체 프롬프트를 출력합니다:
\`\`\`prompt
(전체 프롬프트)
\`\`\`

## 수정 규칙
1. 프롬프트의 전체 구조(섹션, AA코드 등)는 유지합니다.
2. 문제가 된 부분만 최소한으로 수정합니다.
3. 원본 프롬프트의 줄바꿈, 들여쓰기, 포맷을 그대로 유지합니다.
4. 수정된 프롬프트에는 주석이나 마커를 넣지 않습니다. 깨끗한 프롬프트만 출력합니다.

## 수정 방식 제약 (반드시 준수)
- **일반화된 규칙/원칙 문장으로 수정합니다.**
  - 사용자가 특정 사례를 보고했더라도, 그 사례만 커버하는 좁은 규칙이 아니라 같은 유형의 문제를 모두 커버하는 범용 규칙으로 작성합니다.
  - 나쁜 예: "기차문의는 기타문의로 판단한다" (특정 사례만 커버)
  - 좋은 예: "문의 분류 상황에서 고객 발화가 문의 유형 중 하나와 음운이 유사하면 가장 가까운 유형으로 판단한다" (범용 규칙)
- 예시를 나열하는 방식으로 해결하지 않습니다. 예시는 규칙 뒤에 최대 1개, 짧게 1줄만 허용합니다.
- 프롬프트 길이가 기존 대비 20% 이상 늘어나지 않도록 합니다.`;

    const userMessage = `## 현재 프롬프트
\`\`\`
${currentPrompt}
\`\`\`

## 대화 테스트 내역
${chatHistory.map((m: { role: string; content: string }) => `${m.role === "user" ? "[고객]" : "[콜봇]"} ${m.content}`).join("\n")}

## 발견된 문제 / 개선 요청
${feedback}

위 문제를 해결하도록 프롬프트를 수정해주세요.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage },
      ],
      temperature: 0.1,
      max_tokens: 8192,
    });

    const raw = response.choices[0]?.message?.content ?? "";

    // Extract changes summary
    const changesMatch = raw.match(/```changes\s*([\s\S]*?)```/);
    const summary = changesMatch ? changesMatch[1].trim() : "";

    // Extract clean prompt
    const promptMatch = raw.match(/```prompt\s*([\s\S]*?)```/);
    const improvedPrompt = promptMatch ? promptMatch[1].trim() : raw.trim();

    return NextResponse.json({
      improvedPrompt,
      summary,
    });
  } catch (err) {
    logger.error("[improve] failed", err);
    return NextResponse.json(
      { error: "Prompt improvement failed" },
      { status: 500 }
    );
  }
}
