import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { FlightOffer } from '@/lib/api/flights';

export interface CompareState {
  offers: FlightOffer[];
  isDrawerOpen: boolean;
}

const initialState: CompareState = {
  offers: [],
  isDrawerOpen: false,
};

export const compareSlice = createSlice({
  name: 'compare',
  initialState,
  reducers: {
    addOfferToCompare(state, action: PayloadAction<FlightOffer>) {
      const exists = state.offers.some((o) => o.id === action.payload.id);
      if (!exists && state.offers.length < 4) {
        state.offers.push(action.payload);
        state.isDrawerOpen = true;
      }
    },
    removeOfferFromCompare(state, action: PayloadAction<string>) {
      state.offers = state.offers.filter((o) => o.id !== action.payload);
      if (state.offers.length === 0) {
        state.isDrawerOpen = false;
      }
    },
    toggleCompareOffer(state, action: PayloadAction<FlightOffer>) {
      const idx = state.offers.findIndex((o) => o.id === action.payload.id);
      if (idx >= 0) {
        state.offers.splice(idx, 1);
        if (state.offers.length === 0) {
          state.isDrawerOpen = false;
        }
      } else if (state.offers.length < 4) {
        state.offers.push(action.payload);
        state.isDrawerOpen = true;
      }
    },
    setCompareDrawerOpen(state, action: PayloadAction<boolean>) {
      state.isDrawerOpen = action.payload;
    },
    clearCompare(state) {
      state.offers = [];
      state.isDrawerOpen = false;
    },
  },
});

export const {
  addOfferToCompare,
  removeOfferFromCompare,
  toggleCompareOffer,
  setCompareDrawerOpen,
  clearCompare,
} = compareSlice.actions;

export default compareSlice.reducer;
