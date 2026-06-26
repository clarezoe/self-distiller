-- Add the language the interview is CONDUCTED in (independent of UI locale). Nullable so existing rows are safe.
ALTER TABLE "Interview" ADD COLUMN "language" TEXT;
