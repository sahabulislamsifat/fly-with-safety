'use client';

import Image from 'next/image';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

export interface HeroSlide {
  id: string;
  url: string;
  alt: string;
  location: string;
}

export const heroSlides: HeroSlide[] = [
  {
    id: 'dubai-skyline',
    url: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1920&h=800&fit=crop',
    alt: 'Dubai illuminated skyscrapers and architectural skyline at night',
    location: 'Dubai, UAE',
  },
  {
    id: 'bangkok-skyline',
    url: 'https://images.unsplash.com/photo-1528181304800-259b08848526?w=1920&h=800&fit=crop',
    alt: 'Bangkok vibrant metropolis skyline at golden hour',
    location: 'Bangkok, Thailand',
  },
  {
    id: 'kuala-lumpur-towers',
    url: 'https://t4.ftcdn.net/jpg/16/23/97/79/360_F_1623977935_FWMjLf5lN0iY1FzH1L3HDy1PFPrRytd5.jpg',
    alt: 'Kuala Lumpur skyline with iconic Petronas Twin Towers at dusk',
    location: 'Kuala Lumpur, Malaysia',
  },
  {
    id: 'dubai-marina',
    url: 'https://images.unsplash.com/photo-1580674684081-7617fbf3d745?w=1920&h=800&fit=crop',
    alt: 'Dubai Marina waterfront towers illuminated at twilight',
    location: 'Dubai Marina, UAE',
  },
];

interface HeroCarouselProps {
  activeIndex: number;
}

export function HeroCarousel({ activeIndex }: HeroCarouselProps) {
  const shouldReduceMotion = useReducedMotion();
  const currentSlide = heroSlides[activeIndex] || heroSlides[0];

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={currentSlide.id}
          initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 1.03 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            opacity: { duration: 0.85, ease: 'easeInOut' },
            scale: { duration: 6, ease: 'easeOut' },
          }}
          className="absolute inset-0 w-full h-full"
        >
          <Image
            src={currentSlide.url}
            alt={currentSlide.alt}
            fill
            priority={activeIndex === 0}
            className="object-cover object-center select-none"
            sizes="(max-width: 1440px) 100vw, 1440px"
          />
        </motion.div>
      </AnimatePresence>

      {/* Restrained dark contrast gradient overlay so floating white cards pop with high contrast */}
      <div
        className="absolute inset-0 bg-linear-to-r from-black/60 via-black/35 to-black/55 z-10 pointer-events-none"
        aria-hidden="true"
      />
    </div>
  );
}
