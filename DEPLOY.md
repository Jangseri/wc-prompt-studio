# wc-prompt-studio 배포 가이드

## 사전 요구사항

- 서버: **192.168.220.223** (`seri` 계정, sudo 가능)
- Docker, docker-compose 설치됨
- 다음 서비스 접속 가능:
  - MySQL: `192.168.220.222:3306` (`orchestrator` DB)
  - 사내 Orchestrator (KB): `192.168.220.222:9002`
  - 사내 CompanyInfo: `192.168.220.222:3030`
- **외부 인터넷**:
  - `api.openai.com` (텍스트 생성 + Vision fallback)
  - `generativelanguage.googleapis.com` (Vision 1차)

> 외부 인터넷이 막혀있으면 OpenAI/Gemini 호출이 실패합니다. 방화벽/프록시 정책 확인 필요.

---

## 배포 구조

```
/data/wc/
└── prompt-studio/                ← 프로젝트 루트 (여기서 docker compose 실행)
    ├── docker-compose.yml
    ├── docker/Dockerfile
    ├── .env                      ← 실제 키/비밀번호 (git 제외)
    └── logs/                     ← app-YYYY-MM-DD.log (자동 생성)
```

호스트 포트 **7999** → 컨테이너 3000.
(diva-rag-manager 가 3000 점유 중이라 분리)

---

## 최초 배포 절차

### 1. 서버 접속 + 디렉터리 준비

```bash
ssh seri@192.168.220.223

sudo mkdir -p /data/wc
sudo chown -R seri:seri /data/wc
```

### 2. 프로젝트 파일 배치

```bash
cd /data/wc
git clone <repository-url> prompt-studio
cd prompt-studio

# 또는 rsync (로컬 → 서버)
# rsync -av --exclude node_modules --exclude .next --exclude logs \
#   ./ seri@192.168.220.223:/data/wc/prompt-studio/
```

### 3. 환경변수 파일 생성

```bash
cp .env.production.example .env
chmod 600 .env
vi .env
```

`.env` 에 채울 항목:
- `OPENAI_API_KEY` — 텍스트 생성 + Vision fallback
- `GEMINI_API_KEY` — Vision 1차 (없어도 OpenAI 단독으로 동작)
- `DB_PASSWORD` — MySQL `orchestrator` DB
- 나머지는 `.env.production.example` 의 default 값 그대로 사용

### 4. 로그 디렉터리 사전 생성 (권한 충돌 방지)

`docker compose` 가 `./logs` 를 자동 생성하면 **root 소유**가 되어, 컨테이너의
`1007:1009` 유저가 쓰지 못합니다 (logger 가 silent fail). 미리 만들고 소유자
지정.

```bash
mkdir -p logs
chown 1007:1009 logs
# (이미 root 소유로 만들어진 상태면 sudo chown -R 1007:1009 logs)
```

> UID/GID 는 `docker-compose.yml` 의 `user:` 값과 같아야 합니다.

### 5. 빌드 + 실행

```bash
docker compose up -d --build

# 빌드 + 부팅 진행 로그
docker compose logs -f
```

빌드는 multi-stage Dockerfile 기준 **3–6분** 걸립니다 (deps → build → runner).

### 6. 동작 확인

```bash
# 헬스체크
curl http://localhost:7999/api/health
```

정상 응답 (DB 연결 OK):
```json
{ "ok": true, ... }
```

브라우저 접속:
```
http://192.168.220.223:7999
```

---

## 업데이트 배포

```bash
cd /data/wc/prompt-studio

# 1. 최신 코드 받기
git pull

# 2. 재빌드 + 재시작
docker compose up -d --build

# 3. 로그 확인
docker compose logs -f --tail 100
```

---

## 운영 명령어

### 컨테이너 관리

```bash
# 실행 상태 확인
docker compose ps

# 중지
docker compose stop

# 재시작
docker compose restart

# 중지 + 컨테이너 제거
docker compose down

# 완전 재빌드
docker compose up -d --build --force-recreate
```

### 로그 확인

```bash
# Docker stdout (json-file driver, 10MB×7 rotation)
docker compose logs -f
docker compose logs --tail 100

# 애플리케이션 자체 로그 (server-side file logger)
tail -f logs/app-$(date +%Y-%m-%d).log

# 에러만
grep '\[ERROR\]' logs/app-*.log

# 특정 회사 관련 로그
grep 'company_seq=12345' logs/app-*.log
```

### 헬스체크 모니터링

```bash
watch -n 10 'curl -s http://localhost:7999/api/health'
```

---

## 문제 해결

### 컨테이너가 시작 안 됨

```bash
docker compose logs wc-prompt-studio
```

주요 원인:
- `.env` 파일 없음 → `cp .env.production.example .env` 후 채우기
- DB 접속 실패 → `DB_HOST`/`DB_PASSWORD` 확인, `192.168.220.222:3306` 방화벽 확인
- 포트 7999 이미 사용 중 → `docker-compose.yml` 의 `ports` 변경
- 볼륨 권한 문제 → `sudo chown -R 1007:1009 logs/` (또는 compose 의 `user:` 값에 맞춰)

### 로그 파일이 안 쌓임

먼저 logger 가 호출됐는지 확인. 우리 logger 는 거의 `error` / `warn` 만 쓰므로
**평소 정상 동작 중엔 logs/ 가 비어있는 게 정상**입니다. 의심되면 강제 트리거:

```bash
# 빈 multipart 업로드 → /api/upload catch → logger.error
curl -i -X POST http://localhost:7999/api/upload
ls -la logs/                                   # app-YYYY-MM-DD.log 생기면 정상
tail logs/app-$(date +%Y-%m-%d).log
```

위 호출 후에도 파일이 안 생기면 **권한 문제**:

```bash
ls -la logs/                                   # 소유자가 root 면 원인 확정
sudo chown -R 1007:1009 logs/
docker compose restart
```

### 이미지 분석 실패

```bash
# 외부 인터넷 확인
curl -I https://api.openai.com
curl -I https://generativelanguage.googleapis.com
```

둘 다 막혀 있으면 vision 동작 불가. 사내 프록시 사용 시 컨테이너에 `HTTPS_PROXY` 환경변수 추가 필요.

### DB 연결 실패

```bash
# 컨테이너에서 DB 도달 가능 여부 (mysql 클라이언트 없으면 nc)
docker compose exec wc-prompt-studio sh -c "nc -zv 192.168.220.222 3306"
```

223 서버에서 222 DB 로 닿는지 사내망 정책 확인.

### 디스크 사용량

```bash
# Docker 이미지/볼륨/로그 용량
docker system df

# 애플리케이션 로그 용량
du -sh logs/

# 7일 이전 로그 정리 (필요 시)
find logs/ -name "app-*.log" -mtime +7 -delete
```

---

## 보안 체크리스트

- [ ] `.env` 가 git 에 커밋되지 않았는지 (`.gitignore` 에 `.env*` 포함됨)
- [ ] `chmod 600 .env` 로 권한 제한
- [ ] `OPENAI_API_KEY`, `GEMINI_API_KEY`, `DB_PASSWORD` 는 운영용으로 교체
- [ ] 서버 방화벽에서 7999 포트는 필요한 대역만 허용 (사내 전용)
- [ ] `logs/` 에 민감정보 (프롬프트 본문, 회사 식별자 등) 기록되는지 주기 점검
- [ ] HTTPS 필요 시 nginx 리버스 프록시 추가

---

## nginx 리버스 프록시 (선택)

HTTPS 또는 도메인이 필요하면 호스트의 nginx 에서 7999 로 프록시.

```nginx
server {
    listen 443 ssl;
    server_name prompt-studio.example.com;

    ssl_certificate     /etc/ssl/...crt;
    ssl_certificate_key /etc/ssl/...key;

    # SSE (chat 스트리밍) 호환
    proxy_buffering off;

    location / {
        proxy_pass http://127.0.0.1:7999;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection        "";

        # Excel 업로드 대비 (기본 1MB)
        client_max_body_size 50M;
    }
}
```

---

## 백업 / 복구

### 백업 대상

| 항목 | 경로 | 주기 |
|------|------|------|
| DB | MySQL `orchestrator.cstm_prmt_info` | 매일 |
| 로그 | `/data/wc/prompt-studio/logs/` | 주 1회 (감사용) |

### DB 백업 예시

```bash
mysqldump -h 192.168.220.222 -u root -p \
  orchestrator cstm_prmt_info > backup-cstm_prmt_info-$(date +%Y%m%d).sql
```

---

## 롤백

```bash
cd /data/wc/prompt-studio

# 1. 이전 커밋으로
git log --oneline -10
git checkout <이전-commit-sha>

# 2. 재빌드 + 재시작
docker compose up -d --build

# 3. 헬스체크
curl http://localhost:7999/api/health
```

브랜치 단위 롤백도 가능: `git checkout main` 등.
