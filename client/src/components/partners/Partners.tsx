import { partners } from '@/lib/data/site-data';
import { Card } from '@/components/ui';

export function Partners() {
  return (
    <section className="py-12 sm:py-16 bg-white" aria-labelledby="partners-heading">
      <div className="container">
        <p id="partners-heading" className="text-xs font-semibold text-text-tertiary uppercase tracking-wider text-center mb-8">
          Travel Partner References
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12">
          {partners.map((partner) => (
            <div
              key={partner.id}
              className="flex items-center opacity-70 hover:opacity-100 transition-opacity duration-200"
              role="img"
              aria-label={partner.name}
            >
              <img
                src={partner.logo}
                alt=""
                className="h-8 sm:h-10 max-w-[120px] grayscale"
                loading="lazy"
                width={120}
                height={40}
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-text-muted text-center mt-8">
          Partner logos shown for reference only. Not an official endorsement.
        </p>
      </div>
    </section>
  );
}