-- Persist the interview plan + persona context so follow-up turns can be generated
-- contextually from the transcript. Additive, nullable (old interviews keep working).

ALTER TABLE "Interview" ADD COLUMN     "plan" JSONB,
ADD COLUMN     "interviewerPersonaDescription" TEXT,
ADD COLUMN     "interviewerPersonaId" TEXT;
