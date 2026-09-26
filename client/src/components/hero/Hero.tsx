import Image from 'next/image';
import { Icon } from '@/components/ui/Icons';

export function Hero() {
  return (
    <section
      className="relative min-h-[70vh] sm:min-h-[80vh] lg:min-h-[90vh] flex items-center"
      aria-labelledby="hero-heading"
    >
      <div className="absolute inset-0 z-0">
        <Image
          src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1920&h=1080&fit=crop"
          alt=""
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-primary/70 via-brand-primary/60 to-brand-primary/80" />
      </div>

      <div className="relative z-10 container py-20 lg:py-32">
        <div className="max-w-3xl">
          <p className="text-sm sm:text-base font-medium text-white/90 uppercase tracking-wider mb-4">
            <Icon name="shield" size={16} className="inline-block mr-2" />
            TRAVEL MADE REASSURING
          </p>
          <h1
            id="hero-heading"
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6 text-balance"
          >
            EXPLORE THE WORLD{' '}
            <span className="text-brand-cta">WITH SAFETY</span>
          </h1>
          <p className="text-lg sm:text-xl text-white/90 leading-relaxed mb-8 max-w-xl">
            Find best deals on Flights, Hotels & Packages
          </p>
        </div>
      </div>
    </section>
  );
}