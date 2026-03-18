# 👕 Codinator (코디네이터)

얼굴이 아닌 룩 자체를 익명으로 평가받고 피드백을 통해 스타일을 개선하는 패션 피드백 플랫폼입니다.

## 🛠 기술 스택

- **Web:** React, TypeScript, Vite, Tailwind CSS
- **API:** Node.js, NestJS, Prisma, PostgreSQL
- **AI API:** Python, FastAPI
- **Monorepo:** pnpm workspace, Turborepo

---

## 🚀 팀원 로컬 개발 세팅 가이드

처음 Clone을 받으셨다면 아래 순서대로 세팅을 진행해 주세요.

### 1. 필수 설치

- Node.js (v18+) / pnpm (`npm install -g pnpm`)
- Python (v3.10+)
- Docker Desktop

### 2. 패키지 설치 및 환경 변수 설정 (git bash에서 진행하세요!!!!!!!!!!!!!)

```bash
# 의존성 설치 및 Contracts 공용 패키지 최초 빌드 (매우 중요!)
pnpm install
pnpm --filter @codinator/contracts run build

# AI 서버(FastAPI) 별도 실행 방법
cd apps/ai
python -m venv .venv

# 가상환경 활성화 [경로 중요! (.venv) cd/apps/ai]
source .venv/Scripts/activate  # (cmd 사용).venv\Scripts\activate.bat
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000 #(^C 로 종료)
#deactivate (가상환경 종료 코드) -> 루트 폴더로 이동 (cd codinator)

# 각 앱의 .env 파일 생성
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/ai/.env.example apps/ai/.env
cp apps/mobile/.env.example apps/mobile/.env
```

---

### 3. 실행 명령어 (git bash에서 진행!!)

```bash

# 로컬 DB(PostgreSQL) 실행
docker compose -f infra/docker/compose.yaml -f infra/docker/compose.dev.yaml up -d

# 서버 실행하기
pnpm run dev



```

### 4. 수정 후 프로젝트 재시작

```bash

# #프로젝트 캐시 삭제
pnpm clearn
#프로젝트 캐시 삭제 및 서버 재구동
pnpm reset

```

Ctrl + Shift + P → Reset Ts
TypeScript: Restart TS Server (타입스크립트 서버 다시 시작)

### 5. 서버 구동 명령어

```bash

# 프로젝트 내의 모든 서비스(Web, API, Mobile, AI 등)를 한 번에 실행
turbo run dev

# 웹 프론트엔드(web) 환경만 단독으로 실행
pnpm dev:web

# NestJS 백엔드(api) 서버만 실행
pnpm dev:api

# 모바일 애플리케이션 환경만 따로 실행
pnpm dev:mobile

# AI 기능이 구현된 서버(주로 Python/FastAPI)만 단독으로 실행
pnpm dev:ai

# Codinator 프로젝트의 핵심 뼈대인 공통 타입(contracts), 백엔드(api), 웹(web) 세 가지만 묶어서 동시에 실행
pnpm dev:core


```

### 6. DB관련 명령어

자세한 명령어는 [DB 명령어 가이드](apps/api/prisma/README.md)를 참고
