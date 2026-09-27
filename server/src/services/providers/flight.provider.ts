export interface FlightSearchParams {
  from: string;
  to: string;
  departureDate: string;
  returnDate?: string;
  passengers: number;
  cabinClass: string;
}

export interface FlightSearchResult {
  id: string;
  airline: string;
  flightNumber: string;
  from: string;
  to: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  stops: number;
  price: number;
  currency: string;
  cabinClass: string;
  seatsAvailable: number;
  isDemoData: boolean;
}

export interface FlightProvider {
  searchFlights(params: FlightSearchParams): Promise<FlightSearchResult[]>;
  name: string;
}
