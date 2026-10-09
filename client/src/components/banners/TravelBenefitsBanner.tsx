'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Icon } from '@/components/ui/Icons';

export function TravelBenefitsBanner() {
  return (
    <section className="py-10 sm:py-16 bg-slate-50" aria-label="Travel Planning Benefits">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="relative rounded-xs overflow-hidden min-h-[340px] sm:min-h-[400px] flex items-center shadow-lg border border-neutral-200"
        >
          {/* Background Image */}
          <Image
            src="https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1600&h=900&fit=crop"
            alt="Cinematic passenger airplane cruising above cloud bank"
            fill
            sizes="(max-width: 1280px) 100vw, 1280px"
            className="object-cover"
          />

          {/* Deep Red / Charcoal Gradient Overlay */}
          <div className="absolute inset-0 bg-linear-to-r from-[#4d1014]/95 via-[#74181E]/90 to-neutral-900/80" />

          {/* Content */}
          <div className="relative z-10 p-6 sm:p-10 lg:p-14 max-w-3xl text-white">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xs bg-white/10 backdrop-blur-xs border border-white/20 text-xs font-bold uppercase tracking-wider text-amber-300 mb-4">
              <Icon name="checkCircle" size={14} />
              <span>FlyWithSafe Privilege</span>
            </div>

            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight mb-3 leading-tight">
              Unlock Seamless Journeys With Expert Travel Planning
            </h2>

            <p className="text-xs sm:text-sm lg:text-base text-neutral-200 leading-relaxed mb-6 max-w-2xl">
              From quick domestic getaways to complex multi-city international itineraries, get dedicated travel desk assistance, fast electronic ticketing, and complete visa documentation guidance under one roof.
            </p>

            {/* Feature Pills / Chips */}
            <div className="flex flex-wrap gap-2.5 mb-8">
              {[
                'Personalized Route Planning',
                'Fast Ticket Issuance',
                'Transparent Airline Fares',
                'Dedicated Visa Advisory',
              ].map((benefit) => (
                <div
                  key={benefit}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xs bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold text-white"
                >
                  <Icon name="check" size={12} className="text-amber-400" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/flights"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xs bg-white hover:bg-neutral-100 text-[#8B1D24] font-bold text-xs sm:text-sm shadow-md transition-all"
              >
                <Icon name="search" size={14} />
                <span>Search Flights Now</span>
              </Link>

              <Link
                href="/contact"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xs bg-transparent hover:bg-white/10 text-white font-bold text-xs sm:text-sm border border-white/40 transition-all"
              >
                <Icon name="headphones" size={14} />
                <span>Speak With Travel Desk</span>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
