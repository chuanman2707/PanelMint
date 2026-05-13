-- DropIndex
DROP INDEX IF EXISTS "pipeline_runs_inngest_run_id_key";

-- AlterTable
ALTER TABLE "pipeline_runs" DROP COLUMN IF EXISTS "inngest_run_id";

-- Drop legacy auth/provider/billing objects removed from the open-source schema.
DROP INDEX IF EXISTS "users_auth_user_id_key";
DROP INDEX IF EXISTS "credit_transactions_providerTxId_key";
DROP INDEX IF EXISTS "credit_transactions_operation_key_key";
DROP INDEX IF EXISTS "credit_transactions_userId_createdAt_idx";
DROP INDEX IF EXISTS "usage_records_userId_createdAt_idx";
DROP INDEX IF EXISTS "pipeline_events_credit_operation_key_key";

DROP TABLE IF EXISTS "credit_transactions";
DROP TABLE IF EXISTS "usage_records";

-- AlterTable
ALTER TABLE "users" DROP COLUMN IF EXISTS "auth_user_id";
ALTER TABLE "users" DROP COLUMN IF EXISTS "passwordHash";
ALTER TABLE "users" DROP COLUMN IF EXISTS "apiKey";
ALTER TABLE "users" DROP COLUMN IF EXISTS "apiProvider";
ALTER TABLE "users" DROP COLUMN IF EXISTS "credits";
ALTER TABLE "users" DROP COLUMN IF EXISTS "accountTier";
ALTER TABLE "users" DROP COLUMN IF EXISTS "lifetimePurchasedCredits";

-- AlterTable
ALTER TABLE "projects" DROP COLUMN IF EXISTS "imageModel";

-- AlterTable
ALTER TABLE "pipeline_events" DROP COLUMN IF EXISTS "credit_operation_key";

-- CreateTable
CREATE TABLE IF NOT EXISTS "pipeline_jobs" (
    "id" TEXT NOT NULL,
    "episode_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMP(3),
    "locked_by" TEXT,
    "last_error" TEXT,
    "dedupe_key" TEXT NOT NULL,
    "active_dedupe_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pipeline_jobs_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "pipeline_jobs" ADD COLUMN IF NOT EXISTS "active_dedupe_key" TEXT;

-- Backfill active dedupe keys before enforcing uniqueness.
UPDATE "pipeline_jobs"
SET "active_dedupe_key" = "dedupe_key"
WHERE "status" IN ('queued', 'running')
  AND "active_dedupe_key" IS NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pipeline_jobs_status_available_at_idx" ON "pipeline_jobs"("status", "available_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pipeline_jobs_locked_at_idx" ON "pipeline_jobs"("locked_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pipeline_jobs_episode_id_idx" ON "pipeline_jobs"("episode_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pipeline_jobs_dedupe_key_status_idx" ON "pipeline_jobs"("dedupe_key", "status");

-- CreateIndex
DROP INDEX IF EXISTS "pipeline_jobs_active_dedupe_key_key";
CREATE UNIQUE INDEX "pipeline_jobs_active_dedupe_key_key" ON "pipeline_jobs"("active_dedupe_key");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'pipeline_jobs_episode_id_fkey'
    ) THEN
        ALTER TABLE "pipeline_jobs" ADD CONSTRAINT "pipeline_jobs_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'pipeline_jobs_user_id_fkey'
    ) THEN
        ALTER TABLE "pipeline_jobs" ADD CONSTRAINT "pipeline_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
