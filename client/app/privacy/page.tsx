import { Metadata } from "next";
import { PageHero } from "@/components/ui/PageHero";

export const metadata: Metadata = {
  title: "Privacy Policy | FlyWithsafety",
  description: "Read FlyWithsafety's privacy policy to understand how we collect, use, and protect your personal information.",
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  const lastUpdated = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <main className="flex-1">
      <PageHero id="privacy-heading" title="Privacy policy" />

      <section className="page-surface">
        <div className="container max-w-3xl rounded-xs border border-border-light bg-white px-6 py-10 shadow-card sm:px-10 sm:py-12">
        <p className="text-text-tertiary text-sm mb-8 text-center">Last updated: {lastUpdated}</p>

        <article className="space-y-10">
          <section>
            <h2 className="text-2xl font-bold text-text-primary mb-4">1. Information We Collect</h2>
            <p className="text-text-secondary leading-relaxed">
              We collect information you provide directly to us when you create an account, book travel services, contact support, or subscribe to communications. This may include your name, email address, phone number, payment details, passport information, travel preferences, and communication history.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-primary mb-4">2. How We Use Your Information</h2>
            <p className="text-text-secondary leading-relaxed mb-4">
              We use your information to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-text-secondary">
              <li>Process and manage your travel bookings</li>
              <li>Provide customer support and respond to inquiries</li>
              <li>Send booking confirmations, updates, and travel reminders</li>
              <li>Personalize your experience and recommend relevant offers</li>
              <li>Comply with legal obligations and regulatory requirements</li>
              <li>Improve our services and prevent fraud</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-primary mb-4">3. Information Sharing</h2>
            <p className="text-text-secondary leading-relaxed mb-4">
              We may share your information with:
            </p>
            <ul className="list-disc list-inside space-y-2 text-text-secondary">
              <li>Travel service providers (airlines, hotels, tour operators) to fulfill your bookings</li>
              <li>Payment processors to complete transactions securely</li>
              <li>Government authorities when required for travel documentation</li>
              <li>Trusted partners who assist with visa processing and travel insurance</li>
              <li>Service providers who help us operate our platform (hosting, analytics, communications)</li>
            </ul>
            <p className="text-text-secondary leading-relaxed mt-4">
              We do not sell your personal information to third parties for marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-primary mb-4">4. Data Security</h2>
            <p className="text-text-secondary leading-relaxed">
              We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. This includes encryption, secure data centers, access controls, and regular security assessments.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-primary mb-4">5. Your Rights</h2>
            <p className="text-text-secondary leading-relaxed mb-4">
              Depending on your jurisdiction, you may have rights to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-text-secondary">
              <li>Access and obtain a copy of your personal data</li>
              <li>Request correction of inaccurate or incomplete data</li>
              <li>Request deletion of your data (subject to legal obligations)</li>
              <li>Restrict or object to certain processing activities</li>
              <li>Data portability</li>
              <li>Withdraw consent where processing is based on consent</li>
            </ul>
            <p className="text-text-secondary leading-relaxed mt-4">
              To exercise these rights, contact us at privacy@flywithsafety.com.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-primary mb-4">6. Data Retention</h2>
            <p className="text-text-secondary leading-relaxed">
              We retain your information for as long as necessary to fulfill the purposes outlined in this policy, comply with legal obligations, resolve disputes, and enforce agreements. Booking records are typically retained for 7 years for tax and regulatory compliance.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-primary mb-4">7. International Transfers</h2>
            <p className="text-text-secondary leading-relaxed">
              As a global travel service, your data may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place, including standard contractual clauses and adequacy decisions where applicable.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-primary mb-4">8. Cookies and Tracking</h2>
            <p className="text-text-secondary leading-relaxed mb-4">
              We use cookies and similar technologies to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-text-secondary">
              <li>Enable essential site functionality</li>
              <li>Analyze site usage and improve performance</li>
              <li>Remember your preferences</li>
              <li>Provide personalized content and advertising</li>
            </ul>
            <p className="text-text-secondary leading-relaxed mt-4">
              You can manage cookie preferences through your browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-primary mb-4">9. Children&apos;s Privacy</h2>
            <p className="text-text-secondary leading-relaxed">
              Our services are not directed to children under 16. We do not knowingly collect personal information from children. If you believe we have collected information from a child, please contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-primary mb-4">10. Changes to This Policy</h2>
            <p className="text-text-secondary leading-relaxed">
              We may update this policy from time to time. We will notify you of material changes by posting the new policy on this page and updating the &quot;Last updated&quot; date. Continued use of our services after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-primary mb-4">11. Contact Us</h2>
            <p className="text-text-secondary leading-relaxed">
              If you have questions about this Privacy Policy or our data practices, please contact us at:
            </p>
            <address className="not-italic text-text-secondary leading-relaxed mt-2">
              FlyWithsafety Privacy Team<br />
              123 Travel Street, Suite 100<br />
              New York, NY 10001, USA<br />
              Email: privacy@flywithsafety.com
            </address>
          </section>
        </article>
        </div>
      </section>
    </main>
  );
}
