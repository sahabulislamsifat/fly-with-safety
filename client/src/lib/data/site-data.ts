import { Destination, Feature, Partner, Testimonial, NavLink, FooterColumn, SocialLink, PaymentMethod } from '@/types';

export const navLinks: NavLink[] = [
  { label: 'Home', href: '/' },
  { label: 'Flights', href: '/flights' },
  { label: 'Hotels', href: '/hotels' },
  { label: 'Packages', href: '/packages' },
];

export const footerColumns: FooterColumn[] = [
  {
    title: 'Explore',
    links: [
      { label: 'Home', href: '/' },
      { label: 'Flights', href: '/flights' },
      { label: 'Hotels', href: '/hotels' },
      { label: 'Packages', href: '/packages' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Use', href: '/terms' },
    ],
  },
];

export const socialLinks: SocialLink[] = [
  { name: 'Facebook', href: 'https://facebook.com', icon: 'facebook' },
  { name: 'Instagram', href: 'https://instagram.com', icon: 'instagram' },
  { name: 'WhatsApp', href: 'https://wa.me', icon: 'messageCircle' },
];

export const paymentMethods: PaymentMethod[] = [
  { name: 'VISA', icon: 'creditCard' },
  { name: 'Mastercard', icon: 'creditCard' },
  { name: 'bKash', icon: 'smartphone' },
];

export const destinations: Destination[] = [
  {
    id: 'bangkok',
    name: 'Bangkok',
    country: 'Thailand',
    price: '$199',
    image: 'https://images.unsplash.com/photo-1528181304800-259b08848526?w=800&h=600&fit=crop',
    imageAlt: 'Bangkok cityscape with temples and skyscrapers',
    description: 'Vibrant capital with temples, markets, and nightlife',
  },
  {
    id: 'kuala-lumpur',
    name: 'Kuala Lumpur',
    country: 'Malaysia',
    price: '$250',
    image: 'https://images.unsplash.com/photo-1596422846543-75c6fc1ac79f?w=800&h=600&fit=crop',
    imageAlt: 'Kuala Lumpur skyline with Petronas Towers',
    description: 'Modern metropolis with iconic twin towers',
  },
  {
    id: 'coxs-bazar',
    name: "Cox's Bazar",
    country: 'Bangladesh',
    price: '$50',
    image: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800&h=600&fit=crop',
    imageAlt: "Cox's Bazar beach with golden sand and blue water",
    description: 'World\'s longest natural sandy beach',
  },
];

export const features: Feature[] = [
  {
    id: 'secure-bookings',
    icon: 'shield',
    title: '100% Secure Bookings',
    description: 'Clear booking guidance and a safer way to plan your trip.',
  },
  {
    id: 'instant-tickets',
    icon: 'ticket',
    title: 'Instant E-Ticket Issuance',
    description: 'Get your confirmed itinerary delivered without unnecessary waiting.',
  },
  {
    id: 'human-support',
    icon: 'headphones',
    title: '24/7 Human Support',
    description: 'Friendly travel assistance when you need an answer or a hand.',
  },
];

export const partners: Partner[] = [
  {
    id: 'sharetrip',
    name: 'ShareTrip',
    logo: 'https://via.placeholder.com/120x40/1e3a8a/ffffff?text=ShareTrip',
    alt: 'ShareTrip partner logo',
  },
  {
    id: 'agoda',
    name: 'Agoda Partner',
    logo: 'https://via.placeholder.com/120x40/1e3a8a/ffffff?text=Agoda',
    alt: 'Agoda partner logo',
  },
  {
    id: 'biman',
    name: 'Biman',
    logo: 'https://via.placeholder.com/120x40/1e3a8a/ffffff?text=Biman',
    alt: 'Biman partner logo',
  },
  {
    id: 'airasia',
    name: 'AirAsia',
    logo: 'https://via.placeholder.com/120x40/1e3a8a/ffffff?text=AirAsia',
    alt: 'AirAsia partner logo',
  },
];

export const testimonials: Testimonial[] = [
  {
    id: 'testimonial-1',
    quote: 'Booking my flight was super fast and hassle-free! The team helped me find the best deal and I had my e-ticket within minutes.',
    author: 'Sarah Ahmed',
    role: 'Frequent Traveler',
  },
  {
    id: 'testimonial-2',
    quote: 'I\'ve used many travel agencies but FlyWithSafe stands out for their transparency and support. Highly recommended!',
    author: 'Mohammad Rahman',
    role: 'Business Traveler',
  },
  {
    id: 'testimonial-3',
    quote: 'The visa assistance was incredibly helpful. They guided me through the entire process and made it stress-free.',
    author: 'Priya Sharma',
    role: 'Tourist',
  },
];

export const defaultSearchParams = {
  flights: {
    from: 'DAC',
    to: 'KUL',
    departureDate: '',
    returnDate: '',
    passengers: 1,
    class: 'economy' as const,
  },
  hotels: {
    destination: '',
    checkIn: '',
    checkOut: '',
    guests: 2,
    rooms: 1,
  },
  packages: {
    destination: '',
    travelDate: '',
    travellers: 2,
  },
  visa: {
    destination: '',
    nationality: '',
  },
};