import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import {
  searchFlights,
  FlightSearchPayload,
  FlightOffer,
  FlightSearchResponse,
} from '@/lib/api/flights';

export type FlightSortOption = 'recommended' | 'cheapest' | 'fastest';
export type StopFilterOption = 'direct' | '1stop' | '2plus';

export interface FlightFilters {
  maxPrice: number | null;
  stops: StopFilterOption[];
  airlines: string[];
}

export interface FlightSearchState {
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  searchParams: FlightSearchPayload | null;
  offers: FlightOffer[];
  stats: FlightSearchResponse['stats'] | null;
  isDemoData: boolean;
  filters: FlightFilters;
  sortBy: FlightSortOption;
  selectedOffer: FlightOffer | null;
}

const initialState: FlightSearchState = {
  status: 'idle',
  error: null,
  searchParams: null,
  offers: [],
  stats: null,
  isDemoData: true,
  filters: {
    maxPrice: null,
    stops: [],
    airlines: [],
  },
  sortBy: 'recommended',
  selectedOffer: null,
};

export const fetchFlightOffers = createAsyncThunk<
  FlightSearchResponse,
  FlightSearchPayload,
  { rejectValue: string }
>('flights/fetchOffers', async (params, { rejectWithValue }) => {
  try {
    const response = await searchFlights(params);
    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to search flights';
    return rejectWithValue(msg);
  }
});

export const flightSearchSlice = createSlice({
  name: 'flightSearch',
  initialState,
  reducers: {
    setSearchParams(state, action: PayloadAction<FlightSearchPayload>) {
      state.searchParams = action.payload;
    },
    setSortBy(state, action: PayloadAction<FlightSortOption>) {
      state.sortBy = action.payload;
    },
    setMaxPriceFilter(state, action: PayloadAction<number | null>) {
      state.filters.maxPrice = action.payload;
    },
    toggleStopFilter(state, action: PayloadAction<StopFilterOption>) {
      const idx = state.filters.stops.indexOf(action.payload);
      if (idx >= 0) {
        state.filters.stops.splice(idx, 1);
      } else {
        state.filters.stops.push(action.payload);
      }
    },
    toggleAirlineFilter(state, action: PayloadAction<string>) {
      const idx = state.filters.airlines.indexOf(action.payload);
      if (idx >= 0) {
        state.filters.airlines.splice(idx, 1);
      } else {
        state.filters.airlines.push(action.payload);
      }
    },
    resetFilters(state) {
      state.filters = {
        maxPrice: null,
        stops: [],
        airlines: [],
      };
    },
    setSelectedOffer(state, action: PayloadAction<FlightOffer | null>) {
      state.selectedOffer = action.payload;
    },
    clearFlightSearch(state) {
      state.status = 'idle';
      state.error = null;
      state.offers = [];
      state.stats = null;
      state.selectedOffer = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchFlightOffers.pending, (state, action) => {
        state.status = 'loading';
        state.error = null;
        state.searchParams = action.meta.arg;
      })
      .addCase(fetchFlightOffers.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.offers = action.payload.offers || action.payload.results || [];
        state.stats = action.payload.stats;
        state.isDemoData = action.payload.isDemoData;
        state.error = null;
      })
      .addCase(fetchFlightOffers.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || action.error.message || 'Error occurred';
      });
  },
});

export const {
  setSearchParams,
  setSortBy,
  setMaxPriceFilter,
  toggleStopFilter,
  toggleAirlineFilter,
  resetFilters,
  setSelectedOffer,
  clearFlightSearch,
} = flightSearchSlice.actions;

export default flightSearchSlice.reducer;
