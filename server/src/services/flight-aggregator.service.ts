import type { FlightOffer, FlightSearchParams, FlightProvider } from './providers/flight.provider.js';
import { MockFlightProvider } from './providers/mock-flight.provider.js';

export interface AggregatedFlightResults {
  offers: FlightOffer[];
  totalCount: number;
  stats: {
    cheapestPrice: number;
    fastestDurationMinutes: number;
    recommendedOfferId: string | null;
    cheapestOfferId: string | null;
    fastestOfferId: string | null;
  };
  providers: string[];
  isDemoData: boolean;
  searchParams: FlightSearchParams;
}

export class FlightAggregatorService {
  private providers: FlightProvider[];

  constructor(providers?: FlightProvider[]) {
    this.providers = providers && providers.length > 0
      ? providers
      : [new MockFlightProvider()];
  }

  async aggregate(params: FlightSearchParams, timeoutMs = 5000): Promise<AggregatedFlightResults> {
    // Query providers in parallel with timeout shielding
    const providerPromises = this.providers.map(async (provider) => {
      try {
        const timeoutPromise = new Promise<FlightOffer[]>((_, reject) =>
          setTimeout(() => reject(new Error(`Provider ${provider.name} timed out`)), timeoutMs)
        );
        return await Promise.race([provider.searchFlights(params), timeoutPromise]);
      } catch (err) {
        console.warn(`[FlightAggregator] Provider error for ${provider.name}:`, (err as Error).message);
        return [];
      }
    });

    const resultsByProvider = await Promise.all(providerPromises);
    const rawOffers = resultsByProvider.flat();

    if (rawOffers.length === 0) {
      return {
        offers: [],
        totalCount: 0,
        stats: {
          cheapestPrice: 0,
          fastestDurationMinutes: 0,
          recommendedOfferId: null,
          cheapestOfferId: null,
          fastestOfferId: null,
        },
        providers: this.providers.map((p) => p.name),
        isDemoData: true,
        searchParams: params,
      };
    }

    // Deduplicate by airlineCode + flightNumber + departureTime
    const seen = new Set<string>();
    const deduped: FlightOffer[] = [];
    for (const offer of rawOffers) {
      const key = `${offer.airlineCode}-${offer.flightNumber}-${offer.outbound.departureTime}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(offer);
      }
    }

    // Calculate ranking metrics
    const minPrice = Math.min(...deduped.map((o) => o.pricing.totalPrice));
    const maxPrice = Math.max(...deduped.map((o) => o.pricing.totalPrice)) || minPrice + 1;
    const minDuration = Math.min(...deduped.map((o) => o.outbound.durationMinutes));
    const maxDuration = Math.max(...deduped.map((o) => o.outbound.durationMinutes)) || minDuration + 1;

    let cheapestOffer: FlightOffer = deduped[0];
    let fastestOffer: FlightOffer = deduped[0];
    let recommendedOffer: FlightOffer = deduped[0];
    let bestScore = -Infinity;

    for (const offer of deduped) {
      if (offer.pricing.totalPrice < cheapestOffer.pricing.totalPrice) {
        cheapestOffer = offer;
      }
      if (offer.outbound.durationMinutes < fastestOffer.outbound.durationMinutes) {
        fastestOffer = offer;
      }

      // Normalised score 0-100: 45% price, 35% duration, 20% stops
      const priceFactor = 1 - (offer.pricing.totalPrice - minPrice) / (maxPrice - minPrice || 1);
      const durationFactor = 1 - (offer.outbound.durationMinutes - minDuration) / (maxDuration - minDuration || 1);
      const stopFactor = offer.outbound.stops === 0 ? 1 : offer.outbound.stops === 1 ? 0.7 : 0.4;
      const score = Math.round((priceFactor * 45 + durationFactor * 35 + stopFactor * 20) * 10) / 10;
      offer.score = score;

      if (score > bestScore) {
        bestScore = score;
        recommendedOffer = offer;
      }
    }

    // Assign badges
    for (const offer of deduped) {
      if (offer.id === recommendedOffer.id) {
        offer.badge = 'recommended';
      } else if (offer.id === cheapestOffer.id) {
        offer.badge = 'cheapest';
      } else if (offer.id === fastestOffer.id) {
        offer.badge = 'fastest';
      }
    }

    return {
      offers: deduped,
      totalCount: deduped.length,
      stats: {
        cheapestPrice: cheapestOffer.pricing.totalPrice,
        fastestDurationMinutes: fastestOffer.outbound.durationMinutes,
        recommendedOfferId: recommendedOffer.id,
        cheapestOfferId: cheapestOffer.id,
        fastestOfferId: fastestOffer.id,
      },
      providers: this.providers.map((p) => p.name),
      isDemoData: deduped.some((o) => o.isDemoData),
      searchParams: params,
    };
  }
}

export const flightAggregator = new FlightAggregatorService();
