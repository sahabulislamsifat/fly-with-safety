'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { exclusiveDeals } from '@/lib/data/site-data';
import { Icon } from '@/components/ui/Icons';

export function ExclusiveDeals() {
  return (
    <section className="py-14 sm:py-20 bg-white" aria-labelledby="deals-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-xs bg-[#8B1D24]" />
              <p className="text-xs font-bold text-[#8B1D24] uppercase tracking-wider">
                Handpicked Offers
              </p>
            </div>
            <h2
              id="deals-heading"
              className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-neutral-900 tracking-tight"
            >
              Exclusive Travel Deals
            </h2>
            <p className="text-neutral-500 text-sm sm:text-base mt-2 max-w-2xl">
              Curated seasonal flights, hotel packages, and holiday escapes with dedicated agency
              booking support.
            </p>
          </div>

          <Link
            href="/packages"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#8B1D24] hover:text-[#74181E] transition-colors py-1.5 px-3 rounded-xs border border-neutral-200 hover:border-[#8B1D24]/30 shadow-2xs shrink-0 self-start sm:self-end"
          >
            <span>Explore All Offers</span>
            <Icon name="chevronRight" size={14} />
          </Link>
        </div>

        {/* Deals Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {exclusiveDeals.map((deal, idx) => (
            <motion.article
              key={deal.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.45, delay: idx * 0.08, ease: 'easeOut' }}
              className="group flex flex-col bg-white border border-neutral-200 rounded-xs shadow-2xs hover:shadow-md transition-all duration-300 overflow-hidden"
            >
              {/* Card Image */}
              <div className="relative aspect-16/10 w-full overflow-hidden bg-neutral-100">
                <Image
                  src={deal.image}
                  alt={deal.imageAlt}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

                {/* Badge */}
                {deal.badge && (
                  <div className="absolute top-3 left-3">
                    <span className="px-2 py-0.5 rounded-xs bg-[#8B1D24] text-white text-[10px] font-bold tracking-wide uppercase shadow-xs">
                      {deal.badge}
                    </span>
                  </div>
                )}

                {/* Tag */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white/90">
                    {deal.tag}
                  </span>
                  {deal.startingPrice && (
                    <span className="text-xs font-black bg-black/60 backdrop-blur-xs px-2 py-0.5 rounded-xs text-amber-300">
                      {deal.startingPrice}
                    </span>
                  )}
                </div>
              </div>

              {/* Card Content */}
              <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-bold text-neutral-900 group-hover:text-[#8B1D24] transition-colors leading-snug">
                    {deal.title}
                  </h3>
                  <p className="text-xs font-semibold text-[#8B1D24] mt-0.5 mb-2">
                    {deal.subtitle}
                  </p>
                  <p className="text-xs text-neutral-600 line-clamp-2 leading-relaxed">
                    {deal.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between">
                  <Link
                    href={deal.href}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xs bg-neutral-900 hover:bg-[#8B1D24] text-white text-xs font-bold transition-colors shadow-2xs cursor-pointer"
                  >
                    <span>{deal.ctaText}</span>
                    <Icon name="chevronRight" size={13} />
                  </Link>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
