import { Metadata } from "next";
import { BookingSearch } from "@/components/booking/BookingSearch";
import { Destinations } from "@/components/destinations/Destinations";
import { Features } from "@/components/features/Features";
import { Partners } from "@/components/partners/Partners";
import { Testimonials } from "@/components/testimonials/Testimonials";
import { PageHero } from "@/components/ui/PageHero";

export const metadata: Metadata = {
  title: "Travel Packages | FlyWithsafety",
  description: "Discover curated travel packages for popular destinations. All-inclusive deals with flights, hotels, and activities. Book your dream vacation with FlyWithsafety.",
  openGraph: {
    title: "Travel Packages | FlyWithsafety",
    description: "Discover curated travel packages for popular destinations.",
    type: "website",
  },
};

export default function PackagesPage() {
  return (
    <>
      <PageHero
        id="packages-heading"
        title="Curated travel packages"
        description="Bring flights, stays, and experiences into one clear plan for your next journey."
      />

      <div className="page-surface">
        <BookingSearch defaultTab="packages" />
      </div>

      <Destinations />

      <Partners />

      <Features />

      <Testimonials />
    </>
  );
}
