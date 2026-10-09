'use client';

import { useMemo } from 'react';
import { preferredAirlinesList } from '@/lib/data/site-data';
import type { PreferredAirline } from '@/types';
import { Icon } from '@/components/ui/Icons';
import { Marquee } from '@/components/ui/marquee';

function AirlineCard({ airline }: { airline: PreferredAirline }) {
  return (
    <div className="group w-52 sm:w-60 h-24 sm:h-26 shrink-0 bg-neutral-800/80 hover:bg-neutral-800 border border-neutral-700/70 hover:border-[#8B1D24]/60 rounded-xs p-3.5 sm:p-4 transition-all duration-200 flex flex-col justify-between select-none">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-bold text-amber-400/90 bg-neutral-900/80 px-2 py-0.5 rounded-xs border border-neutral-700">
          {airline.code}
        </span>
        <div className="w-5 h-5 rounded-xs bg-neutral-700/60 group-hover:bg-[#8B1D24] text-neutral-400 group-hover:text-white flex items-center justify-center transition-colors">
          <Icon name="plane" size={11} ariaHidden={true} />
        </div>
      </div>

      <div>
        <p className="text-xs sm:text-sm font-bold text-white group-hover:text-amber-200 transition-colors line-clamp-1 leading-snug">
          {airline.name}
        </p>
        {airline.country && (
          <p className="text-[10px] text-neutral-400 mt-0.5 truncate">
            {airline.country}
          </p>
        )}
      </div>
    </div>
  );
}

export function AirlinePartners() {
  const { firstRow, secondRow } = useMemo(() => {
    const list = preferredAirlinesList || [];
    return {
      firstRow: list.filter((_, idx) => idx % 2 === 0),
      secondRow: list.filter((_, idx) => idx % 2 !== 0),
    };
  }, []);

  return (
    <section
      className="py-14 sm:py-20 bg-neutral-900 text-white border-t border-neutral-800 overflow-hidden"
      aria-labelledby="airline-partners-heading"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-xs bg-[#8B1D24]" />
            <p className="text-xs font-bold text-red-400 uppercase tracking-wider">
              World Class Carriers
            </p>
          </div>
          <h2
            id="airline-partners-heading"
            className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight"
          >
            Fly With The World&apos;s Leading Airlines
          </h2>
          <p className="text-neutral-400 text-sm sm:text-base mt-2">
            Access competitive schedules, fares, and baggage policies from verified domestic and international airline distribution networks.
          </p>
        </div>

        {/* Dual Opposing Marquee Container with Gradient Edge Fades */}
        <div className="relative overflow-hidden flex flex-col gap-4 py-2">
          {/* Left / Right gradient edge fades */}
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-16 sm:w-28 bg-linear-to-r from-neutral-900 via-neutral-900/80 to-transparent z-10"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-16 sm:w-28 bg-linear-to-l from-neutral-900 via-neutral-900/80 to-transparent z-10"
            aria-hidden="true"
          />

          {/* Row 1: Right-to-Left (default direction) */}
          {firstRow.length > 0 && (
            <Marquee
              pauseOnHover
              className="[--duration:30s] [--gap:1rem] py-1"
            >
              {firstRow.map((airline) => (
                <AirlineCard key={`row1-${airline.code}`} airline={airline} />
              ))}
            </Marquee>
          )}

          {/* Row 2: Left-to-Right (reverse) */}
          {secondRow.length > 0 && (
            <Marquee
              reverse
              pauseOnHover
              className="[--duration:34s] [--gap:1rem] py-1"
            >
              {secondRow.map((airline) => (
                <AirlineCard key={`row2-${airline.code}`} airline={airline} />
              ))}
            </Marquee>
          )}
        </div>

        {/* Compliance Footer Note */}
        <div className="mt-10 pt-6 border-t border-neutral-800/80 text-center">
          <p className="text-xs text-neutral-400 max-w-2xl mx-auto">
            Schedules and ticket issuance are fulfilled across verified GDS networks, IATA-accredited agency partners, and official airline reservation portals.
          </p>
        </div>
      </div>
    </section>
  );
}
