-- AlterTable
ALTER TABLE "RawMaterial" ADD COLUMN "contentHash" TEXT;

-- CreateIndex
-- contentHash is left NULL on pre-existing rows; NULLs are distinct under a
-- unique index, so this never collides on backfill.
CREATE UNIQUE INDEX "RawMaterial_projectId_contentHash_key" ON "RawMaterial"("projectId", "contentHash");
