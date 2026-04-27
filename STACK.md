# WC Prompt Studio — 기술 스택 정의서

> AI 콜봇/챗봇 프롬프트 자동 생성·정형화·관리 도구
> 프로젝트 버전: `0.1.0` · 최종 갱신: 2026-04-27 (브랜치 `feat/unified-workspace`)

---

## 1. 런타임 & 언어

| 항목 | 버전 | 비고 |
|---|---|---|
| Node.js | `@types/node ^20` 기준 | Windows 11 로컬 개발 |
| TypeScript | `^5` | `tsconfig.json` strict |
| React | `19.2.4` | Server Components · Actions 지원 |
| React DOM | `19.2.4` | React 19와 버전 동기화 |

**선택 이유:** Next.js 16이 React 19를 요구. Server Components 및 `use()` 훅 활용 목적.

---

## 2. 프레임워크

### Next.js `16.2.2` (App Router)

- 구조: `src/app/` 기반 App Router, Route Handlers(`route.ts`)로 API 구현
- ESLint 통합: `eslint-config-next 16.2.2`
- ⚠️ **주의 (AGENTS.md 규정):** 본 Next.js 버전은 훈련 데이터와 breaking changes가 존재. 코드 작성 전 `node_modules/next/dist/docs/` 내 가이드 참조 필수.

**대안 고려:**
- **Remix / React Router v7** — SSR·파일 라우팅 유사하나, Vercel 생태계(Next 전용 최적화, App Router의 서버 액션) 대비 LLM 스트리밍 예제·커뮤니티가 얕음
- **Vite + React (SPA)** — 빠른 HMR 장점이나 API 엔드포인트를 별도 Node 서버로 분리해야 함 → 내부 도구 특성상 프론트+백엔드 통합이 생산성 우위

**선택 이유:** (1) Frontend + Route Handler로 풀스택 단일 리포, (2) SSE 스트리밍(`/api/chat`) 구현이 간결, (3) 사내 인프라(mysql2 direct) 직접 접근이 필요해 Edge 제약 없는 Node 런타임 선호.

---

## 3. 스타일링

| 패키지 | 버전 | 용도 |
|---|---|---|
| `tailwindcss` | `^4` | 유틸리티 클래스 |
| `@tailwindcss/postcss` | `^4` | PostCSS 플러그인 (v4 전용) |
| `tailwind-merge` | `^3.5.0` | 중복 클래스 병합 |
| `clsx` | `^2.1.1` | 조건부 클래스 합성 |
| `next-themes` | `^0.4.6` | 다크/라이트 토글 (다크 기본) |
| `tw-animate-css` | `^1.4.0` | Tailwind 애니메이션 유틸 |

- `src/lib/utils.ts`의 `cn()` = `twMerge(clsx(...))`
- 테마: `next-themes` 기반 dark 기본값 + 헤더 토글 버튼(`src/components/theme-toggle.tsx`). `<html lang="ko" suppressHydrationWarning>` (`src/app/layout.tsx`).
- 디자인 토큰: shadcn-style HSL 시맨틱 토큰(`--background`, `--foreground`, `--primary`, `--muted`, `--destructive` 등) 라이트/다크 모두 정의. 스크롤바·`.glass`·`.glow-primary` 모두 시맨틱 토큰 기반.

**대안 고려:**
- **CSS Modules / Vanilla Extract** — 타입 안전하나 다크/라이트 토큰 오버라이드·bulk 스타일링이 번잡
- **shadcn/ui + Radix** — 컴포넌트 완성도 높지만 디자인 커스터마이즈 자유도 제한, 본 프로젝트는 기존 디자인 규격이 있어 원시 Tailwind가 적합

**선택 이유:** v4의 Oxide 엔진으로 빌드 속도 개선, PostCSS-only 구성으로 config 파일 단순화.

---

## 4. 상태관리

### Zustand `^5.0.12` — 6개 스토어 (워크스페이스 4 + 레거시 2 공유)

| 스토어 | 파일 | 책임 | 사용처 |
|---|---|---|---|
| `useWorkspaceStore` | `src/stores/workspace-store.ts` | 모드(idle/workflow/manage) · 5단계 워크플로 · pre-check · maxVisitedStepIndex | `/` 워크스페이스 |
| `useStructuringStore` | `src/stores/structuring-store.ts` | 8개 Region 정형화 폼 상태 (branching steps, custom items 포함) | `/` + `/legacy` 정형화 |
| `useCompanyNamesStore` | `src/stores/company-names-store.ts` | `company-info` 캐시 (read-through, N=5 동시 fetch) | `/` 사이드바 |
| `useAutoStore` | `src/stores/auto-store.ts` | 업로드·파싱·생성·채팅·개선 이력 | `/legacy` 자동 생성 탭 |
| `useEditorStore` | `src/stores/editor-store.ts` | DB 프롬프트 CRUD · KB · 헬스체크 | `/legacy` DB 관리 탭 |
| `useUIStore` | `src/stores/ui-store.ts` | 레거시 메인 탭(`auto/structuring/editor`) | `/legacy` |

**대안 고려:**
- **Redux Toolkit** — boilerplate 비용이 큼, 비동기 흐름이 단순해 RTK Query의 이점 불필요
- **Jotai / Recoil** — atom 단위 관리의 이점이 있으나, "탭별 대형 상태 1개" 패턴이 store slice 방식에 더 잘 맞음
- **React Context + useReducer** — Provider 지옥 및 불필요 re-render 우려

**선택 이유:** (1) selector로 re-render 최소화, (2) 미들웨어(persist 등) 확장 용이, (3) zero-provider 구조로 Server/Client 경계 충돌 없음.

---

## 5. LLM / AI

### 텍스트 — `openai ^6.33.0` (gpt-4o)

| 용도 | 모델 | 파라미터 | 엔드포인트 |
|---|---|---|---|
| 프롬프트 생성 (8영역) | `gpt-4o` | temperature `0.1`, max_tokens `8192`, `response_format: json_schema` | `/api/generate` |
| 프롬프트 개선 | `gpt-4o` | — | `/api/improve` |
| 대화 테스트 | `gpt-4o` | temperature `0.25`, max_tokens `1024`, **stream: true** | `/api/chat` |

- 클라이언트: `src/lib/openai.ts` (`OPENAI_API_KEY`). `OPENAI_MOCK=1` 시 결정적 stub (Playwright용).
- 시스템 프롬프트 빌더: `src/lib/system-prompt.ts` (`getRegionsSystemPrompt`, `IMAGE_ANALYSIS_PROMPT`, …)

### 이미지 (Vision) — Gemini 1순위 + OpenAI 자동 fallback

| 우선순위 | 모델 | SDK | 위치 |
|---|---|---|---|
| 1차 | `gemini-2.5-flash` | `@google/generative-ai ^0.24.1` | `src/lib/gemini.ts` |
| Fallback | `gpt-5` (vision) | `openai ^6.33.0` | `src/lib/openai-vision.ts` |

- 단일 진입점: `analyzeImageWithGemini({ base64, mimeType, prompt })` — Gemini 실패(429/404/missing key/transport 등) 시 try/catch 내부에서 자동으로 `analyzeImageWithOpenAI` 호출. 둘 다 실패하면 두 에러 메시지를 결합해 throw.
- 호출 경로: `/api/analyze-image` (직접 업로드 이미지), `/api/upload` (xlsx 내부 추출 이미지)
- 로그: Gemini 실패 시 `[gemini] image analysis failed, falling back to openai` warn 한 줄(`logger.warn`).

**대안 고려 (vision):**
- **OpenAI 단독(이전 구성)** — 안정적이나 이미지 분석 비용 높음. 비용 우선시 Gemini가 유리.
- **Claude Vision** — 한국어 흐름도 인식 품질 양호하나 별도 SDK 추가 부담.
- **Gemini 단독** — 현 프로젝트 신규 GCP 프로젝트는 Free Tier 차단 케이스(`limit:0`) + 모델 deprecation(`gemini-2.0-flash`) 이슈 경험 → fallback 필수.

**선택 이유:** 비용은 Gemini로 절감, 안정성은 OpenAI 자동 fallback으로 보장.

### 토큰 추정
- `src/lib/tokenEstimator.ts` — Vercel AI Gateway 없이 자체 추정(BPE 근사).

---

## 6. 데이터베이스

### `mysql2 ^3.20.0` (Promise + Pool)

- 접속 대상: **`192.168.220.222:3306`** / DB `orchestrator`
- Pool 설정 (`src/lib/db.ts`):
  - `connectionLimit: 5`
  - `connectTimeout: 30000ms` / `idleTimeout: 60000ms`
  - `enableKeepAlive: true`, `keepAliveInitialDelay: 30000ms`
  - `dateStrings: true` (JS Date 객체 자동 변환 비활성)
- 에러 복구: `PROTOCOL_CONNECTION_LOST` / `ECONNREFUSED` 발생 시 `pool = null`로 재생성
- 에러 마스킹: `sanitizeDbError()` — 내부 에러 메시지를 사용자 친화 문구로 치환

**주요 테이블/리소스:**
| 엔티티 | 형식 | 출처 |
|---|---|---|
| `CstmPrmtInfo` | 회사별 프롬프트 CRUD (cstm_id, company_seq, ai_staff_seq, svc_cd, prmt_cd, status Y/N, prompt, json_schema) | `src/types/editor.ts` |
| `Code` | 서비스/프롬프트 코드 트리 (code, up_code, name_ko/en) | `/api/codes`, `/api/codes/tree` |
| `KBItem` | Knowledge Base 파일 메타 (file_name, company_seq, content) | `/api/kb`, `/api/kb-file` |

**적용(`/api/prompts` POST) 정책 — strict no-overwrite:**
- 한 번 적용으로 **메인 1행 + 형제 3행(PA4000/PA1000/PC1000) = 총 4행** INSERT.
- **Pre-check 3중 방어**:
  1. Setup 단계: `existingPromptsByService` 로 svc_cd별 기존 행 수 fetch & 표시
  2. Source 단계: 선택된 (channel, industry) 가 충돌하면 advance 차단 + destructive 배너
  3. Apply 단계: 트랜잭션 시작 직전에 4행 중 하나라도 존재하면 `ExistingPromptsError` (HTTP 409)
- **Race-safety**: 동시 요청으로 pre-check를 통과해도 INSERT 단계의 UNIQUE 제약 위반(`ER_DUP_ENTRY`)을 catch해 `ExistingPromptsError`로 변환.
- **업종별 svc_cd 오버라이드**: `INDUSTRY_SVC_CD_OVERRIDES` (`src/lib/prompt-codes.ts`). 현재: `callbot + 병원 → SA1200` (기본 `SA1000` 대체). `resolveChannelCode(channel, industry)` 헬퍼로 일관 사용.

**대안 고려:**
- **Prisma / Drizzle ORM** — 타입 안전성 강점이나 본 프로젝트는 raw SQL 개수가 적고(~10개 라우트) 사내 기존 스키마에 맞춘 동적 쿼리가 더 편함
- **Knex** — 쿼리 빌더 이점이 mysql2 단독 + 타입 수동 정의 대비 크지 않음

**선택 이유:** 사내 기존 DB에 추가 마이그레이션 없이 붙어야 함 → ORM 스키마 관리 부담 회피.

---

## 7. 에디터

### `@monaco-editor/react ^4.7.0`

- VS Code와 동일한 Monaco 엔진 (syntax highlight, 자동 완성, diff 지원)
- 사용처:
  - 자동 생성 탭 프롬프트 편집기 (`src/components/auto/prompt/prompt-editor.tsx`)
  - DB 프롬프트 편집기 (`src/components/editor/PromptEditor.tsx`)
  - JSON Schema 필드 편집
- 변경 감지 훅: `src/hooks/useChangeDetection.ts`
- Diff 하이라이트: `auto-store.setEditedFullTextWithDiff` → `previousPromptText` 저장

**대안 고려:**
- **CodeMirror 6** — 번들 크기 작음, 하지만 Markdown/Plain에서의 자동 완성·설정 UX가 Monaco 대비 약함
- **Plain `<textarea>`** — 장문 프롬프트 편집에 부적합 (탭/들여쓰기/검색 부재)

**선택 이유:** VS Code 친숙성 + 대용량 프롬프트(수천 줄) 편집 시 성능.

---

## 8. 파일 처리

| 패키지 | 버전 | 용도 | 위치 |
|---|---|---|---|
| `exceljs` | `^4.4.0` | XLSX 파싱 (셀 텍스트 추출) | `src/lib/excel-parser.ts` |
| `jszip` | `^3.10.1` | XLSX 내부 이미지(xl/media/*) 추출 | `src/lib/image-extractor.ts` |
| `react-dropzone` | `^15.0.0` | 드래그앤드롭 업로드 | `src/components/auto/upload/file-dropzone.tsx` |

### 파이프라인
```
.xlsx 업로드
  ├─ ExcelJS → 셀 텍스트 → parsedTextContent
  └─ JSZip → 내부 이미지 바이너리 → analyzeImageWithGemini
                                     │   └─ Gemini 2.5-flash
                                     └─ 실패 시 자동 fallback → OpenAI gpt-5 vision
                                     → parsedImageDescriptions[]

직접 이미지 업로드 → analyzeImageWithGemini 동일 경로
```

이미지 분석 결과는 정형화 단계에서 사용자가 **개별 제외/포함**(`textExcluded`, `excludedImageIndices`)할 수 있도록 store에 보관.

**대안 고려:**
- **SheetJS (xlsx)** — 경량이나 스타일·셀 병합 대응이 취약
- **pdfjs** — PDF 업로드는 현재 범위 외 (샘플 `Prompt_0417_meeting.pdf`는 회의 자료로만 사용)
- **Formidable / Multer** — Next App Router의 Web-standard `FormData` API로 충분

**선택 이유:** ExcelJS는 셀 스타일·병합·수식 처리 우수, JSZip은 XLSX(= zip 컨테이너) 내부 media 추출에 최적.

---

## 9. UI/UX 유틸

| 패키지 | 버전 | 용도 |
|---|---|---|
| `lucide-react` | `^1.7.0` | 아이콘 (Sparkles, Database, Upload, Wrench 등) |
| `sonner` | `^2.0.7` | Toast 알림 (우측 하단, dark 커스텀) |
| `nanoid` | `^5.1.7` | 클라이언트 사이드 unique ID (메시지·프롬프트·개선 이력) |

**대안 고려:**
- 아이콘: **Heroicons / Radix Icons** — lucide가 종류 수와 tree-shaking 이점으로 우위
- 토스트: **react-hot-toast** — 유사한 API이나 sonner가 React 19·Next 16 호환성과 스택 애니메이션 우수
- ID: **uuid v4** — 22자 vs nanoid 21자, nanoid가 URL-safe + 성능 우위

---

## 10. 빌드·개발 도구

- **ESLint 9** + `eslint-config-next 16.2.2` (flat config: `eslint.config.mjs`)
- **PostCSS** (`postcss.config.mjs`) — Tailwind v4 플러그인만 등록
- **TypeScript** — `tsconfig.json` strict, `.next` 빌드 산출물에 `next-env.d.ts` 자동 생성
- 스크립트 (`package.json`):
  - `dev` : `next dev`
  - `build` : `next build`
  - `start` : `next start`
  - `lint` : `eslint`

---

## 11. 환경 변수 (`.env.local`)

```bash
# OpenAI — 텍스트 생성 + Vision fallback
OPENAI_API_KEY=sk-...

# Gemini — Vision 1순위
GEMINI_API_KEY=AIza...

# Database (사내 MySQL)
DB_HOST=192.168.220.222
DB_PORT=3306
DB_USER=root
DB_PASSWORD=***
DB_NAME=orchestrator

# 사내 KB / Orchestrator (서로 다른 포트)
ORCHESTRATOR_URL=http://192.168.220.222:9002    # KB 등
COMPANY_INFO_URL=http://192.168.220.222:3030    # 회사 정보 조회
```

- `.gitignore`로 `.env.local` 제외
- 미설정 시 `src/lib/db.ts`의 기본값 fallback (개발 편의)
- 테스트 전용: `.env.test.local` (별도 DB 분리), `OPENAI_MOCK=1` (Playwright)

---

## 12. 아키텍처 요약 — 스택 간 연동 흐름

```
┌───────────────────────── Client (Browser) ────────────────────────────────┐
│  /  → 통합 워크스페이스 (3열)        /legacy → 구 3탭 UI                 │
│  React 19 + Zustand (6 stores) + next-themes (dark default)               │
│  Tailwind v4 (semantic tokens) · Monaco Editor · react-dropzone · sonner  │
└───────────────┬──────────────────────────────────────────────────────────┘
                │ fetch / SSE
                ▼
┌────────────── Next.js 16 Route Handlers (src/app/api) ────────────────────┐
│ /upload         → ExcelJS + JSZip + analyzeImageWithGemini               │
│ /analyze-image  → analyzeImageWithGemini (Gemini → OpenAI fallback)      │
│ /generate       → OpenAI gpt-4o (json_schema, 8영역)                     │
│ /improve        → OpenAI gpt-4o + diff                                   │
│ /chat           → OpenAI gpt-4o (stream) → ReadableStream                │
│ /prompts        → mysql2 pool (strict no-overwrite, 4-row tx)            │
│ /companies      → cstm_prmt_info DISTINCT 집계 (사이드바)                │
│ /company-info   → 사내 COMPANY_INFO_URL 프록시 (회사명 조회)             │
│ /kb, /kb-file   → ORCHESTRATOR_URL 프록시                                │
│ /codes, /llm-config, /health → mysql2                                    │
└───────────────┬───────────────┬───────────────┬───────────────┬─────────┘
                │               │               │               │
                ▼               ▼               ▼               ▼
         OpenAI API      Gemini API      MySQL          사내 KB / CompanyInfo
        (gpt-4o,        (gemini-2.5-    (.220.222       (.220.222 :9002 / :3030)
         gpt-5 vision)   flash)          :3306)

서버 사이드 부산물:
  logs/app-YYYY-MM-DD.log  (logger.ts — 모든 route의 [error]/[warn]/[info])
```

**헬스체크:** 클라이언트에서 30초 간격 `/api/health` 폴링 → Header 우측 "DB 연결됨/실패" 뱃지.

---

## 13. 디렉터리 구조

```
wc-prompt-studio/
├── src/
│   ├── app/
│   │   ├── layout.tsx, page.tsx (= 통합 워크스페이스), globals.css
│   │   ├── legacy/page.tsx                # 구 3탭 UI 보존
│   │   └── api/
│   │       ├── analyze-image/  chat/  codes/{map,tree}/
│   │       ├── generate/  health/  improve/  kb/  kb-file/
│   │       ├── llm-config/  prompts/[id]/  upload/
│   │       ├── companies/  company-info/  regions/   ← 통합 워크스페이스용
│   ├── components/
│   │   ├── workspace/                     # /  통합 워크스페이스 (3열)
│   │   │   ├── workspace-shell.tsx, company-sidebar.tsx
│   │   │   ├── workflow-panel.tsx, center-panel.tsx, idle-panel.tsx
│   │   │   ├── preview-chat-panel.tsx, management-panel.tsx
│   │   │   ├── step-card.tsx, step-nav.tsx
│   │   │   └── steps/{setup,source,analysis,regions,apply}-step.tsx
│   │   ├── auto/{chat,prompt,upload}/     # /legacy 자동 생성 탭
│   │   ├── editor/                        # /legacy DB 관리 탭
│   │   ├── structuring/{chat,lib/renderers}/  # 8영역 폼 (양 라우트 공유)
│   │   ├── layout/header.tsx
│   │   ├── theme-{provider,toggle}.tsx, themed-toaster.tsx
│   ├── hooks/                             # useCompanyName, useChangeDetection 등
│   ├── lib/                               # apply-prompt, prompt-codes, gemini, openai-vision, logger 등
│   ├── stores/                            # 6개 Zustand 스토어
│   └── types/                             # chat, editor, prompt, structuring, upload
├── tests/{unit,integration,e2e,setup}/    # Vitest + Playwright + MSW
├── scripts/                               # check-bundle-secrets, db-cleanup-test-rows 등
├── logs/                                  # app-YYYY-MM-DD.log (gitignore)
├── prompt-source/    # 고객사 원본 xlsx 샘플
├── prompt-example/   # 완성 프롬프트 txt 샘플
├── docs/unified-workspace-plan.md  # 통합 워크스페이스 설계 + 진행 상태
├── AGENTS.md         # Next 16 breaking changes 규정
├── README.md, CLAUDE.md, STACK.md
└── package.json
```

---

## 14. 스택 전체 요약표

| 레이어 | 기술 | 버전 |
|---|---|---|
| Runtime | Node.js / TypeScript | Node 20+ / TS 5 |
| Framework | Next.js (App Router) | 16.2.2 |
| UI Library | React / React DOM | 19.2.4 |
| Styling | Tailwind CSS + tw-animate-css | v4 / 1.4 |
| Theming | next-themes (dark default) | 0.4.6 |
| State | Zustand | 5.0.12 |
| Validation | zod / ajv | 4.3.6 / 8.18 |
| LLM (text) | OpenAI SDK (gpt-4o) | 6.33.0 |
| LLM (vision 1차) | Gemini SDK (gemini-2.5-flash) | 0.24.1 |
| LLM (vision fallback) | OpenAI (gpt-5) | 6.33.0 |
| Database | mysql2 (Pool) | 3.20.0 |
| Editor | @monaco-editor/react | 4.7.0 |
| File | exceljs / jszip / react-dropzone | 4.4 / 3.10 / 15.0 |
| UX | lucide-react / sonner / nanoid | 1.7 / 2.0.7 / 5.1.7 |
| Test | Vitest / Playwright / MSW / @testing-library | 4.1 / 1.59 / 2.13 / 16.3 |
| Lint | ESLint + eslint-config-next | 9 / 16.2.2 |
| Logging | 자체 file logger (`logs/app-YYYY-MM-DD.log`) | — |

---

## 15. 로깅 (Server file logger)

`src/lib/logger.ts` — Next route handler 전반에서 사용.

```ts
logger.info("message", optionalExtra)
logger.warn("message", err)
logger.error("message", err)
```

- 한 줄 형식: `2026-04-27T03:58:47.266Z [ERROR] [upload] image analysis failed Error: ...`
- 출력처: ① `logs/app-YYYY-MM-DD.log` 일자별 파일, ② 터미널 (`console.error`/`warn`/`log`)
- 파일 쓰기 실패는 swallow (요청 처리 자체가 깨지지 않게)
- 클라이언트에서 import 금지 — `node:fs` 사용. 추후 `/api/log` 엔드포인트로 client → server 통합 가능.

---

## 16. 테마 시스템 (next-themes)

- `src/components/theme-provider.tsx` 가 `<html>`에 클래스 주입(`class="dark"` 등). `<html lang="ko" suppressHydrationWarning>` 로 hydration 경고 회피.
- 헤더 우측 `theme-toggle.tsx` 버튼 — light / dark / system 순환.
- 시맨틱 토큰을 `globals.css`에 light/dark 모두 정의 (`--background`, `--foreground`, `--primary`, `--muted`, `--destructive`, `--ring` 등). 컴포넌트는 `bg-background text-foreground` 같은 의미 토큰만 사용 → 테마 토글이 자동 반영.
- Toaster (`themed-toaster.tsx`)도 `useTheme()` 으로 테마 동기화.
