'use client';

import { useState, useRef, useEffect } from 'react';
import { SearchTab, FlightSearchParams, HotelSearchParams, PackageSearchParams, VisaSearchParams } from '@/types';
import { Button, Input, Select, Card } from '@/components/ui';
import { Icon } from '@/components/ui/Icons';
import { defaultSearchParams } from '@/lib/data/site-data';

const tabs: { id: SearchTab; label: string; icon: string }[] = [
  { id: 'flights', label: 'Flights', icon: 'plane' },
  { id: 'hotels', label: 'Hotels', icon: 'hotel' },
  { id: 'packages', label: 'Packages', icon: 'package' },
  { id: 'visa', label: 'Visa Info', icon: 'fileText' },
];

const popularAirports = [
  { code: 'DAC', label: 'DAC - Dhaka' },
  { code: 'KUL', label: 'KUL - Kuala Lumpur' },
  { code: 'BKK', label: 'BKK - Bangkok' },
  { code: 'SIN', label: 'SIN - Singapore' },
  { code: 'DXB', label: 'DXB - Dubai' },
  { code: 'JED', label: 'JED - Jeddah' },
  { code: 'LHR', label: 'LHR - London' },
  { code: 'SYD', label: 'SYD - Sydney' },
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
  const [activeTab, setActiveTab] = useState<SearchTab>(defaultTab);
  const [isLoading, setIsLoading] = useState(false);
  const [flightData, setFlightData] = useState<FlightSearchParams>(defaultSearchParams.flights);
  const [hotelData, setHotelData] = useState<HotelSearchParams>(defaultSearchParams.hotels);
  const [packageData, setPackageData] = useState<PackageSearchParams>(defaultSearchParams.packages);
  const [visaData, setVisaData] = useState<VisaSearchParams>(defaultSearchParams.visa);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const format = (d: Date) => d.toISOString().split('T')[0];
    const formatDisplay = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

    if (!flightData.departureDate) {
      setFlightData((prev) => ({ ...prev, departureDate: format(today) }));
    }
    if (!hotelData.checkIn) {
      setHotelData((prev) => ({ ...prev, checkIn: format(today), checkOut: format(tomorrow) }));
    }
    if (!packageData.travelDate) {
      setPackageData((prev) => ({ ...prev, travelDate: format(today) }));
    }
  }, []);

  const handleSearch = async () => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsLoading(false);

    if (cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const swapAirports = () => {
    setFlightData((prev) => ({ ...prev, from: prev.to, to: prev.from }));
  };

  const renderFlightForm = () => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
      <Input
        label="From"
        value={flightData.from}
        onChange={(e) => setFlightData((prev) => ({ ...prev, from: e.target.value.toUpperCase() }))}
        placeholder="DAC"
        id="flight-from"
      />
      <div className="flex items-center justify-center md:justify-start">
        <button
          type="button"
          onClick={swapAirports}
          className="p-2 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-text-tertiary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          aria-label="Swap origin and destination"
        >
          <Icon name="swapHorizontal" size={20} />
        </button>
      </div>
      <Input
        label="To"
        value={flightData.to}
        onChange={(e) => setFlightData((prev) => ({ ...prev, to: e.target.value.toUpperCase() }))}
        placeholder="KUL"
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
        />
        <Select
          label="Passengers & Class"
          value={`${flightData.passengers},${flightData.class}`}
          onChange={(e) => {
            const [passengers, cls] = e.target.value.split(',');
            setFlightData((prev) => ({ ...prev, passengers: parseInt(passengers), class: cls as FlightSearchParams['class'] }));
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
        value={hotelData.destination}
        onChange={(e) => setHotelData((prev) => ({ ...prev, destination: e.target.value }))}
        placeholder="e.g., Bangkok"
        id="hotel-destination"
      />
      <Input
        label="Check-in"
        type="date"
        value={hotelData.checkIn}
        onChange={(e) => setHotelData((prev) => ({ ...prev, checkIn: e.target.value }))}
        min={new Date().toISOString().split('T')[0]}
        id="hotel-checkin"
      />
      <Input
        label="Check-out"
        type="date"
        value={hotelData.checkOut}
        onChange={(e) => setHotelData((prev) => ({ ...prev, checkOut: e.target.value }))}
        min={hotelData.checkIn || new Date().toISOString().split('T')[0]}
        id="hotel-checkout"
      />
      <div className="md:col-span-1 grid grid-cols-2 gap-4">
        <Select
          label="Guests"
          value={hotelData.guests.toString()}
          onChange={(e) => setHotelData((prev) => ({ ...prev, guests: parseInt(e.target.value) }))}
          options={guestOptions}
          id="hotel-guests"
        />
        <Select
          label="Rooms"
          value={hotelData.rooms.toString()}
          onChange={(e) => setHotelData((prev) => ({ ...prev, rooms: parseInt(e.target.value) }))}
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
        value={packageData.destination}
        onChange={(e) => setPackageData((prev) => ({ ...prev, destination: e.target.value }))}
        placeholder="e.g., Maldives"
        id="package-destination"
      />
      <Input
        label="Travel Date"
        type="date"
        value={packageData.travelDate}
        onChange={(e) => setPackageData((prev) => ({ ...prev, travelDate: e.target.value }))}
        min={new Date().toISOString().split('T')[0]}
        id="package-travel-date"
      />
      <Select
        label="Travellers"
        value={packageData.travellers.toString()}
        onChange={(e) => setPackageData((prev) => ({ ...prev, travellers: parseInt(e.target.value) }))}
        options={travellerOptions}
        id="package-travellers"
      />
    </div>
  );

  const renderVisaForm = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
      <Input
        label="Destination Country"
        value={visaData.destination}
        onChange={(e) => setVisaData((prev) => ({ ...prev, destination: e.target.value }))}
        placeholder="e.g., Thailand"
        id="visa-destination"
      />
      <Input
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
      className="relative -mt-10 z-[100] container"
      role="search"
      aria-label="Travel booking search"
    >
      <Card variant="elevated" padding="lg" className="rounded-2xl">
        <div className="border-b border-border-light mb-6">
          <nav aria-label="Search type" className="flex overflow-x-auto gap-1 pb-1 -mb-1" role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`panel-${tab.id}`}
                id={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-lg transition-all duration-150 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 ${
                  activeTab === tab.id
                    ? 'bg-brand-primary text-white shadow-sm'
                    : 'text-text-secondary hover:text-text-primary hover:bg-neutral-100'
                }`}
              >
                <Icon name={tab.icon as any} size={18} />
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

          <div className="mt-6 pt-6 border-t border-border-light">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleSearch}
              loading={isLoading}
              className="w-full sm:w-auto"
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