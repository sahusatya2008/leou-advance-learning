-- Audit trail for the manual (UPI) payment flow.
ALTER TYPE "LogType" ADD VALUE 'STUDENT_SUBMIT_PAYMENT';
ALTER TYPE "LogType" ADD VALUE 'ADMIN_DECIDE_PAYMENT';
