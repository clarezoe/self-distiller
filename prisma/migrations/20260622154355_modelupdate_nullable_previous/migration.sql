-- DropForeignKey
ALTER TABLE "ModelUpdate" DROP CONSTRAINT "ModelUpdate_previousModelId_fkey";

-- AlterTable
ALTER TABLE "ModelUpdate" ALTER COLUMN "previousModelId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "ModelUpdate" ADD CONSTRAINT "ModelUpdate_previousModelId_fkey" FOREIGN KEY ("previousModelId") REFERENCES "SelfModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
