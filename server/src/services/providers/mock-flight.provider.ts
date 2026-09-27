import type { FlightProvider, FlightSearchParams, FlightSearchResult } from './flight.provider.js';

const AIRLINES = [
  { name: 'Biman Bangladesh Airlines', code: 'BG' },
  { name: 'Air Arabia', code: 'G9' },
  { name: 'Malaysia Airlines', code: 'MH' },
  { name: 'Thai Airways', code: 'TG' },
  { name: 'Singapore Airlines', code: 'SQ' },
  { name: 'Emirates', code: 'EK' },
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function addMinutes(isoDate: string, minutes: number): string {
  const d = new Date(isoDate);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

export class MockFlightProvider implements FlightProvider {
  readonly name = 'MockFlightProvider (Demo)';

  async searchFlights(params: FlightSearchParams): Promise<FlightSearchResult[]> {
    // Simulate realistic response delay
    await new Promise((resolve) => setTimeout(resolve, 200));

    const baseDate = `${params.departureDate}T08:00:00.000Z`;
    const results: FlightSearchResult[] = [];

    const count = randomInt(3, 6);
    for (let i = 0; i < count; i++) {
      const airline = AIRLINES[i % AIRLINES.length];
      const durationMinutes = randomInt(90, 720);
      const departureOffset = i * 90; // stagger departures
      const departureTime = addMinutes(baseDate, departureOffset);
      const arrivalTime = addMinutes(departureTime, durationMinutes);

      const basePrices: Record<string, number> = {
        economy: randomInt(150, 800),
        business: randomInt(800, 3000),
        first: randomInt(2000, 8000),
      };

      results.push({
        id: `mock-${params.from}-${params.to}-${i}-${Date.now()}`,
        airline: airline.name,
        flightNumber: `${airline.code}${randomInt(100, 999)}`,
        from: params.from,
        to: params.to,
        departureTime,
        arrivalTime,
        duration: formatDuration(durationMinutes),
        stops: i === 0 ? 0 : randomInt(0, 1),
        price: basePrices[params.cabinClass] || basePrices.economy,
        currency: 'USD',
        cabinClass: params.cabinClass,
        seatsAvailable: randomInt(2, 20),
        isDemoData: true, // Always true for mock provider
      });
    }

    return results.sort((a, b) => a.price - b.price);
  }
}
