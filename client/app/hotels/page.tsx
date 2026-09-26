import { Metadata } from "next";
import { BookingSearch } from "@/components/booking/BookingSearch";
import { Features } from "@/components/features/Features";
import { Partners } from "@/components/partners/Partners";

export const metadata: Metadata = {
  title: "Book Hotels | FlyWithSafe",
  description: "Find and book hotels worldwide with FlyWithSafe. Compare prices, read reviews, and enjoy secure bookings with instant confirmation.",
  openGraph: {
    title: "Book Hotels | FlyWithSafe",
    description: "Find and book hotels worldwide with FlyWithSafe.",
    type: "website",
  },
};

export default function HotelsPage() {
  return (
    <>
      <section className="relative min-h-[50vh] sm:min-h-[60vh] flex items-center bg-gradient-to-b from-brand-primary/90 to-brand-primary/70" aria-labelledby="hotels-heading">
        <div className="container py-20 lg:py-28">
          <div className="max-w-3xl text-center mx-auto">
            <h1 id="hotels-heading" className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6">
              Find Your Perfect Stay
            </h1>
            <p className="text-lg sm:text-xl text-white/90 leading-relaxed mb-8 max-w-xl mx-auto">
              Browse thousands of hotels, compare prices, and book with confidence. Secure bookings with instant confirmation.
            </p>
          </div>
        </div>
      </section>

      <BookingSearch defaultTab="hotels" />

      <Partners />

      <Features />
    </>
  );
}