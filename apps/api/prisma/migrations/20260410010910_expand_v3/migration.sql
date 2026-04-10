-- 1. EXTENSION 추가
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;


-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'SUPER_ADMIN', 'OPERATOR_ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('ACTIVE', 'HIDDEN', 'DELETED');

-- CreateEnum
CREATE TYPE "EvaluationStatus" AS ENUM ('OPEN', 'CLOSED', 'ENDED');

-- CreateEnum
CREATE TYPE "VoteChoice" AS ENUM ('LIKE', 'DISLIKE');

-- CreateEnum
CREATE TYPE "RankingPeriod" AS ENUM ('WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "RankingStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "GarmentCategory" AS ENUM ('TOP', 'BOTTOM', 'OUTER', 'SHOES', 'BAG', 'ACCESSORY', 'ETC');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('SPAM', 'ABUSE', 'INAPPROPRIATE', 'ETC');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AdminActionTargetType" AS ENUM ('POST', 'POST_REPORT', 'USER_REPORT', 'USER', 'USER_SANCTION');

-- CreateEnum
CREATE TYPE "AdminActionType" AS ENUM ('CREATED', 'RESOLVED', 'REJECTED', 'REOPENED', 'HIDDEN', 'UNHIDDEN', 'DELETED', 'RESTORED', 'SANCTION_UPDATED', 'SANCTION_ENDED', 'USER_STATUS_UPDATED');

-- CreateEnum
CREATE TYPE "ReportTargetType" AS ENUM ('POST_REPORT', 'USER_REPORT');

-- CreateEnum
CREATE TYPE "ReportHistoryActionType" AS ENUM ('CREATED', 'RESOLVED', 'REJECTED', 'REOPENED');

-- CreateEnum
CREATE TYPE "BlurMethod" AS ENUM ('NONE', 'AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "AiBlurStatus" AS ENUM ('NONE', 'PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "SocialProvider" AS ENUM ('GOOGLE', 'KAKAO', 'NAVER');

-- CreateEnum
CREATE TYPE "ThemeMode" AS ENUM ('LIGHT', 'DARK');

-- CreateEnum
CREATE TYPE "PushDevice" AS ENUM ('IOS', 'ANDROID', 'WEB');

-- CreateEnum
CREATE TYPE "PhoneVerificationPurpose" AS ENUM ('SIGN_UP', 'PHONE_CHANGE', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "PhoneVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'USED', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "SanctionType" AS ENUM ('TEMP_SUSPENSION', 'PERMANENT_BAN', 'POST_RESTRICTION');

-- CreateEnum
CREATE TYPE "ImageAssetSourceType" AS ENUM ('POST', 'SEARCH_QUERY');

-- CreateEnum
CREATE TYPE "ImageAnalysisPurpose" AS ENUM ('POST_INDEX', 'SEARCH_QUERY', 'REINDEX');

-- CreateEnum
CREATE TYPE "ImageAnalysisStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'SKIPPED', 'STALE');

-- CreateEnum
CREATE TYPE "ImageVectorScope" AS ENUM ('OUTFIT', 'GARMENT');

-- CreateEnum
CREATE TYPE "AiGarmentCategory" AS ENUM ('TOP', 'BOTTOM', 'OUTER', 'SHOES', 'BAG', 'ACCESSORY', 'DRESS', 'ETC');

-- CreateEnum
CREATE TYPE "SearchHistoryType" AS ENUM ('TEXT', 'IMAGE');

-- CreateEnum
CREATE TYPE "ImageSearchMode" AS ENUM ('FULL_OUTFIT', 'SINGLE_ITEM');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "nickname" VARCHAR(30) NOT NULL,
    "password_hash" VARCHAR(255),
    "gender" "Gender" NOT NULL,
    "birth_date" DATE NOT NULL,
    "phone_number" VARCHAR(20) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "refresh_token_hash" VARCHAR(255) NOT NULL,
    "device_name" VARCHAR(100),
    "user_agent" VARCHAR(500),
    "ip_address" VARCHAR(64),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_accounts" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "provider" "SocialProvider" NOT NULL,
    "provider_user_id" VARCHAR(100) NOT NULL,
    "provider_email" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_verifications" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "phone_number" VARCHAR(20) NOT NULL,
    "purpose" "PhoneVerificationPurpose" NOT NULL,
    "verification_code_hash" VARCHAR(255) NOT NULL,
    "status" "PhoneVerificationStatus" NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "verified_at" TIMESTAMP(3),
    "used_at" TIMESTAMP(3),
    "resend_count" INTEGER NOT NULL,
    "failed_count" INTEGER NOT NULL,
    "blocked_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "phone_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "theme" "ThemeMode" NOT NULL DEFAULT 'LIGHT',
    "push_enabled" BOOLEAN NOT NULL DEFAULT true,
    "service_push_enabled" BOOLEAN NOT NULL DEFAULT true,
    "marketing_push_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "push_token" VARCHAR(255) NOT NULL,
    "device_os" "PushDevice" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sanctions" (
    "id" SERIAL NOT NULL,
    "sanctioned_user_id" INTEGER NOT NULL,
    "processed_by_id" INTEGER NOT NULL,
    "type" "SanctionType" NOT NULL,
    "reason" VARCHAR(255) NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_sanctions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" SERIAL NOT NULL,
    "author_id" INTEGER NOT NULL,
    "content" VARCHAR(500) NOT NULL,
    "status" "PostStatus" NOT NULL DEFAULT 'ACTIVE',
    "published_at" TIMESTAMP(3),
    "hidden_at" TIMESTAMP(3),
    "hidden_reason" VARCHAR(255),
    "hidden_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_images" (
    "id" SERIAL NOT NULL,
    "post_id" INTEGER NOT NULL,
    "image_asset_id" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_outfits" (
    "id" SERIAL NOT NULL,
    "post_id" INTEGER NOT NULL,
    "category" "GarmentCategory" NOT NULL,
    "item_name" VARCHAR(100),
    "brand" VARCHAR(100),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_outfits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keywords" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "label" VARCHAR(50) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "keywords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_keywords" (
    "id" SERIAL NOT NULL,
    "post_id" INTEGER NOT NULL,
    "keyword_id" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_keywords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookmarks" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "post_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" SERIAL NOT NULL,
    "reporter_id" INTEGER NOT NULL,
    "post_id" INTEGER NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "description" VARCHAR(500),
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_id" INTEGER,
    "review_reason" VARCHAR(300),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_reports" (
    "id" SERIAL NOT NULL,
    "reporter_id" INTEGER NOT NULL,
    "reported_user_id" INTEGER NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "description" VARCHAR(500),
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_id" INTEGER,
    "review_reason" VARCHAR(300),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_action_logs" (
    "id" SERIAL NOT NULL,
    "admin_id" INTEGER NOT NULL,
    "target_type" "AdminActionTargetType" NOT NULL,
    "target_id" INTEGER NOT NULL,
    "action_type" "AdminActionType" NOT NULL,
    "reason" VARCHAR(300),
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_action_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_histories" (
    "id" SERIAL NOT NULL,
    "target_type" "ReportTargetType" NOT NULL,
    "target_id" INTEGER NOT NULL,
    "actor_id" INTEGER,
    "action_type" "ReportHistoryActionType" NOT NULL,
    "note" VARCHAR(300),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluations" (
    "id" SERIAL NOT NULL,
    "post_id" INTEGER NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "status" "EvaluationStatus" NOT NULL DEFAULT 'OPEN',
    "closed_at" TIMESTAMP(3),
    "close_reason" VARCHAR(255),
    "closed_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "votes" (
    "id" SERIAL NOT NULL,
    "evaluation_id" INTEGER NOT NULL,
    "voter_id" INTEGER NOT NULL,
    "choice" "VoteChoice" NOT NULL,
    "feedback_submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_tags" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "group_code" VARCHAR(50),
    "vote_choice" "VoteChoice" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedbacks" (
    "id" SERIAL NOT NULL,
    "vote_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rankings" (
    "id" SERIAL NOT NULL,
    "period" "RankingPeriod" NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'Asia/Seoul',
    "algorithm_version" INTEGER NOT NULL DEFAULT 1,
    "status" "RankingStatus" NOT NULL DEFAULT 'PENDING',
    "generated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rankings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ranking_details" (
    "id" SERIAL NOT NULL,
    "ranking_id" INTEGER NOT NULL,
    "post_id" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "dislike_count" INTEGER NOT NULL DEFAULT 0,
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "like_rate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ranking_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_search_index" (
    "id" SERIAL NOT NULL,
    "post_id" INTEGER NOT NULL,
    "author_nickname" VARCHAR(30) NOT NULL,
    "search_text" TEXT NOT NULL,
    "keyword_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "outfit_categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "feedback_like_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "feedback_dislike_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "like_ratio" DECIMAL(5,4) NOT NULL,
    "is_searchable" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "indexed_at" TIMESTAMP(3),

    CONSTRAINT "post_search_index_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "image_assets" (
    "id" SERIAL NOT NULL,
    "owner_user_id" INTEGER,
    "source_type" "ImageAssetSourceType" NOT NULL,
    "storage_key" VARCHAR(255),
    "original_image_url" VARCHAR(500) NOT NULL,
    "processed_image_url" VARCHAR(500),
    "thumbnail_url" VARCHAR(500),
    "mime_type" VARCHAR(100),
    "width" INTEGER,
    "height" INTEGER,
    "checksum" VARCHAR(128),
    "blur_method" "BlurMethod" NOT NULL DEFAULT 'NONE',
    "ai_blur_status" "AiBlurStatus" NOT NULL DEFAULT 'NONE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "image_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "image_analysis_runs" (
    "id" SERIAL NOT NULL,
    "image_asset_id" INTEGER NOT NULL,
    "purpose" "ImageAnalysisPurpose" NOT NULL DEFAULT 'POST_INDEX',
    "status" "ImageAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "pipeline_version" VARCHAR(50),
    "parser_model_name" VARCHAR(100),
    "parser_model_version" VARCHAR(100),
    "embed_model_name" VARCHAR(100),
    "embed_model_version" VARCHAR(100),
    "caption_model_name" VARCHAR(100),
    "caption_model_version" VARCHAR(100),
    "caption_fallback_used" BOOLEAN NOT NULL DEFAULT false,
    "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "image_width" INTEGER,
    "image_height" INTEGER,
    "face_detected" INTEGER,
    "blurred" BOOLEAN,
    "caption" VARCHAR(500),
    "summary_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "raw_response_json" JSONB,
    "error_code" VARCHAR(100),
    "error_message" VARCHAR(500),
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "image_analysis_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "image_garments" (
    "id" SERIAL NOT NULL,
    "analysis_run_id" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "parser_label" VARCHAR(50) NOT NULL,
    "normalized_category" "AiGarmentCategory" NOT NULL,
    "bbox_json" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "area_ratio" DOUBLE PRECISION,
    "dominant_color" VARCHAR(30),
    "color_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fit_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "length_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "material_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "style_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "season_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "occasion_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "image_garments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "image_vectors" (
    "id" SERIAL NOT NULL,
    "analysis_run_id" INTEGER NOT NULL,
    "garment_id" INTEGER,
    "target_scope" "ImageVectorScope" NOT NULL,
    "model_name" VARCHAR(100) NOT NULL,
    "model_version" VARCHAR(100),
    "dimension" INTEGER NOT NULL,
    "vector" vector(512) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "image_vectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_histories" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "search_type" "SearchHistoryType" NOT NULL,
    "query_text" VARCHAR(300),
    "image_asset_id" INTEGER,
    "image_search_mode" "ImageSearchMode",
    "result_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_nickname_key" ON "users"("nickname");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_number_key" ON "users"("phone_number");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_refresh_token_hash_key" ON "user_sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_revoked_at_idx" ON "user_sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "user_sessions_expires_at_idx" ON "user_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "social_accounts_user_id_idx" ON "social_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "social_accounts_provider_provider_user_id_key" ON "social_accounts"("provider", "provider_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "social_accounts_user_id_provider_key" ON "social_accounts"("user_id", "provider");

-- CreateIndex
CREATE INDEX "phone_verifications_phone_number_purpose_created_at_idx" ON "phone_verifications"("phone_number", "purpose", "created_at");

-- CreateIndex
CREATE INDEX "phone_verifications_user_id_idx" ON "phone_verifications"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "settings_user_id_key" ON "settings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_tokens_push_token_key" ON "push_tokens"("push_token");

-- CreateIndex
CREATE INDEX "push_tokens_user_id_is_active_idx" ON "push_tokens"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "user_sanctions_processed_by_id_idx" ON "user_sanctions"("processed_by_id");

-- CreateIndex
CREATE INDEX "posts_author_id_status_created_at_idx" ON "posts"("author_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "posts_status_created_at_idx" ON "posts"("status", "created_at");

-- CreateIndex
CREATE INDEX "posts_author_id_idx" ON "posts"("author_id");

-- CreateIndex
CREATE INDEX "posts_status_idx" ON "posts"("status");

-- CreateIndex
CREATE INDEX "posts_published_at_idx" ON "posts"("published_at");

-- CreateIndex
CREATE INDEX "post_images_post_id_is_primary_idx" ON "post_images"("post_id", "is_primary");

-- CreateIndex
CREATE INDEX "post_images_image_asset_id_idx" ON "post_images"("image_asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "post_images_post_id_sort_order_key" ON "post_images"("post_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "post_images_post_id_image_asset_id_key" ON "post_images"("post_id", "image_asset_id");

-- CreateIndex
CREATE INDEX "post_outfits_post_id_idx" ON "post_outfits"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "post_outfits_post_id_sort_order_key" ON "post_outfits"("post_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "keywords_code_key" ON "keywords"("code");

-- CreateIndex
CREATE INDEX "keywords_is_active_sort_order_idx" ON "keywords"("is_active", "sort_order");

-- CreateIndex
CREATE INDEX "keywords_label_idx" ON "keywords"("label");

-- CreateIndex
CREATE INDEX "post_keywords_keyword_id_post_id_idx" ON "post_keywords"("keyword_id", "post_id");

-- CreateIndex
CREATE INDEX "post_keywords_post_id_idx" ON "post_keywords"("post_id");

-- CreateIndex
CREATE INDEX "post_keywords_keyword_id_idx" ON "post_keywords"("keyword_id");

-- CreateIndex
CREATE UNIQUE INDEX "post_keywords_post_id_keyword_id_key" ON "post_keywords"("post_id", "keyword_id");

-- CreateIndex
CREATE INDEX "bookmarks_user_id_created_at_idx" ON "bookmarks"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "bookmarks_user_id_idx" ON "bookmarks"("user_id");

-- CreateIndex
CREATE INDEX "bookmarks_post_id_idx" ON "bookmarks"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "bookmarks_user_id_post_id_key" ON "bookmarks"("user_id", "post_id");

-- CreateIndex
CREATE INDEX "reports_status_created_at_idx" ON "reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "reports_post_id_created_at_idx" ON "reports"("post_id", "created_at");

-- CreateIndex
CREATE INDEX "reports_post_id_idx" ON "reports"("post_id");

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "reports"("status");

-- CreateIndex
CREATE INDEX "reports_reviewed_by_id_idx" ON "reports"("reviewed_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "reports_reporter_id_post_id_key" ON "reports"("reporter_id", "post_id");

-- CreateIndex
CREATE INDEX "user_reports_reported_user_id_created_at_idx" ON "user_reports"("reported_user_id", "created_at");

-- CreateIndex
CREATE INDEX "user_reports_status_created_at_idx" ON "user_reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "user_reports_reviewed_by_id_idx" ON "user_reports"("reviewed_by_id");

-- CreateIndex
CREATE INDEX "user_reports_reporter_id_reported_user_id_status_idx" ON "user_reports"("reporter_id", "reported_user_id", "status");

-- CreateIndex
CREATE INDEX "admin_action_logs_admin_id_created_at_idx" ON "admin_action_logs"("admin_id", "created_at");

-- CreateIndex
CREATE INDEX "admin_action_logs_target_type_target_id_created_at_idx" ON "admin_action_logs"("target_type", "target_id", "created_at");

-- CreateIndex
CREATE INDEX "admin_action_logs_action_type_created_at_idx" ON "admin_action_logs"("action_type", "created_at");

-- CreateIndex
CREATE INDEX "report_histories_target_type_target_id_created_at_idx" ON "report_histories"("target_type", "target_id", "created_at");

-- CreateIndex
CREATE INDEX "report_histories_actor_id_created_at_idx" ON "report_histories"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "report_histories_action_type_created_at_idx" ON "report_histories"("action_type", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "evaluations_post_id_key" ON "evaluations"("post_id");

-- CreateIndex
CREATE INDEX "evaluations_status_ends_at_idx" ON "evaluations"("status", "ends_at");

-- CreateIndex
CREATE INDEX "evaluations_closed_by_id_idx" ON "evaluations"("closed_by_id");

-- CreateIndex
CREATE INDEX "votes_voter_id_idx" ON "votes"("voter_id");

-- CreateIndex
CREATE INDEX "votes_evaluation_id_choice_idx" ON "votes"("evaluation_id", "choice");

-- CreateIndex
CREATE UNIQUE INDEX "votes_evaluation_id_voter_id_key" ON "votes"("evaluation_id", "voter_id");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_tags_code_key" ON "feedback_tags"("code");

-- CreateIndex
CREATE INDEX "feedback_tags_vote_choice_is_active_sort_order_idx" ON "feedback_tags"("vote_choice", "is_active", "sort_order");

-- CreateIndex
CREATE INDEX "feedback_tags_group_code_idx" ON "feedback_tags"("group_code");

-- CreateIndex
CREATE INDEX "feedbacks_vote_id_idx" ON "feedbacks"("vote_id");

-- CreateIndex
CREATE INDEX "feedbacks_tag_id_idx" ON "feedbacks"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "feedbacks_vote_id_tag_id_key" ON "feedbacks"("vote_id", "tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "feedbacks_vote_id_sort_order_key" ON "feedbacks"("vote_id", "sort_order");

-- CreateIndex
CREATE INDEX "rankings_period_start_date_end_date_idx" ON "rankings"("period", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "rankings_status_idx" ON "rankings"("status");

-- CreateIndex
CREATE UNIQUE INDEX "rankings_period_start_date_end_date_timezone_algorithm_vers_key" ON "rankings"("period", "start_date", "end_date", "timezone", "algorithm_version");

-- CreateIndex
CREATE INDEX "ranking_details_post_id_idx" ON "ranking_details"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "ranking_details_ranking_id_post_id_key" ON "ranking_details"("ranking_id", "post_id");

-- CreateIndex
CREATE UNIQUE INDEX "ranking_details_ranking_id_rank_key" ON "ranking_details"("ranking_id", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "post_search_index_post_id_key" ON "post_search_index"("post_id");

-- CreateIndex
CREATE INDEX "post_search_index_keyword_codes_idx" ON "post_search_index" USING GIN ("keyword_codes");

-- CreateIndex
CREATE INDEX "post_search_index_outfit_categories_idx" ON "post_search_index" USING GIN ("outfit_categories");

-- CreateIndex
CREATE INDEX "post_search_index_feedback_like_codes_idx" ON "post_search_index" USING GIN ("feedback_like_codes");

-- CreateIndex
CREATE INDEX "post_search_index_feedback_dislike_codes_idx" ON "post_search_index" USING GIN ("feedback_dislike_codes");

-- CreateIndex
CREATE INDEX "image_assets_owner_user_id_source_type_created_at_idx" ON "image_assets"("owner_user_id", "source_type", "created_at");

-- CreateIndex
CREATE INDEX "image_assets_source_type_created_at_idx" ON "image_assets"("source_type", "created_at");

-- CreateIndex
CREATE INDEX "image_assets_checksum_idx" ON "image_assets"("checksum");

-- CreateIndex
CREATE INDEX "image_analysis_runs_image_asset_id_status_idx" ON "image_analysis_runs"("image_asset_id", "status");

-- CreateIndex
CREATE INDEX "image_analysis_runs_image_asset_id_is_current_idx" ON "image_analysis_runs"("image_asset_id", "is_current");

-- CreateIndex
CREATE INDEX "image_garments_analysis_run_id_normalized_category_idx" ON "image_garments"("analysis_run_id", "normalized_category");

-- CreateIndex
CREATE INDEX "image_garments_parser_label_idx" ON "image_garments"("parser_label");

-- CreateIndex
CREATE UNIQUE INDEX "image_garments_analysis_run_id_sort_order_key" ON "image_garments"("analysis_run_id", "sort_order");

-- CreateIndex
CREATE INDEX "image_vectors_analysis_run_id_target_scope_idx" ON "image_vectors"("analysis_run_id", "target_scope");

-- CreateIndex
CREATE INDEX "image_vectors_garment_id_idx" ON "image_vectors"("garment_id");

-- CreateIndex
CREATE INDEX "search_histories_user_id_created_at_idx" ON "search_histories"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "search_histories_search_type_created_at_idx" ON "search_histories"("search_type", "created_at");

-- CreateIndex
CREATE INDEX "search_histories_image_asset_id_idx" ON "search_histories"("image_asset_id");

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_verifications" ADD CONSTRAINT "phone_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sanctions" ADD CONSTRAINT "user_sanctions_sanctioned_user_id_fkey" FOREIGN KEY ("sanctioned_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sanctions" ADD CONSTRAINT "user_sanctions_processed_by_id_fkey" FOREIGN KEY ("processed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_hidden_by_id_fkey" FOREIGN KEY ("hidden_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_images" ADD CONSTRAINT "post_images_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_images" ADD CONSTRAINT "post_images_image_asset_id_fkey" FOREIGN KEY ("image_asset_id") REFERENCES "image_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_outfits" ADD CONSTRAINT "post_outfits_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_keywords" ADD CONSTRAINT "post_keywords_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_keywords" ADD CONSTRAINT "post_keywords_keyword_id_fkey" FOREIGN KEY ("keyword_id") REFERENCES "keywords"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reported_user_id_fkey" FOREIGN KEY ("reported_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_action_logs" ADD CONSTRAINT "admin_action_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_histories" ADD CONSTRAINT "report_histories_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_voter_id_fkey" FOREIGN KEY ("voter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_vote_id_fkey" FOREIGN KEY ("vote_id") REFERENCES "votes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "feedback_tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranking_details" ADD CONSTRAINT "ranking_details_ranking_id_fkey" FOREIGN KEY ("ranking_id") REFERENCES "rankings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranking_details" ADD CONSTRAINT "ranking_details_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_search_index" ADD CONSTRAINT "post_search_index_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_assets" ADD CONSTRAINT "image_assets_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_analysis_runs" ADD CONSTRAINT "image_analysis_runs_image_asset_id_fkey" FOREIGN KEY ("image_asset_id") REFERENCES "image_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_garments" ADD CONSTRAINT "image_garments_analysis_run_id_fkey" FOREIGN KEY ("analysis_run_id") REFERENCES "image_analysis_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_vectors" ADD CONSTRAINT "image_vectors_analysis_run_id_fkey" FOREIGN KEY ("analysis_run_id") REFERENCES "image_analysis_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_vectors" ADD CONSTRAINT "image_vectors_garment_id_fkey" FOREIGN KEY ("garment_id") REFERENCES "image_garments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_histories" ADD CONSTRAINT "search_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_histories" ADD CONSTRAINT "search_histories_image_asset_id_fkey" FOREIGN KEY ("image_asset_id") REFERENCES "image_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;




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
