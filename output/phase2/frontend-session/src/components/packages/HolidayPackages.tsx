'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { holidayPackages } from '@/lib/data/site-data';
import { Icon } from '@/components/ui/Icons';

export function HolidayPackages() {
  const featured = holidayPackages.find((p) => p.featured) || holidayPackages[0];
  const others = holidayPackages.filter((p) => p.id !== featured.id);

  return (
    <section className="py-14 sm:py-20 bg-white" aria-labelledby="holiday-packages-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-xs bg-[#8B1D24]" />
              <p className="text-xs font-bold text-[#8B1D24] uppercase tracking-wider">
                Tailored Itineraries
              </p>
            </div>
            <h2 id="holiday-packages-heading" className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-neutral-900 tracking-tight">
              Curated Holiday Packages
            </h2>
            <p className="text-neutral-500 text-sm sm:text-base mt-2 max-w-2xl">
              Complete vacation experiences combining flights, premium accommodations, airport transfers, and guided tours.
            </p>
          </div>

          <Link
            href="/packages"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#8B1D24] hover:text-[#74181E] transition-colors py-1.5 px-3 rounded-xs border border-neutral-200 hover:border-[#8B1D24]/30 shadow-2xs shrink-0 self-start sm:self-end"
          >
            <span>All Packages</span>
            <Icon name="chevronRight" size={14} />
          </Link>
        </div>

        {/* Collage Grid: 1 Large Featured Card + 3 Smaller Side/Bottom Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Large Featured Card (lg:col-span-7) */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="lg:col-span-7 group relative rounded-xs overflow-hidden border border-neutral-200 shadow-sm hover:shadow-lg transition-all duration-300 min-h-[380px] sm:min-h-[460px] flex flex-col justify-end bg-neutral-900"
          >
            <Image
              src={featured.image}
              alt={featured.imageAlt}
              fill
              sizes="(max-width: 1024px) 100vw, 58vw"
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

            <div className="relative p-6 sm:p-8 text-white z-10">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="px-2.5 py-1 rounded-xs bg-[#8B1D24] text-white text-[10px] font-bold uppercase tracking-wider shadow-xs">
                  Featured Experience
                </span>
                <span className="px-2.5 py-1 rounded-xs bg-black/60 backdrop-blur-xs text-white/90 text-[10px] font-bold">
                  {featured.duration}
                </span>
                <span className="px-2.5 py-1 rounded-xs bg-amber-400 text-neutral-900 text-[10px] font-black">
                  Starting {featured.price}
                </span>
              </div>

              <h3 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white mb-2 leading-tight">
                {featured.title}
              </h3>
              <p className="text-xs sm:text-sm text-neutral-200 max-w-lg mb-4">
                {featured.destination}, {featured.country}
              </p>

              {/* Tags */}
              {featured.tags && (
                <div className="flex flex-wrap gap-2 mb-5">
                  {featured.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[11px] px-2.5 py-0.5 rounded-xs bg-white/20 backdrop-blur-xs text-white border border-white/20"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <Link
                href={`/packages?destination=bangkok`}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xs bg-[#8B1D24] hover:bg-[#74181E] text-white text-xs sm:text-sm font-bold shadow-md transition-all cursor-pointer"
              >
                <span>View Package Details</span>
                <Icon name="chevronRight" size={14} />
              </Link>
            </div>
          </motion.div>

          {/* 3 Smaller Cards (lg:col-span-5) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            {others.map((pkg, idx) => (
              <motion.article
                key={pkg.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.45, delay: idx * 0.1, ease: 'easeOut' }}
                className="group flex flex-col sm:flex-row bg-white border border-neutral-200 rounded-xs overflow-hidden shadow-2xs hover:shadow-md transition-all duration-200"
              >
                <div className="relative w-full sm:w-44 h-36 sm:h-auto shrink-0 bg-neutral-100 overflow-hidden">
                  <Image
                    src={pkg.image}
                    alt={pkg.imageAlt}
                    fill
                    sizes="(max-width: 640px) 100vw, 176px"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-linear-to-t sm:bg-linear-to-r from-black/60 to-transparent pointer-events-none" />
                  <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-xs bg-black/70 backdrop-blur-xs text-white text-[10px] font-bold">
                    {pkg.duration}
                  </span>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B1D24]">
                        {pkg.country}
                      </span>
                      <span className="text-xs font-black text-neutral-900 font-mono">
                        {pkg.price}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-neutral-900 group-hover:text-[#8B1D24] transition-colors line-clamp-1">
                      {pkg.title}
                    </h4>
                    <p className="text-xs text-neutral-500 mt-1 line-clamp-1">
                      {pkg.destination}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-neutral-100 flex items-center justify-between">
                    <span className="text-[10px] text-neutral-400">
                      Flights + Stay + Transfers
                    </span>
                    <Link
                      href={`/packages?destination=${pkg.destination.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#8B1D24] hover:underline"
                    >
                      <span>Inquire</span>
                      <Icon name="chevronRight" size={12} />
                    </Link>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
