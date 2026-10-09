'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { features } from '@/lib/data/site-data';
import { Icon, type IconName } from '@/components/ui/Icons';

export function WhyFlyWithSafe() {
  return (
    <section className="py-14 sm:py-20 bg-slate-50 border-t border-neutral-200" aria-labelledby="why-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-xs bg-[#8B1D24]" />
            <p className="text-xs font-bold text-[#8B1D24] uppercase tracking-wider">
              Travel Booking, Done Right
            </p>
          </div>
          <h2 id="why-heading" className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-neutral-900 tracking-tight">
            Why Book With FlyWithSafe
          </h2>
          <p className="text-neutral-500 text-sm sm:text-base mt-2">
            Transparent travel planning backed by verified airline inventories, real human booking agents, and personalized customer care.
          </p>
        </div>

        {/* 6-Card Grid: 5 Feature Cards + 1 Contrasting Featured CTA Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
          {features.map((feature, idx) => (
            <motion.div
              key={feature.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.45, delay: idx * 0.08, ease: 'easeOut' }}
              className="bg-white border border-neutral-200 rounded-xs p-6 shadow-2xs hover:shadow-md hover:border-neutral-300 transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="w-11 h-11 rounded-xs bg-[#8B1D24]/10 text-[#8B1D24] flex items-center justify-center mb-5">
                  <Icon name={feature.icon as IconName} size={22} />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-neutral-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-neutral-100 flex items-center gap-2 text-xs font-semibold text-[#8B1D24]">
                <Icon name="check" size={14} />
                <span>Verified Service Promise</span>
              </div>
            </motion.div>
          ))}

          {/* 6th Card: Contrasting Featured Call-To-Action Card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.45, delay: 0.4, ease: 'easeOut' }}
            className="bg-linear-to-br from-neutral-900 via-neutral-900 to-[#4d1014] text-white border border-neutral-800 rounded-xs p-6 shadow-md flex flex-col justify-between relative overflow-hidden"
          >
            <div className="relative z-10">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xs bg-white/10 text-amber-300 text-[10px] font-bold uppercase tracking-wider mb-4 border border-white/10">
                <Icon name="star" size={12} />
                <span>Agency Travel Desk</span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-white mb-2 leading-snug">
                Need Group Flights or Custom Itinerary?
              </h3>
              <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed mb-6">
                Speak directly with our senior travel specialists for corporate arrangements, family group discounts, and urgent booking confirmations.
              </p>
            </div>

            <div className="relative z-10 pt-4 border-t border-white/10 flex flex-col sm:flex-row gap-2.5">
              <Link
                href="/contact"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xs bg-[#8B1D24] hover:bg-[#74181E] text-white text-xs font-bold transition-all shadow-xs"
              >
                <span>Contact Travel Desk</span>
                <Icon name="chevronRight" size={13} />
              </Link>
              <Link
                href="/track-booking"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xs bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all"
              >
                <span>Track Booking</span>
              </Link>
            </div>

            {/* Subtle background glow */}
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-[#8B1D24]/20 rounded-xs blur-2xl pointer-events-none" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
