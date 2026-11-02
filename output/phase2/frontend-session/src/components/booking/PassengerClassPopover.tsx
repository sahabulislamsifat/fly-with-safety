'use client';

import { useState, useRef, useEffect } from 'react';
import { Icon } from '@/components/ui/Icons';

export type CabinClass = 'economy' | 'premiumEconomy' | 'business' | 'first';

export interface PassengerCounts {
  adults: number;
  children: number;
  infants: number;
}

interface PassengerClassPopoverProps {
  passengers: PassengerCounts;
  cabinClass: CabinClass;
  onChange: (passengers: PassengerCounts, cabinClass: CabinClass) => void;
  id?: string;
}

const cabinOptions: { id: CabinClass; label: string }[] = [
  { id: 'economy', label: 'Economy' },
  { id: 'premiumEconomy', label: 'Premium Economy' },
  { id: 'business', label: 'Business' },
  { id: 'first', label: 'First Class' },
];

export function PassengerClassPopover({
  passengers,
  cabinClass,
  onChange,
  id = 'passenger-class-picker',
}: PassengerClassPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && containerRef.current?.querySelector('[role="dialog"]')) {
        setIsOpen(false);
        containerRef.current.querySelector<HTMLElement>('[aria-haspopup]')?.focus();
      }
    }
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const totalPassengers = passengers.adults + passengers.children + passengers.infants;

  const handleUpdateCount = (field: keyof PassengerCounts, delta: number) => {
    const current = passengers[field];
    const updated = Math.max(field === 'adults' ? 1 : 0, current + delta);
    // Limit total to 9
    if (delta > 0 && totalPassengers >= 9) return;
    onChange({ ...passengers, [field]: updated, infants: field === 'adults' ? Math.min(passengers.infants, updated) : field === 'infants' ? Math.min(updated, passengers.adults) : passengers.infants }, cabinClass);
  };

  const handleCabinChange = (newCabin: CabinClass) => {
    onChange(passengers, newCabin);
  };

  const cabinLabel =
    cabinOptions.find((c) => c.id === cabinClass)?.label || 'Economy';

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger Field Card */}
      <div
        id={id}
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen((prev) => !prev);
          } else if (e.key === 'Escape') {
            setIsOpen(false);
          }
        }}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={`group text-left p-3 sm:p-3.5 bg-white rounded-xs border transition-all cursor-pointer select-none ${
          isOpen
            ? 'border-[#8B1D24] ring-2 ring-red-100 shadow-sm'
            : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50/50'
        }`}
      >
        <span className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-0.5">
          PASSENGER &amp; CLASS
        </span>
        <div className="flex items-baseline justify-between gap-1">
          <span className="text-lg sm:text-xl font-black text-neutral-900 leading-tight">
            {totalPassengers} {totalPassengers === 1 ? 'Passenger' : 'Passengers'}
          </span>
        </div>
        <p className="text-xs text-neutral-500 truncate mt-0.5">{cabinLabel}</p>
      </div>

      {/* Popover Card - rounded-xs */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Select passengers and cabin class"
          className="absolute right-0 top-full mt-2 z-50 w-full sm:min-w-[340px] max-w-[calc(100vw-2rem)] bg-white rounded-xs border border-neutral-200/90 shadow-2xl p-3 sm:p-5 animate-in fade-in slide-in-from-top-2 duration-150"
        >
          {/* Passenger Types */}
          <div className="space-y-4 pb-4 border-b border-neutral-100">
            {/* Adults */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-neutral-900">Adults</p>
                <p className="text-xs text-neutral-400">12 years and above</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleUpdateCount('adults', -1)}
                  disabled={passengers.adults <= 1}
                  className="w-8 h-8 rounded-xs border border-neutral-200 text-neutral-700 hover:border-[#8B1D24] hover:text-[#8B1D24] flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  aria-label="Decrease adult passengers"
                >
                  <Icon name="minus" size={14} />
                </button>
                <span className="w-5 text-center font-bold text-sm text-neutral-900">
                  {passengers.adults}
                </span>
                <button
                  type="button"
                  onClick={() => handleUpdateCount('adults', 1)}
                  disabled={totalPassengers >= 9}
                  className="w-8 h-8 rounded-xs border border-neutral-200 text-neutral-700 hover:border-[#8B1D24] hover:text-[#8B1D24] flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  aria-label="Increase adult passengers"
                >
                  <Icon name="plus" size={14} />
                </button>
              </div>
            </div>

            {/* Children */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-neutral-900">Children</p>
                <p className="text-xs text-neutral-400">2 - 11 years</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleUpdateCount('children', -1)}
                  disabled={passengers.children <= 0}
                  className="w-8 h-8 rounded-xs border border-neutral-200 text-neutral-700 hover:border-[#8B1D24] hover:text-[#8B1D24] flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  aria-label="Decrease child passengers"
                >
                  <Icon name="minus" size={14} />
                </button>
                <span className="w-5 text-center font-bold text-sm text-neutral-900">
                  {passengers.children}
                </span>
                <button
                  type="button"
                  onClick={() => handleUpdateCount('children', 1)}
                  disabled={totalPassengers >= 9}
                  className="w-8 h-8 rounded-xs border border-neutral-200 text-neutral-700 hover:border-[#8B1D24] hover:text-[#8B1D24] flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  aria-label="Increase child passengers"
                >
                  <Icon name="plus" size={14} />
                </button>
              </div>
            </div>

            {/* Infants */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-neutral-900">Infants</p>
                <p className="text-xs text-neutral-400">Under 2 years</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleUpdateCount('infants', -1)}
                  disabled={passengers.infants <= 0}
                  className="w-8 h-8 rounded-xs border border-neutral-200 text-neutral-700 hover:border-[#8B1D24] hover:text-[#8B1D24] flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  aria-label="Decrease infant passengers"
                >
                  <Icon name="minus" size={14} />
                </button>
                <span className="w-5 text-center font-bold text-sm text-neutral-900">
                  {passengers.infants}
                </span>
                <button
                  type="button"
                  onClick={() => handleUpdateCount('infants', 1)}
                  disabled={passengers.infants >= passengers.adults || totalPassengers >= 9}
                  className="w-8 h-8 rounded-xs border border-neutral-200 text-neutral-700 hover:border-[#8B1D24] hover:text-[#8B1D24] flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  aria-label="Increase infant passengers"
                >
                  <Icon name="plus" size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Cabin Class Selection */}
          <div className="pt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2.5">
              Cabin Class
            </p>
            <div className="grid grid-cols-2 gap-2">
              {cabinOptions.map((opt) => {
                const isSelected = cabinClass === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleCabinChange(opt.id)}
                    className={`py-2 px-3 text-xs font-semibold rounded-xs border transition-all text-left ${
                      isSelected
                        ? 'border-[#8B1D24] bg-red-50 text-[#8B1D24] font-bold shadow-2xs'
                        : 'border-neutral-200 text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Done CTA */}
          <div className="mt-5 pt-3 border-t border-neutral-100 flex justify-end">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-5 py-2 rounded-xs bg-[#8B1D24] hover:bg-[#74181E] text-white text-xs font-bold transition-colors shadow-xs"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
