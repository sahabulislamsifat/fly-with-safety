import { Metadata } from "next";
import { BookingSearch } from "@/components/booking/BookingSearch";
import { Features } from "@/components/features/Features";
import { Partners } from "@/components/partners/Partners";
import { PageHero } from "@/components/ui/PageHero";

export const metadata: Metadata = {
  title: "Book Hotels | FlyWithsafety",
  description: "Find and book hotels worldwide with FlyWithsafety. Compare prices, read reviews, and enjoy secure bookings with instant confirmation.",
  openGraph: {
    title: "Book Hotels | FlyWithsafety",
    description: "Find and book hotels worldwide with FlyWithsafety.",
    type: "website",
  },
};

export default function HotelsPage() {
  return (
    <>
      <PageHero
        id="hotels-heading"
        title="Find your perfect stay"
        description="Compare trusted hotels and reserve with clear details and support whenever you need it."
      />

      <div className="page-surface">
        <BookingSearch defaultTab="hotels" />
      </div>

      <Partners />

      <Features />
    </>
  );
}
