-- Add durable, operation-scoped idempotency records. Existing data is preserved.
CREATE TABLE "IdempotencyRecord" (
    "id" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "principal" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IdempotencyRecord_operation_principal_key_key"
  ON "IdempotencyRecord"("operation", "principal", "key");
CREATE INDEX "IdempotencyRecord_userId_idx" ON "IdempotencyRecord"("userId");
CREATE INDEX "IdempotencyRecord_referenceNumber_idx" ON "IdempotencyRecord"("referenceNumber");

ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
