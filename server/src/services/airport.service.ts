export interface Airport {
  code: string;
  name: string;
  city: string;
  country: string;
  isPopular?: boolean;
}

export const AIRPORTS: Airport[] = [
  // Bangladesh (Primary focus)
  { code: 'DAC', name: 'Hazrat Shahjalal International Airport', city: 'Dhaka', country: 'Bangladesh', isPopular: true },
  { code: 'CGP', name: 'Shah Amanat International Airport', city: 'Chattogram', country: 'Bangladesh', isPopular: true },
  { code: 'ZYL', name: 'Osmani International Airport', city: 'Sylhet', country: 'Bangladesh', isPopular: true },
  { code: 'CXB', name: "Cox's Bazar Airport", city: "Cox's Bazar", country: 'Bangladesh', isPopular: true },
  { code: 'JSR', name: 'Jashore Airport', city: 'Jashore', country: 'Bangladesh' },
  { code: 'BZL', name: 'Barishal Airport', city: 'Barishal', country: 'Bangladesh' },
  { code: 'SPD', name: 'Saidpur Airport', city: 'Saidpur', country: 'Bangladesh' },
  { code: 'RJH', name: 'Shah Makhdum Airport', city: 'Rajshahi', country: 'Bangladesh' },

  // Southeast Asia & East Asia
  { code: 'BKK', name: 'Suvarnabhumi Airport', city: 'Bangkok', country: 'Thailand', isPopular: true },
  { code: 'DMK', name: 'Don Mueang International Airport', city: 'Bangkok', country: 'Thailand' },
  { code: 'KUL', name: 'Kuala Lumpur International Airport', city: 'Kuala Lumpur', country: 'Malaysia', isPopular: true },
  { code: 'SIN', name: 'Singapore Changi Airport', city: 'Singapore', country: 'Singapore', isPopular: true },
  { code: 'DPS', name: 'Ngurah Rai International Airport', city: 'Bali', country: 'Indonesia', isPopular: true },
  { code: 'CGK', name: 'Soekarno-Hatta International Airport', city: 'Jakarta', country: 'Indonesia' },
  { code: 'HAN', name: 'Noi Bai International Airport', city: 'Hanoi', country: 'Vietnam' },
  { code: 'SGN', name: 'Tan Son Nhat International Airport', city: 'Ho Chi Minh City', country: 'Vietnam' },
  { code: 'MNL', name: 'Ninoy Aquino International Airport', city: 'Manila', country: 'Philippines' },
  { code: 'HKG', name: 'Hong Kong International Airport', city: 'Hong Kong', country: 'Hong Kong', isPopular: true },
  { code: 'NRT', name: 'Narita International Airport', city: 'Tokyo', country: 'Japan', isPopular: true },
  { code: 'HND', name: 'Haneda Airport', city: 'Tokyo', country: 'Japan' },
  { code: 'ICN', name: 'Incheon International Airport', city: 'Seoul', country: 'South Korea', isPopular: true },

  // South Asia
  { code: 'DEL', name: 'Indira Gandhi International Airport', city: 'Delhi', country: 'India', isPopular: true },
  { code: 'BOM', name: 'Chhatrapati Shivaji Maharaj International Airport', city: 'Mumbai', country: 'India', isPopular: true },
  { code: 'CCU', name: 'Netaji Subhash Chandra Bose International Airport', city: 'Kolkata', country: 'India', isPopular: true },
  { code: 'MAA', name: 'Chennai International Airport', city: 'Chennai', country: 'India' },
  { code: 'BLR', name: 'Kempegowda International Airport', city: 'Bengaluru', country: 'India' },
  { code: 'HYD', name: 'Rajiv Gandhi International Airport', city: 'Hyderabad', country: 'India' },
  { code: 'KTM', name: 'Tribhuvan International Airport', city: 'Kathmandu', country: 'Nepal', isPopular: true },
  { code: 'CMB', name: 'Bandaranaike International Airport', city: 'Colombo', country: 'Sri Lanka', isPopular: true },
  { code: 'MLE', name: 'Velana International Airport', city: 'Male', country: 'Maldives', isPopular: true },
  { code: 'ISB', name: 'Islamabad International Airport', city: 'Islamabad', country: 'Pakistan' },
  { code: 'KHI', name: 'Jinnah International Airport', city: 'Karachi', country: 'Pakistan' },

  // Middle East
  { code: 'DXB', name: 'Dubai International Airport', city: 'Dubai', country: 'United Arab Emirates', isPopular: true },
  { code: 'AUH', name: 'Zayed International Airport', city: 'Abu Dhabi', country: 'United Arab Emirates' },
  { code: 'SHJ', name: 'Sharjah International Airport', city: 'Sharjah', country: 'United Arab Emirates' },
  { code: 'DOH', name: 'Hamad International Airport', city: 'Doha', country: 'Qatar', isPopular: true },
  { code: 'JED', name: 'King Abdulaziz International Airport', city: 'Jeddah', country: 'Saudi Arabia', isPopular: true },
  { code: 'RUH', name: 'King Khalid International Airport', city: 'Riyadh', country: 'Saudi Arabia' },
  { code: 'MED', name: 'Prince Mohammad Bin Abdulaziz International Airport', city: 'Medina', country: 'Saudi Arabia' },
  { code: 'MCT', name: 'Muscat International Airport', city: 'Muscat', country: 'Oman' },
  { code: 'KWI', name: 'Kuwait International Airport', city: 'Kuwait City', country: 'Kuwait' },
  { code: 'BAH', name: 'Bahrain International Airport', city: 'Manama', country: 'Bahrain' },
  { code: 'IST', name: 'Istanbul Airport', city: 'Istanbul', country: 'Turkey', isPopular: true },

  // Europe & UK
  { code: 'LHR', name: 'Heathrow Airport', city: 'London', country: 'United Kingdom', isPopular: true },
  { code: 'LGW', name: 'Gatwick Airport', city: 'London', country: 'United Kingdom' },
  { code: 'MAN', name: 'Manchester Airport', city: 'Manchester', country: 'United Kingdom' },
  { code: 'CDG', name: 'Charles de Gaulle Airport', city: 'Paris', country: 'France', isPopular: true },
  { code: 'FRA', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Germany', isPopular: true },
  { code: 'AMS', name: 'Amsterdam Airport Schiphol', city: 'Amsterdam', country: 'Netherlands', isPopular: true },
  { code: 'FCO', name: 'Leonardo da Vinci-Fiumicino Airport', city: 'Rome', country: 'Italy' },
  { code: 'MAD', name: 'Adolfo Suárez Madrid-Barajas Airport', city: 'Madrid', country: 'Spain' },
  { code: 'ZRH', name: 'Zurich Airport', city: 'Zurich', country: 'Switzerland' },

  // North America
  { code: 'JFK', name: 'John F. Kennedy International Airport', city: 'New York', country: 'United States', isPopular: true },
  { code: 'EWR', name: 'Newark Liberty International Airport', city: 'New York', country: 'United States' },
  { code: 'ORD', name: "O'Hare International Airport", city: 'Chicago', country: 'United States' },
  { code: 'LAX', name: 'Los Angeles International Airport', city: 'Los Angeles', country: 'United States', isPopular: true },
  { code: 'SFO', name: 'San Francisco International Airport', city: 'San Francisco', country: 'United States' },
  { code: 'YYZ', name: 'Toronto Pearson International Airport', city: 'Toronto', country: 'Canada', isPopular: true },
  { code: 'YVR', name: 'Vancouver International Airport', city: 'Vancouver', country: 'Canada' },

  // Oceania
  { code: 'SYD', name: 'Sydney Kingsford Smith Airport', city: 'Sydney', country: 'Australia', isPopular: true },
  { code: 'MEL', name: 'Melbourne Airport', city: 'Melbourne', country: 'Australia', isPopular: true },
  { code: 'AKL', name: 'Auckland Airport', city: 'Auckland', country: 'New Zealand' },
];

export function searchAirports(query?: string, limit = 10): Airport[] {
  if (!query || query.trim().length === 0) {
    return AIRPORTS.filter((a) => a.isPopular).slice(0, limit);
  }

  const q = query.trim().toLowerCase();

  // Score match: exact code > starts with code > starts with city > contains city/name
  const scored = AIRPORTS.map((airport) => {
    let score = 0;
    const codeLower = airport.code.toLowerCase();
    const cityLower = airport.city.toLowerCase();
    const nameLower = airport.name.toLowerCase();
    const countryLower = airport.country.toLowerCase();

    if (codeLower === q) score += 100;
    else if (codeLower.startsWith(q)) score += 80;
    else if (cityLower.startsWith(q)) score += 60;
    else if (cityLower.includes(q)) score += 40;
    else if (nameLower.includes(q)) score += 30;
    else if (countryLower.includes(q)) score += 20;

    // Prioritize popular / Bangladesh airports on tie
    if (airport.country === 'Bangladesh') score += 15;
    if (airport.isPopular) score += 10;

    return { airport, score };
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.airport);

  return scored.slice(0, limit);
}
