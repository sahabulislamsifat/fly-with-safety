'use client';

import { useState } from 'react';
import { Hero } from './Hero';
import { BookingSearch } from '@/components/booking/BookingSearch';
import { TrendingRoutes } from '@/components/booking/TrendingRoutes';

export function HomeHeroSection() {
  const [syncedRoute, setSyncedRoute] = useState<{ from: string; to: string } | null>(null);

  const handleSelectRoute = (from: string, to: string) => {
    setSyncedRoute({ from, to });
    const el = document.getElementById('main-booking-panel');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className="relative">
      <Hero onSelectRoute={handleSelectRoute}>
        <BookingSearch externalRoute={syncedRoute} />
        <TrendingRoutes onSelectRoute={handleSelectRoute} />
      </Hero>
    </div>
  );
}
