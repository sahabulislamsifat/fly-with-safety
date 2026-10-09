'use client';

import { useRef } from 'react';
import { trendingRoutes } from '@/lib/data/site-data';
import { TrendingRoute } from '@/types';
import { Icon } from '@/components/ui/Icons';

interface TrendingRoutesProps {
  onSelectRoute?: (from: string, to: string) => void;
}

export function TrendingRoutes({ onSelectRoute }: TrendingRoutesProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const offset = direction === 'left' ? -260 : 260;
      scrollContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const handleRouteClick = (route: TrendingRoute) => {
    onSelectRoute?.(route.from, route.to);
    const searchPanel = document.getElementById('main-booking-panel');
    if (searchPanel) {
      searchPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className="w-full max-w-[1380px] mx-auto px-4 sm:px-6 mt-14 sm:mt-16 mb-8 select-none">
      <div className="rounded-xs bg-white border border-slate-200/90 shadow-[0_4px_20px_rgba(0,0,0,0.04)] py-2 sm:py-2.5 px-3 sm:px-5 flex items-center justify-between gap-3 overflow-hidden">
        {/* Left: Branding & Title */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xs bg-red-50 text-[#8B1D24] flex items-center justify-center shrink-0 shadow-2xs">
            <Icon name="flame" size={19} />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-black text-neutral-900 leading-tight whitespace-nowrap">
              Trending Routes
            </h3>
            <p className="text-[10px] sm:text-[11px] text-neutral-400 font-medium whitespace-nowrap mt-0.5">
              Most searched · lowest fare
            </p>
          </div>
          <div className="h-7 w-[1px] bg-neutral-200 ml-2 mr-1 hidden sm:block shrink-0" />
        </div>

        {/* Center: Scrollable Route Chips */}
        <div
          ref={scrollContainerRef}
          className="flex-1 flex items-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar scroll-smooth px-1"
        >
          {trendingRoutes.map((route) => {
            return (
              <button
                key={route.id}
                type="button"
                onClick={() => handleRouteClick(route)}
                className="group flex items-center gap-2 px-3 py-1.5 sm:py-2 rounded-xs border border-neutral-200/80 bg-neutral-50/50 hover:bg-white hover:border-[#8B1D24]/40 hover:shadow-sm transition-all duration-150 cursor-pointer shrink-0"
                title={`${route.fromCity} to ${route.toCity}`}
                aria-label={`Select route ${route.from} to ${route.to} from ${route.fare}`}
              >
                {/* Rank Badge - rounded-xs */}
                <span
                  className={`w-5 h-5 rounded-xs flex items-center justify-center text-[11px] font-black shrink-0 ${
                    route.isTopRanked
                      ? 'bg-[#8B1D24] text-white shadow-2xs'
                      : 'bg-neutral-200 text-neutral-600'
                  }`}
                >
                  {route.rank}
                </span>

                {/* Airport Codes */}
                <span className="font-extrabold text-xs text-neutral-900 flex items-center gap-1">
                  <span>{route.from}</span>
                  <span className="text-neutral-400 text-[10px] group-hover:text-[#8B1D24] transition-colors">
                    →
                  </span>
                  <span>{route.to}</span>
                </span>

                {/* Fare */}
                <span className="text-[11px] text-neutral-500 font-semibold pl-1 whitespace-nowrap">
                  <span className="text-[9px] text-neutral-400 font-normal">from </span>
                  <span className="font-bold text-neutral-800">{route.fare}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Right: Carousel Pagination Controls */}
        <div className="flex items-center gap-1.5 shrink-0 pl-1 border-l border-neutral-100 hidden sm:flex">
          <button
            type="button"
            onClick={() => scroll('left')}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-xs border border-neutral-200 text-neutral-500 hover:text-neutral-900 hover:border-neutral-400 hover:bg-neutral-50 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Scroll left in trending routes"
          >
            <Icon name="chevronLeft" size={15} />
          </button>
          <button
            type="button"
            onClick={() => scroll('right')}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-xs border border-neutral-200 text-neutral-500 hover:text-neutral-900 hover:border-neutral-400 hover:bg-neutral-50 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Scroll right in trending routes"
          >
            <Icon name="chevronRight" size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
