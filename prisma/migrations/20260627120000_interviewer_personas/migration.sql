-- Named, reusable interviewer personas (GitHub #8 v1). Additive.
-- projectId-scoped → per-user isolated. Apply to cloud by hand post-deploy (see deploy/README).

CREATE TABLE "InterviewerPersona" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "relationship" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewerPersona_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InterviewerPersona_projectId_idx" ON "InterviewerPersona"("projectId");

CREATE UNIQUE INDEX "InterviewerPersona_projectId_name_key" ON "InterviewerPersona"("projectId", "name");

ALTER TABLE "InterviewerPersona" ADD CONSTRAINT "InterviewerPersona_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
