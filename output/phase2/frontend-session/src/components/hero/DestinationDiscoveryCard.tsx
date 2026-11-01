'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icons';

interface DestinationDiscoveryCardProps {
  onSelectRoute?: (fromCode: string, toCode: string) => void;
}

export function DestinationDiscoveryCard({ onSelectRoute }: DestinationDiscoveryCardProps) {
  const [currentRoute, setCurrentRoute] = useState({
    from: 'DAC',
    to: 'DXB',
    cityName: 'Dubai',
  });

  const popularPreviewRoutes = [
    { from: 'DAC', to: 'DXB', cityName: 'Dubai' },
    { from: 'DAC', to: 'BKK', cityName: 'Bangkok' },
    { from: 'DAC', to: 'KUL', cityName: 'Kuala Lumpur' },
    { from: 'DAC', to: 'SIN', cityName: 'Singapore' },
  ];

  const handleNextRoute = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const currentIndex = popularPreviewRoutes.findIndex(
      (r) => r.to === currentRoute.to && r.from === currentRoute.from
    );
    const nextRoute = popularPreviewRoutes[(currentIndex + 1) % popularPreviewRoutes.length];
    setCurrentRoute(nextRoute);
    onSelectRoute?.(nextRoute.from, nextRoute.to);
  };

  const handleCardClick = () => {
    onSelectRoute?.(currentRoute.from, currentRoute.to);
    const searchPanel = document.getElementById('main-booking-panel');
    if (searchPanel) {
      searchPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className="relative z-20 w-full max-w-[340px] sm:max-w-[370px] bg-white rounded-xs p-4 sm:p-5 shadow-[0_15px_35px_rgba(0,0,0,0.18)] border border-neutral-100 cursor-pointer transition-all hover:shadow-[0_20px_45px_rgba(0,0,0,0.22)] select-none"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleCardClick();
        }
      }}
      aria-label={`Explore flight from ${currentRoute.from} to ${currentRoute.cityName}`}
    >
      {/* Eyebrow Label */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-[#8B1D24]">
          BOOK FLIGHTS, VISAS, HOTELS &amp; HOLIDAYS
        </span>
      </div>

      {/* Bold Heading */}
      <h2 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight leading-snug mb-3.5">
        Where to <span className="text-[#8B1D24]">Next?</span>
      </h2>

      {/* Route Selector and Code Tiles */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-neutral-100">
        <div className="flex items-center gap-1.5">
          {/* Origin Airport Tiles (DAC) */}
          <div className="flex items-center gap-1">
            {currentRoute.from.split('').map((char, idx) => (
              <span
                key={`from-${idx}`}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-xs border border-neutral-200 bg-neutral-50 flex items-center justify-center font-bold text-xs sm:text-sm text-neutral-800 font-mono shadow-2xs"
              >
                {char}
              </span>
            ))}
          </div>

          {/* Plane / Route Icon */}
          <div className="px-1 text-[#8B1D24]">
            <Icon name="plane" size={15} className="transform rotate-45" />
          </div>

          {/* Destination Airport Tiles (DXB) */}
          <div className="flex items-center gap-1">
            {currentRoute.to.split('').map((char, idx) => (
              <span
                key={`to-${idx}`}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-xs border border-neutral-200 bg-neutral-50 flex items-center justify-center font-bold text-xs sm:text-sm text-neutral-800 font-mono shadow-2xs"
              >
                {char}
              </span>
            ))}
          </div>
        </div>

        {/* Destination Caption & Arrow CTA - rounded-xs */}
        <div className="flex items-center gap-2 pl-2">
          <div className="text-right">
            <span className="block text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-neutral-400">
              FLY TO
            </span>
            <span className="block text-xs sm:text-sm font-bold text-neutral-900 truncate max-w-[70px]">
              {currentRoute.cityName}
            </span>
          </div>

          <button
            type="button"
            onClick={handleNextRoute}
            title="Cycle next popular destination"
            className="w-8 h-8 rounded-xs bg-[#8B1D24] hover:bg-[#74181E] text-white flex items-center justify-center shadow-xs transition-transform hover:scale-105 active:scale-95 cursor-pointer shrink-0"
            aria-label={`Cycle to next destination from ${currentRoute.cityName}`}
          >
            <Icon name="arrowRight" size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
