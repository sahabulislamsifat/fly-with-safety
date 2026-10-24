import { Metadata } from "next";
import { PageHero } from "@/components/ui/PageHero";

export const metadata: Metadata = {
  title: "Terms of Use | FlyWithsafety",
  description: "Read FlyWithsafety's terms of use governing your use of our travel booking platform and services.",
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  const lastUpdated = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="flex-1">
      <PageHero id="terms-heading" title="Terms of use" />

      <section className="page-surface">
        <div className="container max-w-3xl rounded-xs border border-border-light bg-white px-6 py-10 shadow-card sm:px-10 sm:py-12">
        <p className="text-text-tertiary text-sm mb-8 text-center">Last updated: {lastUpdated}</p>

        <article className="space-y-10">
          <section>
            <h2 className="text-2xl font-bold text-text-primary mb-4">1. Acceptance of Terms</h2>
            <p className="text-text-secondary leading-relaxed">
              By accessing and using FlyWithsafety&apos;s website and services, you agree to be bound by these Terms of Use and all applicable laws and regulations. If you do not agree with any part of these terms, you may not use our services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-primary mb-4">2. Description of Services</h2>
            <p className="text-text-secondary leading-relaxed mb-4">
              FlyWithsafety provides a travel booking platform that enables users to search, compare, and book flights, hotels, travel packages, and access visa information. We act as an intermediary between you and travel service providers.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-primary mb-4">3. Booking and Payment</h2>
            <p className="text-text-secondary leading-relaxed mb-4">
              When you make a booking through FlyWithsafety:
            </p>
            <ul className="list-disc list-inside space-y-2 text-text-secondary">
              <li>You are entering into a contract directly with the travel service provider (airline, hotel, etc.)</li>
              <li>FlyWithsafety facilitates the booking but is not the service provider</li>
              <li>Payment terms and cancellation policies are set by the service provider</li>
              <li>You are responsible for providing accurate information for all bookings</li>
              <li>Prices and availability are subject to change until booking is confirmed</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-primary mb-4">4. Changes and Cancellations</h2>
            <p className="text-text-secondary leading-relaxed mb-4">
              Changes and cancellations are governed by the policies of the respective travel service provider. FlyWithsafety will assist you with modifications to the extent permitted by the provider&apos;s terms. Fees may apply.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-primary mb-4">5. Travel Documents and Requirements</h2>
            <p className="text-text-secondary leading-relaxed mb-4">
              You are solely responsible for:
            </p>
            <ul className="list-disc list-inside space-y-2 text-text-secondary">
              <li>Obtaining valid passports, visas, and other required travel documents</li>
              <li>Meeting entry requirements for your destination</li>
              <li>Complying with health and vaccination requirements</li>
              <li>Checking travel advisories and restrictions</li>
            </ul>
            <p className="text-text-secondary leading-relaxed mt-4">
              FlyWithsafety provides visa information as a courtesy but does not guarantee its accuracy or completeness. Always verify requirements with official government sources.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-primary mb-4">6. User Conduct</h2>
            <p className="text-text-secondary leading-relaxed mb-4">
              You agree not to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-text-secondary">
              <li>Use our services for any unlawful or prohibited purpose</li>
              <li>Interfere with or disrupt our platform or servers</li>
              <li>Attempt to gain unauthorized access to accounts or systems</li>
              <li>Use automated systems to scrape or extract data</li>
              <li>Make fraudulent or speculative bookings</li>
              <li>Impersonate any person or entity</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-primary mb-4">7. Intellectual Property</h2>
            <p className="text-text-secondary leading-relaxed">
              All content on the FlyWithsafety platform, including text, graphics, logos, images, and software, is the property of FlyWithsafety or its licensors and is protected by intellectual property laws. You may not reproduce, distribute, or create derivative works without written permission.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-primary mb-4">8. Disclaimers</h2>
            <p className="text-text-secondary leading-relaxed mb-4">
              OUR SERVICES ARE PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
            <p className="text-text-secondary leading-relaxed">
              We do not warrant that the platform will be uninterrupted, error-free, or free of viruses. Travel information, prices, and availability are provided by third parties and may contain inaccuracies.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-primary mb-4">9. Limitation of Liability</h2>
            <p className="text-text-secondary leading-relaxed mb-4">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, FLYWITHsafety SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR BUSINESS OPPORTUNITIES, ARISING FROM YOUR USE OF OUR SERVICES.
            </p>
            <p className="text-text-secondary leading-relaxed">
              Our total liability for any claim shall not exceed the amount you paid to FlyWithsafety in the 12 months preceding the claim, or $100, whichever is greater.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-primary mb-4">10. Indemnification</h2>
            <p className="text-text-secondary leading-relaxed">
              You agree to indemnify and hold FlyWithsafety harmless from any claims, damages, losses, and expenses (including reasonable attorneys&apos; fees) arising from your use of our services, violation of these terms, or infringement of any third-party rights.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-primary mb-4">11. Governing Law and Disputes</h2>
            <p className="text-text-secondary leading-relaxed mb-4">
              These terms are governed by the laws of the State of New York, USA, without regard to conflict of law principles. Any disputes shall be resolved through binding arbitration in New York, NY, in accordance with the rules of the American Arbitration Association.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-primary mb-4">12. Termination</h2>
            <p className="text-text-secondary leading-relaxed">
              We may suspend or terminate your access to our services at any time for violation of these terms or for any other reason, with or without notice. Provisions that should survive termination will survive.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-primary mb-4">13. General</h2>
            <p className="text-text-secondary leading-relaxed mb-4">
              These terms constitute the entire agreement between you and FlyWithsafety. If any provision is found unenforceable, the remaining provisions will continue in effect. Our failure to enforce a right does not waive it.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-primary mb-4">14. Contact Information</h2>
            <p className="text-text-secondary leading-relaxed">
              Questions about these Terms of Use? Contact us at:
            </p>
            <address className="not-italic text-text-secondary leading-relaxed mt-2">
              FlyWithsafety Legal Team<br />
              123 Travel Street, Suite 100<br />
              New York, NY 10001, USA<br />
              Email: legal@flywithsafety.com
            </address>
          </section>
        </article>
        </div>
      </section>
    </div>
  );
}
