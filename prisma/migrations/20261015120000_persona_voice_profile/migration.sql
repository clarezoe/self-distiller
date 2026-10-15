-- Distilled speaking-style profile for an interviewer persona (GitHub #15, partial). Additive, nullable.
-- Raw sample messages are never stored; only the distilled profile text + timestamp.

ALTER TABLE "InterviewerPersona" ADD COLUMN     "voiceProfile" TEXT,
ADD COLUMN     "voiceDistilledAt" TIMESTAMP(3);
