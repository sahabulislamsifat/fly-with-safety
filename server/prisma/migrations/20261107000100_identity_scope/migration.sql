-- CreateEnum
CREATE TYPE "IdentityDepartment" AS ENUM ('FLIGHT', 'HOTEL', 'VISA', 'PACKAGES', 'FINANCE', 'SUPPORT');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'SUPER_ADMIN';

-- CreateTable
CREATE TABLE "IdentityAccount" (
    "userId" TEXT NOT NULL,
    "suspended" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 0,
    "mfaVersion" INTEGER NOT NULL DEFAULT 0,
    "mfaFailures" INTEGER NOT NULL DEFAULT 0,
    "mfaBlockedUntil" TIMESTAMPTZ(6),

    CONSTRAINT "IdentityAccount_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "IdentitySession" (
    "sessionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "mfaVersion" INTEGER NOT NULL,
    "mfaVerifiedAt" TIMESTAMPTZ(6),
    "failures" INTEGER NOT NULL DEFAULT 0,
    "blockedUntil" TIMESTAMPTZ(6),

    CONSTRAINT "IdentitySession_pkey" PRIMARY KEY ("sessionId")
);

-- CreateTable
CREATE TABLE "IdentityMembership" (
    "userId" TEXT NOT NULL,
    "department" "IdentityDepartment" NOT NULL,

    CONSTRAINT "IdentityMembership_pkey" PRIMARY KEY ("userId","department")
);

-- CreateTable
CREATE TABLE "IdentityAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "department" "IdentityDepartment" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "bookingId" TEXT,
    "flightInquiryId" TEXT,
    "hotelInquiryId" TEXT,
    "packageInquiryId" TEXT,
    "visaInquiryId" TEXT,
    "contactMessageId" TEXT,

    CONSTRAINT "IdentityAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityInvitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "departments" "IdentityDepartment"[],
    "tokenHash" TEXT NOT NULL,
    "issuerId" TEXT NOT NULL,
    "issuerVersion" INTEGER NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "usedAt" TIMESTAMPTZ(6),
    "deliveredAt" TIMESTAMPTZ(6),

    CONSTRAINT "IdentityInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityMfa" (
    "userId" TEXT NOT NULL,
    "secret" TEXT,
    "pendingSecret" TEXT,
    "pendingUntil" TIMESTAMPTZ(6),
    "lastStep" BIGINT NOT NULL DEFAULT -1,
    "recoveryHashes" TEXT[],

    CONSTRAINT "IdentityMfa_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "IdentityAudit" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentityAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IdentityAssignment_userId_department_active_idx" ON "IdentityAssignment"("userId", "department", "active");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityAssignment_userId_bookingId_department_key" ON "IdentityAssignment"("userId", "bookingId", "department");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityAssignment_userId_flightInquiryId_department_key" ON "IdentityAssignment"("userId", "flightInquiryId", "department");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityAssignment_userId_hotelInquiryId_department_key" ON "IdentityAssignment"("userId", "hotelInquiryId", "department");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityAssignment_userId_packageInquiryId_department_key" ON "IdentityAssignment"("userId", "packageInquiryId", "department");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityAssignment_userId_visaInquiryId_department_key" ON "IdentityAssignment"("userId", "visaInquiryId", "department");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityAssignment_userId_contactMessageId_department_key" ON "IdentityAssignment"("userId", "contactMessageId", "department");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityInvitation_tokenHash_key" ON "IdentityInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "IdentityAudit_targetId_createdAt_idx" ON "IdentityAudit"("targetId", "createdAt");

-- AddForeignKey
ALTER TABLE "IdentityAccount" ADD CONSTRAINT "IdentityAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentitySession" ADD CONSTRAINT "IdentitySession_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityMembership" ADD CONSTRAINT "IdentityMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityAssignment" ADD CONSTRAINT "IdentityAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityAssignment" ADD CONSTRAINT "IdentityAssignment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityAssignment" ADD CONSTRAINT "IdentityAssignment_flightInquiryId_fkey" FOREIGN KEY ("flightInquiryId") REFERENCES "FlightInquiry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityAssignment" ADD CONSTRAINT "IdentityAssignment_hotelInquiryId_fkey" FOREIGN KEY ("hotelInquiryId") REFERENCES "HotelInquiry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityAssignment" ADD CONSTRAINT "IdentityAssignment_packageInquiryId_fkey" FOREIGN KEY ("packageInquiryId") REFERENCES "PackageInquiry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityAssignment" ADD CONSTRAINT "IdentityAssignment_visaInquiryId_fkey" FOREIGN KEY ("visaInquiryId") REFERENCES "VisaInquiry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityAssignment" ADD CONSTRAINT "IdentityAssignment_contactMessageId_fkey" FOREIGN KEY ("contactMessageId") REFERENCES "ContactMessage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityInvitation" ADD CONSTRAINT "IdentityInvitation_issuerId_fkey" FOREIGN KEY ("issuerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityMfa" ADD CONSTRAINT "IdentityMfa_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Scope and lifecycle invariants. This migration never updates existing users.
ALTER TABLE "IdentityAssignment" ADD CONSTRAINT "identity_one_resource" CHECK (
  num_nonnulls("bookingId","flightInquiryId","hotelInquiryId","packageInquiryId","visaInquiryId","contactMessageId")=1
);
ALTER TABLE "IdentityAccount" ADD CONSTRAINT "identity_nonnegative_versions" CHECK (version>=0 AND "mfaVersion">=0 AND "mfaFailures">=0);
ALTER TABLE "IdentitySession" ADD CONSTRAINT "identity_valid_session" CHECK (version>=0 AND "mfaVersion">=0 AND failures>=0);
ALTER TABLE "IdentityInvitation" ADD CONSTRAINT "identity_invite_scope" CHECK (
  role IN ('ADMIN','STAFF') AND departments IS NOT NULL AND cardinality(departments) BETWEEN 1 AND 6
  AND "tokenHash" ~ '^[a-f0-9]{64}$' AND "issuerVersion">=0
);
ALTER TABLE "IdentityMfa" ALTER COLUMN "recoveryHashes" SET NOT NULL;
CREATE FUNCTION identity_audit_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Identity audit records are append-only' USING ERRCODE='23514';
END;
$$;
CREATE TRIGGER identity_audit_immutable BEFORE UPDATE OR DELETE ON "IdentityAudit"
FOR EACH ROW EXECUTE FUNCTION identity_audit_append_only();
