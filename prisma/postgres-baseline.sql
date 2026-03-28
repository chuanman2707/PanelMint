-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "auth_user_id" TEXT,
    "passwordHash" TEXT NOT NULL,
    "apiKey" TEXT,
    "apiProvider" TEXT,
    "preferences" TEXT,
    "credits" INTEGER NOT NULL DEFAULT 300,
    "accountTier" TEXT NOT NULL DEFAULT 'free',
    "lifetimePurchasedCredits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" VARCHAR(512) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "artStyle" TEXT NOT NULL DEFAULT 'manga',
    "imageModel" TEXT,
    "llmModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "episodes" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "novelText" TEXT,
    "pageCount" INTEGER,
    "format" TEXT NOT NULL DEFAULT 'webtoon',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "episodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pages" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "pageIndex" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "characters" TEXT,
    "location" TEXT,
    "screenplay" TEXT,
    "sceneContext" TEXT,
    "imageUrl" TEXT,
    "storage_key" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "panels" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "panelIndex" INTEGER NOT NULL,
    "shotType" TEXT,
    "description" TEXT,
    "dialogue" TEXT,
    "characters" TEXT,
    "location" TEXT,
    "sourceExcerpt" TEXT,
    "mustKeep" TEXT,
    "mood" TEXT,
    "lighting" TEXT,
    "imagePrompt" TEXT,
    "imageUrl" TEXT,
    "storage_key" TEXT,
    "generation_attempt" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "approvedPrompt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "panels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speech_bubbles" (
    "id" TEXT NOT NULL,
    "panelId" TEXT NOT NULL,
    "bubbleIndex" INTEGER NOT NULL,
    "speaker" TEXT,
    "content" TEXT NOT NULL,
    "bubbleType" TEXT NOT NULL DEFAULT 'speech',
    "positionX" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "positionY" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "width" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "height" DOUBLE PRECISION NOT NULL DEFAULT 0.2,

    CONSTRAINT "speech_bubbles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "characters" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT,
    "description" TEXT,
    "identityJson" TEXT,
    "imageUrl" TEXT,
    "storage_key" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_appearances" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "appearanceIndex" INTEGER NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "storage_key" TEXT,
    "imageUrls" TEXT,
    "storage_keys" TEXT,
    "selectedIndex" INTEGER NOT NULL DEFAULT 0,
    "referenceImageUrl" TEXT,
    "reference_storage_key" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "character_appearances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "storage_key" TEXT,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "balance" INTEGER NOT NULL,
    "episodeId" TEXT,
    "providerTxId" TEXT,
    "operation_key" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "tokens" INTEGER,
    "cost" DOUBLE PRECISION,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_runs" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "current_step" TEXT,
    "inngest_run_id" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "error" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pipeline_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_events" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "metadata" TEXT,
    "credit_operation_key" TEXT,

    CONSTRAINT "pipeline_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_auth_user_id_key" ON "users"("auth_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_token_idx" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "projects_userId_idx" ON "projects"("userId");

-- CreateIndex
CREATE INDEX "episodes_projectId_idx" ON "episodes"("projectId");

-- CreateIndex
CREATE INDEX "pages_episodeId_idx" ON "pages"("episodeId");

-- CreateIndex
CREATE UNIQUE INDEX "pages_episodeId_pageIndex_key" ON "pages"("episodeId", "pageIndex");

-- CreateIndex
CREATE INDEX "panels_pageId_idx" ON "panels"("pageId");

-- CreateIndex
CREATE UNIQUE INDEX "panels_pageId_panelIndex_key" ON "panels"("pageId", "panelIndex");

-- CreateIndex
CREATE INDEX "speech_bubbles_panelId_idx" ON "speech_bubbles"("panelId");

-- CreateIndex
CREATE UNIQUE INDEX "speech_bubbles_panelId_bubbleIndex_key" ON "speech_bubbles"("panelId", "bubbleIndex");

-- CreateIndex
CREATE INDEX "characters_projectId_idx" ON "characters"("projectId");

-- CreateIndex
CREATE INDEX "character_appearances_characterId_idx" ON "character_appearances"("characterId");

-- CreateIndex
CREATE UNIQUE INDEX "character_appearances_characterId_appearanceIndex_key" ON "character_appearances"("characterId", "appearanceIndex");

-- CreateIndex
CREATE INDEX "locations_projectId_idx" ON "locations"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "credit_transactions_providerTxId_key" ON "credit_transactions"("providerTxId");

-- CreateIndex
CREATE UNIQUE INDEX "credit_transactions_operation_key_key" ON "credit_transactions"("operation_key");

-- CreateIndex
CREATE INDEX "credit_transactions_userId_createdAt_idx" ON "credit_transactions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "usage_records_userId_createdAt_idx" ON "usage_records"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_runs_episodeId_key" ON "pipeline_runs"("episodeId");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_runs_inngest_run_id_key" ON "pipeline_runs"("inngest_run_id");

-- CreateIndex
CREATE INDEX "pipeline_runs_userId_idx" ON "pipeline_runs"("userId");

-- CreateIndex
CREATE INDEX "pipeline_runs_status_idx" ON "pipeline_runs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_events_credit_operation_key_key" ON "pipeline_events"("credit_operation_key");

-- CreateIndex
CREATE INDEX "pipeline_events_run_id_started_at_idx" ON "pipeline_events"("run_id", "started_at");

-- CreateIndex
CREATE INDEX "pipeline_events_step_status_idx" ON "pipeline_events"("step", "status");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "panels" ADD CONSTRAINT "panels_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speech_bubbles" ADD CONSTRAINT "speech_bubbles_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "panels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_appearances" ADD CONSTRAINT "character_appearances_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_runs" ADD CONSTRAINT "pipeline_runs_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_runs" ADD CONSTRAINT "pipeline_runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_events" ADD CONSTRAINT "pipeline_events_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "pipeline_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
