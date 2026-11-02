import { configureStore } from '@reduxjs/toolkit';
import flightSearchReducer from './slices/flightSearchSlice';
import hotelSearchReducer from './slices/hotelSearchSlice';
import compareReducer from './slices/compareSlice';
import bookingReducer from './slices/bookingSlice';

export const makeStore = () => {
  return configureStore({
    reducer: {
      flightSearch: flightSearchReducer,
      hotelSearch: hotelSearchReducer,
      compare: compareReducer,
      booking: bookingReducer,
    },
  });
};

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
