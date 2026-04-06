# AI Merge Test Checklist

## 1. Python AI 서버 의존성 설치
```bash
cd apps/ai
source .venv/Scripts/activate
pip install -r requirements.txt
```

## 2. AI 서버 환경값 확인
- `AI_PORT=8000`
- `AI_PROCESS_TIMEOUT_SECONDS=60`
- Hugging Face 모델 다운로드 가능 환경인지 확인

## 3. AI 서버 실행
```bash
cd apps/ai
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 4. direct analyze-image 확인
```bash
curl -X POST "http://127.0.0.1:8000/api/v2/analyze-image" \
  -F "image=@apps/api/uploads/seeds/posts/ranked-post-1.jpg"
```

성공 기준:
- `success: true`
- `analysis.caption` 문자열 존재
- `analysis.garments` 배열 존재
- `embeddings.outfit.vector` 존재

## 5. Nest API 환경값 확인
- `AI_SERVER_BASE_URL=http://127.0.0.1:8000/api/v2`
- `AI_SERVER_TIMEOUT_MS=60000`

## 6. Nest API 실행
```bash
cd apps/api
pnpm install
pnpm prisma generate
pnpm dev
```

## 7. proxy analyze-image 확인
```bash
curl -X POST "http://127.0.0.1:3000/api/v2/ai/analyze-image" \
  -F "image=@apps/api/uploads/seeds/posts/ranked-post-1.jpg"
```

성공 기준:
- direct 응답과 동일하게 `success: true`
- `analysis.caption`, `analysis.garments`, `embeddings` 포함

## 8. blur-face 회귀 확인
```bash
curl -X POST "http://127.0.0.1:3000/api/v2/ai/blur-face" \
  -F "image=@apps/api/uploads/seeds/posts/ranked-post-1.jpg" \
  --output blurred.jpg -i
```

성공 기준:
- 200 OK
- `X-AI-Faces-Detected` 헤더 존재
- 파일 저장됨

## 9. 업로드 흐름 회귀 확인
Swagger 또는 프론트에서 `/api/v2/uploads/post-image` 호출

성공 기준:
- `originalImageUrl`
- `processedImageUrl`
- `blurMethod`
- `aiBlurStatus`
반환

## 10. 대표 실패 원인
- `AI_IMAGE_ANALYSIS_FAILED` → AI 서버 미실행, URL 불일치, 타임아웃
- `404 /api/v2/analyze-image` → AI router 머지 누락
- `ModuleNotFoundError` → requirements 설치 누락
- `Hugging Face / model download error` → 네트워크 또는 토큰 환경 문제
