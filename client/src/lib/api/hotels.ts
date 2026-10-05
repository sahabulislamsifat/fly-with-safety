import { post } from './client';

export interface HotelOffer {
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

export interface HotelSearchResponse {
  results: HotelOffer[];
  provider: string;
  isLiveData: boolean;
  searchParams: Record<string, unknown>;
}

export interface HotelSearchPayload {
  destination: string;
  checkIn: string;
  checkOut: string;
  guests?: number;
  rooms?: number;
}

export interface HotelInquiryPayload {
  destination: string;
  checkIn: string;
  checkOut: string;
  guests?: number;
  rooms?: number;
  name: string;
  email: string;
  phone?: string;
  notes?: string;
}

export async function searchHotels(payload: HotelSearchPayload): Promise<HotelSearchResponse> {
  return post<HotelSearchResponse>('/hotels/search', payload);
}

export async function submitHotelInquiry(payload: HotelInquiryPayload): Promise<{
  referenceNumber: string;
  inquiry: Record<string, unknown>;
  message: string;
}> {
  return post('/hotels/inquiries', payload);
}
