-- CreateEnum
CREATE TYPE "ContextType" AS ENUM ('language', 'role', 'relationship', 'scene');

-- CreateEnum
CREATE TYPE "CombinationStatus" AS ENUM ('new', 'training', 'trained', 'needs_more_data');

-- CreateEnum
CREATE TYPE "MaterialSource" AS ENUM ('chat', 'copywriting', 'email', 'social_post', 'diary', 'course_script', 'product_text', 'sales_reply', 'chatgpt_conversation', 'interview', 'blind_calibration', 'task_feedback', 'other');

-- CreateEnum
CREATE TYPE "SignalType" AS ENUM ('fact', 'voice_pattern', 'reaction_pattern', 'decision_pattern', 'relationship_pattern', 'language_pattern', 'boundary', 'current_state');

-- CreateEnum
CREATE TYPE "StabilityLevel" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "ModelStatus" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "InterviewType" AS ENUM ('daily', 'information', 'role', 'language', 'relationship', 'stress', 'conflict', 'creative');

-- CreateEnum
CREATE TYPE "CalibrationDecision" AS ENUM ('accepted', 'partially_accepted', 'rejected', 'edited');

-- CreateEnum
CREATE TYPE "UpdateSourceType" AS ENUM ('import', 'interview', 'blind_calibration', 'task_feedback');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('chat_reply', 'copywriting', 'video_script', 'course', 'email', 'sales_reply', 'rewrite', 'decision_support');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "LlmSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "defaultProvider" TEXT NOT NULL DEFAULT 'openai_compatible',
    "defaultModel" TEXT,
    "agentOverrides" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LlmSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Credential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "label" TEXT,
    "baseUrl" TEXT,
    "secret" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Credential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Context" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "ContextType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Context_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContextCombination" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "languageContextId" TEXT,
    "roleContextId" TEXT,
    "relationshipContextId" TEXT,
    "sceneContextId" TEXT,
    "description" TEXT,
    "status" "CombinationStatus" NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContextCombination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawMaterial" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceType" "MaterialSource" NOT NULL,
    "content" TEXT NOT NULL,
    "language" TEXT,
    "contextIds" TEXT[],
    "sourceMetadata" JSONB NOT NULL DEFAULT '{}',
    "materialTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RawMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "rawMaterialId" TEXT,
    "claim" TEXT NOT NULL,
    "evidenceText" TEXT NOT NULL,
    "contextIds" TEXT[],
    "signalType" "SignalType" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "stability" "StabilityLevel" NOT NULL,
    "firstSeen" TIMESTAMP(3) NOT NULL,
    "lastSeen" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SelfModel" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" "ModelStatus" NOT NULL DEFAULT 'active',
    "coreSelf" JSONB NOT NULL DEFAULT '{}',
    "languageModels" JSONB NOT NULL DEFAULT '{}',
    "roleModels" JSONB NOT NULL DEFAULT '{}',
    "relationshipModels" JSONB NOT NULL DEFAULT '{}',
    "sceneModels" JSONB NOT NULL DEFAULT '{}',
    "currentState" JSONB NOT NULL DEFAULT '{}',
    "boundaries" JSONB NOT NULL DEFAULT '{}',
    "unknowns" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SelfModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interview" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "InterviewType" NOT NULL,
    "interviewerPersona" TEXT NOT NULL,
    "targetContextIds" TEXT[],
    "goal" TEXT NOT NULL,
    "transcript" JSONB NOT NULL DEFAULT '[]',
    "extractionReport" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Interview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlindCalibration" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contextCombinationId" TEXT,
    "scenario" TEXT NOT NULL,
    "incomingMessage" TEXT,
    "hiddenAgentAnswer" TEXT NOT NULL,
    "userAnswer" TEXT,
    "comparisonReport" JSONB,
    "updateProposal" JSONB,
    "userDecision" "CalibrationDecision",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlindCalibration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelUpdate" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "previousModelId" TEXT NOT NULL,
    "newModelId" TEXT,
    "sourceType" "UpdateSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "updateSummary" TEXT NOT NULL,
    "affectedPaths" TEXT[],
    "confidenceDelta" DOUBLE PRECISION,
    "userApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskOutput" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskType" "TaskType" NOT NULL,
    "input" TEXT NOT NULL,
    "contextIds" TEXT[],
    "output" TEXT NOT NULL,
    "feedback" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskOutput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LlmCallLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "projectId" TEXT,
    "agentRole" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "request" JSONB NOT NULL,
    "rawResponse" JSONB,
    "parsedResponse" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LlmCallLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "LlmSettings_userId_key" ON "LlmSettings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Credential_userId_provider_key" ON "Credential"("userId", "provider");

-- CreateIndex
CREATE INDEX "Project_userId_idx" ON "Project"("userId");

-- CreateIndex
CREATE INDEX "Context_projectId_idx" ON "Context"("projectId");

-- CreateIndex
CREATE INDEX "ContextCombination_projectId_idx" ON "ContextCombination"("projectId");

-- CreateIndex
CREATE INDEX "RawMaterial_projectId_idx" ON "RawMaterial"("projectId");

-- CreateIndex
CREATE INDEX "EvidenceItem_projectId_idx" ON "EvidenceItem"("projectId");

-- CreateIndex
CREATE INDEX "EvidenceItem_rawMaterialId_idx" ON "EvidenceItem"("rawMaterialId");

-- CreateIndex
CREATE INDEX "SelfModel_projectId_idx" ON "SelfModel"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "SelfModel_projectId_version_key" ON "SelfModel"("projectId", "version");

-- CreateIndex
CREATE INDEX "Interview_projectId_idx" ON "Interview"("projectId");

-- CreateIndex
CREATE INDEX "BlindCalibration_projectId_idx" ON "BlindCalibration"("projectId");

-- CreateIndex
CREATE INDEX "ModelUpdate_projectId_idx" ON "ModelUpdate"("projectId");

-- CreateIndex
CREATE INDEX "TaskOutput_projectId_idx" ON "TaskOutput"("projectId");

-- CreateIndex
CREATE INDEX "LlmCallLog_userId_idx" ON "LlmCallLog"("userId");

-- CreateIndex
CREATE INDEX "LlmCallLog_projectId_idx" ON "LlmCallLog"("projectId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LlmSettings" ADD CONSTRAINT "LlmSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Context" ADD CONSTRAINT "Context_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextCombination" ADD CONSTRAINT "ContextCombination_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawMaterial" ADD CONSTRAINT "RawMaterial_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "RawMaterial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelfModel" ADD CONSTRAINT "SelfModel_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlindCalibration" ADD CONSTRAINT "BlindCalibration_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlindCalibration" ADD CONSTRAINT "BlindCalibration_contextCombinationId_fkey" FOREIGN KEY ("contextCombinationId") REFERENCES "ContextCombination"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelUpdate" ADD CONSTRAINT "ModelUpdate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelUpdate" ADD CONSTRAINT "ModelUpdate_previousModelId_fkey" FOREIGN KEY ("previousModelId") REFERENCES "SelfModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelUpdate" ADD CONSTRAINT "ModelUpdate_newModelId_fkey" FOREIGN KEY ("newModelId") REFERENCES "SelfModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskOutput" ADD CONSTRAINT "TaskOutput_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
