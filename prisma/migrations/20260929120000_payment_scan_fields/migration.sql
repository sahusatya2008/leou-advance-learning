-- What the scanner read off a student's device screen, plus the comparison it
-- made against the quotation. Nullable throughout: an attempt typed by hand has
-- none of these.
ALTER TABLE "PaymentRequest"
  ADD COLUMN "scannedAmount" DECIMAL(10, 2),
  ADD COLUMN "scannedDate"   TEXT,
  ADD COLUMN "scannedTime"   TEXT,
  ADD COLUMN "scannedPayee"  TEXT,
  ADD COLUMN "checkResult"   TEXT;
