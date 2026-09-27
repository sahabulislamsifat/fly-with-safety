export interface HotelSearchParams {
  destination: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  rooms: number;
}

export interface HotelSearchResult {
  id: string;
  name: string;
  destination: string;
  starRating: number;
  pricePerNight: number;
  totalPrice: number;
  currency: string;
  amenities: string[];
  imageUrl: string;
  reviewScore: number;
  reviewCount: number;
  isDemoData: boolean;
}

export interface HotelProvider {
  searchHotels(params: HotelSearchParams): Promise<HotelSearchResult[]>;
  name: string;
}
