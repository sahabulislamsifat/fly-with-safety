import { Metadata } from 'next';
import { Features } from '@/components/features/Features';
import { Partners } from '@/components/partners/Partners';
import { ContactForm } from '@/components/contact/ContactForm';
import { Icon } from '@/components/ui/Icons';

export const metadata: Metadata = {
  title: 'Contact Us | FlyWithSafe',
  description:
    'Get in touch with FlyWithSafe for travel assistance, booking support, or general inquiries. Our team is available 24/7 to help you.',
  openGraph: {
    title: 'Contact Us | FlyWithSafe',
    description: 'Get in touch with FlyWithSafe for travel assistance.',
    type: 'website',
  },
};

export default function ContactPage() {
  return (
    <>
      <section
        className="relative min-h-[50vh] sm:min-h-[60vh] flex items-center bg-gradient-to-b from-brand-primary/90 to-brand-primary/70"
        aria-labelledby="contact-heading"
      >
        <div className="container py-20 lg:py-28">
          <div className="max-w-3xl text-center mx-auto">
            <h1
              id="contact-heading"
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6"
            >
              We&apos;re Here to Help
            </h1>
            <p className="text-lg sm:text-xl text-white/90 leading-relaxed mb-8 max-w-xl mx-auto">
              Have questions about your booking? Need travel advice? Our friendly support team is
              available around the clock.
            </p>
          </div>
        </div>
      </section>

      <section className="section container">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xs p-8 lg:p-12 shadow-card border border-border-light">
              <h2 className="text-2xl font-bold text-text-primary mb-6">Send us a Message</h2>
              <ContactForm />
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xs p-8 shadow-card border border-border-light">
              <h3 className="text-lg font-semibold text-text-primary mb-4">24/7 Support</h3>
              <p className="text-text-secondary mb-6">
                Our travel specialists are available around the clock to assist with bookings,
                changes, and emergencies.
              </p>
              <a
                href="https://wa.me"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 w-full bg-emerald-600 text-white px-6 py-4 rounded-xs font-medium hover:bg-emerald-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 justify-center"
              >
                <Icon name="messageCircle" size={22} />
                <span>Chat on WhatsApp</span>
              </a>
            </div>

            <div className="bg-white rounded-xs p-8 shadow-card border border-border-light">
              <h3 className="text-lg font-semibold text-text-primary mb-4">
                Other Ways to Reach Us
              </h3>
              <ul className="space-y-4">
                <li className="flex items-center gap-3 text-text-secondary">
                  <Icon name="mail" size={20} className="text-brand-primary flex-shrink-0" />
                  <a
                    href="mailto:support@flywithsafe.com"
                    className="hover:text-brand-primary transition-colors"
                  >
                    support@flywithsafe.com
                  </a>
                </li>
                <li className="flex items-center gap-3 text-text-secondary">
                  <Icon name="phone" size={20} className="text-brand-primary flex-shrink-0" />
                  <a href="tel:+18005550000" className="hover:text-brand-primary transition-colors">
                    +1 (800) 555-0000
                  </a>
                </li>
                <li className="flex items-center gap-3 text-text-secondary">
                  <Icon name="mapPin" size={20} className="text-brand-primary flex-shrink-0" />
                  <address className="not-italic hover:text-brand-primary transition-colors">
                    123 Travel Street, Suite 100
                    <br />
                    New York, NY 10001, USA
                  </address>
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-xs p-8 shadow-card border border-border-light">
              <h3 className="text-lg font-semibold text-text-primary mb-4">Business Hours</h3>
              <dl className="space-y-2 text-text-secondary">
                <div className="flex justify-between">
                  <dt>Monday - Friday</dt>
                  <dd className="font-medium">24 Hours</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Saturday</dt>
                  <dd className="font-medium">24 Hours</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Sunday</dt>
                  <dd className="font-medium">24 Hours</dd>
                </div>
                <div className="flex justify-between border-t border-border-light pt-2">
                  <dt>Holidays</dt>
                  <dd className="font-medium">24 Hours</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      <Partners />

      <Features />
    </>
  );
}
