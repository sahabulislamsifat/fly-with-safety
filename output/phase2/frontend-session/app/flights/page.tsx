import { Metadata } from "next";
import { BookingSearch } from "@/components/booking/BookingSearch";
import { Features } from "@/components/features/Features";
import { Partners } from "@/components/partners/Partners";
import { PageHero } from "@/components/ui/PageHero";

export const metadata: Metadata = {
  title: "Book Flights | FlyWithsafety",
  description: "Search and book affordable flights worldwide with FlyWithsafety. Compare prices, find the best deals, and get instant e-tickets with 24/7 support.",
  openGraph: {
    title: "Book Flights | FlyWithsafety",
    description: "Search and book affordable flights worldwide with FlyWithsafety.",
    type: "website",
  },
};

export default function FlightsPage() {
  return (
    <>
      <PageHero
        id="flights-heading"
        title="Book flights with confidence"
        description="Search routes, compare options, and get a clear next step from booking to departure."
      />

      <div className="page-surface px-4">
        <BookingSearch defaultTab="flights" isOverlapping={false} />
      </div>

      <Partners />

      <Features />
    </>
  );
}
