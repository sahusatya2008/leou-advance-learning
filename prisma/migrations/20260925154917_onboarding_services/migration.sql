-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('REQUESTED', 'BILLED', 'ACTIVATED');

-- CreateEnum
CREATE TYPE "ServiceCodeStatus" AS ENUM ('ISSUED', 'USED', 'EXPIRED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "onboardingRequired" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Board" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Board_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectPricingItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assignmentRate" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "mockRate" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "testRate" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubjectPricingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutoringRate" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "hourlyRate" DECIMAL(10,2),
    "weeklyClasses" INTEGER,
    "weeklyRate" DECIMAL(10,2),
    "monthlyDaysPerWeek" INTEGER,
    "monthlyRate" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TutoringRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "classRoomId" TEXT NOT NULL,
    "subjects" JSONB NOT NULL,
    "wantAssignments" BOOLEAN NOT NULL DEFAULT false,
    "assignmentTopics" TEXT NOT NULL,
    "wantMockTests" BOOLEAN NOT NULL DEFAULT false,
    "mockTopics" TEXT NOT NULL,
    "wantRealTests" BOOLEAN NOT NULL DEFAULT false,
    "testTopics" TEXT NOT NULL,
    "sameTopicsForMockTests" BOOLEAN NOT NULL DEFAULT false,
    "wantTutoring" BOOLEAN NOT NULL DEFAULT false,
    "tutorSubjects" JSONB NOT NULL,
    "tutorGoals" TEXT NOT NULL,
    "tutorPlan" TEXT,
    "tutorHours" INTEGER,
    "amount" DECIMAL(10,2),
    "breakdown" JSONB,
    "status" "OnboardingStatus" NOT NULL DEFAULT 'REQUESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestId" TEXT,
    "code" TEXT NOT NULL,
    "status" "ServiceCodeStatus" NOT NULL DEFAULT 'ISSUED',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "issuedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceActivation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestId" TEXT,
    "codeId" TEXT,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceActivation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Board_name_key" ON "Board"("name");

-- CreateIndex
CREATE INDEX "Board_isActive_sortOrder_idx" ON "Board"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "SubjectPricingItem_batchId_subjectId_idx" ON "SubjectPricingItem"("batchId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectPricingItem_batchId_subjectId_name_key" ON "SubjectPricingItem"("batchId", "subjectId", "name");

-- CreateIndex
CREATE INDEX "TutoringRate_batchId_subjectId_idx" ON "TutoringRate"("batchId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "TutoringRate_batchId_subjectId_key" ON "TutoringRate"("batchId", "subjectId");

-- CreateIndex
CREATE INDEX "OnboardingRequest_userId_idx" ON "OnboardingRequest"("userId");

-- CreateIndex
CREATE INDEX "OnboardingRequest_status_idx" ON "OnboardingRequest"("status");

-- CreateIndex
CREATE INDEX "OnboardingRequest_classRoomId_idx" ON "OnboardingRequest"("classRoomId");

-- CreateIndex
CREATE INDEX "ServiceCode_userId_idx" ON "ServiceCode"("userId");

-- CreateIndex
CREATE INDEX "ServiceCode_code_idx" ON "ServiceCode"("code");

-- CreateIndex
CREATE INDEX "ServiceActivation_userId_idx" ON "ServiceActivation"("userId");

-- CreateIndex
CREATE INDEX "ServiceActivation_expiresAt_idx" ON "ServiceActivation"("expiresAt");

-- AddForeignKey
ALTER TABLE "SubjectPricingItem" ADD CONSTRAINT "SubjectPricingItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectPricingItem" ADD CONSTRAINT "SubjectPricingItem_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutoringRate" ADD CONSTRAINT "TutoringRate_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutoringRate" ADD CONSTRAINT "TutoringRate_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingRequest" ADD CONSTRAINT "OnboardingRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingRequest" ADD CONSTRAINT "OnboardingRequest_classRoomId_fkey" FOREIGN KEY ("classRoomId") REFERENCES "ClassRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCode" ADD CONSTRAINT "ServiceCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCode" ADD CONSTRAINT "ServiceCode_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "OnboardingRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceActivation" ADD CONSTRAINT "ServiceActivation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceActivation" ADD CONSTRAINT "ServiceActivation_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "OnboardingRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
