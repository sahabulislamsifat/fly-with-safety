'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import {
  fetchFlightOffers,
  setSortBy,
  setMaxPriceFilter,
  toggleStopFilter,
  toggleAirlineFilter,
  resetFilters,
  FlightSortOption,
  StopFilterOption,
} from '@/redux/slices/flightSearchSlice';
import { toggleCompareOffer } from '@/redux/slices/compareSlice';
import { openBookingModal } from '@/redux/slices/bookingSlice';
import { Button, Card, Input } from '@/components/ui';
import { Icon } from '@/components/ui/Icons';
import { BookingModal } from '@/components/booking/BookingModal';
import { FlightCompareDrawer } from '@/components/flights/FlightCompareDrawer';
import { AirportCombobox } from '@/components/booking/AirportCombobox';

function FlightResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const dispatch = useAppDispatch();

  const from = searchParams.get('from') || 'DAC';
  const to = searchParams.get('to') || 'KUL';
  const depart = searchParams.get('depart') || new Date().toISOString().split('T')[0];
  const returnDate = searchParams.get('return') || undefined;
  const rawTripType = searchParams.get('tripType');
  const tripType: 'roundTrip' | 'oneWay' | 'multiCity' =
    rawTripType === 'roundTrip' || rawTripType === 'oneWay' || rawTripType === 'multiCity'
      ? rawTripType
      : (returnDate ? 'roundTrip' : 'oneWay');
  const rawCabin = searchParams.get('cabin');
  const cabin: 'economy' | 'premiumEconomy' | 'business' | 'first' =
    rawCabin === 'premiumEconomy' || rawCabin === 'business' || rawCabin === 'first'
      ? rawCabin
      : 'economy';
  const adults = parseInt(searchParams.get('adults') || '1', 10);
  const children = parseInt(searchParams.get('children') || '0', 10);
  const infants = parseInt(searchParams.get('infants') || '0', 10);

  const [isEditingSearch, setIsEditingSearch] = useState(false);
  const [editFrom, setEditFrom] = useState(from);
  const [editTo, setEditTo] = useState(to);
  const [editDepart, setEditDepart] = useState(depart);

  const { status, error, offers, stats, isDemoData, filters, sortBy } = useAppSelector(
    (state) => state.flightSearch
  );
  const { offers: comparedOffers } = useAppSelector((state) => state.compare);

  // Fetch offers on search parameter changes
  useEffect(() => {
    if (from && to && depart) {
      dispatch(
        fetchFlightOffers({
          tripType,
          from,
          to,
          departureDate: depart,
          returnDate: returnDate || undefined,
          adults,
          children,
          infants,
          cabinClass: cabin,
        })
      );
    }
  }, [from, to, depart, returnDate, tripType, cabin, adults, children, infants, dispatch]);

  // Derive available airlines from current offers
  const availableAirlines = useMemo(() => {
    const set = new Set<string>();
    offers.forEach((o) => {
      const name = typeof o.airline === 'object' ? o.airline.name : o.airline;
      if (name) set.add(name);
    });
    return Array.from(set);
  }, [offers]);

  // Filter and sort offers
  const processedOffers = useMemo(() => {
    let result = [...offers];

    // Filter by stops
    if (filters.stops.length > 0) {
      result = result.filter((o) => {
        const stops = o.stopsCount ?? 0;
        if (stops === 0 && filters.stops.includes('direct')) return true;
        if (stops === 1 && filters.stops.includes('1stop')) return true;
        if (stops >= 2 && filters.stops.includes('2plus')) return true;
        return false;
      });
    }

    // Filter by airline
    if (filters.airlines.length > 0) {
      result = result.filter((o) => {
        const name = typeof o.airline === 'object' ? o.airline.name : o.airline;
        return filters.airlines.includes(name);
      });
    }

    // Filter by max price
    if (filters.maxPrice !== null) {
      result = result.filter((o) => {
        const price = o.price?.totalAmount ?? 0;
        return price <= (filters.maxPrice as number);
      });
    }

    // Sort
    result.sort((a, b) => {
      const priceA = a.price?.totalAmount ?? 0;
      const priceB = b.price?.totalAmount ?? 0;
      const durA = a.totalDurationMinutes ?? 999;
      const durB = b.totalDurationMinutes ?? 999;

      if (sortBy === 'cheapest') return priceA - priceB;
      if (sortBy === 'fastest') return durA - durB;
      // Recommended: composite score
      return priceA * 0.6 + durA * 50 - (priceB * 0.6 + durB * 50);
    });

    return result;
  }, [offers, filters, sortBy]);

  const handleApplyEdit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(
      `/flights/results?from=${encodeURIComponent(editFrom)}&to=${encodeURIComponent(
        editTo
      )}&depart=${encodeURIComponent(editDepart)}&tripType=${tripType}&cabin=${cabin}&adults=${adults}`
    );
    setIsEditingSearch(false);
  };

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      {/* Top Header */}
      <section className="bg-brand-primary text-white py-6 border-b border-brand-primary/20">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/80 mb-1">
                <span>Flight Results</span>
                <span>·</span>
                <span>{tripType === 'roundTrip' ? 'Round Trip' : 'One Way'}</span>
                <span>·</span>
                <span>{adults + children + infants} Passenger(s)</span>
                <span>·</span>
                <span className="capitalize">{cabin}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-3">
                <span>{from}</span>
                <Icon name="arrowRight" size={24} className="text-white/60" />
                <span>{to}</span>
              </h1>
              <p className="text-sm text-white/90 mt-1">
                Departure: <strong>{depart}</strong>
                {returnDate && (
                  <span>
                    {' '}
                    · Return: <strong>{returnDate}</strong>
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="bg-white/10 text-white border-white/20 hover:bg-white/20"
                onClick={() => setIsEditingSearch(!isEditingSearch)}
              >
                <Icon name="edit" size={16} />
                {isEditingSearch ? 'Close' : 'Modify Search'}
              </Button>
            </div>
          </div>

          {/* Quick Edit Search Drawer */}
          {isEditingSearch && (
            <form
              onSubmit={handleApplyEdit}
              className="mt-6 p-4 bg-white text-text-primary rounded-sm shadow-md grid grid-cols-1 sm:grid-cols-4 gap-4 items-end"
            >
              <AirportCombobox label="From" value={editFrom} onChange={setEditFrom} />
              <AirportCombobox label="To" value={editTo} onChange={setEditTo} />
              <Input
                label="Departure Date"
                type="date"
                value={editDepart}
                onChange={(e) => setEditDepart(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
              <Button type="submit" variant="primary" className="w-full">
                Update Results
              </Button>
            </form>
          )}
        </div>
      </section>

      {/* Main Container */}
      <div className="container mx-auto px-4 py-8">
        {/* Demo banner indicator */}
        {isDemoData && (
          <div className="mb-6 p-3.5 bg-amber-50 border border-amber-200 rounded-xs flex items-center justify-between text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <Icon name="info" size={18} className="text-amber-700 shrink-0" />
              <span>
                <strong>Demonstration Inventory:</strong> Current offers are generated via FlyWithSafe&apos;s provider abstraction engine. Live reservations are confirmed by our ticketing desk upon inquiry.
              </span>
            </div>
            <span className="font-mono px-2 py-0.5 rounded bg-amber-200 text-amber-900 text-[10px] font-bold shrink-0">
              DEMO MODE
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Sidebar: Filters */}
          <aside className="lg:col-span-1 space-y-6">
            <Card className="p-5 bg-white border border-neutral-200 rounded-sm space-y-6 shadow-xs">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-bold text-sm text-text-primary flex items-center gap-2">
                  <Icon name="filter" size={16} /> Filters
                </h3>
                <button
                  type="button"
                  onClick={() => dispatch(resetFilters())}
                  className="text-xs text-brand-primary hover:underline font-semibold cursor-pointer"
                >
                  Reset All
                </button>
              </div>

              {/* Stops Filter */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-3">
                  Stops
                </h4>
                <div className="space-y-2">
                  {[
                    { id: 'direct', label: 'Direct / Non-stop' },
                    { id: '1stop', label: '1 Stop' },
                    { id: '2plus', label: '2+ Stops' },
                  ].map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center gap-2 text-sm text-text-primary cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={filters.stops.includes(s.id as StopFilterOption)}
                        onChange={() => dispatch(toggleStopFilter(s.id as StopFilterOption))}
                        className="rounded border-neutral-300 text-brand-primary focus:ring-brand-primary"
                      />
                      <span>{s.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Airlines Filter */}
              {availableAirlines.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-3">
                    Airlines
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {availableAirlines.map((airline) => (
                      <label
                        key={airline}
                        className="flex items-center gap-2 text-sm text-text-primary cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={filters.airlines.includes(airline)}
                          onChange={() => dispatch(toggleAirlineFilter(airline))}
                          className="rounded border-neutral-300 text-brand-primary focus:ring-brand-primary"
                        />
                        <span className="truncate">{airline}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Price Filter */}
              {stats?.cheapestPrice && (
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                      Max Price
                    </h4>
                    <span className="text-xs font-bold text-brand-primary">
                      {filters.maxPrice ? `${filters.maxPrice.toLocaleString()} BDT` : 'Any'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={stats.cheapestPrice}
                    max={stats.cheapestPrice * 3}
                    step={1000}
                    value={filters.maxPrice || stats.cheapestPrice * 3}
                    onChange={(e) => dispatch(setMaxPriceFilter(parseInt(e.target.value, 10)))}
                    className="w-full accent-brand-primary cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-text-tertiary mt-1">
                    <span>{stats.cheapestPrice.toLocaleString()} BDT</span>
                    <span>{(stats.cheapestPrice * 3).toLocaleString()} BDT</span>
                  </div>
                </div>
              )}
            </Card>
          </aside>

          {/* Right Main Area: Sort Tabs & Offers List */}
          <main className="lg:col-span-3 space-y-4">
            {/* Sort Tabs */}
            <div className="grid grid-cols-3 gap-2 bg-white p-1 rounded-sm border border-neutral-200 shadow-xs">
              {[
                {
                  id: 'recommended' as FlightSortOption,
                  label: 'Recommended',
                  sub: 'Best balance of price & speed',
                },
                {
                  id: 'cheapest' as FlightSortOption,
                  label: 'Cheapest',
                  sub: stats?.cheapestPrice
                    ? `From ${stats.cheapestPrice.toLocaleString()} BDT`
                    : 'Lowest price',
                },
                {
                  id: 'fastest' as FlightSortOption,
                  label: 'Fastest',
                  sub: stats?.fastestDurationMinutes
                    ? `${Math.floor(stats.fastestDurationMinutes / 60)}h ${
                        stats.fastestDurationMinutes % 60
                      }m`
                    : 'Quickest route',
                },
              ].map((tab) => {
                const isActive = sortBy === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => dispatch(setSortBy(tab.id))}
                    className={`py-3 px-3 text-center rounded-xs transition-all cursor-pointer ${
                      isActive
                        ? 'bg-brand-primary text-white shadow-xs'
                        : 'hover:bg-neutral-100 text-text-secondary'
                    }`}
                  >
                    <span className="block text-sm font-bold">{tab.label}</span>
                    <span
                      className={`block text-[11px] truncate mt-0.5 ${
                        isActive ? 'text-white/80' : 'text-text-tertiary'
                      }`}
                    >
                      {tab.sub}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Status Handling: Loading */}
            {status === 'loading' && (
              <div className="space-y-4 py-8">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="p-6 bg-white border border-neutral-200 rounded-sm animate-pulse space-y-4"
                  >
                    <div className="flex justify-between items-center">
                      <div className="h-6 w-36 bg-neutral-200 rounded" />
                      <div className="h-6 w-24 bg-neutral-200 rounded" />
                    </div>
                    <div className="h-12 bg-neutral-100 rounded" />
                    <div className="flex justify-between items-center pt-2">
                      <div className="h-4 w-48 bg-neutral-100 rounded" />
                      <div className="h-8 w-28 bg-neutral-200 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Status Handling: Error */}
            {status === 'failed' && (
              <div className="p-8 bg-white border border-red-200 rounded-sm text-center space-y-4">
                <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
                  <Icon name="x" size={24} />
                </div>
                <h3 className="text-lg font-bold text-text-primary">Search Failed</h3>
                <p className="text-sm text-text-secondary max-w-md mx-auto">{error}</p>
                <Button
                  variant="primary"
                  onClick={() =>
                    dispatch(
                      fetchFlightOffers({
                        tripType,
                        from,
                        to,
                        departureDate: depart,
                        returnDate: returnDate || undefined,
                        adults,
                        children,
                        infants,
                        cabinClass: cabin,
                      })
                    )
                  }
                >
                  Retry Search
                </Button>
              </div>
            )}

            {/* Status Handling: Empty */}
            {status === 'succeeded' && processedOffers.length === 0 && (
              <div className="p-12 bg-white border border-neutral-200 rounded-sm text-center space-y-4">
                <div className="w-12 h-12 bg-neutral-100 text-neutral-400 rounded-full flex items-center justify-center mx-auto">
                  <Icon name="plane" size={24} />
                </div>
                <h3 className="text-lg font-bold text-text-primary">No Flights Found</h3>
                <p className="text-sm text-text-secondary max-w-md mx-auto">
                  No flight offers matched your filters for {from} to {to}. Try resetting your filters or adjusting your travel dates.
                </p>
                <Button variant="outline" onClick={() => dispatch(resetFilters())}>
                  Reset Filters
                </Button>
              </div>
            )}

            {/* Status Handling: Results List */}
            {status === 'succeeded' && processedOffers.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-text-secondary px-1">
                  <span>Showing <strong>{processedOffers.length}</strong> available options</span>
                  <span>All fares in BDT, taxes included</span>
                </div>

                {processedOffers.map((offer) => {
                  const totalPrice = offer.price?.totalAmount ?? 0;
                  const currency = offer.price?.currency ?? 'BDT';
                  const airlineName =
                    typeof offer.airline === 'object' ? offer.airline.name : offer.airline;
                  const outbound = offer.outboundLeg;
                  const stops = offer.stopsCount ?? 0;
                  const isCompared = comparedOffers.some((o) => o.id === offer.id);

                  return (
                    <Card
                      key={offer.id}
                      className="p-5 bg-white border border-neutral-200 hover:border-brand-primary/40 rounded-sm shadow-xs transition-all hover:shadow-md"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        {/* Left: Flight Details */}
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-base text-text-primary">
                                {airlineName}
                              </span>
                              <span className="text-xs text-text-tertiary">
                                {offer.flightNumber}
                              </span>
                            </div>
                            {/* Ranking tag */}
                            {offer.rankingTags && offer.rankingTags.length > 0 && (
                              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-brand-primary/10 text-brand-primary">
                                {offer.rankingTags[0]}
                              </span>
                            )}
                          </div>

                          {/* Outbound Itinerary */}
                          <div className="flex items-center justify-between gap-4 py-2 border-y border-neutral-100">
                            <div>
                              <p className="text-xl font-bold text-text-primary">
                                {outbound?.departureTime}
                              </p>
                              <p className="text-xs font-semibold text-text-secondary">
                                {outbound?.origin?.code || from}
                              </p>
                            </div>

                            <div className="flex-1 flex flex-col items-center max-w-[200px]">
                              <span className="text-xs text-text-tertiary mb-1">
                                {`${Math.floor(
                                  (offer.totalDurationMinutes || 180) / 60
                                )}h ${(offer.totalDurationMinutes || 180) % 60}m`}
                              </span>
                              <div className="w-full flex items-center gap-1">
                                <div className="h-0.5 bg-neutral-300 flex-1" />
                                <Icon
                                  name="plane"
                                  size={14}
                                  className="text-brand-primary rotate-90"
                                />
                                <div className="h-0.5 bg-neutral-300 flex-1" />
                              </div>
                              <span
                                className={`text-[11px] font-medium mt-1 ${
                                  stops === 0 ? 'text-emerald-700' : 'text-amber-700'
                                }`}
                              >
                                {stops === 0 ? 'Direct' : `${stops} stop`}
                              </span>
                            </div>

                            <div className="text-right">
                              <p className="text-xl font-bold text-text-primary">
                                {outbound?.arrivalTime}
                              </p>
                              <p className="text-xs font-semibold text-text-secondary">
                                {outbound?.destination?.code || to}
                              </p>
                            </div>
                          </div>

                          {/* Baggage & Flex notes */}
                          <div className="flex items-center gap-4 text-xs text-text-tertiary">
                            <span className="flex items-center gap-1">
                              <Icon name="check" size={14} className="text-emerald-600" />
                              Cabin: 7kg
                            </span>
                            <span className="flex items-center gap-1">
                              <Icon name="check" size={14} className="text-emerald-600" />
                              Checked: 20-30kg
                            </span>
                            {offer.refundable ? (
                              <span className="text-emerald-700 font-semibold">Refundable</span>
                            ) : (
                              <span>Non-refundable</span>
                            )}
                          </div>
                        </div>

                        {/* Right: Pricing & CTA */}
                        <div className="md:w-56 md:border-l md:border-neutral-200 md:pl-6 flex flex-col justify-between items-end gap-3">
                          <div className="text-right w-full">
                            <span className="text-xs text-text-tertiary block">Total Fare</span>
                            <span className="text-2xl font-extrabold text-brand-primary">
                              {totalPrice.toLocaleString()} {currency}
                            </span>
                            <span className="text-[10px] text-text-tertiary block">
                              Includes all taxes & fees
                            </span>
                          </div>

                          <div className="w-full space-y-2">
                            <Button
                              variant="primary"
                              size="md"
                              className="w-full font-bold cursor-pointer"
                              onClick={() =>
                                dispatch(
                                  openBookingModal({
                                    type: 'FLIGHT',
                                    title: `${airlineName} (${outbound?.origin?.code || from} → ${
                                      outbound?.destination?.code || to
                                    })`,
                                    totalPrice,
                                    currency,
                                    details: {
                                      offerId: offer.id,
                                      flightNumber: offer.flightNumber,
                                      departureDate: depart,
                                      returnDate,
                                      cabinClass: cabin,
                                    },
                                  })
                                )
                              }
                            >
                              Book with Agent
                            </Button>

                            <label className="flex items-center justify-center gap-2 text-xs text-text-secondary cursor-pointer py-1">
                              <input
                                type="checkbox"
                                checked={isCompared}
                                onChange={() => dispatch(toggleCompareOffer(offer))}
                                className="rounded border-neutral-300 text-brand-primary"
                              />
                              <span>Compare flight</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Floating comparison drawer */}
      <FlightCompareDrawer />

      {/* Modal for Booking / Inquiring */}
      <BookingModal />
    </div>
  );
}

export default function FlightResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-neutral-50">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-semibold text-text-secondary">
              Searching flight offers...
            </p>
          </div>
        </div>
      }
    >
      <FlightResultsContent />
    </Suspense>
  );
}
