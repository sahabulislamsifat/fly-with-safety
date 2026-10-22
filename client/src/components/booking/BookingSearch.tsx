'use client';

import { useState, useId } from 'react';
import { useRouter } from 'next/navigation';
import { SearchTab, TripType, MultiCitySegment } from '@/types';
import { Icon } from '@/components/ui/Icons';
import { CategoryTabs } from './CategoryTabs';
import { AirportSelectorPopover } from './AirportSelectorPopover';
import {
  PassengerClassPopover,
  PassengerCounts,
  CabinClass,
} from './PassengerClassPopover';
import { PreferredAirlinePopover } from './PreferredAirlinePopover';
import { InquiryDefaults, ServiceInquiryModal } from './ServiceInquiryModal';
import { DateInput } from './DateInput';
import { addTravelDays, travelToday } from '@/lib/travel-dates';

interface BookingSearchProps {
  defaultTab?: SearchTab;
  className?: string;
  isOverlapping?: boolean;
  externalRoute?: { from: string; to: string } | null;
}

function formatHumanDate(dateStr: string) {
  if (!dateStr) return { date: 'Select Date', weekday: 'Choose date' };
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return { date: dateStr, weekday: '' };
  const day = d.getDate();
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const year = d.getFullYear().toString().slice(-2);
  const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
  return { date: `${day} ${month}, ${year}`, weekday };
}

export function BookingSearch({
  defaultTab = 'flights',
  className,
  isOverlapping = true,
  externalRoute,
}: BookingSearchProps) {
  const router = useRouter();
  const dateInputIdDepart = useId();
  const dateInputIdReturn = useId();

  // Active Category Tab
  const [activeTab, setActiveTab] = useState<SearchTab>(defaultTab);

  // Flight State
  const [tripType, setTripType] = useState<TripType>('roundTrip');
  const [fromAirport, setFromAirport] = useState('DAC');
  const [toAirport, setToAirport] = useState('CXB');
  const [appliedRoute, setAppliedRoute] = useState<typeof externalRoute>(null);

  // Dates default to today and +3 days
  const todayStr = travelToday();
  const returnDefaultDate = addTravelDays(todayStr, 3);

  const [departureDate, setDepartureDate] = useState(todayStr);
  const [returnDate, setReturnDate] = useState(returnDefaultDate);
  const changeTripType = (next: TripType) => {
    setTripType(next);
    setValidationError(null);
    if (next === 'roundTrip' && (!returnDate || returnDate < departureDate)) {
      setReturnDate(departureDate);
    }
  };

  // Passenger & Cabin Class
  const [passengers, setPassengers] = useState<PassengerCounts>({
    adults: 1,
    children: 0,
    infants: 0,
  });
  const [cabinClass, setCabinClass] = useState<CabinClass>('economy');

  // Preferred Airlines
  const [selectedAirlines, setSelectedAirlines] = useState<string[]>([]);

  // Multi-City Segments
  const [segments, setSegments] = useState<MultiCitySegment[]>([
    { id: 'seg-1', from: 'DAC', to: 'BKK', departureDate: todayStr },
    { id: 'seg-2', from: 'BKK', to: 'SIN', departureDate: returnDefaultDate },
  ]);

  // Hotel State
  const [hotelDestination, setHotelDestination] = useState("Cox's Bazar");
  const [hotelCheckIn, setHotelCheckIn] = useState(todayStr);
  const [hotelCheckOut, setHotelCheckOut] = useState(returnDefaultDate);
  const [hotelGuests, setHotelGuests] = useState(2);
  const [hotelRooms, setHotelRooms] = useState(1);

  // Holiday State
  const [holidayDestination, setHolidayDestination] = useState('Bangkok & Pattaya');
  const [holidayTravelDate, setHolidayTravelDate] = useState(todayStr);
  const [holidayTravellers, setHolidayTravellers] = useState(2);
  const [holidayCategory, setHolidayCategory] = useState('All Packages');

  // Visa State
  const [visaCountry, setVisaCountry] = useState('Thailand');
  const [visaNationality, setVisaNationality] = useState('Bangladeshi');
  const [visaPurpose, setVisaPurpose] = useState('Tourist Visa');

  // Submission & Validation
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [inquiryDefaults, setInquiryDefaults] = useState<InquiryDefaults | null>(null);

  // Sync external route if triggered from Destination Card or Trending Routes
  if (externalRoute && externalRoute !== appliedRoute) {
    setAppliedRoute(externalRoute);
    setFromAirport(externalRoute.from);
    setToAirport(externalRoute.to);
  }

  // Swap origin and destination
  const handleSwapAirports = () => {
    setFromAirport(toAirport);
    setToAirport(fromAirport);
    setValidationError(null);
  };

  // Add Multi-city segment
  const handleAddSegment = () => {
    if (segments.length >= 4) return;
    const lastSeg = segments[segments.length - 1];
    setSegments((prev) => [
      ...prev,
      {
        id: `seg-${Date.now()}`,
        from: lastSeg ? lastSeg.to : 'DAC',
        to: 'KUL',
        departureDate: lastSeg ? lastSeg.departureDate : todayStr,
      },
    ]);
  };

  const handleRemoveSegment = (index: number) => {
    if (segments.length <= 2) return;
    setSegments((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateSegment = (
    index: number,
    field: keyof MultiCitySegment,
    value: string
  ) => {
    setSegments((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Handle Search Submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setIsLoading(true);

    if (activeTab === 'flights') {
      if (tripType === 'multiCity') {
        // Multi city search
        if (segments.some((segment) => segment.from === segment.to)) {
          setValidationError('Each flight must have different origin and destination airports.');
          setIsLoading(false);
          return;
        }
        openSpecialistInquiry();
      } else {
        // Validation
        if (fromAirport === toAirport) {
          setValidationError('Origin and destination cannot be the same airport.');
          setIsLoading(false);
          return;
        }

        if (tripType === 'roundTrip' && returnDate < departureDate) {
          setValidationError('Return date cannot be earlier than departure date.');
          setIsLoading(false);
          return;
        }

        const query = new URLSearchParams({
          from: fromAirport,
          to: toAirport,
          depart: departureDate,
          tripType,
          cabin: cabinClass,
          adults: passengers.adults.toString(),
          children: passengers.children.toString(),
          infants: passengers.infants.toString(),
        });

        if (tripType === 'roundTrip' && returnDate) {
          query.set('return', returnDate);
        }

        if (selectedAirlines.length > 0) {
          query.set('airlines', selectedAirlines.join(','));
        }

        router.push(`/flights/results?${query.toString()}`);
      }
    } else if (activeTab === 'hotels') {
      const query = new URLSearchParams({
        destination: hotelDestination || 'Bangkok',
        checkIn: hotelCheckIn,
        checkOut: hotelCheckOut,
        guests: hotelGuests.toString(),
        rooms: hotelRooms.toString(),
      });
      router.push(`/hotels/results?${query.toString()}`);
    } else if (activeTab === 'packages') {
      const query = new URLSearchParams({
        destination: holidayDestination,
        date: holidayTravelDate,
        travellers: holidayTravellers.toString(),
      });
      router.push(`/packages?${query.toString()}`);
    } else if (activeTab === 'visa') {
      const query = new URLSearchParams({
        destination: visaCountry,
        nationality: visaNationality,
        purpose: visaPurpose,
      });
      router.push(`/visa-info?${query.toString()}`);
    }

    setIsLoading(false);
  };

  const openSpecialistInquiry = () => {
    if (activeTab === 'flights') {
      const isMultiCity = tripType === 'multiCity';
      const firstSegment = segments[0];
      const lastSegment = segments[segments.length - 1];
      const cabinMap = {
        economy: 'economy',
        premiumEconomy: 'premium_economy',
        business: 'business',
        first: 'first',
      } as const;
      setInquiryDefaults({
        kind: 'flight',
        from: isMultiCity ? firstSegment.from : fromAirport,
        to: isMultiCity ? lastSegment.to : toAirport,
        departureDate: isMultiCity ? firstSegment.departureDate : departureDate,
        returnDate: tripType === 'roundTrip' ? returnDate : undefined,
        tripType,
        routeNote: isMultiCity
          ? `Multi-city itinerary: ${segments.map((segment) => `${segment.from} → ${segment.to} (${segment.departureDate})`).join('; ')}`
          : undefined,
        adults: passengers.adults,
        children: passengers.children,
        infants: passengers.infants,
        cabinClass: cabinMap[cabinClass],
      });
      return;
    }
    if (activeTab === 'hotels') {
      setInquiryDefaults({ kind: 'hotel', destination: hotelDestination, checkIn: hotelCheckIn, checkOut: hotelCheckOut, guests: hotelGuests, rooms: hotelRooms });
      return;
    }
    if (activeTab === 'packages') {
      setInquiryDefaults({ kind: 'package', packageTitle: `${holidayDestination || 'Holiday'} — ${holidayCategory}`, travelDate: holidayTravelDate, travellers: holidayTravellers });
      return;
    }
    setInquiryDefaults({ kind: 'visa', destination: visaCountry, nationality: visaNationality, travelPurpose: visaPurpose });
  };

  const humanDepart = formatHumanDate(departureDate);
  const humanReturn = formatHumanDate(returnDate);

  return (
    <div
      className={
        className ||
        (isOverlapping
          ? 'relative w-full max-w-[1380px] mx-auto px-4 sm:px-6 -mt-24 sm:-mt-28 lg:-mt-32 z-30'
          : 'relative w-full max-w-[1380px] mx-auto px-4 sm:px-6 my-8 z-30')
      }
      role="search"
      aria-label="Travel booking search"
    >
      {/* 1. Floating Category Tabs (Centered, Overlapping Panel Top Edge) */}
      <CategoryTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* 2. Main Booking Panel Card */}
      <div
        id="main-booking-panel"
        className="relative bg-white rounded-xs border border-slate-200/90 shadow-[0_20px_50px_rgba(0,0,0,0.06)] pt-12 sm:pt-14 pb-10 sm:pb-12 px-5 sm:px-8 lg:px-10"
      >
        <form onSubmit={handleSearchSubmit}>
          {/* FLIGHTS TAB */}
          {activeTab === 'flights' && (
            <div role="tabpanel" id="category-panel-flights" aria-labelledby="category-tab-flights">
              {/* Trip Type Selector */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div className="inline-flex p-1 bg-neutral-100 rounded-xs text-xs font-semibold text-neutral-600 select-none">
                  {(['oneWay', 'roundTrip', 'multiCity'] as TripType[]).map((type) => {
                    const isActive = tripType === type;
                    const labels: Record<TripType, string> = {
                      oneWay: 'One Way',
                      roundTrip: 'Round Trip',
                      multiCity: 'Multi City',
                    };
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          changeTripType(type);
                          setValidationError(null);
                        }}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xs text-xs transition-all cursor-pointer ${
                          isActive
                            ? 'bg-white text-[#8B1D24] shadow-xs font-bold'
                            : 'text-neutral-600 hover:text-neutral-900'
                        }`}
                      >
                        {isActive && (
                          <span className="w-1.5 h-1.5 rounded-xs bg-[#8B1D24]" aria-hidden="true" />
                        )}
                        <span>{labels[type]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Standard Round Trip / One Way Row (4 Groups on Desktop) */}
              {tripType !== 'multiCity' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3 items-stretch relative">
                  {/* Field A: FROM (col-span-3) */}
                  <div className="lg:col-span-3 relative">
                    <AirportSelectorPopover
                      label="FROM"
                      code={fromAirport}
                      disabledCode={toAirport}
                      onChange={(code) => setFromAirport(code)}
                    />
                  </div>

                  {/* Route Swap Button - rounded-xs */}
                  <div className="relative flex items-center justify-center -my-2 md:absolute md:left-1/2 md:top-7 md:-translate-x-1/2 md:my-0 lg:left-1/4 z-20">
                    <button
                      type="button"
                      onClick={handleSwapAirports}
                      title="Swap departure and arrival airports"
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-xs bg-[#8B1D24] hover:bg-[#74181E] text-white shadow-md flex items-center justify-center transition-transform hover:rotate-180 duration-300 cursor-pointer border-2 border-white shrink-0"
                      aria-label="Swap origin and destination"
                    >
                      <Icon name="swapHorizontal" size={16} />
                    </button>
                  </div>

                  {/* Field B: TO (col-span-3) */}
                  <div className="lg:col-span-3 relative">
                    <AirportSelectorPopover
                      label="TO"
                      code={toAirport}
                      disabledCode={fromAirport}
                      onChange={(code) => setToAirport(code)}
                    />
                  </div>

                  {/* Field C: DEPARTURE & RETURN Connected Container (col-span-3) */}
                  <div className="lg:col-span-3">
                    <div className="p-3 sm:p-3.5 bg-white rounded-xs border border-neutral-200 hover:border-neutral-300 transition-colors flex items-center justify-between gap-2 h-full">
                      {/* DEPARTURE */}
                      <div className="relative flex-1">
                        <label
                          htmlFor={dateInputIdDepart}
                          className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-0.5 cursor-pointer"
                        >
                          DEPARTURE
                        </label>
                        <DateInput
                          id={dateInputIdDepart}
                          required
                          value={departureDate}
                          min={todayStr}
                          onChange={(e) => {
                            setDepartureDate(e.target.value);
                            if (tripType === 'roundTrip' && returnDate < e.target.value) {
                              setReturnDate(e.target.value);
                            }
                          }}
                          className="absolute inset-0 opacity-0 focus:opacity-100 focus:bg-white focus:text-sm focus:text-neutral-900 focus:outline-2 focus:outline-brand-red cursor-pointer w-full h-full z-10"
                        />
                        <div className="pointer-events-none">
                          <p className="text-base sm:text-lg font-black text-neutral-900 leading-tight truncate">
                            {humanDepart.date}
                          </p>
                          <p className="text-xs text-neutral-500 truncate mt-0.5">
                            {humanDepart.weekday}
                          </p>
                        </div>
                      </div>

                      {/* Vertical Divider */}
                      <div className="h-8 w-[1px] bg-neutral-200 shrink-0" />

                      {/* RETURN */}
                      <div className="relative flex-1">
                        <label
                          htmlFor={dateInputIdReturn}
                          className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-0.5 cursor-pointer"
                        >
                          RETURN
                        </label>
                        {tripType === 'roundTrip' ? (
                          <>
                            <DateInput
                              id={dateInputIdReturn}
                              required
                              value={returnDate}
                              min={departureDate || todayStr}
                              onChange={(e) => setReturnDate(e.target.value)}
                              className="absolute inset-0 opacity-0 focus:opacity-100 focus:bg-white focus:text-sm focus:text-neutral-900 focus:outline-2 focus:outline-brand-red cursor-pointer w-full h-full z-10"
                            />
                            <div className="flex items-center justify-between">
                              <div className="pointer-events-none min-w-0 pr-1">
                                <p className="text-base sm:text-lg font-black text-neutral-900 leading-tight truncate">
                                  {humanReturn.date}
                                </p>
                                <p className="text-xs text-neutral-500 truncate mt-0.5">
                                  {humanReturn.weekday}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  changeTripType('oneWay');
                                }}
                                title="Switch to One Way"
                                className="text-neutral-400 hover:text-neutral-600 p-1 z-20"
                                aria-label="Clear return date"
                              >
                                <Icon name="x" size={13} />
                              </button>
                            </div>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => changeTripType('roundTrip')}
                            className="text-left w-full cursor-pointer"
                          >
                            <p className="text-sm font-bold text-[#8B1D24] leading-tight mt-1">
                              + Add Return
                            </p>
                            <p className="text-[11px] text-neutral-400">Save on round trip</p>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Field D: PASSENGER & CLASS (col-span-3) */}
                  <div className="lg:col-span-3">
                    <PassengerClassPopover
                      passengers={passengers}
                      cabinClass={cabinClass}
                      onChange={(p, c) => {
                        setPassengers(p);
                        setCabinClass(c);
                      }}
                    />
                  </div>
                </div>
              ) : (
                /* Multi City Dynamic Segments */
                <div className="space-y-3">
                  {segments.map((seg, idx) => (
                    <div
                      key={seg.id}
                      className="p-3.5 bg-neutral-50 rounded-xs border border-neutral-200/90 grid grid-cols-1 md:grid-cols-12 gap-3 items-center"
                    >
                      <div className="md:col-span-1 text-center font-bold text-xs text-[#8B1D24]">
                        Flight {idx + 1}
                      </div>
                      <div className="md:col-span-4">
                        <AirportSelectorPopover
                          label="FROM"
                          code={seg.from}
                          onChange={(c) => handleUpdateSegment(idx, 'from', c)}
                        />
                      </div>
                      <div className="md:col-span-4">
                        <AirportSelectorPopover
                          label="TO"
                          code={seg.to}
                          onChange={(c) => handleUpdateSegment(idx, 'to', c)}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <div className="p-3 bg-white rounded-xs border border-neutral-200">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-0.5">
                            DATE
                          </label>
                          <DateInput
                            aria-label={`Flight ${idx + 1} departure date`}
                            required
                            value={seg.departureDate}
                            min={idx > 0 ? segments[idx - 1].departureDate || todayStr : todayStr}
                            onChange={(e) =>
                              handleUpdateSegment(idx, 'departureDate', e.target.value)
                            }
                            className="text-sm font-bold text-neutral-900 bg-transparent w-full focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="md:col-span-1 text-right">
                        {segments.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSegment(idx)}
                            className="p-2 text-neutral-400 hover:text-red-600 rounded-xs"
                            aria-label={`Remove Flight ${idx + 1}`}
                          >
                            <Icon name="x" size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={handleAddSegment}
                      disabled={segments.length >= 4}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xs border border-dashed border-[#8B1D24] text-[#8B1D24] text-xs font-bold hover:bg-red-50 disabled:opacity-40 transition-colors"
                    >
                      <Icon name="plus" size={14} />
                      <span>Add Another Flight</span>
                    </button>

                    <div className="w-full sm:w-64">
                      <PassengerClassPopover
                        passengers={passengers}
                        cabinClass={cabinClass}
                        onChange={(p, c) => {
                          setPassengers(p);
                          setCabinClass(c);
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Lower Section: Preferred Airline */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="text-xs text-neutral-400">
                  {validationError ? (
                    <span role="alert" className="text-red-600 font-semibold">{validationError}</span>
                  ) : (
                    <span>{tripType === 'multiCity' ? 'Multi-city itineraries are reviewed by a specialist. Every flight is included in your request.' : 'Compare demo fares and request confirmed options from our travel desk.'}</span>
                  )}
                </div>

                <PreferredAirlinePopover
                  selectedAirlines={selectedAirlines}
                  onChange={setSelectedAirlines}
                />
              </div>
            </div>
          )}

          {/* VISA TAB */}
          {activeTab === 'visa' && (
            <div role="tabpanel" id="category-panel-visa" aria-labelledby="category-tab-visa">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3.5 bg-white rounded-xs border border-neutral-200">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                    DESTINATION COUNTRY
                  </label>
                  <input
                    type="text"
                    value={visaCountry}
                    onChange={(e) => setVisaCountry(e.target.value)}
                    placeholder="e.g. Thailand, Malaysia, UAE"
                    className="w-full text-base font-bold text-neutral-900 bg-transparent focus:outline-none"
                  />
                  <p className="text-xs text-neutral-400 mt-1">E-Visa &amp; Sticker Visa assistance</p>
                </div>

                <div className="p-3.5 bg-white rounded-xs border border-neutral-200">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                    YOUR NATIONALITY
                  </label>
                  <input
                    type="text"
                    value={visaNationality}
                    onChange={(e) => setVisaNationality(e.target.value)}
                    placeholder="e.g. Bangladeshi"
                    className="w-full text-base font-bold text-neutral-900 bg-transparent focus:outline-none"
                  />
                  <p className="text-xs text-neutral-400 mt-1">Passport issuing country</p>
                </div>

                <div className="p-3.5 bg-white rounded-xs border border-neutral-200">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                    VISA PURPOSE
                  </label>
                  <select
                    value={visaPurpose}
                    onChange={(e) => setVisaPurpose(e.target.value)}
                    className="w-full text-base font-bold text-neutral-900 bg-transparent focus:outline-none cursor-pointer"
                  >
                    <option value="Tourist Visa">Tourist Visa</option>
                    <option value="Business Visa">Business Visa</option>
                    <option value="Medical Visa">Medical Visa</option>
                    <option value="Student Visa">Student Visa</option>
                  </select>
                  <p className="text-xs text-neutral-400 mt-1">Dedicated visa counselor</p>
                </div>
              </div>
            </div>
          )}

          {/* HOTEL TAB */}
          {activeTab === 'hotels' && (
            <div role="tabpanel" id="category-panel-hotels" aria-labelledby="category-tab-hotels">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-3.5 bg-white rounded-xs border border-neutral-200">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                    CITY OR HOTEL
                  </label>
                  <input
                    type="text"
                    value={hotelDestination}
                    onChange={(e) => setHotelDestination(e.target.value)}
                    placeholder="e.g. Bangkok, Cox's Bazar"
                    className="w-full text-base font-bold text-neutral-900 bg-transparent focus:outline-none"
                  />
                  <p className="text-xs text-neutral-400 mt-1">City, region, or specific property</p>
                </div>

                <div className="p-3.5 bg-white rounded-xs border border-neutral-200">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                    CHECK-IN
                  </label>
                  <DateInput
                    aria-label="Check-in"
                    required
                    value={hotelCheckIn}
                    min={todayStr}
                    onChange={(e) => {
                      const next = e.target.value;
                      setHotelCheckIn(next);
                      if (next && hotelCheckOut <= next) setHotelCheckOut(addTravelDays(next, 1));
                    }}
                    className="w-full text-sm font-bold text-neutral-900 bg-transparent focus:outline-none"
                  />
                  <p className="text-xs text-neutral-400 mt-1">Standard 2:00 PM check-in</p>
                </div>

                <div className="p-3.5 bg-white rounded-xs border border-neutral-200">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                    CHECK-OUT
                  </label>
                  <DateInput
                    aria-label="Check-out"
                    required
                    value={hotelCheckOut}
                    min={addTravelDays(hotelCheckIn || todayStr, 1)}
                    onChange={(e) => setHotelCheckOut(e.target.value)}
                    className="w-full text-sm font-bold text-neutral-900 bg-transparent focus:outline-none"
                  />
                  <p className="text-xs text-neutral-400 mt-1">Standard 12:00 PM check-out</p>
                </div>

                <div className="p-3.5 bg-white rounded-xs border border-neutral-200 flex items-center justify-between">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                      GUESTS &amp; ROOMS
                    </label>
                    <p className="text-base font-bold text-neutral-900">
                      {hotelGuests} Guests · {hotelRooms} Room{hotelRooms > 1 ? 's' : ''}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] text-neutral-400">Rooms:</span>
                      <button
                        type="button"
                        onClick={() => setHotelRooms((r) => Math.max(1, r - 1))}
                        disabled={hotelRooms <= 1}
                        className="w-5 h-5 rounded-xs border border-neutral-200 flex items-center justify-center text-[10px] text-neutral-700 disabled:opacity-30"
                        aria-label="Decrease rooms"
                      >
                        -
                      </button>
                      <span className="text-xs font-bold text-neutral-800">{hotelRooms}</span>
                      <button
                        type="button"
                        onClick={() => setHotelRooms((r) => Math.min(5, r + 1))}
                        disabled={hotelRooms >= 5}
                        className="w-5 h-5 rounded-xs border border-neutral-200 flex items-center justify-center text-[10px] text-neutral-700 disabled:opacity-30"
                        aria-label="Increase rooms"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setHotelGuests((g) => Math.max(1, g - 1))}
                      disabled={hotelGuests <= 1}
                      className="w-7 h-7 rounded-xs border border-neutral-200 flex items-center justify-center text-xs text-neutral-700 disabled:opacity-30"
                      aria-label="Decrease guests"
                    >
                      -
                    </button>
                    <span className="text-xs font-bold text-neutral-800 px-1">{hotelGuests}</span>
                    <button
                      type="button"
                      onClick={() => setHotelGuests((g) => g + 1)}
                      className="w-7 h-7 rounded-xs border border-neutral-200 flex items-center justify-center text-xs text-neutral-700"
                      aria-label="Increase guests"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* HOLIDAY / PACKAGES TAB */}
          {activeTab === 'packages' && (
            <div role="tabpanel" id="category-panel-packages" aria-labelledby="category-tab-packages">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-3.5 bg-white rounded-xs border border-neutral-200">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                    DESTINATION
                  </label>
                  <input
                    type="text"
                    value={holidayDestination}
                    onChange={(e) => setHolidayDestination(e.target.value)}
                    placeholder="e.g. Maldives, Bangkok"
                    className="w-full text-base font-bold text-neutral-900 bg-transparent focus:outline-none"
                  />
                  <p className="text-xs text-neutral-400 mt-1">Curated holiday package destinations</p>
                </div>

                <div className="p-3.5 bg-white rounded-xs border border-neutral-200">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                    TRAVEL MONTH / DATE
                  </label>
                  <DateInput
                    aria-label="Travel date"
                    required
                    value={holidayTravelDate}
                    min={todayStr}
                    onChange={(e) => setHolidayTravelDate(e.target.value)}
                    className="w-full text-sm font-bold text-neutral-900 bg-transparent focus:outline-none"
                  />
                  <p className="text-xs text-neutral-400 mt-1">Flexible departure dates</p>
                </div>

                <div className="p-3.5 bg-white rounded-xs border border-neutral-200">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                    TRAVELLERS
                  </label>
                  <select
                    value={holidayTravellers}
                    onChange={(e) => setHolidayTravellers(parseInt(e.target.value, 10))}
                    className="w-full text-base font-bold text-neutral-900 bg-transparent focus:outline-none cursor-pointer"
                  >
                    {[1, 2, 3, 4, 5, 6, 8, 10].map((num) => (
                      <option key={num} value={num}>
                        {num} {num === 1 ? 'Traveller' : 'Travellers'}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-neutral-400 mt-1">Tour group or private trip</p>
                </div>

                <div className="p-3.5 bg-white rounded-xs border border-neutral-200">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                    THEME / PACKAGE
                  </label>
                  <select
                    value={holidayCategory}
                    onChange={(e) => setHolidayCategory(e.target.value)}
                    className="w-full text-base font-bold text-neutral-900 bg-transparent focus:outline-none cursor-pointer"
                  >
                    <option value="All Packages">All Packages</option>
                    <option value="Honeymoon & Romantic">Honeymoon &amp; Romantic</option>
                    <option value="Family Vacations">Family Vacations</option>
                    <option value="Adventure & Beach">Adventure &amp; Beach</option>
                    <option value="Luxury Escapes">Luxury Escapes</option>
                  </select>
                  <p className="text-xs text-neutral-400 mt-1">Hotel + flights + transfers</p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={openSpecialistInquiry}
              className="rounded-xs px-3 py-2 text-sm font-semibold text-brand-red underline-offset-4 hover:bg-brand-red-light hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2"
            >
              Request specialist help instead
            </button>
          </div>

          {/* 3. Floating Red Search Button (Centered, Overlapping Panel Bottom Edge) - rounded-xs */}
          <div className="absolute -bottom-7 sm:-bottom-8 left-1/2 -translate-x-1/2 z-30">
            <button
              type="submit"
              disabled={isLoading}
              className="h-[56px] sm:h-[62px] px-10 sm:px-14 rounded-xs bg-[#8B1D24] hover:bg-[#74181E] text-white font-black text-base sm:text-lg shadow-[0_12px_28px_rgba(139,29,36,0.38)] hover:shadow-[0_16px_36px_rgba(139,29,36,0.48)] flex items-center justify-center gap-2.5 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer border-2 border-white select-none whitespace-nowrap"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-xs animate-spin" />
              ) : (
                <Icon name="search" size={20} />
              )}
              <span>
                {activeTab === 'flights' && (tripType === 'multiCity' ? 'Request itinerary' : 'Search')}
                {activeTab === 'hotels' && 'Search Hotels'}
                {activeTab === 'packages' && 'Explore Packages'}
                {activeTab === 'visa' && 'Check Visa Info'}
              </span>
            </button>
          </div>
        </form>
      </div>
      {inquiryDefaults && (
        <ServiceInquiryModal defaults={inquiryDefaults} onClose={() => setInquiryDefaults(null)} />
      )}
    </div>
  );
}
