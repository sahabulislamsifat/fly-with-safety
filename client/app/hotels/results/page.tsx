'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import {
  fetchHotelOffers,
  setHotelSortBy,
  setHotelMaxPrice,
  toggleHotelStar,
  resetHotelFilters,
  HotelSortOption,
} from '@/redux/slices/hotelSearchSlice';
import { openBookingModal } from '@/redux/slices/bookingSlice';
import { Button, Card, Input } from '@/components/ui';
import { Icon } from '@/components/ui/Icons';
import { BookingModal } from '@/components/booking/BookingModal';

function HotelResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const dispatch = useAppDispatch();

  const destination = searchParams.get('destination') || 'Bangkok';
  const checkIn = searchParams.get('checkIn') || new Date().toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 2);
  const checkOut = searchParams.get('checkOut') || tomorrow.toISOString().split('T')[0];
  const guests = parseInt(searchParams.get('guests') || '2', 10);
  const rooms = parseInt(searchParams.get('rooms') || '1', 10);

  const [editDest, setEditDest] = useState(destination);
  const [editIn, setEditIn] = useState(checkIn);
  const [editOut, setEditOut] = useState(checkOut);
  const [isEditing, setIsEditing] = useState(false);

  const { status, error, hotels, isDemoData, filters, sortBy } = useAppSelector(
    (state) => state.hotelSearch
  );

  useEffect(() => {
    if (destination) {
      dispatch(
        fetchHotelOffers({
          destination,
          checkIn,
          checkOut,
          guests,
          rooms,
        })
      );
    }
  }, [destination, checkIn, checkOut, guests, rooms, dispatch]);

  const processedHotels = useMemo(() => {
    let result = [...hotels];

    if (filters.stars.length > 0) {
      result = result.filter((h) => filters.stars.includes(h.starRating));
    }

    if (filters.maxPrice !== null) {
      result = result.filter((h) => h.totalPrice <= (filters.maxPrice as number));
    }

    result.sort((a, b) => {
      if (sortBy === 'cheapest') return a.totalPrice - b.totalPrice;
      if (sortBy === 'rating') return b.reviewScore - a.reviewScore;
      return b.starRating - a.starRating;
    });

    return result;
  }, [hotels, filters, sortBy]);

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(
      `/hotels/results?destination=${encodeURIComponent(editDest)}&checkIn=${encodeURIComponent(
        editIn
      )}&checkOut=${encodeURIComponent(editOut)}&guests=${guests}&rooms=${rooms}`
    );
    setIsEditing(false);
  };

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      {/* Top Header */}
      <section className="bg-brand-primary text-white py-6 border-b border-brand-primary/20">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/80 mb-1">
                <span>Hotel Results</span>
                <span>·</span>
                <span>{destination}</span>
                <span>·</span>
                <span>
                  {guests} Guest(s), {rooms} Room(s)
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold">Hotels in {destination}</h1>
              <p className="text-sm text-white/90 mt-1">
                Check-in: <strong>{checkIn}</strong> · Check-out: <strong>{checkOut}</strong>
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="bg-white/10 text-white border-white/20 hover:bg-white/20 self-start md:self-auto"
              onClick={() => setIsEditing(!isEditing)}
            >
              <Icon name="edit" size={16} />
              {isEditing ? 'Close' : 'Modify Dates'}
            </Button>
          </div>

          {isEditing && (
            <form
              onSubmit={handleUpdate}
              className="mt-6 p-4 bg-white text-text-primary rounded-xs shadow-md grid grid-cols-1 sm:grid-cols-4 gap-4 items-end"
            >
              <Input
                label="Destination"
                value={editDest}
                onChange={(e) => setEditDest(e.target.value)}
              />
              <Input
                label="Check-in"
                type="date"
                value={editIn}
                onChange={(e) => setEditIn(e.target.value)}
              />
              <Input
                label="Check-out"
                type="date"
                value={editOut}
                onChange={(e) => setEditOut(e.target.value)}
              />
              <Button type="submit" variant="primary">
                Update Search
              </Button>
            </form>
          )}
        </div>
      </section>

      {/* Main Grid */}
      <div className="container mx-auto px-4 py-8">
        {/* Demo banner indicator */}
        {isDemoData && (
          <div className="mb-6 p-3.5 bg-amber-50 border border-amber-200 rounded-xs flex items-center justify-between text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <Icon name="info" size={18} className="text-amber-700 shrink-0" />
              <span>
                <strong>Demonstration Inventory:</strong> Current hotel properties are generated via FlyWithsafety&apos;s provider abstraction engine. Live reservations and room availability are confirmed by our travel desk.
              </span>
            </div>
            <span className="font-mono px-2 py-0.5 rounded-xs bg-amber-200 text-amber-900 text-[10px] font-bold shrink-0">
              DEMO MODE
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Filters */}
          <aside className="lg:col-span-1 space-y-6">
            <Card className="p-5 bg-white border border-neutral-200 rounded-xs space-y-6 shadow-xs">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-bold text-sm text-text-primary flex items-center gap-2">
                  <Icon name="filter" size={16} /> Filters
                </h3>
                <button
                  type="button"
                  onClick={() => dispatch(resetHotelFilters())}
                  className="text-xs text-brand-primary hover:underline font-semibold cursor-pointer"
                >
                  Reset
                </button>
              </div>

              {/* Star Rating */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-3">
                  Star Rating
                </h4>
                <div className="space-y-2">
                  {[5, 4, 3].map((star) => (
                    <label
                      key={star}
                      className="flex items-center gap-2 text-sm text-text-primary cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={filters.stars.includes(star)}
                        onChange={() => dispatch(toggleHotelStar(star))}
                        className="rounded-xs border-neutral-300 text-brand-primary"
                      />
                      <span className="flex items-center gap-1">
                        {star} Stars
                        <span className="text-amber-500">★</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Max Price Filter */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-3">
                  Max Price
                </h4>
                <input
                  type="range"
                  min="2000"
                  max="50000"
                  step="1000"
                  value={filters.maxPrice || 50000}
                  onChange={(e) => dispatch(setHotelMaxPrice(Number(e.target.value)))}
                  className="w-full accent-brand-primary cursor-pointer"
                />
                <div className="flex justify-between text-xs text-text-tertiary mt-1">
                  <span>2,000</span>
                  <span className="font-semibold text-text-primary">
                    Up to {(filters.maxPrice || 50000).toLocaleString()} BDT
                  </span>
                </div>
              </div>
            </Card>
          </aside>

          {/* Hotel Cards List */}
          <main className="lg:col-span-3 space-y-4">
            {/* Sort bar */}
            <div className="flex items-center justify-between bg-white p-2.5 rounded-xs border border-neutral-200">
              <span className="text-xs text-text-secondary font-medium">
                Showing <strong>{processedHotels.length}</strong> verified properties
              </span>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-text-tertiary">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => dispatch(setHotelSortBy(e.target.value as HotelSortOption))}
                  className="bg-neutral-50 border border-neutral-200 rounded-xs px-2 py-1 text-text-primary font-medium"
                >
                  <option value="recommended">Recommended</option>
                  <option value="cheapest">Cheapest First</option>
                  <option value="rating">Highest Rated</option>
                </select>
              </div>
            </div>

            {/* Loading */}
            {status === 'loading' && (
              <div className="space-y-4 py-8">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="p-6 bg-white border border-neutral-200 rounded-xs animate-pulse flex gap-4"
                  >
                    <div className="w-36 h-28 bg-neutral-200 rounded-xs" />
                    <div className="flex-1 space-y-3">
                      <div className="h-6 w-48 bg-neutral-200 rounded-xs" />
                      <div className="h-4 w-32 bg-neutral-100 rounded-xs" />
                      <div className="h-4 w-64 bg-neutral-100 rounded-xs" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Error */}
            {status === 'failed' && (
              <div className="p-8 bg-white border border-red-200 rounded-xs text-center space-y-3">
                <p className="text-red-600 font-bold">{error}</p>
                <Button
                  variant="primary"
                  onClick={() =>
                    dispatch(
                      fetchHotelOffers({
                        destination,
                        checkIn,
                        checkOut,
                        guests,
                        rooms,
                      })
                    )
                  }
                >
                  Retry Search
                </Button>
              </div>
            )}

            {/* Empty */}
            {status === 'succeeded' && processedHotels.length === 0 && (
              <div className="p-12 bg-white border border-neutral-200 rounded-xs text-center space-y-3">
                <Icon name="hotel" size={32} className="text-neutral-400 mx-auto" />
                <h3 className="font-bold text-base text-text-primary">No Hotels Found</h3>
                <p className="text-xs text-text-secondary">
                  Try clearing your star rating filters or changing the destination.
                </p>
              </div>
            )}

            {/* Results */}
            {status === 'succeeded' &&
              processedHotels.map((hotel) => (
                <Card
                  key={hotel.id}
                  className="p-5 bg-white border border-neutral-200 rounded-xs hover:border-brand-primary/40 shadow-xs flex flex-col sm:flex-row gap-5"
                >
                  <div className="sm:w-48 h-36 bg-neutral-100 rounded-xs overflow-hidden relative shrink-0">
                    <Image
                      src={hotel.imageUrl}
                      alt={hotel.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, 192px"
                      unoptimized
                    />
                    <div className="absolute top-2 left-2 bg-black/70 text-white text-[10px] font-bold px-2 py-0.5 rounded-xs">
                      {hotel.starRating} ★
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-lg text-text-primary">{hotel.name}</h3>
                          <p className="text-xs text-text-secondary">{hotel.destination}</p>
                        </div>
                        <div className="text-right">
                          <span className="px-2 py-1 bg-brand-primary/10 text-brand-primary font-bold text-xs rounded-xs">
                            {hotel.reviewScore} / 10
                          </span>
                          <span className="block text-[10px] text-text-tertiary mt-0.5">
                            {hotel.reviewCount} reviews
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mt-3">
                        {hotel.amenities.map((a) => (
                          <span
                            key={a}
                            className="text-[11px] px-2 py-0.5 bg-neutral-100 text-text-secondary rounded-xs"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-neutral-100 mt-4">
                      <div>
                        <span className="text-xs text-text-tertiary block">
                          Total for stay (taxes incl.)
                        </span>
                        <span className="text-xl font-extrabold text-brand-primary">
                          {hotel.totalPrice.toLocaleString()} {hotel.currency}
                        </span>
                      </div>

                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() =>
                          dispatch(
                            openBookingModal({
                              type: 'HOTEL',
                              title: `${hotel.name} (${hotel.destination})`,
                              totalPrice: hotel.totalPrice,
                              currency: hotel.currency,
                              details: {
                                hotelId: hotel.id,
                                checkIn,
                                checkOut,
                                guests,
                                rooms,
                              },
                            })
                          )
                        }
                      >
                        Inquire / Book
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
          </main>
        </div>
      </div>

      <BookingModal />
    </div>
  );
}

export default function HotelResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-neutral-50">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-xs animate-spin mx-auto" />
            <p className="text-sm font-semibold text-text-secondary">Searching hotels...</p>
          </div>
        </div>
      }
    >
      <HotelResultsContent />
    </Suspense>
  );
}
