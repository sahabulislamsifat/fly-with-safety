import Image from 'next/image';
import Link from 'next/link';
import { destinations } from '@/lib/data/site-data';
import { CardContent, Icon } from '@/components/ui';

export function Destinations() {
  return (
    <section className="section" aria-labelledby="destinations-heading">
      <div className="container">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <p className="text-xs font-semibold text-black uppercase tracking-wider mb-2">
              Ready to Go
            </p>
            <h2 id="destinations-heading" className="text-3xl sm:text-4xl font-bold text-black">
              Popular destinations
            </h2>
          </div>
          <Link
            href="/packages"
            className="inline-flex items-center gap-2 text-sm font-medium text-white hover:text-primary-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 rounded-xs px-3 py-2"
          >
            Plan a custom trip
            <Icon name="chevronRight" size={16} />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {destinations.map((destination) => (
            <article key={destination.id} className="group">
              <Link
                href={`/packages?destination=${destination.id}`}
                className="block rounded-xs overflow-hidden bg-white shadow-card hover:shadow-xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
                aria-label={`View deals for ${destination.name}, ${destination.country}`}
              >
                <div className="relative aspect-4/3 overflow-hidden">
                  <Image
                    src={destination.image}
                    alt={destination.imageAlt}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div
                    className="absolute inset-0 bg-linear-to-t from-black/60 via-black/10 to-transparent"
                    aria-hidden="true"
                  />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xs bg-white/90 backdrop-blur-sm text-sm font-semibold text-text-primary">
                      from {destination.price}
                    </span>
                  </div>
                </div>
                <CardContent className="p-5 pb-6">
                  <h3 className="text-xl font-semibold text-text-primary mb-1">
                    {destination.name}
                  </h3>
                  <p className="text-sm text-text-tertiary mb-4">{destination.country}</p>
                  <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-xs border-2 border-brand-red px-3 py-1.5 text-sm font-semibold text-brand-red transition-colors duration-150 group-hover:bg-brand-red group-hover:text-white">
                    View Deals
                    <Icon name="chevronRight" size={14} />
                  </span>
                </CardContent>
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
