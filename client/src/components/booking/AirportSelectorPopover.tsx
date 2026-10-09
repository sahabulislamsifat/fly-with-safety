'use client';

import { useState, useEffect, useRef, useId, useMemo } from 'react';
import { Airport, searchAirports } from '@/lib/api/flights';
import { allAirports } from '@/lib/data/site-data';
import { Icon } from '@/components/ui/Icons';

interface AirportSelectorPopoverProps {
  label: string;
  code: string;
  onChange: (code: string, airport?: Airport) => void;
  disabledCode?: string; // e.g. prevent picking same code as other field
  id?: string;
  error?: string;
}

export function AirportSelectorPopover({
  label,
  code,
  onChange,
  disabledCode,
  id,
  error,
}: AirportSelectorPopoverProps) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [liveAirports, setLiveAirports] = useState<Airport[]>(allAirports);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // Find currently selected airport object
  const currentAirport = useMemo(() => {
    return (
      allAirports.find((a) => a.code.toUpperCase() === code?.toUpperCase()) || {
        code: code || 'DAC',
        city: code === 'DAC' ? 'Dhaka' : code === 'CXB' ? "Cox's Bazar" : code === 'DXB' ? 'Dubai' : code,
        name: 'International Airport',
        country: 'Travel Hub',
      }
    );
  }, [code]);

  // Search logic: try API with local fallback
  useEffect(() => {
    if (!isOpen) return;

    const query = searchQuery.trim().toLowerCase();
    if (!query) return;

    let active = true;
    const timer = setTimeout(async () => {
      try {
        const res = await searchAirports(query);
        if (active && res.airports && res.airports.length > 0) {
          setLiveAirports(res.airports);
          return;
        }
      } catch {
        // Fallback to local filter
      }

      if (active) {
        const filtered = allAirports.filter(
          (a) =>
            a.code.toLowerCase().includes(query) ||
            a.city.toLowerCase().includes(query) ||
            a.name.toLowerCase().includes(query) ||
            a.country.toLowerCase().includes(query)
        );
        setLiveAirports(filtered);
      }
    }, 150);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery, isOpen]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayAirports = searchQuery.trim() ? liveAirports : allAirports;

  // Keyboard navigation inside popover
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % Math.max(displayAirports.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + displayAirports.length) % Math.max(displayAirports.length, 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = displayAirports[highlightedIndex];
      if (selected && selected.code !== disabledCode) {
        handleSelectAirport(selected);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleSelectAirport = (airport: Airport) => {
    if (airport.code === disabledCode) return;
    onChange(airport.code, airport);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleOpen = () => {
    setIsOpen(true);
    setSearchQuery('');
    setHighlightedIndex(0);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  return (
    <div ref={popoverRef} className="relative w-full">
      {/* Trigger Field Card */}
      <div
        id={inputId}
        role="button"
        tabIndex={0}
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`group relative text-left p-3 sm:p-3.5 bg-white rounded-xs border transition-all cursor-pointer select-none ${
          error
            ? 'border-red-400 ring-1 ring-red-400'
            : isOpen
            ? 'border-[#8B1D24] ring-2 ring-red-100 shadow-sm'
            : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50/50'
        }`}
      >
        <span className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-0.5">
          {label}
        </span>
        <div className="flex items-baseline justify-between gap-1">
          <span className="text-lg sm:text-xl font-black text-neutral-900 truncate leading-tight group-hover:text-black">
            {currentAirport.city}
          </span>
          <span className="text-xs font-mono font-bold text-neutral-400 uppercase">
            {currentAirport.code}
          </span>
        </div>
        <p className="text-xs text-neutral-500 truncate mt-0.5" title={currentAirport.name}>
          {currentAirport.code} · {currentAirport.name}
        </p>
      </div>

      {/* Dropdown Popover - rounded-xs */}
      {isOpen && (
        <div
          role="listbox"
          aria-label={`Select ${label} airport`}
          className="absolute left-0 top-full mt-2 z-50 w-full min-w-[320px] sm:min-w-[360px] bg-white rounded-xs border border-neutral-200/90 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
        >
          {/* Popover Header with Search Input */}
          <div className="p-3 border-b border-neutral-100 bg-neutral-50/80">
            <div className="relative">
              <Icon
                name="search"
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setHighlightedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Search city, airport or code..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-neutral-200 rounded-xs text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#8B1D24] focus:border-[#8B1D24]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-0.5 rounded-xs"
                >
                  <Icon name="x" size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Airport List */}
          <div className="max-h-64 sm:max-h-72 overflow-y-auto py-1 divide-y divide-neutral-50">
            {displayAirports.length === 0 ? (
              <div className="p-6 text-center text-xs text-neutral-400">
                No airports found matching &ldquo;{searchQuery}&rdquo;
              </div>
            ) : (
              displayAirports.map((airport, idx) => {
                const isSelected = airport.code === code;
                const isDisabled = airport.code === disabledCode;
                const isHighlighted = idx === highlightedIndex;

                return (
                  <div
                    key={airport.code}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={isDisabled}
                    onClick={() => !isDisabled && handleSelectAirport(airport)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`px-3.5 py-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                      isDisabled
                        ? 'opacity-40 cursor-not-allowed bg-neutral-50'
                        : isSelected
                        ? 'bg-red-50 text-[#8B1D24]'
                        : isHighlighted
                        ? 'bg-neutral-50'
                        : 'hover:bg-neutral-50/80 text-neutral-900'
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-neutral-900 truncate">
                          {airport.city}
                        </span>
                        {airport.country && (
                          <span className="text-[11px] text-neutral-400 truncate">
                            · {airport.country}
                          </span>
                        )}
                        {airport.isPopular && (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-xs bg-neutral-100 text-neutral-600">
                            Popular
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-500 truncate mt-0.5">{airport.name}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono font-black px-2 py-1 rounded-xs bg-neutral-100 text-neutral-800 border border-neutral-200/60">
                        {airport.code}
                      </span>
                      {isSelected && (
                        <Icon name="check" size={16} className="text-[#8B1D24]" />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {error && <p className="mt-1 text-[11px] font-medium text-red-500">{error}</p>}
    </div>
  );
}
