import {
  Destination,
  Feature,
  Partner,
  Testimonial,
  NavLink,
  FooterColumn,
  SocialLink,
  PaymentMethod,
  TrendingRoute,
  PreferredAirline,
  ExclusiveDeal,
  HolidayPackage,
} from '@/types';
import { Airport } from '@/lib/api/flights';

export const navLinks: NavLink[] = [
  { label: 'Home', href: '/' },
  { label: 'Flights', href: '/flights' },
  { label: 'Hotels', href: '/hotels' },
  { label: 'Packages', href: '/packages' },
  { label: 'Visa Info', href: '/visa-info' },
  { label: 'Track Booking', href: '/track-booking' },
  { label: 'Contact', href: '/contact' },
];

export const footerColumns: FooterColumn[] = [
  {
    title: 'Explore',
    links: [
      { label: 'Home', href: '/' },
      { label: 'Flights', href: '/flights' },
      { label: 'Hotels', href: '/hotels' },
      { label: 'Packages', href: '/packages' },
      { label: 'Visa Info', href: '/visa-info' },
      { label: 'Track Booking', href: '/track-booking' },
    ],
  },
  {
    title: 'Support & Legal',
    links: [
      { label: 'Contact Us', href: '/contact' },
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
    price: '৳28,946',
    image: 'https://images.unsplash.com/photo-1528181304800-259b08848526?w=1200&h=800&fit=crop',
    imageAlt: 'Bangkok cityscape with Grand Palace and Chao Phraya river',
    description:
      'Vibrant capital with historic temples, floating markets, world-class shopping, and night street food.',
  },
  {
    id: 'kuala-lumpur',
    name: 'Kuala Lumpur',
    country: 'Malaysia',
    price: '৳32,924',
    image:
      'https://t4.ftcdn.net/jpg/00/61/75/53/360_F_61755388_cA3jlJE8QfHo2wTAtpgAlRIRQLQNABvc.jpg',
    imageAlt: 'Kuala Lumpur skyline with illuminated Petronas Twin Towers',
    description:
      'Dynamic Southeast Asian metropolis featuring the iconic Petronas Towers, Batu Caves, and culinary diversity.',
  },
  {
    id: 'coxs-bazar',
    name: "Cox's Bazar",
    country: 'Bangladesh',
    price: '৳4,315',
    image: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1200&h=800&fit=crop',
    imageAlt: "Cox's Bazar beach with golden sunset sand and ocean waves",
    description:
      "The world's longest natural unbroken sea beach with serene coastal beauty and fresh seafood dining.",
  },
  {
    id: 'dubai',
    name: 'Dubai',
    country: 'United Arab Emirates',
    price: '৳41,200',
    image: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1200&h=800&fit=crop',
    imageAlt: 'Dubai skyline with Burj Khalifa and desert glow',
    description:
      'World-renowned architectural marvels, luxury shopping festivals, and exhilarating desert safaris.',
  },
  {
    id: 'singapore',
    name: 'Singapore',
    country: 'Singapore',
    price: '৳39,800',
    image: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=1200&h=800&fit=crop',
    imageAlt: 'Singapore Marina Bay Sands and Supertree Grove',
    description:
      'Futuristic city-state with lush urban gardens, Changi Jewel attractions, and diverse multicultural heritage.',
  },
  {
    id: 'jeddah',
    name: 'Jeddah',
    country: 'Saudi Arabia',
    price: '৳56,146',
    image: 'https://images.unsplash.com/photo-1578895101408-1a36b834405b?w=1200&h=800&fit=crop',
    imageAlt: 'Historic Jeddah Al-Balad coral architecture and Red Sea coast',
    description:
      'Gateway to the holy sanctuaries with historic Al-Balad architecture, modern corniche, and Red Sea shores.',
  },
];

export const exclusiveDeals: ExclusiveDeal[] = [
  {
    id: 'deal-1',
    title: 'Southeast Asia Special',
    subtitle: 'Dhaka to Bangkok Return',
    tag: 'FLIGHT OFFER',
    badge: 'Limited Time',
    description:
      'Special agency promotional fares on direct flights with standard 30kg baggage allowance included.',
    startingPrice: 'From ৳28,946',
    image: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=800&h=500&fit=crop',
    imageAlt: 'Bangkok Wat Arun temple at twilight',
    ctaText: 'View Flight Deal',
    href: '/flights/results?from=DAC&to=BKK&tripType=roundTrip',
  },
  {
    id: 'deal-2',
    title: 'Malaysia Twin City Break',
    subtitle: 'Kuala Lumpur & Genting',
    tag: 'COMBO SAVINGS',
    badge: 'Popular Choice',
    description:
      'Curated 4-night stay packages with roundtrip flight assistance and cable car highland excursion.',
    startingPrice: 'From ৳38,500',
    image: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=800&h=500&fit=crop',
    imageAlt: 'Kuala Lumpur city lights and modern architecture',
    ctaText: 'Explore Package',
    href: '/packages?destination=kuala-lumpur',
  },
  {
    id: 'deal-3',
    title: 'Cox’s Bazar Coastal Weekend',
    subtitle: 'Dhaka to Cox’s Bazar',
    tag: 'DOMESTIC ESCAPE',
    badge: 'Instant Confirmation',
    description:
      'Weekend beach getaways with prime morning departure slots and resort transport guidance.',
    startingPrice: 'From ৳4,315',
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=500&fit=crop',
    imageAlt: 'Tropical sandy beach and turquoise ocean water',
    ctaText: 'Check Fares',
    href: '/flights/results?from=DAC&to=CXB&tripType=oneWay',
  },
  {
    id: 'deal-4',
    title: 'Dubai Luxury & Desert Safari',
    subtitle: 'Direct Flights + 4-Star Stay',
    tag: 'HOTEL & FLIGHT',
    badge: 'Top Rated',
    description:
      'Experience Dubai Marina, Burj Khalifa views, and authentic dune dining with full visa assistance.',
    startingPrice: 'From ৳58,200',
    image: 'https://images.unsplash.com/photo-1518684079-3c830dcef090?w=800&h=500&fit=crop',
    imageAlt: 'Dubai desert dunes under golden sky',
    ctaText: 'View Details',
    href: '/packages?destination=dubai',
  },
];

export const holidayPackages: HolidayPackage[] = [
  {
    id: 'pkg-thailand-grand',
    title: 'Thailand Highlights: Bangkok & Phuket',
    destination: 'Bangkok & Phuket',
    country: 'Thailand',
    duration: '5 Nights · 6 Days',
    price: '৳48,500',
    featured: true,
    tags: ['Best Seller', 'Flight + 4★ Hotel', 'Breakfast Included'],
    image: 'https://images.unsplash.com/photo-1506665531195-3566af2b4dfa?w=1200&h=800&fit=crop',
    imageAlt: 'Spectacular limestone islands in Phang Nga Bay Phuket',
  },
  {
    id: 'pkg-malaysia-escape',
    title: 'Malaysia Urban & Highlands Discovery',
    destination: 'Kuala Lumpur',
    country: 'Malaysia',
    duration: '4 Nights · 5 Days',
    price: '৳39,900',
    tags: ['Twin Towers Tour', 'Batu Caves', 'Highland Cable Car'],
    image: 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=800&h=600&fit=crop',
    imageAlt: 'Kuala Lumpur street and skyline',
  },
  {
    id: 'pkg-dubai-safari',
    title: 'Dubai Wonder: City, Marina & Desert Safari',
    destination: 'Dubai',
    country: 'United Arab Emirates',
    duration: '4 Nights · 5 Days',
    price: '৳62,000',
    tags: ['Burj Khalifa Pass', 'Desert BBQ Safari', 'Airport Transfer'],
    image: 'https://images.unsplash.com/photo-1546412414-e1885259563a?w=800&h=600&fit=crop',
    imageAlt: 'Dubai Marina skyscraper waterfront',
  },
  {
    id: 'pkg-cxb-retreat',
    title: 'Cox’s Bazar Luxury Beach Resort Retreat',
    destination: "Cox's Bazar",
    country: 'Bangladesh',
    duration: '3 Nights · 4 Days',
    price: '৳14,500',
    tags: ['5★ Beachfront Resort', 'Daily Buffet', 'Himchari Tour'],
    image: 'https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?w=800&h=600&fit=crop',
    imageAlt: 'Tropical coastal sea retreat with palm trees',
  },
];

export const features: Feature[] = [
  {
    id: 'convenient-booking',
    icon: 'search',
    title: 'Convenient Booking Requests',
    description:
      'Search domestic and international routes with instant agency desk confirmations and seamless reservation assistance.',
  },
  {
    id: 'clear-information',
    icon: 'shield',
    title: 'Clear Travel Information',
    description:
      'Transparent baggage policies, transit durations, and fare breakdowns with zero hidden booking surprises.',
  },
  {
    id: 'human-support',
    icon: 'headphones',
    title: '24/7 Human Booking Support',
    description:
      'Direct phone and WhatsApp support from dedicated travel agents ready to handle date changes, cancellations, and special requests.',
  },
  {
    id: 'easy-planning',
    icon: 'ticket',
    title: 'Easy Trip Planning',
    description:
      'Coordinate flights, vetted hotel stays, and custom holiday packages with unified agency assistance from start to finish.',
  },
  {
    id: 'secure-handling',
    icon: 'check',
    title: 'Secure Information Handling',
    description:
      'All passenger passport details, itineraries, and booking inquiries are processed securely and handled with strict confidentiality.',
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
    quote:
      'Booking my flight was super fast and hassle-free! The team helped me find the best deal and I had my e-ticket within minutes.',
    author: 'Sarah Ahmed',
    role: 'Frequent Traveler',
  },
  {
    id: 'testimonial-2',
    quote:
      "I've used many travel agencies but FlyWithSafe stands out for their transparency and support. Highly recommended!",
    author: 'Mohammad Rahman',
    role: 'Business Traveler',
  },
  {
    id: 'testimonial-3',
    quote:
      'The visa assistance was incredibly helpful. They guided me through the entire process and made it stress-free.',
    author: 'Priya Sharma',
    role: 'Tourist',
  },
  {
    id: 'testimonial-4',
    quote:
      'The visa assistance was incredibly helpful. They guided me through the entire process and made it stress-free.',
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

export const trendingRoutes: TrendingRoute[] = [
  {
    id: 'tr-1',
    from: 'DAC',
    to: 'BKK',
    fromCity: 'Dhaka',
    toCity: 'Bangkok',
    fare: '৳28,946',
    rank: 1,
    isTopRanked: true,
  },
  {
    id: 'tr-2',
    from: 'DAC',
    to: 'KUL',
    fromCity: 'Dhaka',
    toCity: 'Kuala Lumpur',
    fare: '৳32,924',
    rank: 2,
    isTopRanked: true,
  },
  {
    id: 'tr-3',
    from: 'ZYL',
    to: 'JED',
    fromCity: 'Sylhet',
    toCity: 'Jeddah',
    fare: '৳56,146',
    rank: 3,
    isTopRanked: true,
  },
  {
    id: 'tr-4',
    from: 'DAC',
    to: 'CXB',
    fromCity: 'Dhaka',
    toCity: "Cox's Bazar",
    fare: '৳4,315',
    rank: 4,
    isTopRanked: false,
  },
  {
    id: 'tr-5',
    from: 'DAC',
    to: 'DXB',
    fromCity: 'Dhaka',
    toCity: 'Dubai',
    fare: '৳41,200',
    rank: 5,
    isTopRanked: false,
  },
  {
    id: 'tr-6',
    from: 'CGP',
    to: 'MCT',
    fromCity: 'Chattogram',
    toCity: 'Muscat',
    fare: '৳38,500',
    rank: 6,
    isTopRanked: false,
  },
  {
    id: 'tr-7',
    from: 'DAC',
    to: 'SIN',
    fromCity: 'Dhaka',
    toCity: 'Singapore',
    fare: '৳39,800',
    rank: 7,
    isTopRanked: false,
  },
];

export const allAirports: Airport[] = [
  // Bangladesh
  {
    code: 'DAC',
    name: 'Hazrat Shahjalal International Airport',
    city: 'Dhaka',
    country: 'Bangladesh',
    isPopular: true,
  },
  {
    code: 'CXB',
    name: "Cox's Bazar Airport",
    city: "Cox's Bazar",
    country: 'Bangladesh',
    isPopular: true,
  },
  {
    code: 'CGP',
    name: 'Shah Amanat International Airport',
    city: 'Chattogram',
    country: 'Bangladesh',
    isPopular: true,
  },
  {
    code: 'ZYL',
    name: 'Osmani International Airport',
    city: 'Sylhet',
    country: 'Bangladesh',
    isPopular: true,
  },
  { code: 'JSR', name: 'Jashore Airport', city: 'Jashore', country: 'Bangladesh' },
  { code: 'BZL', name: 'Barishal Airport', city: 'Barishal', country: 'Bangladesh' },
  { code: 'SPD', name: 'Saidpur Airport', city: 'Saidpur', country: 'Bangladesh' },
  { code: 'RJH', name: 'Shah Makhdum Airport', city: 'Rajshahi', country: 'Bangladesh' },

  // Middle East & Gulf
  {
    code: 'DXB',
    name: 'Dubai International Airport',
    city: 'Dubai',
    country: 'United Arab Emirates',
    isPopular: true,
  },
  {
    code: 'AUH',
    name: 'Zayed International Airport',
    city: 'Abu Dhabi',
    country: 'United Arab Emirates',
  },
  {
    code: 'SHJ',
    name: 'Sharjah International Airport',
    city: 'Sharjah',
    country: 'United Arab Emirates',
  },
  {
    code: 'DOH',
    name: 'Hamad International Airport',
    city: 'Doha',
    country: 'Qatar',
    isPopular: true,
  },
  {
    code: 'JED',
    name: 'King Abdulaziz International Airport',
    city: 'Jeddah',
    country: 'Saudi Arabia',
    isPopular: true,
  },
  {
    code: 'RUH',
    name: 'King Khalid International Airport',
    city: 'Riyadh',
    country: 'Saudi Arabia',
  },
  {
    code: 'MED',
    name: 'Prince Mohammad Bin Abdulaziz International Airport',
    city: 'Medina',
    country: 'Saudi Arabia',
  },
  { code: 'MCT', name: 'Muscat International Airport', city: 'Muscat', country: 'Oman' },
  { code: 'KWI', name: 'Kuwait International Airport', city: 'Kuwait City', country: 'Kuwait' },

  // Southeast & East Asia
  {
    code: 'BKK',
    name: 'Suvarnabhumi Airport',
    city: 'Bangkok',
    country: 'Thailand',
    isPopular: true,
  },
  { code: 'DMK', name: 'Don Mueang International Airport', city: 'Bangkok', country: 'Thailand' },
  {
    code: 'KUL',
    name: 'Kuala Lumpur International Airport',
    city: 'Kuala Lumpur',
    country: 'Malaysia',
    isPopular: true,
  },
  {
    code: 'SIN',
    name: 'Singapore Changi Airport',
    city: 'Singapore',
    country: 'Singapore',
    isPopular: true,
  },
  {
    code: 'DPS',
    name: 'Ngurah Rai International Airport',
    city: 'Bali',
    country: 'Indonesia',
    isPopular: true,
  },
  {
    code: 'CGK',
    name: 'Soekarno-Hatta International Airport',
    city: 'Jakarta',
    country: 'Indonesia',
  },
  {
    code: 'HKG',
    name: 'Hong Kong International Airport',
    city: 'Hong Kong',
    country: 'Hong Kong',
    isPopular: true,
  },
  {
    code: 'NRT',
    name: 'Narita International Airport',
    city: 'Tokyo',
    country: 'Japan',
    isPopular: true,
  },
  { code: 'ICN', name: 'Incheon International Airport', city: 'Seoul', country: 'South Korea' },

  // South Asia
  {
    code: 'CCU',
    name: 'Netaji Subhash Chandra Bose International Airport',
    city: 'Kolkata',
    country: 'India',
    isPopular: true,
  },
  {
    code: 'DEL',
    name: 'Indira Gandhi International Airport',
    city: 'Delhi',
    country: 'India',
    isPopular: true,
  },
  {
    code: 'BOM',
    name: 'Chhatrapati Shivaji Maharaj International Airport',
    city: 'Mumbai',
    country: 'India',
  },
  { code: 'MAA', name: 'Chennai International Airport', city: 'Chennai', country: 'India' },
  { code: 'BLR', name: 'Kempegowda International Airport', city: 'Bengaluru', country: 'India' },
  {
    code: 'KTM',
    name: 'Tribhuvan International Airport',
    city: 'Kathmandu',
    country: 'Nepal',
    isPopular: true,
  },
  {
    code: 'MLE',
    name: 'Velana International Airport',
    city: 'Male',
    country: 'Maldives',
    isPopular: true,
  },
  {
    code: 'CMB',
    name: 'Bandaranaike International Airport',
    city: 'Colombo',
    country: 'Sri Lanka',
  },

  // Europe & Americas
  {
    code: 'LHR',
    name: 'Heathrow Airport',
    city: 'London',
    country: 'United Kingdom',
    isPopular: true,
  },
  { code: 'LGW', name: 'Gatwick Airport', city: 'London', country: 'United Kingdom' },
  {
    code: 'CDG',
    name: 'Charles de Gaulle Airport',
    city: 'Paris',
    country: 'France',
    isPopular: true,
  },
  { code: 'FRA', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Germany' },
  { code: 'IST', name: 'Istanbul Airport', city: 'Istanbul', country: 'Turkey', isPopular: true },
  {
    code: 'JFK',
    name: 'John F. Kennedy International Airport',
    city: 'New York',
    country: 'United States',
    isPopular: true,
  },
  {
    code: 'YYZ',
    name: 'Toronto Pearson International Airport',
    city: 'Toronto',
    country: 'Canada',
    isPopular: true,
  },
  {
    code: 'SYD',
    name: 'Sydney Kingsford Smith Airport',
    city: 'Sydney',
    country: 'Australia',
    isPopular: true,
  },
];

export const preferredAirlinesList: PreferredAirline[] = [
  { code: 'BG', name: 'Biman Bangladesh Airlines', country: 'Bangladesh' },
  { code: 'EK', name: 'Emirates', country: 'United Arab Emirates' },
  { code: 'SQ', name: 'Singapore Airlines', country: 'Singapore' },
  { code: 'QR', name: 'Qatar Airways', country: 'Qatar' },
  { code: 'SV', name: 'Saudia', country: 'Saudi Arabia' },
  { code: 'AK', name: 'AirAsia', country: 'Malaysia' },
  { code: 'BS', name: 'US-Bangla Airlines', country: 'Bangladesh' },
  { code: 'FZ', name: 'Flydubai', country: 'United Arab Emirates' },
  { code: 'TG', name: 'Thai Airways', country: 'Thailand' },
  { code: 'MH', name: 'Malaysia Airlines', country: 'Malaysia' },
  { code: 'TK', name: 'Turkish Airlines', country: 'Turkey' },
  { code: 'KU', name: 'Kuwait Airways', country: 'Kuwait' },
  { code: 'GF', name: 'Gulf Air', country: 'Bahrain' },
];
