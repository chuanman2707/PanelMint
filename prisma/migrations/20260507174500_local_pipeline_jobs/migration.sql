-- DropIndex
DROP INDEX IF EXISTS "pipeline_runs_inngest_run_id_key";

-- AlterTable
ALTER TABLE "pipeline_runs" DROP COLUMN IF EXISTS "inngest_run_id";

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
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pipeline_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pipeline_jobs_status_available_at_idx" ON "pipeline_jobs"("status", "available_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pipeline_jobs_locked_at_idx" ON "pipeline_jobs"("locked_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pipeline_jobs_episode_id_idx" ON "pipeline_jobs"("episode_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pipeline_jobs_dedupe_key_status_idx" ON "pipeline_jobs"("dedupe_key", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "pipeline_jobs_active_dedupe_key_key" ON "pipeline_jobs"("dedupe_key") WHERE "status" IN ('queued', 'running');

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
