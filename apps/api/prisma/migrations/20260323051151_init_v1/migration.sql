-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

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

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "nickname" VARCHAR(30) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
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
CREATE TABLE "posts" (
    "id" SERIAL NOT NULL,
    "author_id" INTEGER NOT NULL,
    "content" VARCHAR(500),
    "status" "PostStatus" NOT NULL DEFAULT 'ACTIVE',
    "published_at" TIMESTAMP(3),
    "hidden_at" TIMESTAMP(3),
    "hidden_reason" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_images" (
    "id" SERIAL NOT NULL,
    "post_id" INTEGER NOT NULL,
    "storage_key" VARCHAR(255),
    "image_url" VARCHAR(500) NOT NULL,
    "thumbnail_url" VARCHAR(500),
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
CREATE TABLE "ranking_entries" (
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

    CONSTRAINT "ranking_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_nickname_key" ON "users"("nickname");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_refresh_token_hash_key" ON "user_sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_revoked_at_idx" ON "user_sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "user_sessions_expires_at_idx" ON "user_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "posts_author_id_idx" ON "posts"("author_id");

-- CreateIndex
CREATE INDEX "posts_status_idx" ON "posts"("status");

-- CreateIndex
CREATE INDEX "posts_published_at_idx" ON "posts"("published_at");

-- CreateIndex
CREATE INDEX "post_images_post_id_is_primary_idx" ON "post_images"("post_id", "is_primary");

-- CreateIndex
CREATE UNIQUE INDEX "post_images_post_id_sort_order_key" ON "post_images"("post_id", "sort_order");

-- CreateIndex
CREATE INDEX "post_outfits_post_id_idx" ON "post_outfits"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "post_outfits_post_id_sort_order_key" ON "post_outfits"("post_id", "sort_order");

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
CREATE UNIQUE INDEX "feedbacks_vote_id_key" ON "feedbacks"("vote_id");

-- CreateIndex
CREATE INDEX "feedbacks_tag_id_idx" ON "feedbacks"("tag_id");

-- CreateIndex
CREATE INDEX "rankings_period_start_date_end_date_idx" ON "rankings"("period", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "rankings_status_idx" ON "rankings"("status");

-- CreateIndex
CREATE UNIQUE INDEX "rankings_period_start_date_end_date_timezone_algorithm_vers_key" ON "rankings"("period", "start_date", "end_date", "timezone", "algorithm_version");

-- CreateIndex
CREATE INDEX "ranking_entries_post_id_idx" ON "ranking_entries"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "ranking_entries_ranking_id_post_id_key" ON "ranking_entries"("ranking_id", "post_id");

-- CreateIndex
CREATE UNIQUE INDEX "ranking_entries_ranking_id_rank_key" ON "ranking_entries"("ranking_id", "rank");

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_images" ADD CONSTRAINT "post_images_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_outfits" ADD CONSTRAINT "post_outfits_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "ranking_entries" ADD CONSTRAINT "ranking_entries_ranking_id_fkey" FOREIGN KEY ("ranking_id") REFERENCES "rankings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranking_entries" ADD CONSTRAINT "ranking_entries_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
