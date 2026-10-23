-- Prepared for review; applying this migration requires separate local-database approval.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
-- CreateEnum
CREATE TYPE public."BookingType" AS ENUM ('FLIGHT', 'HOTEL', 'PACKAGE');

-- CreateEnum
CREATE TYPE public."BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE public."BookingModel" AS ENUM ('AGENCY_INQUIRY', 'PROVIDER_REDIRECT', 'DIRECT_API');

-- AlterEnum


-- AlterTable
ALTER TABLE public."ContactMessage" ADD COLUMN     "serviceType" TEXT,
ALTER COLUMN "status" SET DEFAULT 'NEW';

-- CreateTable
CREATE TABLE public."Booking" (
    "id" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "bookingType" public."BookingType" NOT NULL DEFAULT 'FLIGHT',
    "bookingModel" public."BookingModel" NOT NULL DEFAULT 'AGENCY_INQUIRY',
    "status" public."BookingStatus" NOT NULL DEFAULT 'PENDING',
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT,
    "totalPrice" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'BDT',
    "bookingDetails" JSONB,
    "notes" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE public."BookingPassenger" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "passengerType" TEXT NOT NULL DEFAULT 'adult',
    "gender" TEXT,
    "dateOfBirth" TEXT,
    "passportNumber" TEXT,
    "passportExpiry" TEXT,
    "nationality" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingPassenger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE public."BookingStatusHistory" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "fromStatus" public."BookingStatus" NOT NULL,
    "toStatus" public."BookingStatus" NOT NULL,
    "reason" TEXT,
    "changedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Booking_referenceNumber_key" ON public."Booking"("referenceNumber");

-- CreateIndex
CREATE INDEX "Booking_referenceNumber_idx" ON public."Booking"("referenceNumber");

-- CreateIndex
CREATE INDEX "Booking_customerEmail_idx" ON public."Booking"("customerEmail");

-- CreateIndex
CREATE INDEX "Booking_status_idx" ON public."Booking"("status");

-- CreateIndex
CREATE INDEX "Booking_createdAt_idx" ON public."Booking"("createdAt");

-- CreateIndex
CREATE INDEX "BookingPassenger_bookingId_idx" ON public."BookingPassenger"("bookingId");

-- CreateIndex
CREATE INDEX "BookingStatusHistory_bookingId_idx" ON public."BookingStatusHistory"("bookingId");

-- AddForeignKey
ALTER TABLE public."Booking" ADD CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE public."BookingPassenger" ADD CONSTRAINT "BookingPassenger_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES public."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE public."BookingStatusHistory" ADD CONSTRAINT "BookingStatusHistory_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES public."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;


COMMIT;
