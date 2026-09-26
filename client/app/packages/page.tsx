import { Metadata } from "next";
import { BookingSearch } from "@/components/booking/BookingSearch";
import { Destinations } from "@/components/destinations/Destinations";
import { Features } from "@/components/features/Features";
import { Partners } from "@/components/partners/Partners";
import { Testimonials } from "@/components/testimonials/Testimonials";

export const metadata: Metadata = {
  title: "Travel Packages | FlyWithSafe",
  description: "Discover curated travel packages for popular destinations. All-inclusive deals with flights, hotels, and activities. Book your dream vacation with FlyWithSafe.",
  openGraph: {
    title: "Travel Packages | FlyWithSafe",
    description: "Discover curated travel packages for popular destinations.",
    type: "website",
  },
};

export default function PackagesPage() {
  return (
    <>
      <section className="relative min-h-[50vh] sm:min-h-[60vh] flex items-center bg-gradient-to-b from-brand-primary/90 to-brand-primary/70" aria-labelledby="packages-heading">
        <div className="container py-20 lg:py-28">
          <div className="max-w-3xl text-center mx-auto">
            <h1 id="packages-heading" className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6">
              Curated Travel Packages
            </h1>
            <p className="text-lg sm:text-xl text-white/90 leading-relaxed mb-8 max-w-xl mx-auto">
              Hand-picked packages with flights, hotels, and experiences. Stress-free planning for your next adventure.
            </p>
          </div>
        </div>
      </section>

      <BookingSearch defaultTab="packages" />

      <Destinations />

      <Partners />

      <Features />

      <Testimonials />
    </>
  );
}