'use client';

import { Icon } from '@/components/ui/Icons';

export function BookingHelpStrip() {
  return (
    <section className="py-6 sm:py-8 bg-slate-900 border-t border-slate-800 text-white" aria-label="Customer Booking Support">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Left: Support info */}
          <div className="flex items-center gap-4 text-center md:text-left">
            <div className="w-12 h-12 rounded-xs bg-[#8B1D24] text-white flex items-center justify-center shrink-0 shadow-sm">
              <Icon name="headphones" size={24} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white leading-tight">
                Need Help With Flight Or Visa Reservations?
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Our certified travel consultants are available 24 Hours a day · 7 Days a week.
              </p>
            </div>
          </div>

          {/* Right: Working Contact Links with rounded-xs */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href="tel:+8801700000000"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs sm:text-sm font-bold text-white transition-all shadow-2xs"
            >
              <Icon name="phone" size={14} className="text-[#8B1D24]" />
              <span>+880 1700-000000</span>
            </a>

            <a
              href="mailto:support@flywithsafe.com"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs sm:text-sm font-bold text-white transition-all shadow-2xs"
            >
              <Icon name="mail" size={14} className="text-[#8B1D24]" />
              <span>support@flywithsafe.com</span>
            </a>

            <a
              href="https://wa.me"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xs bg-[#128C7E] hover:bg-[#075E54] text-xs sm:text-sm font-bold text-white transition-all shadow-2xs"
            >
              <Icon name="messageCircle" size={14} />
              <span>WhatsApp Desk</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
