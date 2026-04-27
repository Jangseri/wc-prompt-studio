# wc-prompt-studio

AI 콜봇/챗봇용 프롬프트를 자동 생성·정형화·DB 저장까지 한 화면에서 처리하는 사내 도구.

- 업로드한 고객사 자료(xlsx + 이미지)를 LLM이 8개 영역(role/persona/system/conversation/branching/toolCalling/custom/answerScope)으로 정형화
- 채널(콜봇/챗봇) × 업종(병원/일반)에 맞춰 `cstm_prmt_info` 테이블에 메인 + 형제 3개(PA4000/PA1000/PC1000)를 한 트랜잭션에 저장
- 회사별 적용 현황을 좌측 사이드바에서 관리(편집·상태 토글·삭제)

## Quick Start

```bash
# 의존성 설치
npm install

# 개발 서버 (이 워크스테이션은 Turbopack 패닉 → --webpack 플래그 필수)
npm run dev -- --webpack

# 빌드 / 프로덕션
npm run build
npm run start

# 테스트
npm run test           # vitest 단위
npm run test:e2e       # Playwright (Chromium)
npm run lint
```

`http://localhost:3000` 에서 접속.

## 환경 변수 (`.env.local`)

```bash
# OpenAI — 텍스트 생성 + Gemini 실패 시 vision fallback
OPENAI_API_KEY=sk-...

# Gemini — vision (이미지 분석) 1순위
GEMINI_API_KEY=AIza...

# 사내 MySQL
DB_HOST=192.168.220.222
DB_PORT=3306
DB_USER=root
DB_PASSWORD=...
DB_NAME=orchestrator

# 사내 KB / Orchestrator
ORCHESTRATOR_URL=http://192.168.220.222:9002
COMPANY_INFO_URL=http://192.168.220.222:3030
```

미설정 시 `src/lib/db.ts` 가 fallback 값으로 동작 (개발 편의).

## 라우트 구조

| 경로 | 설명 |
|---|---|
| `/` | **통합 워크스페이스** (3열: 회사 사이드바 / 5단계 워크플로 / Preview·Chat·KB) |
| `/legacy` | 구 3탭 UI (자동 생성 / 정형화 / DB 관리) — 회귀 비교용 보존 |

## 주요 흐름

1. **Setup**: `company_seq` + `ai_staff_seq` 입력 → 기존 적용 프롬프트 svc_cd별 pre-check
2. **Source**: xlsx/이미지 업로드 + 채널(콜봇/챗봇) + 업종(병원/일반) 선택
3. **Analysis**: Excel 텍스트 + Gemini 이미지 분석(실패 시 OpenAI gpt-5 자동 fallback) → 8영역 초안 자동 생성
4. **Regions**: 영역별 폼 편집 (System/Conversation 룰 잠금, Branching 단계 ↑↓, Custom 섹션, Tool Calling 비활성)
5. **Apply**: strict no-overwrite 트랜잭션 (대상 4행 중 하나라도 존재하면 409). 적용 후 사이드바 갱신.

## 더 자세한 정보

- 기술 스택 + 의사결정: [`STACK.md`](./STACK.md)
- 통합 워크스페이스 설계 원안 + 현재 진행 상태: [`docs/unified-workspace-plan.md`](./docs/unified-workspace-plan.md)
- Next.js 16 주의사항: [`AGENTS.md`](./AGENTS.md)
