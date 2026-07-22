-- Allow new audit photos to live in Vercel Blob while preserving existing
-- database-backed image bytes for already-uploaded photos.
ALTER TABLE "safety_report_photos"
  ALTER COLUMN "data" DROP NOT NULL,
  ADD COLUMN "blob_url" TEXT,
  ADD COLUMN "blob_pathname" TEXT;

CREATE INDEX "safety_report_photos_blob_pathname_idx" ON "safety_report_photos"("blob_pathname");
