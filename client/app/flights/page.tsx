import { Metadata } from "next";
import { BookingSearch } from "@/components/booking/BookingSearch";
import { Features } from "@/components/features/Features";
import { Partners } from "@/components/partners/Partners";

export const metadata: Metadata = {
  title: "Book Flights | FlyWithSafe",
  description: "Search and book affordable flights worldwide with FlyWithSafe. Compare prices, find the best deals, and get instant e-tickets with 24/7 support.",
  openGraph: {
    title: "Book Flights | FlyWithSafe",
    description: "Search and book affordable flights worldwide with FlyWithSafe.",
    type: "website",
  },
};

export default function FlightsPage() {
  return (
    <>
      <section className="relative min-h-[50vh] sm:min-h-[60vh] flex items-center bg-gradient-to-b from-brand-primary/90 to-brand-primary/70" aria-labelledby="flights-heading">
        <div className="container py-20 lg:py-28">
          <div className="max-w-3xl text-center mx-auto">
            <h1 id="flights-heading" className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6">
              Book Flights with Confidence
            </h1>
            <p className="text-lg sm:text-xl text-white/90 leading-relaxed mb-8 max-w-xl mx-auto">
              Search thousands of routes, compare prices, and get instant e-tickets. Safe, simple, and supported 24/7.
            </p>
          </div>
        </div>
      </section>

      <div className="py-6 px-4">
        <BookingSearch defaultTab="flights" isOverlapping={false} />
      </div>

      <Partners />

      <Features />
    </>
  );
}