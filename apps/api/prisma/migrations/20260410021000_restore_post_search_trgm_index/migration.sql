CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "post_search_index_search_text_trgm_idx"
ON "post_search_index"
USING GIN ("search_text" gin_trgm_ops);
