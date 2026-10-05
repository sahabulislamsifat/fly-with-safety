'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  SearchTab,
  FlightSearchParams,
  HotelSearchParams,
  PackageSearchParams,
  VisaSearchParams,
} from '@/types';
import { Button, Input, Select, Card } from '@/components/ui';
import { Icon, IconName } from '@/components/ui/Icons';
import { defaultSearchParams } from '@/lib/data/site-data';
import { AirportCombobox } from './AirportCombobox';

const tabs: { id: SearchTab; label: string; icon: IconName }[] = [
  { id: 'flights', label: 'Flights', icon: 'plane' },
  { id: 'hotels', label: 'Hotels', icon: 'hotel' },
  { id: 'packages', label: 'Packages', icon: 'package' },
  { id: 'visa', label: 'Visa Info', icon: 'fileText' },
];

const passengerOptions = [
  { value: '1', label: '1 Passenger' },
  { value: '2', label: '2 Passengers' },
  { value: '3', label: '3 Passengers' },
  { value: '4', label: '4 Passengers' },
  { value: '5', label: '5 Passengers' },
];

const classOptions = [
  { value: 'economy', label: 'Economy' },
  { value: 'business', label: 'Business' },
  { value: 'first', label: 'First' },
];

const guestOptions = [
  { value: '1', label: '1 Guest' },
  { value: '2', label: '2 Guests' },
  { value: '3', label: '3 Guests' },
  { value: '4', label: '4 Guests' },
  { value: '5', label: '5 Guests' },
  { value: '6', label: '6 Guests' },
];

const roomOptions = [
  { value: '1', label: '1 Room' },
  { value: '2', label: '2 Rooms' },
  { value: '3', label: '3 Rooms' },
];

const travellerOptions = [
  { value: '1', label: '1 Traveller' },
  { value: '2', label: '2 Travellers' },
  { value: '3', label: '3 Travellers' },
  { value: '4', label: '4 Travellers' },
  { value: '5', label: '5 Travellers' },
];

interface BookingSearchProps {
  defaultTab?: SearchTab;
}

export function BookingSearch({ defaultTab = 'flights' }: BookingSearchProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SearchTab>(defaultTab);
  const [isLoading, setIsLoading] = useState(false);

  const [flightData, setFlightData] = useState<FlightSearchParams>(() => {
    const today = new Date().toISOString().split('T')[0];
    return {
      ...defaultSearchParams.flights,
      departureDate: defaultSearchParams.flights.departureDate || today,
    };
  });

  const [hotelData, setHotelData] = useState<HotelSearchParams>(() => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const format = (d: Date) => d.toISOString().split('T')[0];
    return {
      ...defaultSearchParams.hotels,
      checkIn: defaultSearchParams.hotels.checkIn || format(today),
      checkOut: defaultSearchParams.hotels.checkOut || format(tomorrow),
    };
  });

  const [packageData, setPackageData] = useState<PackageSearchParams>(() => {
    const today = new Date().toISOString().split('T')[0];
    return {
      ...defaultSearchParams.packages,
      travelDate: defaultSearchParams.packages.travelDate || today,
    };
  });

  const [visaData, setVisaData] = useState<VisaSearchParams>(defaultSearchParams.visa);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleSearch = () => {
    setIsLoading(true);

    if (activeTab === 'flights') {
      const from = flightData.from || 'DAC';
      const to = flightData.to || 'KUL';
      const depart = flightData.departureDate || new Date().toISOString().split('T')[0];
      const cabin = flightData.class || 'economy';
      const adults = flightData.passengers || 1;
      router.push(
        `/flights/results?from=${encodeURIComponent(from)}&to=${encodeURIComponent(
          to
        )}&depart=${encodeURIComponent(depart)}&cabin=${cabin}&adults=${adults}&tripType=oneWay`
      );
    } else if (activeTab === 'hotels') {
      const destination = hotelData.destination || 'Bangkok';
      const checkIn = hotelData.checkIn || new Date().toISOString().split('T')[0];
      const checkOut = hotelData.checkOut || '';
      router.push(
        `/hotels/results?destination=${encodeURIComponent(
          destination
        )}&checkIn=${encodeURIComponent(checkIn)}&checkOut=${encodeURIComponent(
          checkOut
        )}&guests=${hotelData.guests || 2}&rooms=${hotelData.rooms || 1}`
      );
    } else if (activeTab === 'packages') {
      router.push('/packages');
    } else if (activeTab === 'visa') {
      router.push('/visa-info');
    }

    setIsLoading(false);
  };

  const swapAirports = () => {
    setFlightData((prev) => ({ ...prev, from: prev.to, to: prev.from }));
  };

  const renderFlightForm = () => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
      <AirportCombobox
        label="From"
        value={flightData.from}
        onChange={(code) => setFlightData((prev) => ({ ...prev, from: code }))}
        placeholder="DAC - Dhaka"
        id="flight-from"
      />
      <div className="flex items-center justify-center md:justify-start">
        <button
          type="button"
          onClick={swapAirports}
          className="p-2.5 rounded-xs bg-neutral-100 hover:bg-neutral-200 text-text-tertiary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer"
          aria-label="Swap origin and destination"
        >
          <Icon name="swapHorizontal" size={20} />
        </button>
      </div>
      <AirportCombobox
        label="To"
        value={flightData.to}
        onChange={(code) => setFlightData((prev) => ({ ...prev, to: code }))}
        placeholder="KUL - Kuala Lumpur"
        id="flight-to"
      />
      <div className="md:col-span-2 grid grid-cols-2 gap-4">
        <Input
          label="Departure"
          type="date"
          value={flightData.departureDate}
          onChange={(e) => setFlightData((prev) => ({ ...prev, departureDate: e.target.value }))}
          min={new Date().toISOString().split('T')[0]}
          id="flight-departure"
          className="rounded-xs"
        />
        <Select
          label="Passengers & Class"
          className="rounded-xs"
          value={`${flightData.passengers},${flightData.class}`}
          onChange={(e) => {
            const [passengers, cls] = e.target.value.split(',');
            setFlightData((prev) => ({
              ...prev,
              passengers: parseInt(passengers, 10),
              class: cls as FlightSearchParams['class'],
            }));
          }}
          options={[
            ...passengerOptions.flatMap((p) =>
              classOptions.map((c) => ({
                value: `${p.value},${c.value}`,
                label: `${p.label}, ${c.label}`,
              }))
            ),
          ]}
          id="flight-passengers-class"
        />
      </div>
    </div>
  );

  const renderHotelForm = () => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
      <Input
        label="Destination"
        className="rounded-xs"
        value={hotelData.destination}
        onChange={(e) => setHotelData((prev) => ({ ...prev, destination: e.target.value }))}
        placeholder="e.g., Bangkok"
        id="hotel-destination"
      />
      <Input
        label="Check-in"
        className="rounded-xs"
        type="date"
        value={hotelData.checkIn}
        onChange={(e) => setHotelData((prev) => ({ ...prev, checkIn: e.target.value }))}
        min={new Date().toISOString().split('T')[0]}
        id="hotel-checkin"
      />
      <Input
        label="Check-out"
        className="rounded-xs"
        type="date"
        value={hotelData.checkOut}
        onChange={(e) => setHotelData((prev) => ({ ...prev, checkOut: e.target.value }))}
        min={hotelData.checkIn || new Date().toISOString().split('T')[0]}
        id="hotel-checkout"
      />
      <div className="md:col-span-1 grid grid-cols-2 gap-4">
        <Select
          label="Guests"
          className="rounded-xs"
          value={hotelData.guests.toString()}
          onChange={(e) =>
            setHotelData((prev) => ({ ...prev, guests: parseInt(e.target.value, 10) }))
          }
          options={guestOptions}
          id="hotel-guests"
        />
        <Select
          label="Rooms"
          className="rounded-xs"
          value={hotelData.rooms.toString()}
          onChange={(e) =>
            setHotelData((prev) => ({ ...prev, rooms: parseInt(e.target.value, 10) }))
          }
          options={roomOptions}
          id="hotel-rooms"
        />
      </div>
    </div>
  );

  const renderPackageForm = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
      <Input
        label="Destination"
        className="rounded-xs"
        value={packageData.destination}
        onChange={(e) => setPackageData((prev) => ({ ...prev, destination: e.target.value }))}
        placeholder="e.g., Maldives"
        id="package-destination"
      />
      <Input
        label="Travel Date"
        className="rounded-xs"
        type="date"
        value={packageData.travelDate}
        onChange={(e) => setPackageData((prev) => ({ ...prev, travelDate: e.target.value }))}
        min={new Date().toISOString().split('T')[0]}
        id="package-travel-date"
      />
      <Select
        label="Travellers"
        className="rounded-xs"
        value={packageData.travellers.toString()}
        onChange={(e) =>
          setPackageData((prev) => ({ ...prev, travellers: parseInt(e.target.value, 10) }))
        }
        options={travellerOptions}
        id="package-travellers"
      />
    </div>
  );

  const renderVisaForm = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
      <Input
        className="rounded-xs"
        label="Destination Country"
        value={visaData.destination}
        onChange={(e) => setVisaData((prev) => ({ ...prev, destination: e.target.value }))}
        placeholder="e.g., Thailand"
        id="visa-destination"
      />
      <Input
        className="rounded-xs"
        label="Your Nationality"
        value={visaData.nationality}
        onChange={(e) => setVisaData((prev) => ({ ...prev, nationality: e.target.value }))}
        placeholder="e.g., Bangladeshi"
        id="visa-nationality"
      />
    </div>
  );

  return (
    <div
      ref={cardRef}
      className="relative -mt-10 z-10 container mx-auto px-4"
      role="search"
      aria-label="Travel booking search"
    >
      <Card variant="elevated" padding="lg" className="rounded-xs shadow-lg">
        <div className="border-b border-neutral-200 mb-6">
          <nav
            aria-label="Search type"
            className="flex overflow-x-auto gap-1 pb-1 -mb-1"
            role="tablist"
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`panel-${tab.id}`}
                id={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-xs transition-all duration-150 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-brand-primary text-white shadow-xs'
                    : 'text-text-secondary hover:text-text-primary hover:bg-neutral-100'
                }`}
              >
                <Icon name={tab.icon} size={18} />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
          {activeTab === 'flights' && renderFlightForm()}
          {activeTab === 'hotels' && renderHotelForm()}
          {activeTab === 'packages' && renderPackageForm()}
          {activeTab === 'visa' && renderVisaForm()}

          <div className="mt-6 pt-6 border-t border-neutral-200">
            <Button
              variant="primary"
              size="md"
              onClick={handleSearch}
              loading={isLoading}
              className="w-full sm:w-auto rounded-xs font-bold"
            >
              <Icon name="search" size={20} />
              {activeTab === 'flights' && 'Search Flights'}
              {activeTab === 'hotels' && 'Search Hotels'}
              {activeTab === 'packages' && 'Explore Packages'}
              {activeTab === 'visa' && 'Check Visa Info'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
