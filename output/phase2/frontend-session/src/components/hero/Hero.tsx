'use client';

import { useState, useEffect, useCallback } from 'react';
import { HeroCarousel, heroSlides } from './HeroCarousel';
import { DestinationDiscoveryCard } from './DestinationDiscoveryCard';

interface HeroProps {
  children?: React.ReactNode;
  onSelectRoute?: (from: string, to: string) => void;
}

export function Hero({ children, onSelectRoute }: HeroProps) {
  const [activeSlide, setActiveSlide] = useState(0);

  const nextSlide = useCallback(() => {
    setActiveSlide((prev) => (prev + 1) % heroSlides.length);
  }, []);

  // Automatic slide progression every 5.5 seconds, paused when tab is hidden
  useEffect(() => {
    let timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        nextSlide();
      }
    }, 5500);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        clearInterval(timer);
        timer = setInterval(nextSlide, 5500);
      } else {
        clearInterval(timer);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [nextSlide]);

  return (
    <section
      className="relative pt-3 sm:pt-5 pb-6 lg:pb-10"
      aria-label="Homepage hero banner and booking search"
    >
      {/* 1. Wide, Rounded Hero Banner Card */}
      <div className="w-full max-w-433 mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative h-85 sm:h-88.75 lg:h-90 rounded-xs overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.12)]">
          {/* Framer Motion Crossfade Carousel Background */}
          <HeroCarousel activeIndex={activeSlide} />

          {/* Upper-Right Carousel Dash Indicators */}
          <div
            className="absolute top-6 right-6 sm:top-8 sm:right-8 z-20 flex items-center gap-1.5 select-none"
            role="tablist"
            aria-label="Carousel slide selectors"
          >
            {heroSlides.map((slide, idx) => {
              const isActive = activeSlide === idx;
              return (
                <button
                  key={slide.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-label={`Show slide ${idx + 1}: ${slide.location}`}
                  onClick={() => setActiveSlide(idx)}
                  className="p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-xs cursor-pointer"
                >
                  <span
                    className={`block h-1 rounded-xs transition-all duration-300 ${
                      isActive
                        ? 'w-7 sm:w-8 bg-white shadow-2xs'
                        : 'w-4 sm:w-5 bg-white/40 hover:bg-white/70'
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* Floating Destination-Discovery Card inside Upper-Left Area */}
          <div className="absolute top-5 left-5 sm:top-7 sm:left-8 lg:left-12 z-20">
            <DestinationDiscoveryCard onSelectRoute={onSelectRoute} />
          </div>
        </div>
      </div>

      {/* 2. Overlapping Booking Card & Children */}
      {children}
    </section>
  );
}
