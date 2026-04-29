## 패키지 설치 및 초기 세팅

```bash
pnpm --filter @codinator/api add bcryptjs
cp apps/api/.env.example apps/api/.env
pnpm --filter @codinator/api run prisma:generate

```

## 마이그레이션 작업 방식
```bash

#Codinator V3는 Prisma가 직접 표현하지 못하는 수동 SQL(pg_trgm, partial unique, CHECK, HNSW 등)이 포함되어 있다. 따라서 migration은 아래 순서로 진행한다.

pnpm --filter @codinator/api exec prisma migrate dev --create-only --name expand_v3

# 생성된 apps/api/prisma/migrations/.../migration.sql을 직접 검토/수정한 뒤 적용한다.
pnpm --filter @codinator/api exec prisma migrate dev --name expand_v3

# 해당 내용 마이그레이션 파일이 생성 될 경우
-- CREATE INDEX "post_search_index_search_text_trgm_idx"
-- ON "post_search_index"
-- USING GIN ("search_text" gin_trgm_ops);

pnpm --filter @codinator/api run prisma:reset

# Seed 실행
pnpm --filter @codinator/api run prisma:seed

# Prisma Studio
pnpm --filter @codinator/api run prisma:studio

##자주 쓰는 명령어
pnpm --filter @codinator/api run prisma:generate
pnpm --filter @codinator/api exec prisma migrate dev --create-only --name expand_v3
pnpm --filter @codinator/api exec prisma migrate dev --name expand_v3
pnpm --filter @codinator/api run prisma:reset
pnpm --filter @codinator/api run prisma:studio

```

### 마이그레이션 수동 추가

-- 1. EXTENSION 추가
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- (이 위치에 각 테이블 생성문 실행) --


-- 2. ALTER TABLE / CHECK CONSTRAINT
-- ImageVector scope / garment 체크 제약
ALTER TABLE "image_vectors"
ADD CONSTRAINT "image_vectors_scope_garment_check"
CHECK (
  ("target_scope" = 'OUTFIT' AND "garment_id" IS NULL)
  OR
  ("target_scope" = 'GARMENT' AND "garment_id" IS NOT NULL)
);

-- Ranking READY 상태면 generated_at 필수
ALTER TABLE "rankings"
ADD CONSTRAINT "rankings_ready_requires_generated_at"
CHECK (
  "status" != 'READY' OR "generated_at" IS NOT NULL
);


-- 3. UNIQUE INDEX 및 비즈니스 로직 제약용 인덱스
-- 신고 제약 걸기
-- CREATE INDEX "user_reports_reporter_id_reported_user_id_status_idx" ON "user_reports"("reporter_id", "reported_user_id", "status");  --해당 코드 밑에 복붙

CREATE UNIQUE INDEX "user_reports_pending_unique" ON "user_reports" ("reporter_id", "reported_user_id") WHERE "status" = 'PENDING';

-- current analysis partial unique
CREATE UNIQUE INDEX uq_image_analysis_runs_current
ON image_analysis_runs (image_asset_id, purpose)
WHERE is_current = true;

-- 4. 성능용 인덱스 (HNSW / GIN / TRGM)
-- vector ANN index
CREATE INDEX idx_image_vectors_outfit_hnsw
ON image_vectors
USING hnsw (vector vector_cosine_ops)
WHERE target_scope = 'OUTFIT' AND is_active = true;

CREATE INDEX idx_image_vectors_garment_hnsw
ON image_vectors
USING hnsw (vector vector_cosine_ops)
WHERE target_scope = 'GARMENT' AND is_active = true;

-- searchText용 full-text / trigram 인덱스
CREATE INDEX "post_search_index_search_text_tsv_idx"
ON "post_search_index"
USING GIN (to_tsvector('simple', coalesce("search_text", '')));

CREATE INDEX "post_search_index_search_text_trgm_idx"
ON "post_search_index"
USING GIN ("search_text" gin_trgm_ops);
