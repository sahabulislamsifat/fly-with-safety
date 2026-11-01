import { Metadata } from 'next';
import { BookingSearch } from '@/components/booking/BookingSearch';
import { Features } from '@/components/features/Features';
import { Partners } from '@/components/partners/Partners';
import { PageHero } from '@/components/ui/PageHero';

export const metadata: Metadata = {
  title: 'Visa Information | FlyWithsafety',
  description:
    'Get up-to-date visa requirements and assistance for your travel destination. FlyWithsafety helps you navigate visa applications with ease.',
  openGraph: {
    title: 'Visa Information | FlyWithsafety',
    description: 'Get up-to-date visa requirements and assistance for your travel destination.',
    type: 'website',
  },
};

export default function VisaInfoPage() {
  return (
    <>
      <PageHero
        id="visa-heading"
        title="Visa information and assistance"
        description="Understand the travel documents you may need before you go, with specialist support when the details matter."
      />

      <div className="page-surface">
        <BookingSearch defaultTab="visa" />
      </div>

      <div className="section container">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-xs p-8 lg:p-12 shadow-card border border-border-light">
            <h2 className="text-2xl font-bold text-text-primary mb-6">How We Help</h2>
            <dl className="space-y-6">
              <div>
                <dt className="font-semibold text-text-primary mb-2">Destination Requirements</dt>
                <dd className="text-text-secondary">
                  Enter your destination and nationality to see current visa requirements, including
                  visa-free entry, visa on arrival, or e-visa eligibility.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-text-primary mb-2">Document Checklist</dt>
                <dd className="text-text-secondary">
                  Get a personalized checklist of required documents based on your travel purpose:
                  tourism, business, transit, or study.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-text-primary mb-2">Processing Times</dt>
                <dd className="text-text-secondary">
                  See estimated processing times and fees for different visa types. Plan ahead to
                  avoid last-minute complications.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-text-primary mb-2">Application Support</dt>
                <dd className="text-text-secondary">
                  Our 24/7 support team can guide you through the application process and connect
                  you with trusted visa service partners.
                </dd>
              </div>
            </dl>

            <div className="mt-8 p-6 bg-bg-secondary rounded-xs">
              <h3 className="text-lg font-semibold text-text-primary mb-3">
                Need Personalized Help?
              </h3>
              <p className="text-text-secondary mb-4">
                Visa rules change frequently. Contact our travel specialists for the most current
                information and assistance with your application.
              </p>
              <a
                href="https://wa.me"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-brand-primary font-medium hover:text-brand-secondary transition-colors"
              >
                Chat on WhatsApp
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>

      <Partners />

      <Features />
    </>
  );
}
