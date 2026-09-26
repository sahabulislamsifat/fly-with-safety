import { Hero } from "@/components/hero/Hero";
import { BookingSearch } from "@/components/booking/BookingSearch";
import { Partners } from "@/components/partners/Partners";
import { Features } from "@/components/features/Features";
import { Destinations } from "@/components/destinations/Destinations";
import { Testimonials } from "@/components/testimonials/Testimonials";

export default function Home() {
  return (
    <>
      <Hero />
      <BookingSearch />
      <Partners />
      <Features />
      <Destinations />
      <Testimonials />
    </>
  );
}