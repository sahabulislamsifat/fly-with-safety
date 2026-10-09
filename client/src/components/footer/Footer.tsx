/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link';
import { footerColumns, socialLinks, paymentMethods } from '@/lib/data/site-data';
import { Icon } from '@/components/ui';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-bg-footer text-white" role="contentinfo">
      <div className="max-w-11/12 mx-auto py-16 lg:py-20">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 lg:gap-12 mb-12 lg:mb-16">
          <div className="col-span-2 lg:col-span-1">
            <Link
              href="/"
              className="flex items-center gap-2 text-xl font-bold text-white mb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cta focus-visible:ring-offset-2 focus-visible:ring-offset-bg-footer rounded-xs"
              aria-label="FlyWithSafety Home"
            >
              <Icon name="plane" size={28} className="text-brand-cta" />
              <span>FlyWithSafety</span>
            </Link>
            <p className="text-neutral-400 text-sm leading-relaxed max-w-xs">
              Thoughtful travel planning, easier bookings, and support that stays with you.
            </p>
          </div>

          <nav aria-label="Explore">
            <h3 className="font-semibold text-white mb-4">Explore</h3>
            <ul className="space-y-3">
              {footerColumns[0].links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-neutral-400 hover:text-white transition-colors text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cta focus-visible:ring-offset-2 focus-visible:ring-offset-bg-footer rounded-xs"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Legal">
            <h3 className="font-semibold text-white mb-4">Legal</h3>
            <ul className="space-y-3">
              {footerColumns[1].links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-neutral-400 hover:text-white transition-colors text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cta focus-visible:ring-offset-2 focus-visible:ring-offset-bg-footer rounded-xs"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h3 className="font-semibold text-white mb-4">Payment Options</h3>
            <div className="flex gap-3">
              {paymentMethods.map((method) => (
                <div
                  key={method.name}
                  className="flex items-center gap-2 px-3 py-2 bg-neutral-800/50 rounded-xs border border-neutral-700"
                  role="img"
                  aria-label={method.name}
                >
                  <Icon name={method.icon as any} size={18} className="text-neutral-300" />
                  <span className="text-sm font-medium text-neutral-200">{method.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-8 lg:pt-12 border-t border-neutral-800">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <p className="text-neutral-500 text-sm">
              &copy; {currentYear} FlyWithSafety. All rights reserved.
            </p>

            <nav aria-label="Social media" className="flex items-center gap-4">
              {socialLinks.map((social) => (
                <Link
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-xs bg-neutral-800/50 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cta focus-visible:ring-offset-2 focus-visible:ring-offset-bg-footer"
                  aria-label={social.name}
                >
                  <Icon name={social.icon as any} size={20} />
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}
