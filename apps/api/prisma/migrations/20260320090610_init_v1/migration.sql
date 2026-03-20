-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('ACTIVE', 'DELETED');

-- CreateEnum
CREATE TYPE "EvaluationStatus" AS ENUM ('OPEN', 'CLOSED', 'ENDED');

-- CreateEnum
CREATE TYPE "VoteChoice" AS ENUM ('LIKE', 'DISLIKE');

-- CreateEnum
CREATE TYPE "RankingPeriod" AS ENUM ('WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "FeedbackTagPolarity" AS ENUM ('POSITIVE', 'NEGATIVE');

-- CreateEnum
CREATE TYPE "GarmentCategory" AS ENUM ('TOP', 'BOTTOM', 'OUTER', 'SHOES', 'BAG', 'ACCESSORY', 'ETC');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "nickname" VARCHAR(50),
    "password_hash" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "refreshTokenHash" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" SERIAL NOT NULL,
    "author_id" INTEGER NOT NULL,
    "content" TEXT,
    "status" "PostStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_images" (
    "id" SERIAL NOT NULL,
    "post_id" INTEGER NOT NULL,
    "image_url" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_outfit_items" (
    "id" SERIAL NOT NULL,
    "post_id" INTEGER NOT NULL,
    "category" "GarmentCategory" NOT NULL,
    "item_name" VARCHAR(100),
    "brand" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_outfit_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluations" (
    "id" SERIAL NOT NULL,
    "post_id" INTEGER NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "status" "EvaluationStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

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
    "polarity" "FeedbackTagPolarity" NOT NULL,
    "vote_choice" "VoteChoice" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "feedback_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vote_feedback_tags" (
    "id" SERIAL NOT NULL,
    "vote_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vote_feedback_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ranking_snapshots" (
    "id" SERIAL NOT NULL,
    "period" "RankingPeriod" NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ranking_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ranking_entries" (
    "id" SERIAL NOT NULL,
    "snapshot_id" INTEGER NOT NULL,
    "post_id" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "dislike_count" INTEGER NOT NULL DEFAULT 0,
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "like_rate" DECIMAL(5,4) NOT NULL,

    CONSTRAINT "ranking_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "posts_author_id_idx" ON "posts"("author_id");

-- CreateIndex
CREATE INDEX "posts_status_idx" ON "posts"("status");

-- CreateIndex
CREATE INDEX "post_images_post_id_idx" ON "post_images"("post_id");

-- CreateIndex
CREATE INDEX "post_outfit_items_post_id_idx" ON "post_outfit_items"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluations_post_id_key" ON "evaluations"("post_id");

-- CreateIndex
CREATE INDEX "evaluations_status_ends_at_idx" ON "evaluations"("status", "ends_at");

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
CREATE INDEX "vote_feedback_tags_tag_id_idx" ON "vote_feedback_tags"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "vote_feedback_tags_vote_id_tag_id_key" ON "vote_feedback_tags"("vote_id", "tag_id");

-- CreateIndex
CREATE INDEX "ranking_snapshots_period_idx" ON "ranking_snapshots"("period");

-- CreateIndex
CREATE UNIQUE INDEX "ranking_snapshots_period_start_date_end_date_key" ON "ranking_snapshots"("period", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "ranking_entries_post_id_idx" ON "ranking_entries"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "ranking_entries_snapshot_id_post_id_key" ON "ranking_entries"("snapshot_id", "post_id");

-- CreateIndex
CREATE UNIQUE INDEX "ranking_entries_snapshot_id_rank_key" ON "ranking_entries"("snapshot_id", "rank");

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_images" ADD CONSTRAINT "post_images_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_outfit_items" ADD CONSTRAINT "post_outfit_items_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_voter_id_fkey" FOREIGN KEY ("voter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vote_feedback_tags" ADD CONSTRAINT "vote_feedback_tags_vote_id_fkey" FOREIGN KEY ("vote_id") REFERENCES "votes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vote_feedback_tags" ADD CONSTRAINT "vote_feedback_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "feedback_tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranking_entries" ADD CONSTRAINT "ranking_entries_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "ranking_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranking_entries" ADD CONSTRAINT "ranking_entries_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
