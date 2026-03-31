-- DropIndex
DROP INDEX "user_reports_reporter_id_reported_user_id_key";

-- CreateIndex
CREATE INDEX "user_reports_reporter_id_reported_user_id_status_idx" ON "user_reports"("reporter_id", "reported_user_id", "status");
