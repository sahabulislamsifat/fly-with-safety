'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { destinations } from '@/lib/data/site-data';
import { Icon } from '@/components/ui/Icons';

interface PopularDestinationsProps {
  onSelectRoute?: (from: string, to: string) => void;
}

const destinationAirportMap: Record<string, string> = {
  bangkok: 'BKK',
  'kuala-lumpur': 'KUL',
  'coxs-bazar': 'CXB',
  dubai: 'DXB',
  singapore: 'SIN',
  jeddah: 'JED',
};

export function PopularDestinations({ onSelectRoute }: PopularDestinationsProps) {
  const [activeId, setActiveId] = useState<string>(destinations[0]?.id || 'bangkok');
  const activeDest = destinations.find((d) => d.id === activeId) || destinations[0];
  const airportCode = destinationAirportMap[activeDest.id] || 'BKK';

  const handleQuickBook = () => {
    if (onSelectRoute) {
      onSelectRoute('DAC', airportCode);
    }
  };

  return (
    <section className="py-14 sm:py-20 bg-slate-50 border-t border-neutral-200" aria-labelledby="popular-destinations-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-xs bg-brand-red" />
              <p className="text-xs font-bold text-brand-red uppercase tracking-wider">
                Explore The World
              </p>
            </div>
            <h2 id="popular-destinations-heading" className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-neutral-900 tracking-tight">
              Popular Tourist Destinations
            </h2>
            <p className="text-neutral-500 text-sm sm:text-base mt-2 max-w-2xl">
              Select your next getaway from top-traveled leisure and cultural capitals across South and Southeast Asia, the Middle East, and beyond.
            </p>
          </div>

          <Link
            href="/flights/results?from=DAC&to=BKK&tripType=roundTrip"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-brand-red hover:text-[#74181E] transition-colors py-1.5 px-3 rounded-xs border border-neutral-200 hover:border-brand-red/30 shadow-2xs shrink-0 self-start sm:self-end bg-white"
          >
            <span>View All Flights</span>
            <Icon name="chevronRight" size={14} />
          </Link>
        </div>

        {/* Two-Part Layout: Left Vertical List + Right Large Featured Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
          {/* Left: Vertical Destination List */}
          <div className="lg:col-span-5 flex flex-col gap-2.5">
            {destinations.map((dest) => {
              const isSelected = dest.id === activeId;
              const code = destinationAirportMap[dest.id] || 'AIR';
              return (
                <button
                  key={dest.id}
                  type="button"
                  onClick={() => setActiveId(dest.id)}
                  className={`w-full text-left p-3.5 sm:p-4 rounded-xs border transition-all duration-200 flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-white border-brand-red shadow-md ring-1 ring-brand-red/20'
                      : 'bg-white/80 hover:bg-white border-neutral-200/80 hover:border-neutral-300 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xs flex items-center justify-center font-mono font-bold text-xs shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-brand-red text-white'
                          : 'bg-neutral-100 text-neutral-600'
                      }`}
                    >
                      {code}
                    </div>
                    <div className="truncate">
                      <p className={`text-sm font-bold truncate ${isSelected ? 'text-brand-red' : 'text-neutral-900'}`}>
                        {dest.name}
                      </p>
                      <p className="text-xs text-neutral-500 truncate">
                        {dest.country}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0 ml-3">
                    <span className="text-xs font-bold text-neutral-700 font-mono">
                      {dest.price}
                    </span>
                    <div
                      className={`w-6 h-6 rounded-xs flex items-center justify-center transition-colors ${
                        isSelected ? 'bg-brand-red/10 text-brand-red' : 'text-neutral-300'
                      }`}
                    >
                      <Icon name="chevronRight" size={14} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right: Large Featured Destination Showcase Card */}
          <div className="lg:col-span-7 relative min-h-105 sm:min-h-120 rounded-xs overflow-hidden border border-neutral-200 shadow-lg bg-neutral-900">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeDest.id}
                initial={{ opacity: 0, scale: 1.02 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: 'easeInOut' }}
                className="absolute inset-0 w-full h-full"
              >
                <Image
                  src={activeDest.image}
                  alt={activeDest.imageAlt}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 58vw"
                  className="object-cover"
                />
                {/* Gradient Masks */}
                <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/30 to-black/20" />
                <div className="absolute inset-0 bg-linear-to-r from-black/60 via-transparent to-transparent" />

                {/* Content Overlay */}
                <div className="absolute inset-0 p-6 sm:p-8 lg:p-10 flex flex-col justify-between text-white">
                  {/* Top Bar inside card */}
                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xs bg-black/60 backdrop-blur-md border border-white/10 text-xs font-bold text-white uppercase tracking-wider">
                      <span className="w-2 h-2 rounded-xs bg-brand-red" />
                      <span>{activeDest.country}</span>
                    </div>

                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-xs bg-black/60 backdrop-blur-md border border-white/10 text-xs font-bold text-amber-300">
                      <span>Fares from</span>
                      <span className="font-mono text-sm text-white">{activeDest.price}</span>
                    </div>
                  </div>

                  {/* Bottom details & CTAs */}
                  <div>
                    <span className="text-xs font-mono font-bold text-white/70 uppercase tracking-widest block mb-1">
                      DIRECT OR 1-STOP ROUTE · DAC ➔ {airportCode}
                    </span>
                    <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight mb-2">
                      {activeDest.name}
                    </h3>
                    <p className="text-sm sm:text-base text-neutral-200 max-w-xl line-clamp-3 mb-6 leading-relaxed">
                      {activeDest.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={handleQuickBook}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xs bg-brand-red hover:bg-[#74181E] text-white text-xs sm:text-sm font-bold shadow-md transition-all cursor-pointer"
                      >
                        <Icon name="plane" size={14} />
                        <span>Search Flights to {activeDest.name}</span>
                      </button>

                      <Link
                        href={`/packages?destination=${activeDest.id}`}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xs bg-white/20 hover:bg-white/30 backdrop-blur-md text-white text-xs sm:text-sm font-bold border border-white/20 transition-all"
                      >
                        <Icon name="calendar" size={14} />
                        <span>View Packages</span>
                      </Link>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
