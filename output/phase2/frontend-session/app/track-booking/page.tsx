import { Metadata } from 'next';
import BookingLookupPage from '../bookings/lookup/page';

export const metadata: Metadata = {
  title: 'Track Booking | FlyWithsafety',
  description:
    'Track your FlyWithsafety flight, hotel, and travel package booking status and audit timeline using your official FWS reference number.',
  openGraph: {
    title: 'Track Booking | FlyWithsafety',
    description: 'Track your FlyWithsafety booking status in real time.',
    type: 'website',
  },
};

export default function TrackBookingPage() {
  return <BookingLookupPage />;
}
