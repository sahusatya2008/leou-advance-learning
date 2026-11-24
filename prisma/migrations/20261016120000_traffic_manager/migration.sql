-- Traffic manager: a live request log and a per-visitor rollup, both written
-- only by the proxy's background task (see src/proxy.ts). See the schema
-- comments for why these live outside ActivityLog.

CREATE TYPE "TrafficKind" AS ENUM ('PAGE', 'API');

CREATE TABLE "TrafficEvent" (
    "id" TEXT NOT NULL,
    "kind" "TrafficKind" NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "deviceId" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "device" TEXT,
    "isMobile" BOOLEAN NOT NULL DEFAULT false,
    "referer" TEXT,
    "userId" TEXT,
    "role" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrafficEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TrafficEvent_createdAt_idx" ON "TrafficEvent"("createdAt");
CREATE INDEX "TrafficEvent_deviceId_createdAt_idx" ON "TrafficEvent"("deviceId", "createdAt");
CREATE INDEX "TrafficEvent_kind_createdAt_idx" ON "TrafficEvent"("kind", "createdAt");
CREATE INDEX "TrafficEvent_path_idx" ON "TrafficEvent"("path");

CREATE TABLE "TrafficVisitor" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "device" TEXT,
    "isMobile" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "role" TEXT,
    "language" TEXT,
    "timezone" TEXT,
    "screen" TEXT,
    "platform" TEXT,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "pageHits" INTEGER NOT NULL DEFAULT 0,
    "apiHits" INTEGER NOT NULL DEFAULT 0,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrafficVisitor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrafficVisitor_deviceId_key" ON "TrafficVisitor"("deviceId");
CREATE INDEX "TrafficVisitor_lastSeen_idx" ON "TrafficVisitor"("lastSeen");
CREATE INDEX "TrafficVisitor_userId_idx" ON "TrafficVisitor"("userId");
CREATE INDEX "TrafficVisitor_firstSeen_idx" ON "TrafficVisitor"("firstSeen");
