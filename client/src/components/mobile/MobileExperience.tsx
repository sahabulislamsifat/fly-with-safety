'use client';

import { motion } from 'framer-motion';
import { Icon, type IconName } from '@/components/ui/Icons';
import Link from 'next/link';

export function MobileExperience() {
  return (
    <section className="py-14 sm:py-20 bg-white border-t border-neutral-200" aria-labelledby="mobile-exp-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left: Text, Features & WhatsApp Desk CTA */}
          <div className="lg:col-span-7">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-xs bg-[#8B1D24]" />
              <p className="text-xs font-bold text-[#8B1D24] uppercase tracking-wider">
                Mobile Web &amp; WhatsApp Concierge
              </p>
            </div>

            <h2 id="mobile-exp-heading" className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-neutral-900 tracking-tight mb-4">
              Book &amp; Manage Your Trips On The Go
            </h2>

            <p className="text-sm sm:text-base text-neutral-600 leading-relaxed mb-6">
              Experience fast mobile flight searches, check hotel packages, and connect directly with our dedicated travel agents on WhatsApp for immediate fare quotes and reservation assistance.
            </p>

            {/* Feature List */}
            <div className="space-y-3.5 mb-8">
              {(
                [
                  {
                    title: 'Mobile-Optimized Booking Desk',
                    desc: 'Search, compare, and request flights seamlessly from any smartphone or tablet browser.',
                    icon: 'smartphone',
                  },
                  {
                    title: 'Direct WhatsApp Travel Desk',
                    desc: 'Share travel dates with our agents for custom itinerary quotes and rapid ticket issuance.',
                    icon: 'messageCircle',
                  },
                  {
                    title: 'Instant Booking Status Tracking',
                    desc: 'Access your reference code and monitor reservation updates in real time.',
                    icon: 'checkCircle',
                  },
                ] as const satisfies readonly { title: string; desc: string; icon: IconName }[]
              ).map((item) => (
                <div key={item.title} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xs bg-[#8B1D24]/10 text-[#8B1D24] flex items-center justify-center shrink-0 mt-0.5">
                    <Icon name={item.icon} size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900">{item.title}</h3>
                    <p className="text-xs text-neutral-500 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* CTAs + WhatsApp QR box */}
            <div className="flex flex-wrap items-center gap-4">
              <a
                href="https://wa.me"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xs bg-[#128C7E] hover:bg-[#075E54] text-white font-bold text-xs sm:text-sm shadow-sm transition-all"
              >
                <Icon name="messageCircle" size={16} />
                <span>Chat On WhatsApp</span>
              </a>

              <Link
                href="/track-booking"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xs bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs sm:text-sm shadow-sm transition-all"
              >
                <Icon name="search" size={15} />
                <span>Track My Booking</span>
              </Link>
            </div>
          </div>

          {/* Right: Sleek Mobile Visual Card Mockup */}
          <div className="lg:col-span-5 flex justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="w-full max-w-[340px] bg-slate-900 border-2 border-slate-700/80 rounded-xs p-4 shadow-xl text-white"
            >
              {/* Phone top notch bar */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800 text-[11px] text-slate-400">
                <span className="font-mono font-bold text-slate-300">09:41</span>
                <span className="text-[10px] tracking-widest text-[#8B1D24] font-bold">FLYWITHSAFE MOBILE</span>
                <span>5G · 100%</span>
              </div>

              {/* Mobile Ticket Sample Card */}
              <div className="bg-slate-800/90 border border-slate-700 rounded-xs p-4 space-y-3 mb-3 shadow-inner">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wide">
                    Confirmed E-Ticket
                  </span>
                  <span className="font-mono text-[10px] text-slate-400">FWS-89241</span>
                </div>

                <div className="flex items-center justify-between py-2 border-y border-slate-700/60">
                  <div>
                    <span className="text-xl font-black text-white font-mono">DAC</span>
                    <span className="block text-[10px] text-slate-400">Dhaka</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[9px] text-slate-400 font-mono">2h 35m</span>
                    <div className="w-16 h-px bg-slate-600 relative my-1">
                      <span className="absolute left-1/2 -top-1 -translate-x-1/2 text-[10px] text-[#8B1D24]">✈</span>
                    </div>
                    <span className="text-[9px] text-emerald-400 font-bold">Non-stop</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black text-white font-mono">BKK</span>
                    <span className="block text-[10px] text-slate-400">Bangkok</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-300">
                  <span>Passenger: Sarah Ahmed</span>
                  <span className="font-bold text-white">Economy · 30kg</span>
                </div>
              </div>

              {/* QR Code Quick Assistant Box */}
              <div className="bg-white rounded-xs p-3 text-neutral-900 flex items-center gap-3">
                <div className="w-14 h-14 bg-neutral-900 text-white rounded-xs flex items-center justify-center font-mono text-[9px] text-center p-1 font-bold shrink-0">
                  SCAN FOR TRAVEL DESK
                </div>
                <div>
                  <p className="text-xs font-bold text-neutral-900 leading-tight">
                    Scan With Phone Camera
                  </p>
                  <p className="text-[11px] text-neutral-500 mt-0.5 leading-snug">
                    Instantly opens WhatsApp chat with FlyWithSafe booking desk.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
