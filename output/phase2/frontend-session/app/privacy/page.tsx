import type { Metadata } from "next";
import { PageHero } from "@/components/ui/PageHero";

export const metadata: Metadata = {
  title: "Privacy Notice — Draft | FlyWithsafety",
  description: "Privacy notice under review before production launch.",
  robots: { index: false, follow: false },
};

const draftUpdated = "October 28, 2026";
const sections = [
  [
    "Information handled by the application",
    "Account and travel workflows accept names, email addresses, phone numbers, inquiry and booking details, and support messages. Passenger forms also accept traveler names, dates of birth, nationality and passport details. Production collection of sensitive traveler information requires the remaining security and processing controls to be completed. Do not enter payment-card numbers in inquiry, booking notes or support messages."
  ],
  [
    "Purposes and communications",
    "The implemented workflows support account access, email verification, password resets, travel inquiries, booking administration and service communications. Optional marketing, personalization and advertising require their own verified implementation, notices and choices before activation."
  ],
  [
    "Travel suppliers and other service providers",
    "Real flight and hotel inventory, reservations and fulfillment must use external supplier systems. Supplier contracts, payment arrangements, hosting and communication providers, and any onward disclosure must be confirmed before the related production processing is enabled. This draft does not represent an approved supplier agreement."
  ],
  [
    "Security",
    "Access controls, response minimization and logging safeguards are implemented and being tested. Sensitive-data encryption integration and production infrastructure verification remain incomplete. This draft makes no claim of completed passport encryption at rest, certified data centers or completed independent security assessments."
  ],
  [
    "Privacy requests",
    "Processes for access, correction, deletion and other applicable requests must be finalized with verified contact details before launch. Existing records and applicable obligations must still be addressed; this draft does not promise an unverified response deadline or unrestricted deletion."
  ],
  [
    "Retention and deletion",
    "A purpose-specific retention, deletion, legal-hold and backup-handling schedule must be confirmed before production launch. No statutory retention period has been established by this draft. Existing records must not be deleted merely because this notice or a release scope changes."
  ],
  [
    "Processing locations",
    "Production hosting, KMS provider and region, supplier processing locations and backup/support countries have not been finalized. Applicable transfer conditions and provider responsibilities require verification before real data flows are activated. No adequacy decision or contractual safeguard is asserted here."
  ],
  [
    "Cookies and optional tracking",
    "The account system uses cookies for authentication. Any optional analytics, advertising or marketing tracking requires verified behavior, accurate disclosures and applicable choices before activation. Browser settings do not replace the required application controls."
  ],
  [
    "Children and other travelers",
    "Travel bookings may include child travelers. The guardian-assisted authorization workflow, notices and handling controls must be completed and verified before production use. The current forms do not establish a blanket under-16 exclusion, and this draft does not invent a legal age threshold or claim guardian verification is already implemented."
  ],
  [
    "Notice changes",
    "Notice changes must be reviewed and versioned when actual processing changes. Any required communication or choice must be implemented rather than inferred from continued use of the website. The draft date below is a fixed content revision date, not a date generated when this page is viewed."
  ],
  [
    "Company and privacy contacts",
    "Official company details, customer-support contact and privacy contact are not yet finalized. They must be verified and added before production launch. Do not rely on placeholder contact information or send identity documents to an unverified address."
  ]
];

export default function PrivacyPage() {
  return (
    <div className="flex-1">
      <PageHero id="privacy-heading" title="Privacy notice" />
      <section className="page-surface">
        <div className="container max-w-3xl rounded-xs border border-border-light bg-white px-6 py-10 shadow-card sm:px-10 sm:py-12">
          <p role="note" className="mb-6 rounded-xs border border-border-light p-4 text-text-secondary">
            Draft — under review, not a finalized or production-approved privacy policy. Company contacts, processing arrangements and release controls require confirmation before launch.
          </p>
          <p className="text-text-tertiary text-sm mb-8 text-center">Draft updated: {draftUpdated}</p>
          <article className="space-y-10">
            {sections.map(([heading, body], index) => (
              <section key={heading}>
                <h2 className="text-2xl font-bold text-text-primary mb-4">{index + 1}. {heading}</h2>
                <p className="text-text-secondary leading-relaxed">{body}</p>
              </section>
            ))}
          </article>
        </div>
      </section>
    </div>
  );
}
