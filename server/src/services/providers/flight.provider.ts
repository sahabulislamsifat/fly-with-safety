export interface AirportInfo {
  code: string;
  name: string;
  city: string;
  terminal?: string;
}

export interface FlightLeg {
  origin: AirportInfo;
  destination: AirportInfo;
  departureTime: string; // ISO
  arrivalTime: string;   // ISO
  durationMinutes: number;
  durationFormatted: string;
  stops: number;
  stopAirports?: string[];
}

export interface FlightOffer {
  id: string;
  airline: string;
  airlineCode: string;
  flightNumber: string;
  aircraft: string;
  tripType: 'roundTrip' | 'oneWay' | 'multiCity';
  outbound: FlightLeg;
  inbound?: FlightLeg;
  cabinClass: 'economy' | 'premium_economy' | 'business' | 'first';
  baggage: {
    cabin: string;
    checked: string;
  };
  flexibility: {
    refundable: boolean;
    changeable: boolean;
    cancellationPolicy: string;
  };
  pricing: {
    baseFare: number;
    taxes: number;
    totalPrice: number;
    currency: string;
  };
  // Backwards-compatible root fields for older references
  price: number;
  currency: string;
  duration: string;
  stops: number;
  departureTime: string;
  arrivalTime: string;
  from: string;
  to: string;
  seatsAvailable: number;
  provider: string;
  isDemoData: boolean;
  score?: number;
  badge?: 'recommended' | 'cheapest' | 'fastest';
}

export interface FlightSearchParams {
  tripType?: 'roundTrip' | 'oneWay' | 'multiCity';
  from: string;
  to: string;
  departureDate: string;
  returnDate?: string;
  adults?: number;
  children?: number;
  infants?: number;
  passengers: number;
  cabinClass: 'economy' | 'premium_economy' | 'business' | 'first';
}

export interface FlightProvider {
  name: string;
  searchFlights(params: FlightSearchParams): Promise<FlightOffer[]>;
}
