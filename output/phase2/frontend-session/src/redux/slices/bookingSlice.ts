import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import {ApiError} from '@/lib/api/client';
import {isTerminalBookingFailure} from '@/lib/api/booking-attempt';
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
  activeSubmitRequest: string | null;
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
  activeSubmitRequest: null,
  lookupError: null,
  recentBooking: null,
  lookupRecord: null,
  isBookingModalOpen: false,
  bookingTarget: null,
};

export const submitBookingThunk = createAsyncThunk<
  { booking: NonNullable<BookingState['recentBooking']> },
  {payload: CreateBookingPayload; requestId: string},
  { rejectValue: {message:string;terminal:boolean} }
>('booking/submit', async ({payload,requestId}, { rejectWithValue }) => {
  try {
    const res = await createBooking(payload,requestId);
    return res;
  } catch (err: unknown) {
    const message = err instanceof ApiError && err.status>=400 && err.status<500 ? err.message : 'We could not confirm your booking request. Retry without changing the form.';
    return rejectWithValue({message,terminal:isTerminalBookingFailure(err)});
  }
},{condition:(_input,{getState})=>(getState() as {booking:BookingState}).booking.submitStatus!=='loading'});

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
      if(state.submitStatus==='loading')return;
      state.bookingTarget = action.payload;
      state.isBookingModalOpen = true;
      state.submitStatus = 'idle';
      state.submitError = null;
      state.recentBooking = null;
      state.activeSubmitRequest = null;
    },
    closeBookingModal(state) {
      if(state.submitStatus==='loading')return;
      state.isBookingModalOpen = false;
    },
    clearBookingState(state) {
      if(state.submitStatus==='loading')return;
      state.submitStatus = 'idle';
      state.submitError = null;
      state.recentBooking = null;
      state.activeSubmitRequest = null;
    },
    clearLookupState(state) {
      state.lookupStatus = 'idle';
      state.lookupError = null;
      state.lookupRecord = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(submitBookingThunk.pending, (state,action) => {
        state.submitStatus = 'loading';
        state.submitError = null;
        state.activeSubmitRequest=action.meta.requestId;
      })
      .addCase(submitBookingThunk.fulfilled, (state, action) => {
        if(state.activeSubmitRequest!==action.meta.requestId)return;
        state.submitStatus = 'succeeded';
        state.recentBooking = action.payload.booking;
        state.submitError = null;
        state.activeSubmitRequest=null;
      })
      .addCase(submitBookingThunk.rejected, (state, action) => {
        if(state.activeSubmitRequest!==action.meta.requestId)return;
        state.submitStatus = 'failed';
        state.submitError = action.payload?.message || 'Failed to submit booking';
        state.activeSubmitRequest=null;
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
