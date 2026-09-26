export type SearchTab = 'flights' | 'hotels' | 'packages' | 'visa';

export interface FlightSearchParams {
  from: string;
  to: string;
  departureDate: string;
  returnDate?: string;
  passengers: number;
  class: 'economy' | 'business' | 'first';
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