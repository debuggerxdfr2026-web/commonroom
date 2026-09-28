DROP TABLE "Session";
ALTER TABLE "User" DROP COLUMN "email";
ALTER TABLE "User" DROP COLUMN "passwordHash";

CREATE TABLE "GuestSession" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GuestSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GuestSession_tokenHash_key" ON "GuestSession"("tokenHash");
CREATE UNIQUE INDEX "GuestSession_userId_key" ON "GuestSession"("userId");
CREATE INDEX "GuestSession_expiresAt_idx" ON "GuestSession"("expiresAt");
ALTER TABLE "GuestSession" ADD CONSTRAINT "GuestSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
