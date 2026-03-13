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

### 2. 패키지 설치 및 환경 변수 설정
```bash
# 의존성 설치 및 Contracts 공용 패키지 최초 빌드 (매우 중요!)
pnpm install
pnpm --filter @codinator/contracts run build

# 각 앱의 .env 파일 생성
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/ai/.env.example apps/ai/.env
```
---

### 3. 실행 명령어

```bash

# 로컬 DB(PostgreSQL) 실행
docker compose -f infra/docker/compose.yaml -f infra/docker/compose.dev.yaml up -d

# 서버 실행하기
pnpm run dev

# AI 서버(FastAPI) 별도 실행 방법
cd apps/ai
python -m venv .venv
# 가상환경 활성화 (Windows)
.\.venv\Scripts\activate 
# 가상환경 활성화 (Mac/Linux)
source .venv/bin/activate

pip install -r requirements.txt
pnpm run dev

```