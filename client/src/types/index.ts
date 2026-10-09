export type SearchTab = 'flights' | 'hotels' | 'packages' | 'visa';
export type TripType = 'oneWay' | 'roundTrip' | 'multiCity';

export interface MultiCitySegment {
  id: string;
  from: string;
  to: string;
  departureDate: string;
}

export interface TrendingRoute {
  id: string;
  from: string;
  to: string;
  fromCity: string;
  toCity: string;
  fare: string;
  rank: number;
  isTopRanked?: boolean;
}

export interface PreferredAirline {
  code: string;
  name: string;
  country?: string;
}

export interface FlightSearchParams {
  tripType?: TripType;
  from: string;
  to: string;
  departureDate: string;
  returnDate?: string;
  passengers: number;
  class: 'economy' | 'premiumEconomy' | 'business' | 'first';
  preferredAirlines?: string[];
  multiCitySegments?: MultiCitySegment[];
}

export interface HotelSearchParams {
  destination: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  rooms: number;
}

export interface PackageSearchParams {
  destination: string;
  travelDate: string;
  travellers: number;
}

export interface VisaSearchParams {
  destination: string;
  nationality: string;
}

export interface SearchFormData {
  flights: FlightSearchParams;
  hotels: HotelSearchParams;
  packages: PackageSearchParams;
  visa: VisaSearchParams;
}

export interface Destination {
  id: string;
  name: string;
  country: string;
  price: string;
  image: string;
  imageAlt: string;
  description?: string;
}

export interface Feature {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export interface Partner {
  id: string;
  name: string;
  logo: string;
  alt: string;
}

export interface Testimonial {
  id: string;
  quote: string;
  author: string;
  role?: string;
  avatar?: string;
}

export interface NavLink {
  label: string;
  href: string;
}

export interface FooterColumn {
  title: string;
  links: NavLink[];
}

export interface SocialLink {
  name: string;
  href: string;
  icon: string;
}

export interface PaymentMethod {
  name: string;
  icon: string;
}

export interface ExclusiveDeal {
  id: string;
  title: string;
  subtitle: string;
  tag: string;
  description: string;
  image: string;
  imageAlt: string;
  ctaText: string;
  href: string;
  badge?: string;
  startingPrice?: string;
}

export interface HolidayPackage {
  id: string;
  title: string;
  destination: string;
  country: string;
  duration: string;
  price: string;
  image: string;
  imageAlt: string;
  tags?: string[];
  featured?: boolean;
}