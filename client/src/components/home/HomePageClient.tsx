'use client';

import { useState } from 'react';
import { Hero } from '@/components/hero/Hero';
import { BookingSearch } from '@/components/booking/BookingSearch';
import { TrendingRoutes } from '@/components/booking/TrendingRoutes';
import { ExclusiveDeals } from '@/components/deals/ExclusiveDeals';
import { PopularDestinations } from '@/components/destinations/PopularDestinations';
import { HolidayPackages } from '@/components/packages/HolidayPackages';
import { WhyFlyWithSafe } from '@/components/features/WhyFlyWithSafe';
import { AirlinePartners } from '@/components/partners/AirlinePartners';
import { TravellerStories } from '@/components/testimonials/TravellerStories';
import { TravelBenefitsBanner } from '@/components/banners/TravelBenefitsBanner';
import { MobileExperience } from '@/components/mobile/MobileExperience';
import { BookingHelpStrip } from '@/components/help/BookingHelpStrip';
import { BackToTop } from '@/components/ui/BackToTop';

export function HomePageClient() {
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
      {/* 1. Hero Background Carousel + Floating Destination Card + Overlapping Booking Form + Trending Routes */}
      <Hero onSelectRoute={handleSelectRoute}>
        <BookingSearch externalRoute={syncedRoute} />
        <TrendingRoutes onSelectRoute={handleSelectRoute} />
      </Hero>

      {/* 2. Exclusive Deals */}
      <ExclusiveDeals />

      {/* 3. Popular Tourist Destinations (Left list + Right animated featured showcase) */}
      <PopularDestinations onSelectRoute={handleSelectRoute} />

      {/* 4. Curated Holiday Packages (Collage grid: 1 large + 3 smaller cards) */}
      <HolidayPackages />

      {/* 5. Why FlyWithSafe / Travel Booking, Done Right (5 feature cards + 1 dark CTA card) */}
      <WhyFlyWithSafe />

      {/* 6. Airline Partners (Dark distinctive section) */}
      <AirlinePartners />

      {/* 7. Traveller Stories / Testimonials (Ratings summary + cards) */}
      <TravellerStories />

      {/* 8. Membership / Travel Benefits Promotion Banner */}
      <TravelBenefitsBanner />

      {/* 9. Mobile Web Experience & WhatsApp Travel Concierge */}
      <MobileExperience />

      {/* 10. Booking Help Strip (Before footer) */}
      <BookingHelpStrip />

      {/* 11. Floating Back-to-Top Button */}
      <BackToTop />
    </div>
  );
}
