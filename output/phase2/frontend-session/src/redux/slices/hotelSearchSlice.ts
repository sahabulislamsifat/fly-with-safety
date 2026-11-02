import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import {
  searchHotels,
  HotelSearchPayload,
  HotelOffer,
  HotelSearchResponse,
} from '@/lib/api/hotels';

export type HotelSortOption = 'recommended' | 'cheapest' | 'rating';

export interface HotelFilters {
  maxPrice: number | null;
  minRating: number | null;
  stars: number[];
}

export interface HotelSearchState {
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  searchParams: HotelSearchPayload | null;
  hotels: HotelOffer[];
  isDemoData: boolean;
  filters: HotelFilters;
  sortBy: HotelSortOption;
  selectedHotel: HotelOffer | null;
}

const initialState: HotelSearchState = {
  status: 'idle',
  error: null,
  searchParams: null,
  hotels: [],
  isDemoData: true,
  filters: {
    maxPrice: null,
    minRating: null,
    stars: [],
  },
  sortBy: 'recommended',
  selectedHotel: null,
};

export const fetchHotelOffers = createAsyncThunk<
  HotelSearchResponse,
  HotelSearchPayload,
  { rejectValue: string }
>('hotels/fetchOffers', async (params, { rejectWithValue }) => {
  try {
    const response = await searchHotels(params);
    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to search hotels';
    return rejectWithValue(msg);
  }
});

export const hotelSearchSlice = createSlice({
  name: 'hotelSearch',
  initialState,
  reducers: {
    setHotelSearchParams(state, action: PayloadAction<HotelSearchPayload>) {
      state.searchParams = action.payload;
    },
    setHotelSortBy(state, action: PayloadAction<HotelSortOption>) {
      state.sortBy = action.payload;
    },
    setHotelMaxPrice(state, action: PayloadAction<number | null>) {
      state.filters.maxPrice = action.payload;
    },
    toggleHotelStar(state, action: PayloadAction<number>) {
      const idx = state.filters.stars.indexOf(action.payload);
      if (idx >= 0) {
        state.filters.stars.splice(idx, 1);
      } else {
        state.filters.stars.push(action.payload);
      }
    },
    resetHotelFilters(state) {
      state.filters = {
        maxPrice: null,
        minRating: null,
        stars: [],
      };
    },
    setSelectedHotel(state, action: PayloadAction<HotelOffer | null>) {
      state.selectedHotel = action.payload;
    },
    clearHotelSearch(state) {
      state.status = 'idle';
      state.error = null;
      state.hotels = [];
      state.selectedHotel = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchHotelOffers.pending, (state, action) => {
        state.status = 'loading';
        state.error = null;
        state.searchParams = action.meta.arg;
      })
      .addCase(fetchHotelOffers.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.hotels = action.payload.results || [];
        state.isDemoData = action.payload.results?.some((r) => r.isDemoData) ?? true;
        state.error = null;
      })
      .addCase(fetchHotelOffers.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || action.error.message || 'Error occurred';
      });
  },
});

export const {
  setHotelSearchParams,
  setHotelSortBy,
  setHotelMaxPrice,
  toggleHotelStar,
  resetHotelFilters,
  setSelectedHotel,
  clearHotelSearch,
} = hotelSearchSlice.actions;

export default hotelSearchSlice.reducer;
