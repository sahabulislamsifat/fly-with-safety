import type { HotelProvider, HotelSearchParams, HotelSearchResult } from './hotel.provider.js';

const HOTELS: Array<{ name: string; stars: number; amenities: string[] }> = [
  { name: 'Grand Horizon Hotel', stars: 5, amenities: ['Pool', 'Spa', 'WiFi', 'Gym', 'Restaurant', 'Concierge'] },
  { name: 'City Center Suites', stars: 4, amenities: ['WiFi', 'Breakfast', 'Gym', 'Restaurant'] },
  { name: 'Comfort Inn Express', stars: 3, amenities: ['WiFi', 'Parking', 'Breakfast'] },
  { name: 'Skyline Boutique Hotel', stars: 4, amenities: ['WiFi', 'Rooftop Bar', 'Gym', 'Restaurant'] },
  { name: 'Budget Travellers Lodge', stars: 2, amenities: ['WiFi', 'Parking'] },
];

const UNSPLASH_HOTEL_IMAGES = [
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&h=600&fit=crop',
];

function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(checkIn);
  const b = new Date(checkOut);
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)));
}

export class MockHotelProvider implements HotelProvider {
  readonly name = 'FlyWithSafe Mock Hotel Aggregator';

  async searchHotels(params: HotelSearchParams): Promise<HotelSearchResult[]> {
    await new Promise((resolve) => setTimeout(resolve, 100));

    const nights = nightsBetween(params.checkIn, params.checkOut);
    const destSlug = params.destination.toLowerCase().replace(/[^a-z0-9]/g, '');

    return HOTELS.map((hotel, i) => {
      // Deterministic pricing and stats
      const basePerNight = hotel.stars * 35 + i * 15;
      const pricePerNight = basePerNight;
      const totalPrice = pricePerNight * nights * params.rooms;

      return {
        id: `fws-hotel-${destSlug}-${i}`,
        name: `${hotel.name} ${params.destination}`,
        destination: params.destination,
        starRating: hotel.stars,
        pricePerNight,
        totalPrice,
        currency: 'USD',
        amenities: hotel.amenities,
        imageUrl: UNSPLASH_HOTEL_IMAGES[i % UNSPLASH_HOTEL_IMAGES.length],
        reviewScore: +(3.8 + hotel.stars * 0.2 + (i % 3) * 0.1).toFixed(1),
        reviewCount: 140 + i * 65,
        isDemoData: true,
      };
    }).sort((a, b) => a.totalPrice - b.totalPrice);
  }
}
