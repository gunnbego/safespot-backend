-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'MANAGER', 'MEMBER');

-- CreateEnum
CREATE TYPE "PhotoPurpose" AS ENUM ('HAZARD', 'RESOLUTION');

-- CreateTable
CREATE TABLE "organisations" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "tier" VARCHAR(50) NOT NULL DEFAULT 'free',
    "subscription_status" VARCHAR(50) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER,
    "metadata" JSONB,

    CONSTRAINT "organisations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" SERIAL NOT NULL,
    "organisation_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "organisation_id" INTEGER NOT NULL,
    "team_id" INTEGER,
    "username" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "safety_reports" (
    "id" SERIAL NOT NULL,
    "organisation_id" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL,
    "created_by_id" INTEGER NOT NULL,
    "resolved_by_id" INTEGER,
    "title" VARCHAR(255) NOT NULL,
    "notes" TEXT,
    "category" VARCHAR(100) NOT NULL DEFAULT 'General',
    "severity" VARCHAR(50) NOT NULL DEFAULT 'Low',
    "status" VARCHAR(50) NOT NULL DEFAULT 'Open',
    "resolution_comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "safety_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "safety_report_photos" (
    "id" SERIAL NOT NULL,
    "organisation_id" INTEGER NOT NULL,
    "report_id" INTEGER NOT NULL,
    "file_name" VARCHAR(255),
    "content_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "purpose" "PhotoPurpose" NOT NULL DEFAULT 'HAZARD',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "safety_report_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" SERIAL NOT NULL,
    "organisation_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "action" VARCHAR(50) NOT NULL,
    "resource_type" VARCHAR(100) NOT NULL,
    "resource_id" INTEGER,
    "resource_name" VARCHAR(255),
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" VARCHAR(45),
    "details" JSONB,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organisations_slug_key" ON "organisations"("slug");

-- CreateIndex
CREATE INDEX "teams_organisation_id_idx" ON "teams"("organisation_id");

-- CreateIndex
CREATE UNIQUE INDEX "teams_organisation_id_name_key" ON "teams"("organisation_id", "name");

-- CreateIndex
CREATE INDEX "users_organisation_id_idx" ON "users"("organisation_id");

-- CreateIndex
CREATE INDEX "users_organisation_id_email_idx" ON "users"("organisation_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "users_organisation_id_username_key" ON "users"("organisation_id", "username");

-- CreateIndex
CREATE INDEX "safety_reports_organisation_id_idx" ON "safety_reports"("organisation_id");

-- CreateIndex
CREATE INDEX "safety_reports_organisation_id_team_id_idx" ON "safety_reports"("organisation_id", "team_id");

-- CreateIndex
CREATE INDEX "safety_reports_organisation_id_status_created_at_idx" ON "safety_reports"("organisation_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "safety_reports_organisation_id_resolved_at_idx" ON "safety_reports"("organisation_id", "resolved_at" DESC);

-- CreateIndex
CREATE INDEX "safety_reports_organisation_id_created_by_id_idx" ON "safety_reports"("organisation_id", "created_by_id");

-- CreateIndex
CREATE INDEX "safety_report_photos_report_id_idx" ON "safety_report_photos"("report_id");

-- CreateIndex
CREATE INDEX "safety_report_photos_organisation_id_report_id_idx" ON "safety_report_photos"("organisation_id", "report_id");

-- CreateIndex
CREATE INDEX "safety_report_photos_organisation_id_purpose_idx" ON "safety_report_photos"("organisation_id", "purpose");

-- CreateIndex
CREATE INDEX "audit_log_organisation_id_timestamp_idx" ON "audit_log"("organisation_id", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "audit_log_user_id_idx" ON "audit_log"("user_id");

-- CreateIndex
CREATE INDEX "audit_log_action_timestamp_idx" ON "audit_log"("action", "timestamp" DESC);

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_reports" ADD CONSTRAINT "safety_reports_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_reports" ADD CONSTRAINT "safety_reports_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_reports" ADD CONSTRAINT "safety_reports_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_reports" ADD CONSTRAINT "safety_reports_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_report_photos" ADD CONSTRAINT "safety_report_photos_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_report_photos" ADD CONSTRAINT "safety_report_photos_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "safety_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
