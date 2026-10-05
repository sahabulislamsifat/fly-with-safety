import type { FlightProvider, FlightSearchParams, FlightOffer, FlightLeg } from './flight.provider.js';
import { AIRPORTS } from '../airport.service.js';

interface AirlineConfig {
  name: string;
  code: string;
  aircraft: string[];
}

const AIRLINES: AirlineConfig[] = [
  { name: 'Biman Bangladesh Airlines', code: 'BG', aircraft: ['Boeing 787-9 Dreamliner', 'Boeing 777-300ER', 'Boeing 737-800'] },
  { name: 'Emirates', code: 'EK', aircraft: ['Boeing 777-300ER', 'Airbus A380-800'] },
  { name: 'Qatar Airways', code: 'QR', aircraft: ['Airbus A350-900', 'Boeing 787-8 Dreamliner'] },
  { name: 'Singapore Airlines', code: 'SQ', aircraft: ['Airbus A350-900', 'Boeing 787-10'] },
  { name: 'Malaysia Airlines', code: 'MH', aircraft: ['Airbus A330-300', 'Boeing 737-800'] },
  { name: 'Thai Airways', code: 'TG', aircraft: ['Airbus A350-900', 'Boeing 777-300'] },
  { name: 'US-Bangla Airlines', code: 'BS', aircraft: ['Boeing 737-800', 'Airbus A330-300'] },
  { name: 'Air Arabia', code: 'G9', aircraft: ['Airbus A320-200'] },
];

function getAirportInfo(code: string) {
  const match = AIRPORTS.find((a) => a.code.toUpperCase() === code.toUpperCase());
  return {
    code: code.toUpperCase(),
    name: match?.name || `${code.toUpperCase()} Airport`,
    city: match?.city || code.toUpperCase(),
    terminal: '1',
  };
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
  readonly name = 'FlyWithSafe Demo Provider';

  async searchFlights(params: FlightSearchParams): Promise<FlightOffer[]> {
    // Realistic provider latency
    await new Promise((resolve) => setTimeout(resolve, 200));

    const originInfo = getAirportInfo(params.from);
    const destInfo = getAirportInfo(params.to);

    const baseDepartDate = `${params.departureDate}T06:30:00.000Z`;
    const isRoundTrip = params.tripType === 'roundTrip' && Boolean(params.returnDate);
    const baseReturnDate = params.returnDate ? `${params.returnDate}T10:00:00.000Z` : null;

    const offers: FlightOffer[] = [];

    // Create 6 realistic flight offers
    const offerConfigs = [
      { airlineIdx: 0, depHourOffset: 0, duration: 230, stops: 0, stopAirport: undefined, refundable: true },
      { airlineIdx: 1, depHourOffset: 3, duration: 410, stops: 1, stopAirport: 'DXB', refundable: true },
      { airlineIdx: 2, depHourOffset: 6, duration: 390, stops: 1, stopAirport: 'DOH', refundable: true },
      { airlineIdx: 3, depHourOffset: 9, duration: 260, stops: 0, stopAirport: undefined, refundable: false },
      { airlineIdx: 4, depHourOffset: 12, duration: 245, stops: 0, stopAirport: undefined, refundable: false },
      { airlineIdx: 6, depHourOffset: 15, duration: 240, stops: 0, stopAirport: undefined, refundable: true },
    ];

    const cabinMultiplier: Record<string, number> = {
      economy: 1,
      premium_economy: 1.5,
      business: 2.8,
      first: 5.0,
    };
    const mult = cabinMultiplier[params.cabinClass] || 1;

    for (let i = 0; i < offerConfigs.length; i++) {
      const cfg = offerConfigs[i];
      const airline = AIRLINES[cfg.airlineIdx % AIRLINES.length];
      const flightNum = `${airline.code} ${300 + i * 14}`;
      const aircraft = airline.aircraft[i % airline.aircraft.length];

      const outDepTime = addMinutes(baseDepartDate, cfg.depHourOffset * 60);
      const outArrTime = addMinutes(outDepTime, cfg.duration);

      const outbound: FlightLeg = {
        origin: originInfo,
        destination: destInfo,
        departureTime: outDepTime,
        arrivalTime: outArrTime,
        durationMinutes: cfg.duration,
        durationFormatted: formatDuration(cfg.duration),
        stops: cfg.stops,
        stopAirports: cfg.stopAirport ? [cfg.stopAirport] : [],
      };

      let inbound: FlightLeg | undefined;
      if (isRoundTrip && baseReturnDate) {
        const inDepTime = addMinutes(baseReturnDate, (cfg.depHourOffset + 2) * 60);
        const inArrTime = addMinutes(inDepTime, cfg.duration + 15);
        inbound = {
          origin: destInfo,
          destination: originInfo,
          departureTime: inDepTime,
          arrivalTime: inArrTime,
          durationMinutes: cfg.duration + 15,
          durationFormatted: formatDuration(cfg.duration + 15),
          stops: cfg.stops,
          stopAirports: cfg.stopAirport ? [cfg.stopAirport] : [],
        };
      }

      // Calculate realistic BDT price (e.g. 35,000 to 95,000 BDT for economy)
      const basePriceBDT = Math.round((28000 + i * 7200 + (cfg.stops === 0 ? 5000 : 0)) * mult);
      const taxesBDT = Math.round(basePriceBDT * 0.18);
      const travelerCount = params.passengers || 1;
      const totalPerPerson = basePriceBDT + taxesBDT;
      const grandTotal = totalPerPerson * travelerCount;

      const checkedBag = params.cabinClass === 'first' ? '2 x 32 kg' : params.cabinClass === 'business' ? '2 x 30 kg' : '1 x 25 kg';

      offers.push({
        id: `fws-offer-${params.from.toLowerCase()}-${params.to.toLowerCase()}-${airline.code.toLowerCase()}-${i}`,
        airline: airline.name,
        airlineCode: airline.code,
        flightNumber: flightNum,
        aircraft,
        tripType: isRoundTrip ? 'roundTrip' : 'oneWay',
        outbound,
        inbound,
        cabinClass: params.cabinClass,
        baggage: {
          cabin: '7 kg',
          checked: checkedBag,
        },
        flexibility: {
          refundable: cfg.refundable,
          changeable: true,
          cancellationPolicy: cfg.refundable ? 'Free cancellation up to 48h before departure' : 'Non-refundable (cancellation fee applies)',
        },
        pricing: {
          baseFare: basePriceBDT * travelerCount,
          taxes: taxesBDT * travelerCount,
          totalPrice: grandTotal,
          currency: 'BDT',
        },
        // Backwards-compatible root fields
        price: grandTotal,
        currency: 'BDT',
        duration: outbound.durationFormatted,
        stops: outbound.stops,
        departureTime: outbound.departureTime,
        arrivalTime: outbound.arrivalTime,
        from: params.from,
        to: params.to,
        seatsAvailable: 3 + (i * 2) % 9,
        provider: 'FlyWithSafe Mock Aggregator',
        isDemoData: true,
      });
    }

    return offers;
  }
}
