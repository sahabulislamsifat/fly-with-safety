import { Prisma } from '../generated/prisma/client.js';
import type { InquiryType } from '../validators/account.schemas.js';

/** Static identifiers and bound values only. Never interpolate user-supplied SQL fragments. */
export function inquiryPageQuery(userId: string, input: { page: number; limit: number; type?: InquiryType; status?: string }) {
  const where = Prisma.sql`WHERE "userId" = ${userId}${input.status ? Prisma.sql` AND "status" = ${input.status}::public."InquiryStatus"` : Prisma.empty}`;
  const branches = {
    flight: Prisma.sql`SELECT id, "referenceNumber", status::text, "createdAt", "updatedAt", 'flight'::text AS type, 0 AS "typeRank", "fromAirport" || ' → ' || "toAirport" AS summary, NULLIF("departureDate", '') AS "travelDate" FROM public."FlightInquiry" ${where}`,
    hotel: Prisma.sql`SELECT id, "referenceNumber", status::text, "createdAt", "updatedAt", 'hotel'::text AS type, 1 AS "typeRank", destination AS summary, NULLIF("checkIn", '') AS "travelDate" FROM public."HotelInquiry" ${where}`,
    package: Prisma.sql`SELECT id, "referenceNumber", status::text, "createdAt", "updatedAt", 'package'::text AS type, 2 AS "typeRank", COALESCE(NULLIF("packageTitle", ''), 'Holiday package') AS summary, NULLIF("travelDate", '') AS "travelDate" FROM public."PackageInquiry" ${where}`,
    visa: Prisma.sql`SELECT id, "referenceNumber", status::text, "createdAt", "updatedAt", 'visa'::text AS type, 3 AS "typeRank", destination AS summary, NULL::text AS "travelDate" FROM public."VisaInquiry" ${where}`,
  };
  const selected = input.type ? [branches[input.type]] : Object.values(branches);
  return Prisma.sql`WITH inquiries AS (${Prisma.join(selected, ' UNION ALL ')}),
    page AS (SELECT * FROM inquiries ORDER BY "createdAt" DESC, "typeRank" ASC, id DESC
      LIMIT ${input.limit} OFFSET ${(input.page - 1) * input.limit})
    SELECT totals.total, page.* FROM (SELECT count(*) AS total FROM inquiries) totals
    LEFT JOIN page ON TRUE ORDER BY page."createdAt" DESC, page."typeRank" ASC, page.id DESC`;
}
