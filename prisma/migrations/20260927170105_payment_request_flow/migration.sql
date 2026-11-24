-- CreateEnum
CREATE TYPE "PaymentPurpose" AS ENUM ('REGISTRATION', 'RENEWAL', 'ADDITIONAL_SERVICE');

-- CreateEnum
CREATE TYPE "PaymentRequestStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "PaymentProofMethod" AS ENUM ('TRANSACTION_ID', 'SCREENSHOT', 'CAMERA_SCAN');

-- CreateTable
CREATE TABLE "PaymentRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "purpose" "PaymentPurpose" NOT NULL,
    "leouPayRef" TEXT NOT NULL,
    "method" "PaymentProofMethod" NOT NULL,
    "transactionId" TEXT,
    "screenshotUrl" TEXT,
    "cameraProofUrl" TEXT,
    "ocrText" TEXT,
    "superseded" BOOLEAN NOT NULL DEFAULT false,
    "status" "PaymentRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "decisionNote" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "amountExpected" DECIMAL(10,2),
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRequestAttachment" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentRequestAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRequest_leouPayRef_key" ON "PaymentRequest"("leouPayRef");

-- CreateIndex
CREATE INDEX "PaymentRequest_userId_submittedAt_idx" ON "PaymentRequest"("userId", "submittedAt");

-- CreateIndex
CREATE INDEX "PaymentRequest_status_submittedAt_idx" ON "PaymentRequest"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "PaymentRequest_requestId_idx" ON "PaymentRequest"("requestId");

-- CreateIndex
CREATE INDEX "PaymentRequest_purpose_status_idx" ON "PaymentRequest"("purpose", "status");

-- CreateIndex
CREATE INDEX "PaymentRequestAttachment_paymentId_idx" ON "PaymentRequestAttachment"("paymentId");

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "OnboardingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequestAttachment" ADD CONSTRAINT "PaymentRequestAttachment_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "PaymentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
