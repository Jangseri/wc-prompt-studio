# wc-prompt-studio 배포 가이드

> **운영서버 전용 가이드** (개발서버 `192.168.220.223` 은 별도 환경)
> 사내 컨벤션: **빌드는 외부에서, 운영서버는 이미지 로드 + 실행만**.
> 운영은 **root 계정 단독 운영** — 명령 실행 전 대상 서버 / 경로 / 명령어 한 번 더 확인.

## 사전 요구사항

### 빌드 호스트 (예: 개발서버 `192.168.220.223` 또는 docker 깔린 아무 곳)
- Docker (BuildKit 권장)
- 본 리포지토리 git clone 가능
- 운영서버(`110.225`) 로 scp 가능

### 운영서버 (`192.168.110.225`)
- `root` 계정 접속
- **Docker Engine 20.10.x + docker-compose v1.24.1** (하이픈 명령, compose 파일 포맷 **v3.7** 까지 인식)
- 다음 서비스 접속 가능:
  - MySQL: `192.168.110.235:3306` (`orchestrator` DB)
  - 사내 Orchestrator (KB): `192.168.110.235:9002`
  - 사내 CompanyInfo: `http://192.168.110.235:3030/companyInfo`
- **외부 인터넷** (런타임용):
  - `api.openai.com` (텍스트 생성 + Vision fallback)
  - `generativelanguage.googleapis.com` (Vision 1차)

> 외부 인터넷이 막혀있으면 OpenAI/Gemini 호출이 실패합니다. 방화벽/프록시 정책 확인 필요.
> 운영서버에는 npm registry 접근이 필요 없음 (빌드 안 함).

---

## 배포 구조 (Layout B — artifact 방식)

```
/home/prompt-studio/
└── op/
    ├── docker-compose.yml             ← 이 리포의 op/docker-compose.yml
    ├── wc-prompt-studio-<sha>.tar.gz  ← docker save 산출물 (빌드 호스트에서 생성)
    ├── .env                           ← 운영 시크릿 + IMAGE_TAG
    └── logs/                          ← app-YYYY-MM-DD.log (자동 생성)
```

- 호스트 포트 **8999** → 컨테이너 3000
- 컨테이너 user: **1001:1001** (이미지 내 nextjs)
- 컨테이너 IP: **172.24.18.2** (네트워크 `172.24.18.0/24`, diva-rag-manager 의 `172.24.17.0/24` 회피)
- 모든 명령은 `/home/prompt-studio/op/` 안에서 실행

---

## 최초 배포

### A. 빌드 호스트 (220.223 등) 에서

```bash
# 1. clone & 빌드
git clone https://github.com/Jangseri/wc-prompt-studio.git
cd wc-prompt-studio

# git short sha 를 태그로 사용
SHA=$(git rev-parse --short HEAD)
docker build -f docker/Dockerfile -t wc-prompt-studio:$SHA .

# 2. 이미지를 tar.gz 로 저장
docker save wc-prompt-studio:$SHA | gzip > wc-prompt-studio-$SHA.tar.gz
ls -lh wc-prompt-studio-$SHA.tar.gz

# 3. 운영서버로 전송 (compose 파일도 같이)
scp wc-prompt-studio-$SHA.tar.gz root@192.168.110.225:/home/prompt-studio/op/
scp op/docker-compose.yml root@192.168.110.225:/home/prompt-studio/op/
echo "Tag for .env: IMAGE_TAG=$SHA"
```

### B. 운영서버 (110.225) 에서

```bash
ssh root@192.168.110.225

# 1. 디렉터리 준비 (최초 1회)
mkdir -p /home/prompt-studio/op/logs
chown 1001:1001 /home/prompt-studio/op/logs
cd /home/prompt-studio/op

# 2. .env 작성
vi .env
```

`.env` 내용:
```env
IMAGE_TAG=<빌드 호스트에서 출력된 SHA, 예: abc1234>
NODE_ENV=production

OPENAI_API_KEY=...
GEMINI_API_KEY=...

DB_HOST=192.168.110.235
DB_PORT=3306
DB_NAME=orchestrator
DB_USER=...
DB_PASSWORD=...

# KB Orchestrator / CompanyInfo
# 키 이름은 .env.production.example 참고
ORCHESTRATOR_URL=http://192.168.110.235:9002
COMPANY_INFO_URL=http://192.168.110.235:3030/companyInfo
```

권한 제한:
```bash
chmod 600 .env
```

```bash
# 3. 이미지 로드
docker load -i wc-prompt-studio-<sha>.tar.gz
docker images | grep wc-prompt-studio    # 태그 확인

# 4. 사전 검증 (compose 파일 파싱)
docker-compose -f docker-compose.yml config

# 5. 기동
docker-compose -f docker-compose.yml up -d
docker-compose -f docker-compose.yml ps

# 6. 헬스체크
curl http://localhost:8999/api/health
docker-compose -f docker-compose.yml logs -f --tail 100
```

정상 응답 (DB 연결 OK):
```json
{ "connected": true }
```

브라우저 접속: `http://192.168.110.225:8999`

---

## 업데이트 배포

### 빌드 호스트
```bash
cd wc-prompt-studio
git pull
SHA=$(git rev-parse --short HEAD)
docker build -f docker/Dockerfile -t wc-prompt-studio:$SHA .
docker save wc-prompt-studio:$SHA | gzip > wc-prompt-studio-$SHA.tar.gz
scp wc-prompt-studio-$SHA.tar.gz root@192.168.110.225:/home/prompt-studio/op/

# compose 파일이 변경되었으면 같이 보냄
scp op/docker-compose.yml root@192.168.110.225:/home/prompt-studio/op/
```

### 운영서버
```bash
cd /home/prompt-studio/op
docker load -i wc-prompt-studio-<새-sha>.tar.gz

# .env 의 IMAGE_TAG 를 새 SHA 로 갱신
sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=<새-sha>/" .env

# 재기동 (이미지가 바뀌면 자동으로 컨테이너 재생성)
docker-compose -f docker-compose.yml up -d

# 검증
docker-compose -f docker-compose.yml ps
curl http://localhost:8999/api/health
```

> 디스크 정리: 오래된 tar.gz / 이미지는 주기적으로 제거.
> `docker image prune` 으로 dangling 이미지 정리.

---

## 운영 명령어

> 모든 명령은 `/home/prompt-studio/op/` 에서 실행.

### 컨테이너 관리

```bash
docker-compose -f docker-compose.yml ps
docker-compose -f docker-compose.yml stop
docker-compose -f docker-compose.yml restart
docker-compose -f docker-compose.yml down              # 컨테이너 + 네트워크 제거 (볼륨 유지)
docker-compose -f docker-compose.yml up -d             # 다시 기동
```

### 로그 확인

```bash
# Docker stdout (json-file driver, 10MB×7 rotation)
docker-compose -f docker-compose.yml logs -f
docker-compose -f docker-compose.yml logs --tail 100

# 애플리케이션 자체 로그 (server-side file logger)
tail -f logs/app-$(date +%Y-%m-%d).log

# 에러만
grep '\[ERROR\]' logs/app-*.log

# 특정 회사 관련 로그
grep 'company_seq=12345' logs/app-*.log
```

### 헬스체크 모니터링

```bash
watch -n 10 'curl -s http://localhost:8999/api/health'
```

---

## 문제 해결

### 컨테이너가 시작 안 됨

```bash
docker-compose -f docker-compose.yml logs wc-prompt-studio
```

주요 원인:
- `.env` 의 `IMAGE_TAG` 가 `docker images` 에 없는 태그 → `docker load` 다시
- `.env` 누락/오타 → `cp` 후 채우기
- DB 접속 실패 → `DB_HOST`/`DB_PASSWORD` 확인, `192.168.110.235:3306` 방화벽 확인
- 포트 8999 점유 → `docker-compose.yml` 의 `ports` 변경
- 서브넷 `172.24.18.0/24` 충돌 → 다른 컨테이너가 이미 사용 중인지 `docker network ls` 후 inspect
- 권한 문제 → `chown -R 1001:1001 logs/`
- `Version in "./docker-compose.yml" is unsupported` → compose 파일 `version` 이 3.7 인지 확인

### 로그 파일이 안 쌓임

평소 정상 동작 중엔 `logs/` 가 비어있는 게 정상 (logger 가 `error` / `warn` 만 씀). 의심되면 강제 트리거:

```bash
curl -i -X POST http://localhost:8999/api/upload     # 빈 multipart → logger.error
ls -la logs/
tail logs/app-$(date +%Y-%m-%d).log
```

위 호출 후에도 파일이 안 생기면 권한 문제:

```bash
ls -la logs/                          # 소유자 root 면 원인 확정
chown -R 1001:1001 logs/
docker-compose -f docker-compose.yml restart
```

### 이미지 분석 실패

```bash
curl -I https://api.openai.com
curl -I https://generativelanguage.googleapis.com
```

둘 다 막혀 있으면 vision 동작 불가. 사내 프록시 사용 시 컨테이너에 `HTTPS_PROXY` 환경변수 추가 필요.

### DB 연결 실패

```bash
docker-compose -f docker-compose.yml exec wc-prompt-studio sh -c "nc -zv 192.168.110.235 3306"
```

운영서버(225)에서 DB(235) 로 닿는지 사내망 정책 확인.

### 디스크 사용량

```bash
docker system df
du -sh logs/
du -sh wc-prompt-studio-*.tar.gz

# 오래된 산출물 정리 (최근 2개만 남기기)
ls -t wc-prompt-studio-*.tar.gz | tail -n +3 | xargs -r rm

# 7일 이전 로그 정리
find logs/ -name "app-*.log" -mtime +7 -delete

# dangling 이미지 정리
docker image prune
```

---

## 보안 체크리스트

- [ ] `.env` 가 git 에 커밋되지 않았는지 (`.gitignore` 에 `.env*` 포함됨)
- [ ] `chmod 600 .env` 로 권한 제한
- [ ] `OPENAI_API_KEY`, `GEMINI_API_KEY`, `DB_PASSWORD` 는 운영용으로 교체
- [ ] 서버 방화벽에서 8999 포트는 필요한 대역만 허용 (사내 전용)
- [ ] `logs/` 에 민감정보 (프롬프트 본문, 회사 식별자 등) 기록되는지 주기 점검
- [ ] HTTPS 필요 시 nginx 리버스 프록시 추가
- [ ] root 단독 운영 — 위험 명령(`down -v`, `rm -rf`, `prune -a` 류) 실행 전 한 번 더 확인

---

## nginx 리버스 프록시 (선택)

HTTPS 또는 도메인이 필요하면 호스트의 nginx 에서 8999 로 프록시.

```nginx
server {
    listen 443 ssl;
    server_name prompt-studio.example.com;

    ssl_certificate     /etc/ssl/...crt;
    ssl_certificate_key /etc/ssl/...key;

    # SSE (chat 스트리밍) 호환
    proxy_buffering off;

    location / {
        proxy_pass http://127.0.0.1:8999;
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
| 로그 | `/home/prompt-studio/op/logs/` | 주 1회 (감사용) |
| 직전 이미지 tar.gz | `/home/prompt-studio/op/wc-prompt-studio-<sha>.tar.gz` | 롤백용 — 최소 2개 유지 |

### DB 백업 예시

```bash
mysqldump -h 192.168.110.235 -u root -p \
  orchestrator cstm_prmt_info > backup-cstm_prmt_info-$(date +%Y%m%d).sql
```

---

## 롤백

직전 이미지 tar.gz 가 운영서버에 남아있다면 즉시 롤백 가능:

```bash
cd /home/prompt-studio/op

# 1. 이전 sha 확인
ls -t wc-prompt-studio-*.tar.gz

# 2. .env 의 IMAGE_TAG 를 이전 sha 로
sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=<이전-sha>/" .env

# 3. 재기동 (load 는 이미 되어있어야 함; 아니면 docker load -i 먼저)
docker-compose -f docker-compose.yml up -d

# 4. 검증
curl http://localhost:8999/api/health
```

운영서버에 이전 이미지가 없다면 빌드 호스트에서 해당 git commit 으로 체크아웃 → 위 "최초 배포 A" 단계 반복.
