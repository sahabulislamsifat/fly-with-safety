import { get, post } from './client';

export function formatFlightTime(value?: string): string {
  if (!value) return '--:--';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '--:--' : `${date.toISOString().slice(11, 16)} UTC`;
}

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

interface ApiFlightOffer {
  id: string;
  provider: string;
  isDemoData: boolean;
  airline: string;
  airlineCode: string;
  flightNumber: string;
  aircraft: string;
  tripType: FlightOffer['tripType'];
  cabinClass: 'economy' | 'premium_economy' | 'business' | 'first';
  outbound: Omit<FlightLeg, 'airline' | 'flightNumber' | 'aircraft'> & { stops: number };
  inbound?: ApiFlightOffer['outbound'];
  baggage: { cabin: string; checked: string };
  flexibility: { refundable: boolean; changeable: boolean };
  pricing: { baseFare: number; taxes: number; totalPrice: number; currency: string };
  badge?: 'recommended' | 'cheapest' | 'fastest';
}

function baggageKg(value: string): number {
  const match = value.match(/(?:(\d+)\s*x\s*)?(\d+)\s*kg/i);
  return match ? Number(match[1] || 1) * Number(match[2]) : 0;
}

function mapFlightOffer(offer: ApiFlightOffer): FlightOffer {
  const airline = { code: offer.airlineCode, name: offer.airline };
  const legDetails = { airline, flightNumber: offer.flightNumber, aircraft: offer.aircraft };
  return {
    id: offer.id, provider: offer.provider, isDemoData: offer.isDemoData,
    airline, flightNumber: offer.flightNumber, aircraft: offer.aircraft,
    tripType: offer.tripType,
    cabinClass: offer.cabinClass === 'premium_economy' ? 'premiumEconomy' : offer.cabinClass,
    outboundLeg: { ...offer.outbound, ...legDetails },
    returnLeg: offer.inbound ? { ...offer.inbound, ...legDetails } : undefined,
    totalDurationMinutes: offer.outbound.durationMinutes,
    stopsCount: offer.outbound.stops,
    baggageAllowance: { cabinKg: baggageKg(offer.baggage.cabin), checkedKg: baggageKg(offer.baggage.checked) },
    price: { baseAmount: offer.pricing.baseFare, taxAmount: offer.pricing.taxes, totalAmount: offer.pricing.totalPrice, currency: offer.pricing.currency },
    refundable: offer.flexibility.refundable, changeable: offer.flexibility.changeable,
    rankingTags: offer.badge ? [offer.badge] : [],
  };
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
  const response = await post<Omit<FlightSearchResponse, 'offers' | 'results'> & { offers: ApiFlightOffer[]; results: ApiFlightOffer[] }>('/flights/search', {
    ...payload,
    cabinClass: payload.cabinClass === 'premiumEconomy' ? 'premium_economy' : payload.cabinClass,
  });
  const offers = (response.offers || response.results).map(mapFlightOffer);
  return { ...response, offers, results: offers };
}

export async function submitFlightInquiry(payload: FlightInquiryPayload, idempotencyKey: string): Promise<{
  referenceNumber: string;
  inquiry: Record<string, unknown>;
  message: string;
}> {
  return post('/flights/inquiries', payload, { 'Idempotency-Key': idempotencyKey });
}
