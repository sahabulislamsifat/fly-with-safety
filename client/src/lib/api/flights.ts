import { get, post } from './client';

export interface Airport {
  code: string;
  name: string;
  city: string;
  country: string;
  isPopular?: boolean;
}

export interface FlightLeg {
  origin: {
    code: string;
    name: string;
    city: string;
    terminal?: string;
  };
  destination: {
    code: string;
    name: string;
    city: string;
    terminal?: string;
  };
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  flightNumber: string;
  aircraft?: string;
  airline: {
    code: string;
    name: string;
    logoUrl?: string;
  };
}

export interface FlightOffer {
  id: string;
  provider: string;
  isDemoData: boolean;
  airline: {
    code: string;
    name: string;
    logoUrl?: string;
  };
  flightNumber: string;
  aircraft?: string;
  tripType: 'roundTrip' | 'oneWay' | 'multiCity';
  cabinClass: 'economy' | 'premiumEconomy' | 'business' | 'first';
  outboundLeg: FlightLeg;
  returnLeg?: FlightLeg;
  totalDurationMinutes: number;
  stopsCount: number;
  baggageAllowance: {
    cabinKg: number;
    checkedKg: number;
  };
  price: {
    baseAmount: number;
    taxAmount: number;
    totalAmount: number;
    currency: string;
  };
  refundable: boolean;
  changeable: boolean;
  deepLink?: string;
  rankingTags?: ('cheapest' | 'fastest' | 'recommended')[];
}

export interface FlightSearchResponse {
  results: FlightOffer[];
  offers: FlightOffer[];
  stats: {
    cheapestPrice: number;
    fastestDurationMinutes: number;
    recommendedOfferId: string | null;
    cheapestOfferId: string | null;
    fastestOfferId: string | null;
  };
  totalCount: number;
  provider: string;
  isDemoData: boolean;
  searchParams: Record<string, unknown>;
}

export interface FlightSearchPayload {
  tripType?: 'roundTrip' | 'oneWay' | 'multiCity';
  from: string;
  to: string;
  departureDate: string;
  returnDate?: string;
  adults?: number;
  children?: number;
  infants?: number;
  passengers?: number;
  cabinClass?: 'economy' | 'premiumEconomy' | 'business' | 'first';
}

export interface FlightInquiryPayload {
  from: string;
  to: string;
  departureDate: string;
  returnDate?: string;
  tripType?: 'roundTrip' | 'oneWay' | 'multiCity';
  adults?: number;
  children?: number;
  infants?: number;
  passengers?: number;
  cabinClass?: 'economy' | 'premium_economy' | 'business' | 'first';
  name: string;
  email: string;
  phone?: string;
  notes?: string;
}

export async function searchAirports(query = ''): Promise<{ airports: Airport[] }> {
  const qs = query ? `?q=${encodeURIComponent(query)}` : '';
  return get<{ airports: Airport[] }>(`/airports/search${qs}`);
}

export async function searchFlights(payload: FlightSearchPayload): Promise<FlightSearchResponse> {
  return post<FlightSearchResponse>('/flights/search', payload);
}

export async function submitFlightInquiry(payload: FlightInquiryPayload, idempotencyKey: string): Promise<{
  referenceNumber: string;
  inquiry: Record<string, unknown>;
  message: string;
}> {
  return post('/flights/inquiries', payload, { 'Idempotency-Key': idempotencyKey });
}
