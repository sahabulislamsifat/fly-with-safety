import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import {
  createBooking,
  lookupBooking,
  CreateBookingPayload,
  BookingRecord,
} from '@/lib/api/bookings';

export interface BookingState {
  submitStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  lookupStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  submitError: string | null;
  lookupError: string | null;
  recentBooking: {
    id: string;
    referenceNumber: string;
    status: string;
    customerName: string;
    customerEmail: string;
    totalPrice: number;
    currency: string;
    passengerCount: number;
    createdAt: string;
  } | null;
  lookupRecord: BookingRecord | null;
  isBookingModalOpen: boolean;
  bookingTarget: {
    type: 'FLIGHT' | 'HOTEL' | 'PACKAGE';
    title: string;
    totalPrice: number;
    currency: string;
    details: Record<string, unknown>;
  } | null;
}

const initialState: BookingState = {
  submitStatus: 'idle',
  lookupStatus: 'idle',
  submitError: null,
  lookupError: null,
  recentBooking: null,
  lookupRecord: null,
  isBookingModalOpen: false,
  bookingTarget: null,
};

export const submitBookingThunk = createAsyncThunk<
  { booking: NonNullable<BookingState['recentBooking']> },
  CreateBookingPayload,
  { rejectValue: string }
>('booking/submit', async (payload, { rejectWithValue }) => {
  try {
    const res = await createBooking(payload);
    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to submit booking';
    return rejectWithValue(msg);
  }
});

export const lookupBookingThunk = createAsyncThunk<
  { booking: BookingRecord },
  { referenceNumber: string; email: string },
  { rejectValue: string }
>('booking/lookup', async ({ referenceNumber, email }, { rejectWithValue }) => {
  try {
    const res = await lookupBooking(referenceNumber, email);
    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'No booking found matching the provided reference and email';
    return rejectWithValue(msg);
  }
});

export const bookingSlice = createSlice({
  name: 'booking',
  initialState,
  reducers: {
    openBookingModal(
      state,
      action: PayloadAction<NonNullable<BookingState['bookingTarget']>>
    ) {
      state.bookingTarget = action.payload;
      state.isBookingModalOpen = true;
      state.submitStatus = 'idle';
      state.submitError = null;
    },
    closeBookingModal(state) {
      state.isBookingModalOpen = false;
    },
    clearBookingState(state) {
      state.submitStatus = 'idle';
      state.submitError = null;
      state.recentBooking = null;
    },
    clearLookupState(state) {
      state.lookupStatus = 'idle';
      state.lookupError = null;
      state.lookupRecord = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(submitBookingThunk.pending, (state) => {
        state.submitStatus = 'loading';
        state.submitError = null;
      })
      .addCase(submitBookingThunk.fulfilled, (state, action) => {
        state.submitStatus = 'succeeded';
        state.recentBooking = action.payload.booking;
        state.submitError = null;
      })
      .addCase(submitBookingThunk.rejected, (state, action) => {
        state.submitStatus = 'failed';
        state.submitError = action.payload || 'Failed to submit booking';
      })
      .addCase(lookupBookingThunk.pending, (state) => {
        state.lookupStatus = 'loading';
        state.lookupError = null;
      })
      .addCase(lookupBookingThunk.fulfilled, (state, action) => {
        state.lookupStatus = 'succeeded';
        state.lookupRecord = action.payload.booking;
        state.lookupError = null;
      })
      .addCase(lookupBookingThunk.rejected, (state, action) => {
        state.lookupStatus = 'failed';
        state.lookupError = action.payload || 'Booking lookup failed';
      });
  },
});

export const {
  openBookingModal,
  closeBookingModal,
  clearBookingState,
  clearLookupState,
} = bookingSlice.actions;

export default bookingSlice.reducer;
