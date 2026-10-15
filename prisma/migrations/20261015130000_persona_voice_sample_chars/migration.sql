-- Cumulative characters of messages distilled into the voice profile (count only, never the text). Additive.

ALTER TABLE "InterviewerPersona" ADD COLUMN     "voiceSampleChars" INTEGER NOT NULL DEFAULT 0;
