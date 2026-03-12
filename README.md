# [cite_start]👕 Codinator (코디네이터) [cite: 1]

[cite_start]얼굴이 아닌 룩 자체를 익명으로 평가받고 피드백을 통해 스타일을 개선하는 패션 피드백 플랫폼입니다. [cite: 1]

## 🛠 기술 스택
- **Web:** React, TypeScript, Vite, Tailwind CSS
- **API:** Node.js, NestJS, Prisma, PostgreSQL
- **AI API:** Python, FastAPI
- **Monorepo:** pnpm workspace, Turborepo
- **Infra:** Docker

---

## 🚀 로컬 개발 환경 세팅 (Getting Started)

새로 저장소를 Clone 받았다면 아래 순서대로 실행해 주세요.

### 1. 필수 설치 프로그램
- [Node.js](https://nodejs.org/) (v18 이상)
- [pnpm](https://pnpm.io/installation) (`npm install -g pnpm`)
- [Python](https://www.python.org/) (v3.10 이상)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

### 2. 패키지 설치 및 환경 변수 설정
```bash
# 1. 의존성 패키지 설치
pnpm install

# 2. 각 폴더의 .env 설정 (미리 준비된 example 복사)
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/ai/.env.example apps/ai/.env